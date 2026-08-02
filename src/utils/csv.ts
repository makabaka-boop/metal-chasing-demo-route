import type { Card, ExhibitRiskSnapshot } from '../types';
import {
  STATUS_LABELS,
  DIFFICULTY_LABELS,
  EXHIBIT_RISK_LEVEL_LABELS,
  EXHIBIT_RISK_REASON_LABELS,
  EXHIBIT_RISK_SOURCE_LABELS
} from '../types';
import { store } from '../store';

const HEADERS = [
  '图案编号',
  '金属规格',
  '难度',
  '錾刻步骤',
  '预计工时(分钟)',
  '常见失误',
  '责任人',
  '状态',
  '是否重点',
  '讲解提示',
  '累计试作次数',
  '累计确认次数',
  '累计实际工时(分钟)',
  '最近试作日期',
  '是否已稳定',
  '风险等级',
  '风险原因',
  '建议动作',
  '风险来源',
  '风险状态',
  '快照日期'
];

export function exportToCSV(
  cards: Card[],
  riskSnapshotMap?: Map<string, ExhibitRiskSnapshot>
): void {
  const snapshotMap = riskSnapshotMap || store.getLatestExhibitRiskSnapshotMap();

  const rows = cards.map((c) => {
    const stats = store.getCardReviewStats(c.id);
    const risk = snapshotMap.get(c.id);

    return [
      c.patternNumber,
      c.metalSpec,
      DIFFICULTY_LABELS[c.difficulty],
      c.steps.replace(/\n/g, ' / '),
      String(c.durationMin),
      c.mistakes,
      c.owner,
      STATUS_LABELS[c.status],
      c.starred ? '是' : '否',
      c.reviewNotes,
      String(stats.practiceCount),
      String(stats.completedCount),
      String(stats.totalDurationMin),
      stats.lastPracticeDate || '',
      stats.isStable ? '是' : '否',
      risk ? EXHIBIT_RISK_LEVEL_LABELS[risk.riskLevel] : '',
      risk ? risk.riskReasons.map((r) => EXHIBIT_RISK_REASON_LABELS[r]).join('；') : '',
      risk ? risk.recommendedAction : '',
      risk ? EXHIBIT_RISK_SOURCE_LABELS[risk.source] : '',
      risk ? (risk.resolved ? '已解除' : '未解除') : '',
      risk ? risk.snapshotDate : ''
    ];
  });

  const csvContent =
    '\uFEFF' +
    [HEADERS, ...rows]
      .map((row) => row.map(escapeCSV).join(','))
      .join('\n');

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.setAttribute('href', url);
  a.setAttribute('download', `錾刻工艺清单_${date}.csv`);
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
