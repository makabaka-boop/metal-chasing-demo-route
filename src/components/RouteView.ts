import type { Card } from '../types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DIFFICULTY_LABELS,
  EXHIBIT_RISK_LEVEL_LABELS
} from '../types';
import { formatDuration, estimateTotalDuration } from '../utils/router';
import { store } from '../store';

export class RouteView {
  private el: HTMLElement;
  private onCardClick: (id: string) => void;

  constructor(onCardClick: (id: string) => void) {
    this.onCardClick = onCardClick;
    this.el = document.createElement('section');
    this.el.className = 'route-view';
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(route: Card[]): void {
    const total = estimateTotalDuration(route);
    const doneCount = route.filter((c) => store.isCardDoneToday(c.id)).length;

    this.el.innerHTML = `
      <div class="route-header">
        <div class="route-info">
          <h2>🗺️ 演示路线</h2>
          <p class="muted">critical 风险优先、high 次之，其余按工艺难度递增排列，共 ${route.length} 张样片 · 预计总工时 ${formatDuration(total)}</p>
        </div>
        <div class="route-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${route.length ? (doneCount / route.length) * 100 : 0}%"></div>
          </div>
          <span class="progress-text">${doneCount} / ${route.length}</span>
        </div>
      </div>
      <div class="route-timeline">
        ${
          route.length === 0
            ? `<div class="empty-state"><div class="empty-icon">📋</div><p>暂无可编排的工艺卡片</p></div>`
            : route
                .map(
                  (c, idx) => {
                    const stats = store.getCardReviewStats(c.id);
                    const inPlan = store.isCardInTodayPlan(c.id);
                    const planStatus = store.getTodayPlanItemStatus(c.id);
                    // 与卡片列表读取同一份快照，解释路线排序原因
                    const risk = store.getExhibitRiskSnapshots(c.id).find((s) => !s.resolved);
                    const riskBadge = risk
                      ? `<span class="risk-badge risk-${risk.riskLevel}" title="${risk.recommendedAction}">🛡 ${EXHIBIT_RISK_LEVEL_LABELS[risk.riskLevel]}</span>`
                      : '';

                    let planBadge = '';
                    if (inPlan && planStatus) {
                      const statusLabels: Record<string, string> = {
                        pending: '待排',
                        in_progress: '排练中',
                        completed: '已完成',
                        skipped: '暂不演示'
                      };
                      planBadge = `<span class="route-plan-badge plan-status-${planStatus}">📋 ${statusLabels[planStatus]}</span>`;
                    }

                    return `
              <div class="route-step ${store.isCardDoneToday(c.id) ? 'is-done' : ''}" data-id="${c.id}">
                <div class="route-marker" style="background:var(--diff-${c.difficulty})">
                  <span>${idx + 1}</span>
                </div>
                <div class="route-line"></div>
                <div class="route-card" style="border-left:3px solid var(--diff-${c.difficulty})">
                  <div class="route-card-head">
                    <div>
                      <span class="card-number">${c.patternNumber}</span>
                      <span class="diff-tag diff-${c.difficulty}">${DIFFICULTY_LABELS[c.difficulty]}</span>
                      <span class="card-badge" style="background:${STATUS_COLORS[c.status]}">${STATUS_LABELS[c.status]}</span>
                      ${stats.isStable ? '<span class="route-stable-badge">✅ 稳定</span>' : ''}
                      ${planBadge}
                      ${riskBadge}
                    </div>
                    <label class="route-check">
                      <input type="checkbox" ${store.isCardDoneToday(c.id) ? 'checked' : ''} />
                      <span>已确认</span>
                    </label>
                  </div>
                  <div class="route-card-body">
                    <div class="meta-row">
                      <span>📏 ${c.metalSpec}</span>
                      <span>⏱ ${formatDuration(c.durationMin)}</span>
                      <span>👤 ${c.owner || '未分配'}</span>
                      ${c.starred ? '<span>⭐ 重点</span>' : ''}
                      ${stats.practiceCount > 0 ? `<span>📝 试作${stats.practiceCount}次</span>` : ''}
                    </div>
                    ${c.steps ? `<p class="route-steps">${c.steps.split('\n').slice(0, 2).join(' / ')}</p>` : ''}
                    ${c.mistakes ? `<div class="route-mistakes">⚠ ${c.mistakes}</div>` : ''}
                  </div>
                </div>
              </div>
            `;
                  }
                )
                .join('')
        }
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.el.querySelectorAll<HTMLElement>('.route-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('input, label')) return;
        const step = card.closest<HTMLElement>('.route-step');
        const id = step?.dataset.id;
        if (id) this.onCardClick(id);
      });
    });

    this.el.querySelectorAll<HTMLInputElement>('.route-check input').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const step = (e.target as HTMLElement).closest<HTMLElement>('.route-step');
        const id = step?.dataset.id;
        if (!id) return;
        if (cb.checked) {
          store.markCardDoneToday(id);
        } else {
          store.unmarkCardDoneToday(id);
        }
      });
    });
  }
}
