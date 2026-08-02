import type { Card, ExhibitRiskSnapshot } from '../types';
import { EXHIBIT_RISK_LEVEL_ORDER } from '../types';

export function generatePracticeRoute(
  cards: Card[],
  riskSnapshotMap?: Map<string, ExhibitRiskSnapshot>
): Card[] {
  const clone = [...cards];
  clone.sort((a, b) => {
    const riskA = riskSnapshotMap?.get(a.id);
    const riskB = riskSnapshotMap?.get(b.id);

    const priorityA = resolveRouteRiskPriority(riskA);
    const priorityB = resolveRouteRiskPriority(riskB);
    if (priorityA !== priorityB) return priorityA - priorityB;

    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
    if (a.durationMin !== b.durationMin) return a.durationMin - b.durationMin;
    return a.patternNumber.localeCompare(b.patternNumber);
  });
  return clone;
}

function resolveRouteRiskPriority(risk: ExhibitRiskSnapshot | undefined): number {
  if (!risk || risk.resolved) return 99;
  if (risk.riskLevel === 'critical') return 0;
  if (risk.riskLevel === 'high') return 1;
  return 50 + EXHIBIT_RISK_LEVEL_ORDER[risk.riskLevel];
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
