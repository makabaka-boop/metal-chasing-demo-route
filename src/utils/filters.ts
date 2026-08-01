import type { Card, FilterCriteria, CardReviewStats } from '../types';
import { store } from '../store';

export function filterCards(
  cards: Card[],
  criteria: FilterCriteria
): Card[] {
  const statsMap = new Map<string, CardReviewStats>();
  for (const card of cards) {
    statsMap.set(card.id, store.getCardReviewStats(card.id));
  }

  let result = cards.filter((card) => {
    const stats = statsMap.get(card.id)!;

    if (criteria.metalSpec && criteria.metalSpec !== card.metalSpec) {
      return false;
    }
    if (
      criteria.difficulty !== undefined &&
      criteria.difficulty !== card.difficulty
    ) {
      return false;
    }
    if (criteria.status && criteria.status !== card.status) {
      return false;
    }
    if (criteria.owner && criteria.owner !== card.owner) {
      return false;
    }
    if (
      criteria.minDuration !== undefined &&
      card.durationMin < criteria.minDuration
    ) {
      return false;
    }
    if (
      criteria.maxDuration !== undefined &&
      card.durationMin > criteria.maxDuration
    ) {
      return false;
    }
    if (criteria.starredOnly && !card.starred) {
      return false;
    }
    if (criteria.stableFilter && criteria.stableFilter !== 'all') {
      if (criteria.stableFilter === 'stable' && !stats.isStable) return false;
      if (criteria.stableFilter === 'unstable' && stats.isStable) return false;
    }
    if (
      criteria.minPracticeCount !== undefined &&
      stats.practiceCount < criteria.minPracticeCount
    ) {
      return false;
    }
    if (
      criteria.maxPracticeCount !== undefined &&
      stats.practiceCount > criteria.maxPracticeCount
    ) {
      return false;
    }
    if (criteria.minLastPracticeDate && stats.lastPracticeDate) {
      if (stats.lastPracticeDate < criteria.minLastPracticeDate) return false;
    }
    if (criteria.maxLastPracticeDate && stats.lastPracticeDate) {
      if (stats.lastPracticeDate > criteria.maxLastPracticeDate) return false;
    }
    if (criteria.lastPracticeDaysAgo !== undefined) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - criteria.lastPracticeDaysAgo);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      if (!stats.lastPracticeDate || stats.lastPracticeDate < cutoffStr) return false;
    }
    return true;
  });

  if (criteria.sortBy && criteria.sortBy !== 'default') {
    result.sort((a, b) => {
      const sa = statsMap.get(a.id)!;
      const sb = statsMap.get(b.id)!;

      switch (criteria.sortBy) {
        case 'lastPracticeDate': {
          const da = sa.lastPracticeDate || '';
          const db = sb.lastPracticeDate || '';
          return db.localeCompare(da);
        }
        case 'practiceCount':
          return sb.practiceCount - sa.practiceCount;
        case 'isStable': {
          if (sa.isStable !== sb.isStable) return sa.isStable ? -1 : 1;
          return sb.completedCount - sa.completedCount;
        }
        default:
          return 0;
      }
    });
  }

  return result;
}

export function collectOwners(cards: Card[]): string[] {
  const set = new Set<string>();
  for (const c of cards) {
    if (c.owner.trim()) set.add(c.owner.trim());
  }
  return Array.from(set).sort();
}

export function collectMetalSpecs(cards: Card[]): string[] {
  const set = new Set<string>();
  for (const c of cards) {
    if (c.metalSpec.trim()) set.add(c.metalSpec.trim());
  }
  return Array.from(set).sort();
}
