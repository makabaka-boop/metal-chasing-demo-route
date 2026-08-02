import type {
  Card,
  CardReviewStats,
  DailyPlanItemStatus,
  ExhibitRiskLevel,
  ExhibitRiskSnapshot,
  ExhibitRiskSource,
  ReviewResult
} from '../types';
import { EXHIBIT_RISK_LEVEL_ORDER, REVIEW_RESULT_LABELS, STABILITY_THRESHOLD } from '../types';

export const EXHIBIT_RISK_STALE_DAYS_WARNING = 7;
export const EXHIBIT_RISK_STALE_DAYS_CRITICAL = 14;

export interface ExhibitRiskReviewEvidence {
  result: ReviewResult;
  problems: string;
  durationMin: number;
}

export interface ExhibitRiskAssessmentInput {
  card: Card;
  stats: CardReviewStats;
  todayPlanItemStatus: DailyPlanItemStatus | null;
  todayPlanSettled: boolean;
  today: string;
  todayReview?: ExhibitRiskReviewEvidence | null;
}

export interface ExhibitRiskAssessment {
  riskLevel: ExhibitRiskLevel;
  riskReasons: string[];
  recommendedAction: string;
  source: ExhibitRiskSource;
}

const EXHIBIT_RISK_ACTIONS: Record<ExhibitRiskLevel, string> = {
  critical: '展前必须完成工艺复核与讲解排练，确认稳定前不要排入演示路线',
  high: '尽快安排一次完整试作复核，并补齐讲解准备',
  medium: '建议近日安排试作巩固，并完善讲解提示',
  low: '保持关注，按日常节奏安排试作即可'
};

function daysBetween(dateStr: string | null, today: string): number {
  if (!dateStr) return 9999;
  const from = new Date(dateStr + 'T00:00:00');
  const to = new Date(today + 'T00:00:00');
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 展品风险快照的唯一计算入口（纯函数）。
 * 风险等级由五类因素共同决定：未稳定、久未试作、需讲解、
 * 重点但无讲解提示、今日计划暂缓或未完成。
 * CSV 导出、工艺复核单、演示路线均读取由它生成的同一份快照，不各自重复计算。
 */
export function assessExhibitRisk(
  input: ExhibitRiskAssessmentInput
): ExhibitRiskAssessment | null {
  const { card, stats, todayPlanItemStatus, todayPlanSettled, today, todayReview } = input;
  const riskReasons: string[] = [];
  let score = 0;

  // 复核证据优先展示：failed / partial 的复核结果直接沉淀为风险原因
  const hasReviewEvidence = !!todayReview && todayReview.result !== 'completed';
  if (todayReview && hasReviewEvidence) {
    const problemsSummary = todayReview.problems.trim() || '未填写问题描述';
    riskReasons.push(`复核${REVIEW_RESULT_LABELS[todayReview.result]}：${problemsSummary}`);
    const deviation = todayReview.durationMin - card.durationMin;
    if (deviation > 0) {
      riskReasons.push(`实际工时 ${todayReview.durationMin} 分钟，超出预计 ${deviation} 分钟`);
    } else if (deviation < 0) {
      riskReasons.push(`实际工时 ${todayReview.durationMin} 分钟，少于预计 ${-deviation} 分钟`);
    } else {
      riskReasons.push(`实际工时与预计一致（${todayReview.durationMin} 分钟）`);
    }
    score += todayReview.result === 'failed' ? 3 : 1;
  }

  if (!stats.isStable) {
    riskReasons.push(`工艺未稳定（累计确认 ${stats.completedCount}/${STABILITY_THRESHOLD} 次）`);
    score += 2;
  }

  const staleDays = daysBetween(stats.lastPracticeDate, today);
  if (staleDays >= EXHIBIT_RISK_STALE_DAYS_CRITICAL) {
    riskReasons.push(stats.lastPracticeDate ? `已 ${staleDays} 天未试作` : '从未试作');
    score += 2;
  } else if (staleDays >= EXHIBIT_RISK_STALE_DAYS_WARNING) {
    riskReasons.push(`已 ${staleDays} 天未试作`);
    score += 1;
  }

  if (card.status === 'need_help') {
    riskReasons.push('当前状态为“需讲解”');
    score += 2;
  }

  if (card.starred && !card.reviewNotes.trim()) {
    riskReasons.push('重点样片缺少讲解提示');
    score += 1;
  }

  const planBlocked =
    todayPlanItemStatus === 'skipped' ||
    (todayPlanSettled && todayPlanItemStatus !== null && todayPlanItemStatus !== 'completed');
  if (planBlocked) {
    riskReasons.push(
      todayPlanItemStatus === 'skipped' ? '今日计划中被暂缓' : '今日计划结束仍未完成'
    );
    score += 2;
  }

  if (riskReasons.length === 0) return null;

  const riskLevel: ExhibitRiskLevel =
    score >= 6 ? 'critical' : score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';

  return {
    riskLevel,
    riskReasons,
    recommendedAction: EXHIBIT_RISK_ACTIONS[riskLevel],
    source: hasReviewEvidence ? 'review' : planBlocked ? 'plan' : 'review'
  };
}

/** 排序：未处理优先，同级内 critical > high > medium > low，再按更新时间倒序。 */
export function sortExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[]
): ExhibitRiskSnapshot[] {
  return [...snapshots].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    const levelDiff =
      EXHIBIT_RISK_LEVEL_ORDER[a.riskLevel] - EXHIBIT_RISK_LEVEL_ORDER[b.riskLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/** 等级筛选：critical 必须优先展示，不能被普通筛选隐藏，因此始终强制保留。 */
export function filterExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[],
  levels?: ExhibitRiskLevel[]
): ExhibitRiskSnapshot[] {
  if (!levels || levels.length === 0) return [...snapshots];
  const keep = new Set<ExhibitRiskLevel>(levels);
  keep.add('critical');
  return snapshots.filter((s) => keep.has(s.riskLevel));
}
