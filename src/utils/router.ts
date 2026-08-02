import type { Card } from '../types';
import { store } from '../store';
import { getLatestSnapshotPerCard, getRouteRiskPriority } from './exhibitRisk';

export function generatePracticeRoute(cards: Card[]): Card[] {
  const snapshotMap = getLatestSnapshotPerCard(store.getExhibitRiskSnapshots());
  const clone = [...cards];
  clone.sort((a, b) => {
    const pa = getRouteRiskPriority(snapshotMap.get(a.id));
    const pb = getRouteRiskPriority(snapshotMap.get(b.id));
    if (pa !== pb) return pa - pb;
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
