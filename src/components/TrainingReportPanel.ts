import { store } from '../store';
import type {
  TrainingReport,
  ReportDateRangeConfig,
  ReportDateRange,
  ExhibitRiskLevel,
  ExhibitRiskSource
} from '../types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DIFFICULTY_LABELS,
  EXHIBIT_RISK_LEVEL_LABELS,
  EXHIBIT_RISK_SOURCE_LABELS
} from '../types';
import { formatDuration } from '../utils/router';
import {
  countExhibitRiskByLevel,
  filterExhibitRiskSnapshots
} from '../utils/exhibitRisk';
import type { ExhibitRiskFilter } from '../utils/exhibitRisk';

export class TrainingReportPanel {
  private el: HTMLElement;
  private onCardClick: (id: string) => void;
  private onClose: () => void;
  private isOpen = false;
  private dateRange: ReportDateRangeConfig = { type: '7days' };
  private report: TrainingReport | null = null;
  private riskFilter: ExhibitRiskFilter = { resolved: false };

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

  // 风险分析区域：复用 store.getExhibitRiskSnapshots() 的原始快照，
  // 顶部统计各等级数量，中部按 riskLevel / source / resolved 过滤并展示列表。
  private renderRiskAnalysis(): string {
    const snapshots = store.getExhibitRiskSnapshots();
    const counts = countExhibitRiskByLevel(snapshots);
    const filtered = filterExhibitRiskSnapshots(snapshots, this.riskFilter);

    const levels: ExhibitRiskLevel[] = ['low', 'medium', 'high', 'critical'];
    const sources: ExhibitRiskSource[] = ['manual', 'review', 'plan', 'report'];
    const f = this.riskFilter;

    const levelCards = levels
      .map(
        (lv) => `
        <div class="risk-count-card risk-tone-${lv}">
          <div class="risk-count-value">${counts[lv]}</div>
          <div class="risk-count-label">${EXHIBIT_RISK_LEVEL_LABELS[lv]}</div>
        </div>`
      )
      .join('');

    const levelOptions = levels
      .map(
        (lv) =>
          `<option value="${lv}" ${f.riskLevel === lv ? 'selected' : ''}>${EXHIBIT_RISK_LEVEL_LABELS[lv]}</option>`
      )
      .join('');
    const sourceOptions = sources
      .map(
        (src) =>
          `<option value="${src}" ${f.source === src ? 'selected' : ''}>${EXHIBIT_RISK_SOURCE_LABELS[src]}</option>`
      )
      .join('');

    const listHtml =
      filtered.length > 0
        ? filtered.map((snap) => this.renderRiskItem(snap)).join('')
        : '<div class="empty-text">当前筛选条件下暂无风险快照</div>';

    return `
      <div class="risk-analysis-section">
        <div class="stats-card">
          <h3 class="stats-title">🚨 展品风险处置</h3>
          <p class="card-subtitle">按等级集中统计与处置未解决风险，critical 始终优先展示</p>

          <div class="risk-count-grid">
            ${levelCards}
          </div>

          <div class="risk-filter-bar">
            <div class="risk-filter-group">
              <label>风险等级</label>
              <select class="risk-filter" data-risk-filter="riskLevel">
                <option value="" ${!f.riskLevel ? 'selected' : ''}>全部</option>
                ${levelOptions}
              </select>
            </div>
            <div class="risk-filter-group">
              <label>来源</label>
              <select class="risk-filter" data-risk-filter="source">
                <option value="" ${!f.source ? 'selected' : ''}>全部</option>
                ${sourceOptions}
              </select>
            </div>
            <div class="risk-filter-group">
              <label>处置状态</label>
              <select class="risk-filter" data-risk-filter="resolved">
                <option value="false" ${f.resolved === false ? 'selected' : ''}>未解决</option>
                <option value="true" ${f.resolved === true ? 'selected' : ''}>已解决</option>
              </select>
            </div>
          </div>

          <div class="risk-list">
            ${listHtml}
          </div>
        </div>
      </div>
    `;
  }

  private renderRiskItem(snap: {
    id: string;
    cardId: string;
    snapshotDate: string;
    riskLevel: ExhibitRiskLevel;
    riskReasons: string[];
    recommendedAction: string;
    source: ExhibitRiskSource;
    resolved: boolean;
  }): string {
    const card = store.getCard(snap.cardId);
    const stats = store.getCardReviewStats(snap.cardId);
    const inPlan = store.isCardInTodayPlan(snap.cardId);
    const isCritical = snap.riskLevel === 'critical' && !snap.resolved;

    const patternNumber = card?.patternNumber ?? '（样片已删除）';
    const difficultyTag = card
      ? `<span class="diff-tag diff-${card.difficulty}">${DIFFICULTY_LABELS[card.difficulty]}</span>`
      : '';
    const lastPractice = stats.lastPracticeDate
      ? `最近试作 ${stats.lastPracticeDate}`
      : '尚无试作记录';

    return `
      <div class="risk-item risk-tone-${snap.riskLevel}${isCritical ? ' risk-item-critical' : ''}" data-card-id="${snap.cardId}">
        <div class="risk-item-main">
          <div class="risk-item-head">
            <span class="risk-badge risk-badge-${snap.riskLevel}${isCritical ? ' risk-badge-critical-pulse' : ''}">⚠ ${EXHIBIT_RISK_LEVEL_LABELS[snap.riskLevel]}</span>
            <span class="card-number">${patternNumber}</span>
            ${difficultyTag}
            <span class="risk-item-source">${EXHIBIT_RISK_SOURCE_LABELS[snap.source]} · ${snap.snapshotDate}</span>
          </div>
          <div class="risk-item-sub">${lastPractice}</div>
          <ul class="risk-item-reasons">
            ${snap.riskReasons.map((r) => `<li>${r}</li>`).join('')}
          </ul>
          ${snap.recommendedAction ? `<div class="risk-item-action">👉 ${snap.recommendedAction}</div>` : ''}
        </div>
        <div class="risk-item-actions">
          <button class="btn btn-tiny risk-add-plan" data-card-id="${snap.cardId}" ${inPlan || !card ? 'disabled' : ''}>
            ${inPlan ? '已编排' : '+ 演示序列'}
          </button>
          ${
            snap.resolved
              ? '<span class="risk-resolved-tag">✅ 已解决</span>'
              : `<button class="btn btn-tiny btn-primary risk-resolve" data-risk-id="${snap.id}">标记解决</button>`
          }
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
            <div class="summary-card summary-warning">
              <div class="summary-icon">🚩</div>
              <div class="summary-info">
                <div class="summary-value">${s.activeRiskCardCount}</div>
                <div class="summary-label">未消解风险快照</div>
              </div>
            </div>
          </div>
        </div>

        ${this.renderRiskAnalysis()}

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

    // 风险分析区域：过滤器、加入演示序列、标记解决、点击样片打开编辑
    this.el.querySelectorAll<HTMLSelectElement>('.risk-filter').forEach((sel) => {
      sel.addEventListener('change', () => {
        const key = sel.dataset.riskFilter as 'riskLevel' | 'source' | 'resolved';
        this.updateRiskFilter(key, sel.value);
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.risk-add-plan').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardId = btn.dataset.cardId;
        if (cardId && !btn.disabled) {
          this.addCardToPlan(cardId);
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.risk-resolve').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const riskId = btn.dataset.riskId;
        if (riskId) {
          store.resolveExhibitRiskSnapshot(riskId);
          this.refresh();
        }
      });
    });

    this.el.querySelectorAll<HTMLElement>('.risk-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const cardId = item.dataset.cardId;
        if (cardId && store.getCard(cardId)) {
          this.onCardClick(cardId);
          this.close();
        }
      });
    });
  }

  private updateRiskFilter(
    key: 'riskLevel' | 'source' | 'resolved',
    value: string
  ): void {
    if (key === 'resolved') {
      this.riskFilter = { ...this.riskFilter, resolved: value === 'true' };
    } else if (key === 'riskLevel') {
      this.riskFilter = {
        ...this.riskFilter,
        riskLevel: value ? (value as ExhibitRiskLevel) : undefined
      };
    } else {
      this.riskFilter = {
        ...this.riskFilter,
        source: value ? (value as ExhibitRiskSource) : undefined
      };
    }
    this.refresh();
  }
}
