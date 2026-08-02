import type {
  ExhibitRiskSnapshot,
  ExhibitRiskLevel,
  ExhibitRiskReason,
  ExhibitRiskEvaluation,
  ExhibitRiskEvaluationContext,
  ExhibitRiskSource
} from '../types';
import {
  EXHIBIT_RISK_LEVEL_ORDER,
  EXHIBIT_LONG_UNPRACTICED_DAYS
} from '../types';

export function daysBetween(dateStr: string | null, reference: Date = new Date()): number {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const ref = new Date(reference);
  ref.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.floor((ref.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function evaluateExhibitRisk(
  context: ExhibitRiskEvaluationContext
): ExhibitRiskEvaluation {
  const { card, stats, todayPlanItemStatus, todayPlanStatus } = context;
  const reasons: ExhibitRiskReason[] = [];

  if (!stats.isStable) {
    reasons.push('unstable');
  }

  const days = daysBetween(stats.lastPracticeDate);
  if (stats.practiceCount === 0 || days >= EXHIBIT_LONG_UNPRACTICED_DAYS) {
    reasons.push('long_unpracticed');
  }

  if (card.status === 'need_help') {
    reasons.push('need_help');
  }

  if (card.starred && !card.reviewNotes.trim()) {
    reasons.push('starred_no_notes');
  }

  const isDelayed = todayPlanItemStatus === 'skipped';
  const isIncompleteAfterPlan =
    todayPlanStatus === 'completed' &&
    (todayPlanItemStatus === 'pending' || todayPlanItemStatus === 'in_progress');
  if (isDelayed || isIncompleteAfterPlan) {
    reasons.push('plan_delayed_or_incomplete');
  }

  return {
    riskLevel: deriveRiskLevel(reasons),
    riskReasons: reasons,
    recommendedAction: buildRecommendedAction(reasons)
  };
}

function deriveRiskLevel(reasons: ExhibitRiskReason[]): ExhibitRiskLevel {
  if (reasons.length === 0) return 'low';

  const hasUnstable = reasons.includes('unstable');
  const hasLongUnpracticed = reasons.includes('long_unpracticed');
  const hasNeedHelp = reasons.includes('need_help');
  const hasStarredNoNotes = reasons.includes('starred_no_notes');
  const hasPlanIssue = reasons.includes('plan_delayed_or_incomplete');
  const hasReviewIssue = reasons.includes('review_issue');
  const hasDurationDeviation = reasons.includes('duration_deviation');

  if (
    (hasUnstable && hasLongUnpracticed && hasPlanIssue) ||
    (hasNeedHelp && hasStarredNoNotes) ||
    (hasNeedHelp && hasPlanIssue) ||
    (hasReviewIssue && hasDurationDeviation) ||
    (hasReviewIssue && hasUnstable)
  ) {
    return 'critical';
  }

  if (hasReviewIssue && reasons.length >= 2) return 'high';
  if (reasons.length >= 3) return 'high';
  if (reasons.length === 2) return 'medium';
  return 'low';
}

function buildRecommendedAction(reasons: ExhibitRiskReason[]): string {
  if (reasons.length === 0) {
    return '保持现有排练节奏，展前复核一次即可。';
  }

  const actions: string[] = [];

  if (reasons.includes('unstable')) {
    actions.push('安排至少一次完整试作以确认工艺稳定度');
  }
  if (reasons.includes('long_unpracticed')) {
    actions.push(`尽快补做试作（已超过 ${EXHIBIT_LONG_UNPRACTICED_DAYS} 天未练习）`);
  }
  if (reasons.includes('need_help')) {
    actions.push('展前由资深馆员做一次讲解示范并记录要点');
  }
  if (reasons.includes('starred_no_notes')) {
    actions.push('补全重点样片的讲解提示与常见失误说明');
  }
  if (reasons.includes('plan_delayed_or_incomplete')) {
    actions.push('跟进今日演示路线中暂缓或未完成的样片');
  }
  if (reasons.includes('review_issue')) {
    actions.push('针对最近一次复核暴露的问题安排专项补练');
  }
  if (reasons.includes('duration_deviation')) {
    actions.push('重新核对预计工时并在排练时校准节奏');
  }

  return actions.join('；') + '。';
}

export function sortExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[]
): ExhibitRiskSnapshot[] {
  return [...snapshots].sort((a, b) => {
    if (a.resolved !== b.resolved) {
      return a.resolved ? 1 : -1;
    }
    const levelDiff =
      EXHIBIT_RISK_LEVEL_ORDER[a.riskLevel] - EXHIBIT_RISK_LEVEL_ORDER[b.riskLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.snapshotDate.localeCompare(a.snapshotDate);
  });
}

export function getLatestExhibitRiskSnapshotPerCard(
  snapshots: ExhibitRiskSnapshot[]
): Map<string, ExhibitRiskSnapshot> {
  const map = new Map<string, ExhibitRiskSnapshot>();
  for (const snapshot of snapshots) {
    const existing = map.get(snapshot.cardId);
    if (
      !existing ||
      snapshot.snapshotDate > existing.snapshotDate ||
      (snapshot.snapshotDate === existing.snapshotDate &&
        new Date(snapshot.updatedAt).getTime() > new Date(existing.updatedAt).getTime())
    ) {
      map.set(snapshot.cardId, snapshot);
    }
  }
  return map;
}

export interface ExhibitRiskFilterOptions {
  cardId?: string;
  riskLevel?: ExhibitRiskLevel;
  source?: ExhibitRiskSource;
  resolved?: boolean;
  includeResolvedCritical?: boolean;
}

export function filterExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[],
  options: ExhibitRiskFilterOptions = {}
): ExhibitRiskSnapshot[] {
  return snapshots.filter((snapshot) => {
    if (options.cardId && snapshot.cardId !== options.cardId) return false;
    if (options.riskLevel && snapshot.riskLevel !== options.riskLevel) return false;
    if (options.source && snapshot.source !== options.source) return false;

    if (options.resolved !== undefined) {
      const isUnresolvedCritical =
        snapshot.riskLevel === 'critical' && !snapshot.resolved;
      const protectCritical =
        isUnresolvedCritical && options.includeResolvedCritical !== false;
      if (protectCritical && options.resolved) {
        return true;
      }
      if (snapshot.resolved !== options.resolved) return false;
    }

    return true;
  });
}
