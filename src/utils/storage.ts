import type { Card, PracticeRecord, DailyPlan, ExhibitRiskSnapshot } from '../types';

const STORAGE_KEY = 'chasing-practice-cards';
const RECORDS_KEY = 'chasing-practice-records';
const DAILY_PLAN_KEY = 'chasing-daily-plan';
const EXHIBIT_RISK_KEY = 'chasing-exhibit-risk-snapshots';

export function loadCards(): Card[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    const parsed = JSON.parse(raw) as Card[];
    if (!Array.isArray(parsed)) return seedData();
    return parsed;
  } catch {
    return seedData();
  }
}

export function saveCards(cards: Card[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function loadRecords(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PracticeRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveRecords(records: PracticeRecord[]): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export function loadDailyPlans(): DailyPlan[] {
  try {
    const raw = localStorage.getItem(DAILY_PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyPlan[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveDailyPlans(plans: DailyPlan[]): void {
  localStorage.setItem(DAILY_PLAN_KEY, JSON.stringify(plans));
}

export function loadExhibitRiskSnapshots(): ExhibitRiskSnapshot[] {
  try {
    const raw = localStorage.getItem(EXHIBIT_RISK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeExhibitRiskSnapshot).filter(
      (s): s is ExhibitRiskSnapshot => s !== null
    );
  } catch {
    return [];
  }
}

export function saveExhibitRiskSnapshots(snapshots: ExhibitRiskSnapshot[]): void {
  localStorage.setItem(EXHIBIT_RISK_KEY, JSON.stringify(snapshots));
}

function normalizeExhibitRiskSnapshot(raw: unknown): ExhibitRiskSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.cardId !== 'string') return null;

  const riskLevel = normalizeRiskLevel(obj.riskLevel);
  const source = normalizeRiskSource(obj.source);
  const riskReasons = normalizeRiskReasons(obj.riskReasons);

  return {
    id: obj.id,
    cardId: obj.cardId,
    snapshotDate: typeof obj.snapshotDate === 'string' ? obj.snapshotDate : '',
    riskLevel,
    riskReasons,
    recommendedAction: typeof obj.recommendedAction === 'string' ? obj.recommendedAction : '',
    source,
    resolved: typeof obj.resolved === 'boolean' ? obj.resolved : false,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString()
  };
}

function normalizeRiskLevel(value: unknown): ExhibitRiskSnapshot['riskLevel'] {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
    return value;
  }
  return 'low';
}

function normalizeRiskSource(value: unknown): ExhibitRiskSnapshot['source'] {
  if (value === 'manual' || value === 'review' || value === 'plan' || value === 'report') {
    return value;
  }
  return 'manual';
}

function normalizeRiskReasons(value: unknown): ExhibitRiskSnapshot['riskReasons'] {
  if (!Array.isArray(value)) return [];
  const valid: ExhibitRiskSnapshot['riskReasons'] = [];
  const allowed = new Set([
    'unstable',
    'long_inactive',
    'need_help',
    'starred_no_notes',
    'plan_postponed',
    'plan_incomplete',
    'review_problems',
    'duration_deviation'
  ]);
  for (const item of value) {
    if (typeof item === 'string' && allowed.has(item)) {
      valid.push(item as ExhibitRiskSnapshot['riskReasons'][number]);
    }
  }
  return valid;
}

function seedData(): Card[] {
  const now = new Date().toISOString();
  const seeds: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      patternNumber: 'Z-001',
      metalSpec: '30x30x0.8mm 铜',
      difficulty: 1,
      steps: '1. 准备錾子与锤子\n2. 在金属片上划线定位\n3. 轻敲出直线纹理',
      durationMin: 30,
      mistakes: '力度不均导致线条深浅不一',
      owner: '张三',
      status: 'pending',
      starred: false,
      reviewNotes: '注意手腕放松，保持匀速敲击'
    },
    {
      patternNumber: 'Z-002',
      metalSpec: '50x50x1mm 铜',
      difficulty: 2,
      steps: '1. 设计曲线图案\n2. 转移到金属片\n3. 沿曲线錾刻',
      durationMin: 60,
      mistakes: '转角处容易偏线',
      owner: '张三',
      status: 'in_progress',
      starred: true,
      reviewNotes: '转角处放慢速度，小幅度调整錾子角度'
    },
    {
      patternNumber: 'Z-003',
      metalSpec: '50x50x1mm 银',
      difficulty: 3,
      steps: '1. 绘制回纹图案\n2. 分区域錾刻\n3. 打磨抛光',
      durationMin: 90,
      mistakes: '',
      owner: '李四',
      status: 'need_help',
      starred: false,
      reviewNotes: ''
    }
  ];
  return seeds.map((s, i) => ({
    ...s,
    id: `seed-${i}-${Date.now()}`,
    createdAt: now,
    updatedAt: now
  }));
}

export function generateId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
