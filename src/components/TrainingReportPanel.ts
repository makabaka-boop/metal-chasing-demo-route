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
  EXHIBIT_RISK_REASON_LABELS,
  EXHIBIT_RISK_SOURCE_LABELS
} from '../types';
import { formatDuration } from '../utils/router';
import { sortExhibitRiskSnapshots } from '../utils/exhibitRisk';

type ExhibitRiskResolvedFilter = 'all' | 'unresolved' | 'resolved';

export class TrainingReportPanel {
  private el: HTMLElement;
  private onCardClick: (id: string) => void;
  private onClose: () => void;
  private isOpen = false;
  private dateRange: ReportDateRangeConfig = { type: '7days' };
  private report: TrainingReport | null = null;
  private riskLevelFilter: ExhibitRiskLevel | '' = '';
  private riskSourceFilter: ExhibitRiskSource | '' = '';
  private riskResolvedFilter: ExhibitRiskResolvedFilter = 'unresolved';

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
            <div class="summary-card ${s.criticalRiskCount > 0 ? 'summary-warning' : ''}">
              <div class="summary-icon">🚨</div>
              <div class="summary-info">
                <div class="summary-value" style="${s.criticalRiskCount > 0 ? 'color:#E74C3C' : ''}">${s.criticalRiskCount}</div>
                <div class="summary-label">紧急风险</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon">🛰️</div>
              <div class="summary-info">
                <div class="summary-value">${s.unresolvedRiskCount}</div>
                <div class="summary-label">未解除风险</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon">📝</div>
              <div class="summary-info">
                <div class="summary-value">${s.reviewRiskCount}</div>
                <div class="summary-label">复核来源风险</div>
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

  private getRiskSnapshots(): ExhibitRiskSnapshot[] {
    let list = store.getExhibitRiskSnapshots();

    if (this.riskLevelFilter) {
      list = list.filter(
        (s) => s.riskLevel === this.riskLevelFilter || s.riskLevel === 'critical'
      );
    }
    if (this.riskSourceFilter) {
      list = list.filter((s) => s.source === this.riskSourceFilter);
    }
    if (this.riskResolvedFilter === 'unresolved') {
      list = list.filter((s) => !s.resolved || s.riskLevel === 'critical');
    } else if (this.riskResolvedFilter === 'resolved') {
      list = list.filter((s) => s.resolved);
    }

    return sortExhibitRiskSnapshots(list);
  }

  private countRiskLevel(
    snapshots: ExhibitRiskSnapshot[],
    level: ExhibitRiskLevel
  ): number {
    return snapshots.filter((s) => s.riskLevel === level).length;
  }

  private renderRiskAnalysisSection(): string {
    const allSnapshots = store.getExhibitRiskSnapshots();
    const criticalCount = this.countRiskLevel(allSnapshots, 'critical');
    const highCount = this.countRiskLevel(allSnapshots, 'high');
    const mediumCount = this.countRiskLevel(allSnapshots, 'medium');
    const lowCount = this.countRiskLevel(allSnapshots, 'low');

    const filtered = this.getRiskSnapshots();

    return `
      <section class="risk-analysis-section">
        <div class="risk-analysis-header">
          <h3 class="stats-title">🛰️ 展品风险快照 (${allSnapshots.length})</h3>
          <p class="card-subtitle">按 critical 优先集中处置；筛选不会隐藏未解决的紧急风险</p>
        </div>

        <div class="risk-level-overview">
          ${this.renderRiskLevelCard('critical', '紧急', criticalCount)}
          ${this.renderRiskLevelCard('high', '高风险', highCount)}
          ${this.renderRiskLevelCard('medium', '中风险', mediumCount)}
          ${this.renderRiskLevelCard('low', '低风险', lowCount)}
        </div>

        <div class="risk-filters">
          <div class="risk-filter-group">
            <label>风险等级</label>
            <select class="risk-filter-select" data-risk-filter="level">
              <option value="" ${!this.riskLevelFilter ? 'selected' : ''}>全部</option>
              ${(['critical', 'high', 'medium', 'low'] as ExhibitRiskLevel[])
                .map(
                  (lvl) =>
                    `<option value="${lvl}" ${this.riskLevelFilter === lvl ? 'selected' : ''}>${EXHIBIT_RISK_LEVEL_LABELS[lvl]}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="risk-filter-group">
            <label>来源</label>
            <select class="risk-filter-select" data-risk-filter="source">
              <option value="" ${!this.riskSourceFilter ? 'selected' : ''}>全部</option>
              ${(['manual', 'review', 'plan', 'report'] as ExhibitRiskSource[])
                .map(
                  (src) =>
                    `<option value="${src}" ${this.riskSourceFilter === src ? 'selected' : ''}>${EXHIBIT_RISK_SOURCE_LABELS[src]}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="risk-filter-group">
            <label>状态</label>
            <select class="risk-filter-select" data-risk-filter="resolved">
              <option value="unresolved" ${this.riskResolvedFilter === 'unresolved' ? 'selected' : ''}>未解除</option>
              <option value="all" ${this.riskResolvedFilter === 'all' ? 'selected' : ''}>全部</option>
              <option value="resolved" ${this.riskResolvedFilter === 'resolved' ? 'selected' : ''}>已解除</option>
            </select>
          </div>
        </div>

        <div class="risk-snapshot-list">
          ${
            filtered.length === 0
              ? '<div class="empty-text">暂无符合条件的风险快照</div>'
              : filtered
                  .map((snapshot) => this.renderRiskSnapshotItem(snapshot))
                  .join('')
          }
        </div>
      </section>
    `;
  }

  private renderRiskLevelCard(level: ExhibitRiskLevel, label: string, count: number): string {
    const isCritical = level === 'critical';
    return `
      <button
        class="risk-level-card risk-level-${level} ${this.riskLevelFilter === level ? 'is-active' : ''} ${isCritical && count > 0 ? 'is-pulsing' : ''}"
        data-risk-level-card="${level}"
        style="border-color:${EXHIBIT_RISK_LEVEL_COLORS[level]}"
      >
        <div class="risk-level-count" style="color:${EXHIBIT_RISK_LEVEL_COLORS[level]}">${count}</div>
        <div class="risk-level-label">${label}</div>
      </button>
    `;
  }

  private renderRiskSnapshotItem(snapshot: ExhibitRiskSnapshot): string {
    const card = store.getCard(snapshot.cardId);
    if (!card) return '';

    const stats = store.getCardReviewStats(snapshot.cardId);
    const inPlan = store.isCardInTodayPlan(snapshot.cardId);
    const isCriticalUnresolved = snapshot.riskLevel === 'critical' && !snapshot.resolved;

    const reasonsHtml = snapshot.riskReasons.length > 0
      ? snapshot.riskReasons
          .map(
            (r) =>
              `<span class="risk-reason-tag" style="color:${EXHIBIT_RISK_LEVEL_COLORS[snapshot.riskLevel]};border-color:${EXHIBIT_RISK_LEVEL_COLORS[snapshot.riskLevel]}40">${EXHIBIT_RISK_REASON_LABELS[r]}</span>`
          )
          .join('')
      : '<span class="muted">无</span>';

    return `
      <div
        class="risk-snapshot-item ${isCriticalUnresolved ? 'is-critical' : ''} ${snapshot.resolved ? 'is-resolved' : ''}"
        data-snapshot-id="${snapshot.id}"
        data-card-id="${snapshot.cardId}"
      >
        <div class="risk-snapshot-head">
          <div class="risk-snapshot-id">
            <span class="card-number">${card.patternNumber}</span>
            <span class="diff-tag diff-${card.difficulty}">${DIFFICULTY_LABELS[card.difficulty]}</span>
            <span
              class="risk-level-badge"
              style="background:${EXHIBIT_RISK_LEVEL_COLORS[snapshot.riskLevel]}"
            >${EXHIBIT_RISK_LEVEL_LABELS[snapshot.riskLevel]}</span>
            <span class="risk-source-tag">${EXHIBIT_RISK_SOURCE_LABELS[snapshot.source]}</span>
            ${snapshot.resolved ? '<span class="risk-resolved-tag">已解除</span>' : ''}
          </div>
          <div class="risk-snapshot-date">
            ${snapshot.snapshotDate}
            ${stats.lastPracticeDate ? ` · 最近试作 ${stats.lastPracticeDate}` : ' · 暂无试作记录'}
          </div>
        </div>
        <div class="risk-snapshot-reasons">${reasonsHtml}</div>
        ${
          snapshot.recommendedAction
            ? `<div class="risk-snapshot-action">💡 ${snapshot.recommendedAction}</div>`
            : ''
        }
        <div class="risk-snapshot-foot">
          <button class="btn btn-tiny risk-open-card" data-card-id="${snapshot.cardId}">查看样片</button>
          <button
            class="btn btn-tiny risk-add-plan"
            data-card-id="${snapshot.cardId}"
            ${inPlan ? 'disabled' : ''}
          >${inPlan ? '✓ 已在演示序列' : '📋 加入演示序列'}</button>
          ${
            !snapshot.resolved
              ? `<button class="btn btn-tiny risk-resolve" data-snapshot-id="${snapshot.id}">✓ 标记解决</button>`
              : ''
          }
        </div>
      </div>
    `;
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

    this.el.querySelectorAll<HTMLSelectElement>('.risk-filter-select').forEach((select) => {
      select.addEventListener('change', () => {
        const key = select.dataset.riskFilter;
        const value = select.value;
        if (key === 'level') {
          this.riskLevelFilter = (value || '') as ExhibitRiskLevel | '';
        } else if (key === 'source') {
          this.riskSourceFilter = (value || '') as ExhibitRiskSource | '';
        } else if (key === 'resolved') {
          this.riskResolvedFilter = (value || 'unresolved') as ExhibitRiskResolvedFilter;
        }
        this.render();
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('[data-risk-level-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const level = btn.dataset.riskLevelCard as ExhibitRiskLevel | undefined;
        if (!level) return;
        this.riskLevelFilter = this.riskLevelFilter === level ? '' : level;
        this.render();
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.risk-open-card').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardId = btn.dataset.cardId;
        if (cardId) {
          this.onCardClick(cardId);
          this.close();
        }
      });
    });

    this.el.querySelectorAll<HTMLElement>('.risk-snapshot-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button, select, input, label')) return;
        const cardId = item.dataset.cardId;
        if (cardId) {
          this.onCardClick(cardId);
          this.close();
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.risk-add-plan').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardId = btn.dataset.cardId;
        if (cardId && !btn.disabled) {
          store.addCardsToTodayPlan([cardId]);
          this.refresh();
        }
      });
    });

    this.el.querySelectorAll<HTMLButtonElement>('.risk-resolve').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const snapshotId = btn.dataset.snapshotId;
        if (snapshotId) {
          store.resolveExhibitRiskSnapshot(snapshotId);
          this.refresh();
        }
      });
    });
  }
}
