export type CardStatus =
  | 'pending'
  | 'in_progress'
  | 'need_help'
  | 'showcase'
  | 'postponed';

export interface Card {
  id: string;
  patternNumber: string;
  metalSpec: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  steps: string;
  durationMin: number;
  mistakes: string;
  owner: string;
  status: CardStatus;
  starred: boolean;
  reviewNotes: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<CardStatus, string> = {
  pending: '待排样',
  in_progress: '试作中',
  need_help: '需讲解',
  showcase: '可展示',
  postponed: '暂缓'
};

export const STATUS_COLORS: Record<CardStatus, string> = {
  pending: '#7F8C8D',
  in_progress: '#3498DB',
  need_help: '#E67E22',
  showcase: '#27AE60',
  postponed: '#9B59B6'
};

export const METAL_SPECS = [
  '30x30x0.8mm 铜',
  '50x50x1mm 铜',
  '50x50x1mm 银',
  '60x40x1mm 铜',
  '80x80x1.2mm 银',
  '其他'
] as const;

export const DIFFICULTY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '入门',
  2: '初级',
  3: '中级',
  4: '进阶',
  5: '高级'
};

export type ReviewResult = 'completed' | 'partial' | 'failed';

export const REVIEW_RESULT_LABELS: Record<ReviewResult, string> = {
  completed: '确认',
  partial: '部分确认',
  failed: '需返工'
};

export const REVIEW_RESULT_COLORS: Record<ReviewResult, string> = {
  completed: '#27AE60',
  partial: '#F39C12',
  failed: '#E74C3C'
};

export const STABILITY_THRESHOLD = 3;

export interface PracticeRecord {
  id: string;
  cardId: string;
  date: string;
  durationMin: number;
  result: ReviewResult;
  problems: string;
  gains: string;
  createdAt: string;
}

export interface CardReviewStats {
  practiceCount: number;
  lastPracticeDate: string | null;
  isStable: boolean;
  completedCount: number;
  totalDurationMin: number;
}

export interface FilterCriteria {
  metalSpec?: string;
  difficulty?: number;
  status?: CardStatus;
  owner?: string;
  minDuration?: number;
  maxDuration?: number;
  starredOnly?: boolean;
  sortBy?: 'default' | 'lastPracticeDate' | 'practiceCount' | 'isStable';
  stableFilter?: 'all' | 'stable' | 'unstable';
  minPracticeCount?: number;
  maxPracticeCount?: number;
  lastPracticeDaysAgo?: number;
  minLastPracticeDate?: string;
  maxLastPracticeDate?: string;
  riskLevel?: ExhibitRiskLevel;
  includeResolvedRisk?: boolean;
}

export type AlertType =
  | 'duplicate_number'
  | 'duration_too_long'
  | 'total_duration_too_long'
  | 'mistakes_empty'
  | 'owner_overloaded'
  | 'starred_no_notes'
  | 'stable_achieved';

export interface ValidationAlert {
  type: AlertType;
  severity: 'warning' | 'error';
  message: string;
  cardIds: string[];
}

export type DailyPlanStatus = 'planning' | 'in_progress' | 'completed';

export type DailyPlanItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface DailyPlanItem {
  cardId: string;
  order: number;
  status: DailyPlanItemStatus;
  actualDurationMin?: number;
  completedAt?: string;
  note?: string;
}

export interface DailyPlanSummary {
  totalCount: number;
  completedCount: number;
  skippedCount: number;
  pendingCount: number;
  totalDurationMin: number;
  followUpCardIds: string[];
  summaryText: string;
}

export interface DailyPlan {
  id: string;
  date: string;
  goal: string;
  items: DailyPlanItem[];
  status: DailyPlanStatus;
  startedAt?: string;
  endedAt?: string;
  summary?: DailyPlanSummary;
  createdAt: string;
  updatedAt: string;
}

export type ReportDateRange = '7days' | '30days' | 'custom';

export interface ReportDateRangeConfig {
  type: ReportDateRange;
  startDate?: string;
  endDate?: string;
}

export interface ReportSummaryStats {
  totalPracticeCount: number;
  totalDurationMin: number;
  completionRate: number;
  stableCardCount: number;
  needFollowUpCardCount: number;
  unresolvedRiskCount: number;
  criticalRiskCount: number;
  reviewRiskCount: number;
}

export interface DifficultyStat {
  difficulty: 1 | 2 | 3 | 4 | 5;
  count: number;
  practiceCount: number;
  completionRate: number;
}

export interface StatusStat {
  status: CardStatus;
  count: number;
}

export interface OwnerStat {
  owner: string;
  count: number;
  practiceCount: number;
  completedCount: number;
}

export interface FrequentMistake {
  description: string;
  count: number;
  cardIds: string[];
}

export interface UnstableUnpracticedCard {
  cardId: string;
  patternNumber: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  daysSinceLastPractice: number;
  practiceCount: number;
  completedCount: number;
}

export interface DailyPlanCompletion {
  date: string;
  totalCount: number;
  completedCount: number;
  completionRate: number;
  totalDurationMin: number;
}

export interface TrainingReport {
  dateRange: ReportDateRangeConfig;
  summary: ReportSummaryStats;
  difficultyStats: DifficultyStat[];
  statusStats: StatusStat[];
  ownerStats: OwnerStat[];
  frequentMistakes: FrequentMistake[];
  unstableUnpracticedCards: UnstableUnpracticedCard[];
  dailyPlanCompletions: DailyPlanCompletion[];
}

export type ExhibitRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ExhibitRiskSource = 'manual' | 'review' | 'plan' | 'report';

export type ExhibitRiskReason =
  | 'unstable'
  | 'long_unpracticed'
  | 'need_help'
  | 'starred_no_notes'
  | 'plan_delayed_or_incomplete'
  | 'review_issue'
  | 'duration_deviation';

export const EXHIBIT_RISK_LEVEL_LABELS: Record<ExhibitRiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '紧急'
};

export const EXHIBIT_RISK_LEVEL_COLORS: Record<ExhibitRiskLevel, string> = {
  low: '#27AE60',
  medium: '#F39C12',
  high: '#E67E22',
  critical: '#E74C3C'
};

export const EXHIBIT_RISK_LEVEL_ORDER: Record<ExhibitRiskLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

export const EXHIBIT_RISK_REASON_LABELS: Record<ExhibitRiskReason, string> = {
  unstable: '未稳定',
  long_unpracticed: '久未试作',
  need_help: '需讲解',
  starred_no_notes: '重点但无讲解提示',
  plan_delayed_or_incomplete: '今日计划暂缓或未完成',
  review_issue: '复核发现问题',
  duration_deviation: '实际工时偏差'
};

export const EXHIBIT_RISK_SOURCE_LABELS: Record<ExhibitRiskSource, string> = {
  manual: '手动登记',
  review: '工艺复核',
  plan: '演示路线',
  report: '训练报告'
};

export const EXHIBIT_LONG_UNPRACTICED_DAYS = 14;

export interface ExhibitRiskSnapshot {
  id: string;
  cardId: string;
  snapshotDate: string;
  riskLevel: ExhibitRiskLevel;
  riskReasons: ExhibitRiskReason[];
  recommendedAction: string;
  source: ExhibitRiskSource;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExhibitRiskSnapshotInput = Omit<
  ExhibitRiskSnapshot,
  'id' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export interface ExhibitRiskEvaluation {
  riskLevel: ExhibitRiskLevel;
  riskReasons: ExhibitRiskReason[];
  recommendedAction: string;
}

export interface ExhibitRiskEvaluationContext {
  card: Card;
  stats: CardReviewStats;
  todayPlanItemStatus?: DailyPlanItem['status'] | null;
  todayPlanStatus?: DailyPlan['status'] | null;
}
