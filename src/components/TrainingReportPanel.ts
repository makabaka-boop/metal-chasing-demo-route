import { store } from '../store';
import type {
  TrainingReport,
  ReportDateRangeConfig,
  ReportDateRange,
  ExhibitRiskSnapshot,
  ExhibitRiskLevel,
  ExhibitRiskSource
} from '../types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DIFFICULTY_LABELS,
  EXHIBIT_RISK_LEVEL_LABELS,
  EXHIBIT_RISK_LEVEL_COLORS,
  EXHIBIT_RISK_SOURCE_LABELS,
  EXHIBIT_RISK_REASON_LABELS
} from '../types';
import { formatDuration } from '../utils/router';
import { sortExhibitRiskSnapshots } from '../utils/exhibitRisk';

type RiskLevelFilter = 'all' | ExhibitRiskLevel;
type RiskSourceFilter = 'all' | ExhibitRiskSource;
type RiskResolvedFilter = 'all' | 'unresolved' | 'resolved';

const RISK_LEVEL_ORDER: ExhibitRiskLevel[] = ['critical', 'high', 'medium', 'low'];

export class TrainingReportPanel {
  private el: HTMLElement;
  private onCardClick: (id: string) => void;
  private onClose: () => void;
  private isOpen = false;
  private dateRange: ReportDateRangeConfig = { type: '7days' };
  private report: TrainingReport | null = null;
  private riskFilterLevel: RiskLevelFilter = 'all';
  private riskFilterSource: RiskSourceFilter = 'all';
  private riskFilterResolved: RiskResolvedFilter = 'unresolved';

  constructor(
    onCardClick: (id: string) => void,
    onClose: () => void
  ) {
    this.onCardClick = onCardClick;
    this.onClose = onClose;
    this.el = document.createElement('div');
    this.el.className = 'training-report-panel';
    this.el.style.display = 'none';
  }

  getElement(): HTMLElement {
    return this.el;
  }

  open(): void {
    this.isOpen = true;
    this.el.style.display = 'flex';
    this.refresh();
  }

  close(): void {
    this.isOpen = false;
    this.el.style.display = 'none';
    this.onClose();
  }

  refresh(): void {
    if (this.isOpen) {
      this.report = store.getTrainingReport(this.dateRange);
      this.render();
    }
  }

  private setDateRange(type: ReportDateRange): void {
    if (type === 'custom') {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      this.dateRange = {
        type: 'custom',
        startDate: thirtyDaysAgo.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10)
      };
    } else {
      this.dateRange = { type };
    }
    this.refresh();
  }

  private updateCustomDate(field: 'startDate' | 'endDate', value: string): void {
    if (this.dateRange.type !== 'custom') return;
    this.dateRange[field] = value;
    this.refresh();
  }

  private addCardToPlan(cardId: string): void {
    store.addCardsToTodayPlan([cardId]);
    this.refresh();
  }

  private getRiskSnapshots(): ExhibitRiskSnapshot[] {
    return store.getExhibitRiskSnapshots();
  }

  private getFilteredRiskSnapshots(): ExhibitRiskSnapshot[] {
    const all = this.getRiskSnapshots();
    const level = this.riskFilterLevel;
    const source = this.riskFilterSource;
    const resolved = this.riskFilterResolved;

    const pinned: ExhibitRiskSnapshot[] = [];
    const rest: ExhibitRiskSnapshot[] = [];

    for (const snapshot of all) {
      if (resolved === 'unresolved' && snapshot.resolved) continue;
      if (resolved === 'resolved' && !snapshot.resolved) continue;
      if (source !== 'all' && snapshot.source !== source) continue;

      const isCriticalUnresolved =
        snapshot.riskLevel === 'critical' && !snapshot.resolved;

      if (level !== 'all') {
        if (isCriticalUnresolved) {
          pinned.push(snapshot);
          continue;
        }
        if (snapshot.riskLevel !== level) continue;
      }

      rest.push(snapshot);
    }

    return sortExhibitRiskSnapshots([...pinned, ...rest]);
  }

  private getRiskLevelCounts(): Record<ExhibitRiskLevel, { total: number; unresolved: number }> {
    const counts: Record<ExhibitRiskLevel, { total: number; unresolved: number }> = {
      critical: { total: 0, unresolved: 0 },
      high: { total: 0, unresolved: 0 },
      medium: { total: 0, unresolved: 0 },
      low: { total: 0, unresolved: 0 }
    };
    for (const snapshot of this.getRiskSnapshots()) {
      counts[snapshot.riskLevel].total++;
      if (!snapshot.resolved) counts[snapshot.riskLevel].unresolved++;
    }
    return counts;
  }

  private renderRiskAnalysisSection(): string {
    const counts = this.getRiskLevelCounts();
    const snapshots = this.getFilteredRiskSnapshots();
    const totalUnresolved = Object.values(counts).reduce((sum, c) => sum + c.unresolved, 0);

    const statCards = RISK_LEVEL_ORDER.map((level) => {
      const c = counts[level];
      const color = EXHIBIT_RISK_LEVEL_COLORS[level];
      const active = this.riskFilterLevel === level ? ' risk-stat-active' : '';
      return `
        <button class="risk-stat-card risk-stat-${level}${active}" data-risk-level="${level}" style="border-top-color:${color}">
          <span class="risk-stat-level" style="background:${color}">${EXHIBIT_RISK_LEVEL_LABELS[level]}</span>
          <span class="risk-stat-count">${c.unresolved}</span>
          <span class="risk-stat-sub">未解除 / 共 ${c.total}</span>
        </button>
      `;
    }).join('');

    const options = (selected: string, items: [string, string][]) =>
      items.map(([value, label]) =>
        `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`
      ).join('');

    const levelOptions = options(this.riskFilterLevel, [
      ['all', '全部等级'],
      ...RISK_LEVEL_ORDER.map((l) => [l, EXHIBIT_RISK_LEVEL_LABELS[l]] as [string, string])
    ]);

    const sourceOptions = options(this.riskFilterSource, [
      ['all', '全部来源'],
      ['manual', EXHIBIT_RISK_SOURCE_LABELS.manual],
      ['review', EXHIBIT_RISK_SOURCE_LABELS.review],
      ['plan', EXHIBIT_RISK_SOURCE_LABELS.plan],
      ['report', EXHIBIT_RISK_SOURCE_LABELS.report]
    ]);

    const resolvedOptions = options(this.riskFilterResolved, [
      ['unresolved', '未解除'],
      ['resolved', '已解除'],
      ['all', '全部状态']
    ]);

    const list = snapshots.length === 0
      ? `<div class="empty-text">暂无符合条件的展品风险快照</div>`
      : snapshots.map((snapshot) => this.renderRiskSnapshotItem(snapshot)).join('');

    return `
      <div class="risk-analysis-section">
        <div class="risk-analysis-head">
          <h3 class="stats-title">🚩 展品风险集中处置</h3>
          <span class="risk-analysis-total">共 ${totalUnresolved} 项未解除</span>
        </div>
        <p class="card-subtitle">critical 紧急项始终置顶展示，不受等级筛选隐藏</p>

        <div class="risk-stat-grid">
          ${statCards}
        </div>

        <div class="risk-filters">
          <div class="risk-filter-group">
            <label>风险等级</label>
            <select class="filter-select" data-risk-filter="level">${levelOptions}</select>
          </div>
          <div class="risk-filter-group">
            <label>来源</label>
            <select class="filter-select" data-risk-filter="source">${sourceOptions}</select>
          </div>
          <div class="risk-filter-group">
            <label>处置状态</label>
            <select class="filter-select" data-risk-filter="resolved">${resolvedOptions}</select>
          </div>
        </div>

        <div class="risk-snapshot-list">
          ${list}
        </div>
      </div>
    `;
  }

  private renderRiskSnapshotItem(snapshot: ExhibitRiskSnapshot): string {
    const card = store.getCard(snapshot.cardId);
    const patternNumber = card?.patternNumber || '（已删除卡片）';
    const difficulty = card?.difficulty;
    const stats = card ? store.getCardReviewStats(card.id) : null;
    const lastPracticeDate = stats?.lastPracticeDate || '—';
    const inPlan = card ? store.isCardInTodayPlan(card.id) : false;
    const color = EXHIBIT_RISK_LEVEL_COLORS[snapshot.riskLevel];
    const criticalClass =
      !snapshot.resolved && snapshot.riskLevel === 'critical' ? ' risk-item-critical' : '';
    const resolvedClass = snapshot.resolved ? ' risk-item-resolved' : '';

    const reasonChips = snapshot.riskReasons.length > 0
      ? snapshot.riskReasons
          .map((r) => `<span class="risk-reason">${EXHIBIT_RISK_REASON_LABELS[r]}</span>`)
          .join('')
      : '<span class="risk-reason risk-reason-empty">待补充原因</span>';

    const diffTag = difficulty
      ? `<span class="diff-tag diff-${difficulty}">${DIFFICULTY_LABELS[difficulty]}</span>`
      : '';

    return `
      <div class="risk-snapshot-item${criticalClass}${resolvedClass}" data-card-id="${snapshot.cardId}" data-snapshot-id="${snapshot.id}">
        <div class="risk-item-head">
          <div class="risk-item-title">
            <span class="risk-level-badge" style="background:${color}">${EXHIBIT_RISK_LEVEL_LABELS[snapshot.riskLevel]}</span>
            <span class="card-number">${patternNumber}</span>
            ${diffTag}
            ${snapshot.resolved ? '<span class="risk-resolved-tag">✓ 已解除</span>' : ''}
          </div>
          <span class="risk-item-source">${EXHIBIT_RISK_SOURCE_LABELS[snapshot.source]} · ${snapshot.snapshotDate}</span>
        </div>
        <div class="risk-item-meta">
          <span>📅 最近试作：${lastPracticeDate}</span>
        </div>
        <div class="risk-item-reasons">${reasonChips}</div>
        ${snapshot.recommendedAction ? `<div class="risk-item-action">💡 ${snapshot.recommendedAction}</div>` : ''}
        <div class="risk-item-actions">
          <button class="btn btn-tiny btn-risk-plan" ${inPlan || snapshot.resolved ? 'disabled' : ''}>
            ${inPlan ? '✓ 已在演示序列' : '📋 一键加入演示序列'}
          </button>
          ${snapshot.resolved ? '' : `
            <button class="btn btn-tiny btn-risk-resolve">✓ 标记已解除</button>
          `}
          <button class="btn btn-tiny btn-risk-open">查看样片</button>
        </div>
      </div>
    `;
  }

  private render(): void {
    if (!this.report) return;

    const r = this.report;
    const s = r.summary;

    this.el.innerHTML = `
      <div class="report-header">
        <div class="report-title-section">
          <h2>📑 工艺复核单</h2>
          <p class="muted">金工錾刻样片与讲解风险复核</p>
        </div>
        <button class="btn-icon report-close" title="关闭">✕</button>
      </div>

      <div class="report-content">
        <div class="date-range-section">
          <div class="date-range-tabs">
            <button class="date-tab ${this.dateRange.type === '7days' ? 'active' : ''}" data-range="7days">
              近7天
            </button>
            <button class="date-tab ${this.dateRange.type === '30days' ? 'active' : ''}" data-range="30days">
              近30天
            </button>
            <button class="date-tab ${this.dateRange.type === 'custom' ? 'active' : ''}" data-range="custom">
              自定义
            </button>
          </div>
          ${this.dateRange.type === 'custom' ? `
            <div class="custom-date-inputs">
              <input type="date" class="custom-date" data-field="startDate" value="${this.dateRange.startDate || ''}" />
              <span class="date-separator">~</span>
              <input type="date" class="custom-date" data-field="endDate" value="${this.dateRange.endDate || ''}" />
            </div>
          ` : ''}
        </div>

        <div class="summary-section">
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-icon">🔄</div>
              <div class="summary-info">
                <div class="summary-value">${s.totalPracticeCount}</div>
                <div class="summary-label">试作总次数</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon">⏱</div>
              <div class="summary-info">
                <div class="summary-value">${formatDuration(s.totalDurationMin)}</div>
                <div class="summary-label">累计工时</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon">✅</div>
              <div class="summary-info">
                <div class="summary-value">${s.completionRate}%</div>
                <div class="summary-label">确认率</div>
              </div>
            </div>
            <div class="summary-card summary-success">
              <div class="summary-icon">🎯</div>
              <div class="summary-info">
                <div class="summary-value">${s.stableCardCount}</div>
                <div class="summary-label">稳定样片</div>
              </div>
            </div>
            <div class="summary-card summary-warning">
              <div class="summary-icon">⚠️</div>
              <div class="summary-info">
                <div class="summary-value">${s.needFollowUpCardCount}</div>
                <div class="summary-label">讲解风险点</div>
              </div>
            </div>
            <div class="summary-card summary-critical-risk">
              <div class="summary-icon">🚩</div>
              <div class="summary-info">
                <div class="summary-value">${s.unresolvedCriticalRiskCount}</div>
                <div class="summary-label">紧急风险(未解除)</div>
              </div>
            </div>
            <div class="summary-card summary-high-risk">
              <div class="summary-icon">🔶</div>
              <div class="summary-info">
                <div class="summary-value">${s.unresolvedHighRiskCount}</div>
                <div class="summary-label">高风险(未解除)</div>
              </div>
            </div>
          </div>
        </div>

        ${this.renderRiskAnalysisSection()}

        <div class="stats-section">
          <div class="stats-card">
            <h3 class="stats-title">📈 按难度分布</h3>
            <div class="difficulty-stats">
              ${r.difficultyStats.map((d) => `
                <div class="difficulty-stat-row">
                  <div class="difficulty-stat-head">
                    <span class="diff-tag diff-${d.difficulty}">${DIFFICULTY_LABELS[d.difficulty]}</span>
                    <span class="stat-count">${d.practiceCount}次试作</span>
                  </div>
                  <div class="difficulty-stat-bar">
                    <div class="stat-bar-bg">
                      <div class="stat-bar-fill diff-${d.difficulty}" style="width: ${d.completionRate}%"></div>
                    </div>
                    <span class="stat-percentage">${d.completionRate}%</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="stats-card">
            <h3 class="stats-title">📋 按状态分布</h3>
            <div class="status-stats">
              ${r.statusStats.filter((s) => s.count > 0).map((s) => `
                <div class="status-stat-row">
                  <div class="status-stat-dot" style="background: ${STATUS_COLORS[s.status]}"></div>
                  <span class="status-stat-label">${STATUS_LABELS[s.status]}</span>
                  <span class="status-stat-count">${s.count}</span>
                  <div class="status-stat-bar">
                    <div class="stat-bar-fill" style="width: ${r.summary.totalPracticeCount > 0 ? (s.count / (r.statusStats.reduce((a, b) => a + b.count, 0) || 1)) * 100 : 0}%; background: ${STATUS_COLORS[s.status]}"></div>
                  </div>
                </div>
              `).join('')}
              ${r.statusStats.every((s) => s.count === 0) ? '<div class="empty-text">暂无数据</div>' : ''}
            </div>
          </div>

          <div class="stats-card">
            <h3 class="stats-title">👤 按责任人分布</h3>
            <div class="owner-stats">
              ${r.ownerStats.length > 0 ? r.ownerStats.map((o) => `
                <div class="owner-stat-row">
                  <span class="owner-name">${o.owner}</span>
                  <div class="owner-stat-info">
                    <span class="owner-practice">试作${o.practiceCount}次</span>
                    <span class="owner-completed">确认${o.completedCount}次</span>
                  </div>
                  <div class="owner-stat-bar">
                    <div class="stat-bar-fill" style="width: ${o.practiceCount > 0 ? (o.completedCount / o.practiceCount) * 100 : 0}%"></div>
                  </div>
                </div>
              `).join('') : '<div class="empty-text">暂无数据</div>'}
            </div>
          </div>
        </div>

        <div class="analysis-section">
          <div class="analysis-card">
            <h3 class="stats-title">❌ 高频失误 (${r.frequentMistakes.length})</h3>
            <div class="mistakes-list">
              ${r.frequentMistakes.length > 0 ? r.frequentMistakes.map((m, idx) => `
                <div class="mistake-item">
                  <div class="mistake-rank">${idx + 1}</div>
                  <div class="mistake-content">
                    <div class="mistake-desc">${m.description}</div>
                    <div class="mistake-meta">
                      <span class="mistake-count">出现 ${m.count} 次</span>
                      <span class="mistake-cards">涉及 ${m.cardIds.length} 张卡片</span>
                    </div>
                  </div>
                  <div class="mistake-actions">
                    ${m.cardIds.length > 0 ? `
                      <button class="btn btn-tiny btn-view-cards" data-card-ids="${m.cardIds.join(',')}">
                        查看卡片
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('') : '<div class="empty-text">暂无失误记录</div>'}
            </div>
          </div>

          <div class="analysis-card">
            <h3 class="stats-title">🔔 需讲解样片 (${r.unstableUnpracticedCards.length})</h3>
            <p class="card-subtitle">近期未试作且工艺表现尚未稳定的样片</p>
            <div class="unstable-list">
              ${r.unstableUnpracticedCards.length > 0 ? r.unstableUnpracticedCards.map((c) => {
                const inPlan = store.isCardInTodayPlan(c.cardId);
                return `
                  <div class="unstable-item" data-card-id="${c.cardId}">
                    <div class="unstable-card-info">
                      <div class="unstable-card-head">
                        <span class="card-number">${c.patternNumber}</span>
                        <span class="diff-tag diff-${c.difficulty}">${DIFFICULTY_LABELS[c.difficulty]}</span>
                        <span class="days-ago">${c.daysSinceLastPractice}天未试作</span>
                      </div>
                      <div class="unstable-card-meta">
                        <span>试作 ${c.practiceCount} 次</span>
                        <span>确认 ${c.completedCount} 次</span>
                        <span class="stability-rate">
                          稳定度 ${c.practiceCount > 0 ? Math.round((c.completedCount / c.practiceCount) * 100) : 0}%
                        </span>
                      </div>
                    </div>
                    <div class="unstable-actions">
                      <button class="btn btn-tiny btn-add-plan" ${inPlan ? 'disabled' : ''}>
                        ${inPlan ? '已编排' : '+ 演示序列'}
                      </button>
                    </div>
                  </div>
                `;
              }).join('') : '<div class="empty-text">暂无需讲解的样片</div>'}
            </div>
          </div>

          <div class="analysis-card">
            <h3 class="stats-title">📅 演示序列归档情况</h3>
            <div class="daily-completion-list">
              ${r.dailyPlanCompletions.length > 0 ? r.dailyPlanCompletions.map((d) => `
                <div class="daily-completion-item">
                  <div class="daily-date">${d.date}</div>
                  <div class="daily-progress">
                    <div class="daily-progress-bar">
                      <div class="daily-progress-fill" style="width: ${d.completionRate}%"></div>
                    </div>
                    <span class="daily-completion-rate">${d.completionRate}%</span>
                  </div>
                  <div class="daily-stats">
                    <span>${d.completedCount}/${d.totalCount}</span>
                    <span class="daily-duration">${formatDuration(d.totalDurationMin)}</span>
                  </div>
                </div>
              `).join('') : '<div class="empty-text">暂无序列记录</div>'}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.el.querySelector('.report-close')?.addEventListener('click', () => {
      this.close();
    });

    this.el.querySelectorAll<HTMLButtonElement>('.date-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const range = btn.dataset.range as ReportDateRange;
        if (range) {
          this.setDateRange(range);
        }
      });
    });

    this.el.querySelectorAll<HTMLInputElement>('.custom-date').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.field as 'startDate' | 'endDate';
        if (field) {
          this.updateCustomDate(field, input.value);
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.btn-view-cards').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cardIds = btn.dataset.cardIds?.split(',') || [];
        if (cardIds.length > 0) {
          this.onCardClick(cardIds[0]);
          this.close();
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.btn-add-plan').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest<HTMLElement>('.unstable-item');
        const cardId = item?.dataset.cardId;
        if (cardId && !btn.disabled) {
          this.addCardToPlan(cardId);
        }
      });
    });

    this.el.querySelectorAll<HTMLElement>('.unstable-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const cardId = item.dataset.cardId;
        if (cardId) {
          this.onCardClick(cardId);
          this.close();
        }
      });
    });

    this.bindRiskEvents();
  }

  private bindRiskEvents(): void {
    this.el.querySelectorAll<HTMLButtonElement>('.risk-stat-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.riskLevel as ExhibitRiskLevel | undefined;
        if (!level) return;
        this.riskFilterLevel = this.riskFilterLevel === level ? 'all' : level;
        this.render();
      });
    });

    this.el.querySelectorAll<HTMLSelectElement>('select[data-risk-filter]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const key = sel.dataset.riskFilter as 'level' | 'source' | 'resolved';
        const value = sel.value;
        if (key === 'level') this.riskFilterLevel = value as RiskLevelFilter;
        else if (key === 'source') this.riskFilterSource = value as RiskSourceFilter;
        else if (key === 'resolved') this.riskFilterResolved = value as RiskResolvedFilter;
        this.render();
      });
    });

    this.el.querySelectorAll<HTMLElement>('.risk-snapshot-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, select, input')) return;
        const cardId = item.dataset.cardId;
        if (cardId) {
          this.onCardClick(cardId);
          this.close();
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.btn-risk-plan').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest<HTMLElement>('.risk-snapshot-item');
        const cardId = item?.dataset.cardId;
        if (cardId && !btn.disabled) {
          this.addCardToPlan(cardId);
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.btn-risk-resolve').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest<HTMLElement>('.risk-snapshot-item');
        const snapshotId = item?.dataset.snapshotId;
        if (snapshotId) {
          store.resolveExhibitRiskSnapshot(snapshotId);
          this.refresh();
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.btn-risk-open').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest<HTMLElement>('.risk-snapshot-item');
        const cardId = item?.dataset.cardId;
        if (cardId) {
          this.onCardClick(cardId);
          this.close();
        }
      });
    });
  }
}
