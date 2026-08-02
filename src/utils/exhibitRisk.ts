import type {
  Card,
  CardReviewStats,
  DailyPlanItem,
  ExhibitRiskLevel,
  ExhibitRiskReason,
  ExhibitRiskSnapshot,
  ExhibitRiskSource,
  PracticeRecord
} from '../types';
import { EXHIBIT_RISK_LEVEL_ORDER } from '../types';

const LONG_INACTIVE_DAYS = 14;
const MODERATE_INACTIVE_DAYS = 7;
const DURATION_DEVIATION_MIN = 15;
const DURATION_DEVIATION_RATIO = 0.3;

export interface ExhibitRiskEvaluation {
  riskLevel: ExhibitRiskLevel;
  riskReasons: ExhibitRiskReason[];
  recommendedAction: string;
}

export interface ExhibitRiskFilterCriteria {
  includeResolved?: boolean;
  level?: ExhibitRiskLevel;
  cardId?: string;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function evaluateExhibitRisk(
  card: Card,
  stats: CardReviewStats,
  planItem?: DailyPlanItem | null
): ExhibitRiskEvaluation {
  const reasons: ExhibitRiskReason[] = [];
  let score = 0;

  if (!stats.isStable) {
    reasons.push('unstable');
    score += 2;
  }

  const inactiveDays = daysSince(stats.lastPracticeDate);
  if (inactiveDays >= LONG_INACTIVE_DAYS) {
    reasons.push('long_inactive');
    score += 2;
  } else if (inactiveDays >= MODERATE_INACTIVE_DAYS) {
    score += 1;
  }

  if (card.status === 'need_help') {
    reasons.push('need_help');
    score += 2;
  }

  if (card.starred && !card.reviewNotes.trim()) {
    reasons.push('starred_no_notes');
    score += 2;
  }

  if (planItem) {
    if (planItem.status === 'skipped') {
      reasons.push('plan_postponed');
      score += 2;
    } else if (planItem.status === 'pending' || planItem.status === 'in_progress') {
      reasons.push('plan_incomplete');
      score += 1;
    }
  }

  let riskLevel: ExhibitRiskLevel;
  if (score >= 6) {
    riskLevel = 'critical';
  } else if (score >= 4) {
    riskLevel = 'high';
  } else if (score >= 2) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    riskLevel,
    riskReasons: reasons,
    recommendedAction: buildRecommendedAction(reasons)
  };
}

function buildRecommendedAction(reasons: ExhibitRiskReason[]): string {
  if (reasons.length === 0) return '保持当前排练节奏，展前再复核一次';

  const actions: string[] = [];

  if (reasons.includes('unstable')) {
    actions.push('安排至少 1 次完整试作以确认工艺稳定性');
  }
  if (reasons.includes('long_inactive')) {
    actions.push('尽快补做试作，恢复手感与节奏');
  }
  if (reasons.includes('need_help')) {
    actions.push('请资深馆员现场讲解并记录要点');
  }
  if (reasons.includes('starred_no_notes')) {
    actions.push('补充重点展品的讲解提示卡');
  }
  if (reasons.includes('plan_postponed')) {
    actions.push('将暂缓项目重新排入下一演示序列');
  }
  if (reasons.includes('plan_incomplete')) {
    actions.push('今日演示结束前完成未竟项或明确顺延');
  }

  return actions.join('；');
}

export function buildExhibitRiskSnapshot(
  card: Card,
  stats: CardReviewStats,
  source: ExhibitRiskSource,
  planItem?: DailyPlanItem | null,
  snapshotDate?: string
): Omit<ExhibitRiskSnapshot, 'id' | 'createdAt' | 'updatedAt'> {
  const evaluation = evaluateExhibitRisk(card, stats, planItem);
  const date = snapshotDate || new Date().toISOString().slice(0, 10);

  return {
    cardId: card.id,
    snapshotDate: date,
    riskLevel: evaluation.riskLevel,
    riskReasons: evaluation.riskReasons,
    recommendedAction: evaluation.recommendedAction,
    source,
    resolved: false
  };
}

export function sortExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[]
): ExhibitRiskSnapshot[] {
  return [...snapshots].sort((a, b) => {
    const levelDiff = EXHIBIT_RISK_LEVEL_ORDER[a.riskLevel] - EXHIBIT_RISK_LEVEL_ORDER[b.riskLevel];
    if (levelDiff !== 0) return levelDiff;

    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;

    return b.snapshotDate.localeCompare(a.snapshotDate);
  });
}

export function filterExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[],
  criteria: ExhibitRiskFilterCriteria
): ExhibitRiskSnapshot[] {
  const level = criteria.level;
  const includeResolved = criteria.includeResolved ?? false;
  const cardId = criteria.cardId;

  const criticalPinned: ExhibitRiskSnapshot[] = [];
  const rest: ExhibitRiskSnapshot[] = [];

  for (const snapshot of snapshots) {
    if (cardId && snapshot.cardId !== cardId) continue;

    const isCriticalUnresolved = snapshot.riskLevel === 'critical' && !snapshot.resolved;

    if (isCriticalUnresolved) {
      criticalPinned.push(snapshot);
      continue;
    }

    if (!includeResolved && snapshot.resolved) continue;
    if (level && snapshot.riskLevel !== level) continue;

    rest.push(snapshot);
  }

  return sortExhibitRiskSnapshots([...criticalPinned, ...rest]);
}

export function getLatestSnapshotPerCard(
  snapshots: ExhibitRiskSnapshot[]
): Map<string, ExhibitRiskSnapshot> {
  const map = new Map<string, ExhibitRiskSnapshot>();
  for (const snapshot of snapshots) {
    const existing = map.get(snapshot.cardId);
    if (
      !existing ||
      snapshot.snapshotDate > existing.snapshotDate ||
      (snapshot.snapshotDate === existing.snapshotDate &&
        snapshot.updatedAt > existing.updatedAt)
    ) {
      map.set(snapshot.cardId, snapshot);
    }
  }
  return map;
}

export function getRouteRiskPriority(
  snapshot: ExhibitRiskSnapshot | undefined
): number {
  if (!snapshot || snapshot.resolved) return 2;
  if (snapshot.riskLevel === 'critical') return 0;
  if (snapshot.riskLevel === 'high') return 1;
  return 2;
}

export interface DurationDeviation {
  deltaMin: number;
  ratio: number;
  isOvertime: boolean;
  hasDeviation: boolean;
}

export function measureDurationDeviation(
  actualMin: number,
  estimatedMin: number
): DurationDeviation {
  const deltaMin = actualMin - estimatedMin;
  const ratio = estimatedMin > 0 ? Math.abs(deltaMin) / estimatedMin : 0;
  const hasDeviation =
    Math.abs(deltaMin) >= DURATION_DEVIATION_MIN || ratio >= DURATION_DEVIATION_RATIO;
  return {
    deltaMin,
    ratio,
    isOvertime: deltaMin > 0,
    hasDeviation
  };
}

export function evaluateReviewRisk(
  card: Card,
  stats: CardReviewStats,
  record: PracticeRecord
): ExhibitRiskEvaluation {
  const reasons: ExhibitRiskReason[] = [];
  let score = 0;

  if (record.result === 'failed') {
    score += 4;
  } else if (record.result === 'partial') {
    score += 2;
  }

  const hasProblems = !!record.problems && record.problems.trim().length > 0;
  if (hasProblems) {
    reasons.push('review_problems');
    score += 1;
  }

  const deviation = measureDurationDeviation(record.durationMin, card.durationMin);
  if (deviation.hasDeviation) {
    reasons.push('duration_deviation');
    score += deviation.isOvertime ? 2 : 1;
  }

  if (!stats.isStable) {
    reasons.push('unstable');
    score += 1;
  }

  let riskLevel: ExhibitRiskLevel;
  if (score >= 6) {
    riskLevel = 'critical';
  } else if (score >= 4) {
    riskLevel = 'high';
  } else if (score >= 2) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    riskLevel,
    riskReasons: reasons,
    recommendedAction: buildReviewRecommendedAction(record, card, reasons, deviation)
  };
}

function buildReviewRecommendedAction(
  record: PracticeRecord,
  card: Card,
  reasons: ExhibitRiskReason[],
  deviation: DurationDeviation
): string {
  const actions: string[] = [];

  if (record.result === 'failed') {
    actions.push('安排返工并由资深馆员现场指导');
  } else if (record.result === 'partial') {
    actions.push('针对未确认环节补做一次试作');
  }

  if (reasons.includes('review_problems') && record.problems.trim()) {
    const summary = record.problems.trim().slice(0, 40);
    actions.push(`问题摘要：${summary}${record.problems.length > 40 ? '…' : ''}`);
  }

  if (reasons.includes('duration_deviation')) {
    const diff = Math.abs(deviation.deltaMin);
    const direction = deviation.isOvertime ? '超出' : '短于';
    actions.push(
      `实际工时${direction}预计 ${diff} 分钟（预计 ${card.durationMin} / 实际 ${record.durationMin}）`
    );
  }

  if (reasons.includes('unstable')) {
    actions.push('累计确认未达稳定阈值，继续排练');
  }

  if (actions.length === 0) {
    actions.push('保持当前排练节奏，展前再复核一次');
  }

  return actions.join('；');
}

export function findUnresolvedReviewSnapshot(
  snapshots: ExhibitRiskSnapshot[],
  cardId: string
): ExhibitRiskSnapshot | undefined {
  return snapshots.find(
    (s) => s.cardId === cardId && s.source === 'review' && !s.resolved
  );
}
