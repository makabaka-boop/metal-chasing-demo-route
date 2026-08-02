import type {
  Card,
  ExhibitRiskLevel,
  ExhibitRiskSnapshot,
  ExhibitRiskSource,
  ReviewResult
} from '../types';
import { EXHIBIT_RISK_LEVEL_WEIGHT, EXHIBIT_RISK_STALE_DAYS } from '../types';

// ============ 展品风险快照纯函数工具 ============
// PRD 开头规则：风险等级由“未稳定、久未试作、需讲解、重点但无讲解提示、
// 今日计划暂缓或未完成”共同决定。以下函数不含任何副作用，
// 供 store、CSV 导出、工艺复核单、演示路线共同复用同一套判定逻辑。

// 风险因子的原始输入，由调用方（通常是 store）从已有数据汇总后传入，
// 避免纯函数直接依赖存储或时间。
export interface ExhibitRiskFactors {
  // 卡片尚未形成稳定工艺表现
  unstable: boolean;
  // 距上次试作的天数（无试作记录时应传入较大值）
  daysSinceLastPractice: number;
  // 当前状态为“需讲解”
  needsExplanation: boolean;
  // 重点样片但缺少讲解提示
  keyWithoutExplanationNote: boolean;
  // 今日计划中该卡片被暂缓或尚未完成
  todayPlanPostponedOrUnfinished: boolean;
}

export interface ExhibitRiskAssessment {
  riskLevel: ExhibitRiskLevel;
  riskReasons: string[];
  recommendedAction: string;
}

// 各风险因子对应的说明文案，用于生成 riskReasons
const FACTOR_REASONS = {
  unstable: '尚未形成稳定工艺表现',
  stale: `已超过 ${EXHIBIT_RISK_STALE_DAYS} 天未试作`,
  needsExplanation: '当前状态为需讲解',
  keyWithoutExplanationNote: '重点样片但缺少讲解提示',
  todayPlanPostponedOrUnfinished: '今日计划暂缓或未完成'
} as const;

// 根据五项风险因子收集触发的原因列表
export function collectExhibitRiskReasons(factors: ExhibitRiskFactors): string[] {
  const reasons: string[] = [];
  if (factors.unstable) reasons.push(FACTOR_REASONS.unstable);
  if (factors.daysSinceLastPractice >= EXHIBIT_RISK_STALE_DAYS) reasons.push(FACTOR_REASONS.stale);
  if (factors.needsExplanation) reasons.push(FACTOR_REASONS.needsExplanation);
  if (factors.keyWithoutExplanationNote) reasons.push(FACTOR_REASONS.keyWithoutExplanationNote);
  if (factors.todayPlanPostponedOrUnfinished) {
    reasons.push(FACTOR_REASONS.todayPlanPostponedOrUnfinished);
  }
  return reasons;
}

// 依据触发因子的数量与组合计算风险等级。
// 规则：命中越多越高；“需讲解 + 重点无讲解提示”属于展前致命组合，直接判为 critical。
export function computeExhibitRiskLevel(factors: ExhibitRiskFactors): ExhibitRiskLevel {
  const hitCount = collectExhibitRiskReasons(factors).length;

  if (hitCount === 0) return 'low';

  // 展前讲解准备的致命组合：需讲解且重点样片没有讲解提示
  if (factors.needsExplanation && factors.keyWithoutExplanationNote) return 'critical';

  // 今日计划暂缓/未完成叠加其他任一因子，也视为严重
  if (factors.todayPlanPostponedOrUnfinished && hitCount >= 3) return 'critical';

  if (hitCount >= 3) return 'high';
  if (hitCount === 2) return 'medium';
  return 'low';
}

function buildRecommendedAction(level: ExhibitRiskLevel, reasons: string[]): string {
  if (level === 'low' || reasons.length === 0) return '暂无需特别处理，保持常规排练即可';
  const head = reasons[0];
  switch (level) {
    case 'critical':
      return `展前必须先处理：${head}，建议立即补讲解提示并安排复核`;
    case 'high':
      return `优先安排试作与讲解，重点关注：${head}`;
    case 'medium':
    default:
      return `建议尽快跟进：${head}`;
  }
}

// 综合评估：一次性给出等级、原因与建议动作
export function assessExhibitRisk(factors: ExhibitRiskFactors): ExhibitRiskAssessment {
  const riskReasons = collectExhibitRiskReasons(factors);
  const riskLevel = computeExhibitRiskLevel(factors);
  return {
    riskLevel,
    riskReasons,
    recommendedAction: buildRecommendedAction(riskLevel, riskReasons)
  };
}

// 判断某卡片是否为“重点但无讲解提示”，供因子汇总复用
export function isKeyWithoutExplanationNote(card: Card): boolean {
  return card.starred && !card.reviewNotes.trim();
}

// PRD 中段规则：critical 必须优先展示且不能被普通筛选隐藏。
// 该函数按“未解决 critical → 其余按风险权重降序 → snapshotDate 降序”排序，
// 供演示路线、复核单、CSV 导出共享同一顺序。
export function sortExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[]
): ExhibitRiskSnapshot[] {
  return [...snapshots].sort((a, b) => {
    const aCritical = a.riskLevel === 'critical' && !a.resolved;
    const bCritical = b.riskLevel === 'critical' && !b.resolved;
    if (aCritical !== bCritical) return aCritical ? -1 : 1;

    const weightDiff =
      EXHIBIT_RISK_LEVEL_WEIGHT[b.riskLevel] - EXHIBIT_RISK_LEVEL_WEIGHT[a.riskLevel];
    if (weightDiff !== 0) return weightDiff;

    return b.snapshotDate.localeCompare(a.snapshotDate);
  });
}

// 判断一条快照是否必须始终展示（未解决的 critical）
export function isAlwaysVisibleExhibitRisk(snapshot: ExhibitRiskSnapshot): boolean {
  return snapshot.riskLevel === 'critical' && !snapshot.resolved;
}

// PRD 中段规则的落地：在普通筛选之上，强制保留未解决的 critical 快照。
// filtered 为普通筛选结果，all 为全量快照，返回并集且保持排序。
export function applyExhibitRiskVisibility(
  filtered: ExhibitRiskSnapshot[],
  all: ExhibitRiskSnapshot[]
): ExhibitRiskSnapshot[] {
  const seen = new Set(filtered.map((s) => s.id));
  const forced = all.filter((s) => isAlwaysVisibleExhibitRisk(s) && !seen.has(s.id));
  return sortExhibitRiskSnapshots([...filtered, ...forced]);
}

// 从全量快照中取出某卡片“最具代表性”的一条：
// 优先未解决的 critical，其次风险权重最高、日期最新。
export function pickRepresentativeExhibitRisk(
  snapshots: ExhibitRiskSnapshot[]
): ExhibitRiskSnapshot | null {
  if (snapshots.length === 0) return null;
  return sortExhibitRiskSnapshots(snapshots)[0];
}

// 按 cardId 聚合出每张卡片的代表性快照，供卡片网格/路线视图/工具栏共享，
// 组件只需读取该表即可，无需自行拼装风险判断。
export function buildRepresentativeRiskMap(
  snapshots: ExhibitRiskSnapshot[]
): Map<string, ExhibitRiskSnapshot> {
  const grouped = new Map<string, ExhibitRiskSnapshot[]>();
  for (const s of snapshots) {
    const list = grouped.get(s.cardId);
    if (list) list.push(s);
    else grouped.set(s.cardId, [s]);
  }
  const result = new Map<string, ExhibitRiskSnapshot>();
  for (const [cardId, list] of grouped) {
    const rep = pickRepresentativeExhibitRisk(list);
    if (rep) result.set(cardId, rep);
  }
  return result;
}

// 卡片层的风险权重：取其代表性快照的风险权重；未解决的 critical 记为最高，
// 无快照或已解决时记为 -1（排在有风险之后）。
export function exhibitRiskRankOf(
  snapshot: ExhibitRiskSnapshot | null | undefined
): number {
  if (!snapshot || snapshot.resolved) return -1;
  return EXHIBIT_RISK_LEVEL_WEIGHT[snapshot.riskLevel];
}

// PRD 中段规则落地到路线视图：
// “critical 优先、high 次之，其余按原工艺难度递增”。
// riskMap 由 buildRepresentativeRiskMap 生成，difficultyTieBreak 复用原路线次级排序。
export function sortCardsByExhibitRisk(
  cards: Card[],
  riskMap: Map<string, ExhibitRiskSnapshot>,
  difficultyTieBreak?: (a: Card, b: Card) => number
): Card[] {
  return [...cards].sort((a, b) => {
    const rankA = exhibitRiskRankOf(riskMap.get(a.id));
    const rankB = exhibitRiskRankOf(riskMap.get(b.id));
    if (rankA !== rankB) return rankB - rankA;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    return difficultyTieBreak ? difficultyTieBreak(a, b) : 0;
  });
}

// ============ 复核结果沉淀为风险快照 ============
// 复核结果为 failed / partial 时，需自动落一份 source: 'review' 的快照。
// 以下纯函数负责生成 riskReasons 与风险等级，供 store 在写入前调用，
// 组件与 store 不重复拼装。

// 来源于复核的风险快照输入
export interface ReviewRiskInput {
  // 本次复核结果（仅 failed / partial 会触发风险沉淀）
  result: ReviewResult;
  // 本次实际工时（分钟）
  actualDurationMin: number;
  // 卡片预计工时（分钟），用于计算工时偏差
  plannedDurationMin: number;
  // 问题备注原文
  problems: string;
}

// 生成问题摘要：截断过长文本，空白时给出兜底描述
export function summarizeReviewProblem(problems: string, maxLen = 40): string {
  const text = problems.trim();
  if (!text) return '未记录具体问题，需现场复核';
  const oneLine = text.replace(/\s+/g, ' ');
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine;
}

// 生成工时偏差说明：与预计工时对比，给出方向与幅度
export function describeDurationDeviation(
  actualDurationMin: number,
  plannedDurationMin: number
): string {
  const diff = actualDurationMin - plannedDurationMin;
  if (plannedDurationMin <= 0 || diff === 0) {
    return `实际工时 ${actualDurationMin} 分钟，与预计基本持平`;
  }
  const pct = Math.round((Math.abs(diff) / plannedDurationMin) * 100);
  const dir = diff > 0 ? '超出' : '低于';
  return `实际工时 ${actualDurationMin} 分钟，${dir}预计 ${Math.abs(diff)} 分钟（${pct}%）`;
}

// 构建复核来源快照的原因列表：至少包含问题摘要与工时偏差
export function buildReviewRiskReasons(input: ReviewRiskInput): string[] {
  const resultLabel = input.result === 'failed' ? '复核未通过（需返工）' : '复核部分确认';
  return [
    resultLabel,
    `问题摘要：${summarizeReviewProblem(input.problems)}`,
    `工时偏差：${describeDurationDeviation(input.actualDurationMin, input.plannedDurationMin)}`
  ];
}

// 复核结果对应的风险等级：failed 视为 high，partial 视为 medium
export function reviewResultToRiskLevel(result: ReviewResult): ExhibitRiskLevel {
  if (result === 'failed') return 'high';
  return 'medium';
}

// 从现有快照中找出某卡片当天已存在的 review 来源快照（用于去重更新）
export function findExistingReviewSnapshot(
  snapshots: ExhibitRiskSnapshot[],
  cardId: string,
  snapshotDate: string
): ExhibitRiskSnapshot | undefined {
  return snapshots.find(
    (s) => s.cardId === cardId && s.source === 'review' && s.snapshotDate === snapshotDate
  );
}

// 卡片达到稳定后，需自动 resolve 的快照：未解决且来源为 review / report
export function isAutoResolvableOnStable(snapshot: ExhibitRiskSnapshot): boolean {
  return (
    !snapshot.resolved &&
    (snapshot.source === 'review' || snapshot.source === 'report')
  );
}

// ============ 工艺复核单·风险分析区域 ============

// 各风险等级的数量统计（顶部指标）
export type ExhibitRiskLevelCounts = Record<ExhibitRiskLevel, number>;

// 统计每个风险等级的快照数量；onlyUnresolved 为 true 时只计未解决的
export function countExhibitRiskByLevel(
  snapshots: ExhibitRiskSnapshot[],
  onlyUnresolved = false
): ExhibitRiskLevelCounts {
  const counts: ExhibitRiskLevelCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const s of snapshots) {
    if (onlyUnresolved && s.resolved) continue;
    counts[s.riskLevel]++;
  }
  return counts;
}

// 风险分析区域的过滤条件
export interface ExhibitRiskFilter {
  riskLevel?: ExhibitRiskLevel;
  source?: ExhibitRiskSource;
  // resolved 未设置时默认只看未解决；显式 true/false 时按值过滤
  resolved?: boolean;
}

// 按条件过滤风险快照，并落实 PRD 中段“critical 优先且不能被普通筛选隐藏”：
// 未解决的 critical 快照无论过滤条件如何都会保留，最终统一排序（critical 置顶）。
export function filterExhibitRiskSnapshots(
  snapshots: ExhibitRiskSnapshot[],
  filter: ExhibitRiskFilter
): ExhibitRiskSnapshot[] {
  const wantResolved = filter.resolved ?? false;

  const matched = snapshots.filter((s) => {
    if (s.resolved !== wantResolved) return false;
    if (filter.riskLevel && s.riskLevel !== filter.riskLevel) return false;
    if (filter.source && s.source !== filter.source) return false;
    return true;
  });

  // 只在“查看未解决”视图下强制补入被过滤掉的 critical
  const base = wantResolved
    ? matched
    : applyExhibitRiskVisibility(matched, snapshots);

  return sortExhibitRiskSnapshots(base);
}
