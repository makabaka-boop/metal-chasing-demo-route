import type { Card, ExhibitRiskSnapshot } from '../types';
import { sortCardsByExhibitRisk } from './exhibitRisk';

export function generatePracticeRoute(cards: Card[]): Card[] {
  const clone = [...cards];
  clone.sort((a, b) => {
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
    return a.patternNumber.localeCompare(b.patternNumber);
  });
  return clone;
}

// PRD 中段规则：演示路线按“critical 优先、high 次之、原工艺难度递增”排序。
// 先按原难度规则生成基础顺序（作为同风险等级下的次级排序），
// 再依据代表性风险快照做稳定重排，风险判断完全复用传入的 riskMap。
export function generateRiskAwareRoute(
  cards: Card[],
  riskMap: Map<string, ExhibitRiskSnapshot>
): Card[] {
  const base = generatePracticeRoute(cards);
  return sortCardsByExhibitRisk(base, riskMap);
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
