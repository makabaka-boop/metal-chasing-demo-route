import type { Card } from '../types';
import { store } from '../store';

export function generatePracticeRoute(cards: Card[]): Card[] {
  // 复用同一份展品风险快照：critical 优先、high 次之，其余按原工艺难度递增
  // getExhibitRiskSnapshots 已按未处理优先 + 等级排序，首张未处理快照即为该卡最高风险
  const riskRank = new Map<string, number>();
  for (const s of store.getExhibitRiskSnapshots()) {
    if (s.resolved || riskRank.has(s.cardId)) continue;
    riskRank.set(s.cardId, s.riskLevel === 'critical' ? 0 : s.riskLevel === 'high' ? 1 : 2);
  }

  const clone = [...cards];
  clone.sort((a, b) => {
    const ra = riskRank.get(a.id) ?? 2;
    const rb = riskRank.get(b.id) ?? 2;
    if (ra !== rb) return ra - rb;
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
    return a.patternNumber.localeCompare(b.patternNumber);
  });
  return clone;
}

export function estimateTotalDuration(route: Card[]): number {
  return route.reduce((sum, c) => sum + c.durationMin, 0);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}
