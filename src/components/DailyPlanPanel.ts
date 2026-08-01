import { store } from '../store';
import type { DailyPlan } from '../types';
import {
  STATUS_LABELS,
  DIFFICULTY_LABELS,
  STATUS_COLORS
} from '../types';
import { formatDuration } from '../utils/router';

export class DailyPlanPanel {
  private el: HTMLElement;
  private onCardClick: (id: string) => void;
  private onClose: () => void;
  private isOpen = false;
  private draggedCardId: string | null = null;

  constructor(onCardClick: (id: string) => void, onClose: () => void) {
    this.onCardClick = onCardClick;
    this.onClose = onClose;
    this.el = document.createElement('div');
    this.el.className = 'daily-plan-panel';
  }

  getElement(): HTMLElement {
    return this.el;
  }

  open(): void {
    this.isOpen = true;
    this.render();
  }

  close(): void {
    this.isOpen = false;
    this.onClose();
  }

  refresh(): void {
    if (this.isOpen) {
      this.render();
    }
  }

  private render(): void {
    const plan = store.getTodayPlan();

    if (!plan) {
      this.renderEmptyState();
      this.bindEvents();
      return;
    }

    switch (plan.status) {
      case 'planning':
        this.renderPlanningState(plan);
        break;
      case 'in_progress':
        this.renderInProgressState(plan);
        break;
      case 'completed':
        this.renderCompletedState(plan);
        break;
    }

    this.bindEvents();
  }

  private renderEmptyState(): void {
    this.el.innerHTML = `
      <div class="plan-empty">
        <div class="plan-empty-icon">📋</div>
        <h3>工坊演示序列</h3>
        <p class="muted">根据"未稳定样片优先、久未试作优先、展示重点优先"的规则推荐编排</p>
        <button class="btn btn-primary btn-generate-plan">✨ 生成演示序列</button>
        <p class="muted plan-empty-hint">或从工艺卡片中手动选择样片</p>
      </div>
    `;
  }

  private renderPlanningState(plan: DailyPlan): void {
    const items = [...plan.items].sort((a, b) => a.order - b.order);
    const cardsWithItems = items.map((item) => ({
      item,
      card: store.getCard(item.cardId)
    })).filter((x) => x.card);

    const totalDuration = cardsWithItems.reduce(
      (sum, x) => sum + (x.card?.durationMin || 0),
      0
    );

    const recommendations = store.recommendTodayCards(5);

    this.el.innerHTML = `
      <div class="plan-header">
        <div class="plan-title-section">
          <h2>📋 工坊演示序列</h2>
          <span class="plan-date">${plan.date}</span>
        </div>
        <button class="btn-icon plan-close" title="关闭">✕</button>
      </div>

      <div class="plan-goal-section">
        <label class="plan-goal-label">演示目标</label>
        <textarea
          class="plan-goal-input"
          placeholder="写下本次演示要覆盖的工艺重点..."
          rows="2"
        >${plan.goal || ''}</textarea>
      </div>

      <div class="plan-list-section">
        <div class="plan-list-header">
          <h3>待演示样片 (${items.length}张)</h3>
          <span class="plan-estimate">预计 ${formatDuration(totalDuration)}</span>
        </div>

        <div class="plan-list ${items.length === 0 ? 'is-empty' : ''}">
          ${
            items.length === 0
              ? `<div class="plan-list-empty">
                  <p>还没有添加样片</p>
                  <p class="muted">从下方推荐中添加，或从工艺卡片选择</p>
                 </div>`
              : cardsWithItems
                  .map(
                    ({ item, card }) => `
                  <div class="plan-item" data-card-id="${card!.id}" draggable="true">
                    <div class="plan-item-handle">⋮⋮</div>
                    <div class="plan-item-order">${item.order + 1}</div>
                    <div class="plan-item-content" style="border-left:3px solid var(--diff-${card!.difficulty})">
                      <div class="plan-item-head">
                        <span class="card-number">${card!.patternNumber}</span>
                        <span class="diff-tag diff-${card!.difficulty}">${DIFFICULTY_LABELS[card!.difficulty]}</span>
                        <span class="card-badge" style="background:${STATUS_COLORS[card!.status]}">${STATUS_LABELS[card!.status]}</span>
                        ${card!.starred ? '<span class="star-icon">⭐</span>' : ''}
                      </div>
                      <div class="plan-item-meta">
                        <span>📏 ${card!.metalSpec}</span>
                        <span>⏱ ${formatDuration(card!.durationMin)}</span>
                        <span>👤 ${card!.owner || '未分配'}</span>
                      </div>
                    </div>
                    <button class="btn-icon plan-item-remove" title="移除">✕</button>
                  </div>
                `
                  )
                  .join('')
          }
        </div>
      </div>

      ${
        recommendations.length > 0
          ? `
      <div class="plan-recommend-section">
        <h3>💡 推荐样片</h3>
        <div class="plan-recommend-list">
          ${recommendations
            .map(
              (card) => `
            <div class="plan-recommend-item" data-card-id="${card.id}">
              <div class="recommend-item-info">
                <span class="card-number">${card.patternNumber}</span>
                <span class="diff-tag diff-${card.difficulty}">${DIFFICULTY_LABELS[card.difficulty]}</span>
                <span class="recommend-duration">⏱ ${formatDuration(card.durationMin)}</span>
              </div>
              <button class="btn btn-tiny btn-add-recommend">添加</button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
      `
          : ''
      }

      <div class="plan-footer">
        <button class="btn btn-ghost btn-reset-plan">重新生成</button>
        <button class="btn btn-primary btn-start-plan" ${items.length === 0 ? 'disabled' : ''}>
          ▶ 开始排练
        </button>
      </div>
    `;
  }

  private renderInProgressState(plan: DailyPlan): void {
    const items = [...plan.items].sort((a, b) => a.order - b.order);
    const completedCount = items.filter((i) => i.status === 'completed').length;
    const skippedCount = items.filter((i) => i.status === 'skipped').length;
    const pendingCount = items.length - completedCount - skippedCount;
    const totalDuration = items
      .filter((i) => i.status === 'completed')
      .reduce((sum, i) => sum + (i.actualDurationMin || 0), 0);

    const currentIndex = items.findIndex(
      (i) => i.status === 'pending' || i.status === 'in_progress'
    );
    const currentItem = currentIndex >= 0 ? items[currentIndex] : null;
    const currentCard = currentItem ? store.getCard(currentItem.cardId) : null;

    this.el.innerHTML = `
      <div class="plan-header">
        <div class="plan-title-section">
          <h2>🔥 演示排练中</h2>
          <span class="plan-date">${plan.date}</span>
        </div>
        <button class="btn-icon plan-close" title="最小化">—</button>
      </div>

      <div class="plan-progress-section">
        <div class="plan-progress-bar">
          <div class="plan-progress-fill" style="width:${items.length ? (completedCount / items.length) * 100 : 0}%"></div>
        </div>
        <div class="plan-progress-stats">
          <span>已确认 ${completedCount}/${items.length}</span>
          <span>已用时 ${formatDuration(totalDuration)}</span>
        </div>
      </div>

      ${
        currentCard && currentItem
          ? `
      <div class="plan-current-card">
        <div class="current-card-label">当前样片</div>
        <div class="current-card-content" style="border-left:4px solid var(--diff-${currentCard.difficulty})">
          <div class="current-card-head">
            <span class="current-card-number">${currentCard.patternNumber}</span>
            <span class="diff-tag diff-${currentCard.difficulty}">${DIFFICULTY_LABELS[currentCard.difficulty]}</span>
            <span class="card-badge" style="background:${STATUS_COLORS[currentCard.status]}">${STATUS_LABELS[currentCard.status]}</span>
            ${currentCard.starred ? '<span class="star-icon">⭐</span>' : ''}
          </div>
          <div class="current-card-meta">
            <span>📏 ${currentCard.metalSpec}</span>
            <span>⏱ 预计 ${formatDuration(currentCard.durationMin)}</span>
            <span>👤 ${currentCard.owner || '未分配'}</span>
          </div>
          ${currentCard.steps ? `<div class="current-card-steps"><strong>步骤：</strong>${currentCard.steps.replace(/\n/g, ' / ')}</div>` : ''}
          ${currentCard.mistakes ? `<div class="current-card-mistakes">⚠ ${currentCard.mistakes}</div>` : ''}

          <div class="current-card-actions">
            <div class="duration-input-group">
              <label>实际工时(分钟)</label>
              <input type="number" class="actual-duration-input" min="1" value="${currentCard.durationMin}" />
            </div>
            <div class="complete-actions">
              <button class="btn btn-ghost btn-skip-item">跳过</button>
              <button class="btn btn-primary btn-complete-item">✓ 确认样片</button>
            </div>
          </div>
        </div>
      </div>
      `
          : `
      <div class="plan-all-done">
        <div class="all-done-icon">🎉</div>
        <p>所有样片都已处理！</p>
      </div>
      `
      }

      <div class="plan-list-section">
        <div class="plan-list-header">
          <h3>全部项目</h3>
          <div class="plan-status-tags">
            <span class="status-tag status-completed">确认 ${completedCount}</span>
            <span class="status-tag status-skipped">暂缓 ${skippedCount}</span>
            <span class="status-tag status-pending">待排 ${pendingCount}</span>
          </div>
        </div>

        <div class="plan-list plan-list-compact">
          ${items
            .map((item, idx) => {
              const card = store.getCard(item.cardId);
              if (!card) return '';
              const isCurrent = idx === currentIndex;
              return `
            <div class="plan-item plan-item-small ${item.status} ${isCurrent ? 'is-current' : ''}" data-card-id="${card.id}">
              <div class="plan-item-order-small">${idx + 1}</div>
              <div class="plan-item-content-small">
                <span class="card-number">${card.patternNumber}</span>
                ${item.status === 'completed' && item.actualDurationMin
                  ? `<span class="actual-time">⏱ ${item.actualDurationMin}分钟</span>`
                  : ''}
              </div>
              <div class="plan-item-status">
                ${item.status === 'completed' ? '<span class="status-icon">✓</span>' : ''}
                ${item.status === 'skipped' ? '<span class="status-icon skipped">⊘</span>' : ''}
                ${item.status === 'pending' ? '<span class="status-dot"></span>' : ''}
                ${item.status === 'in_progress' ? '<span class="status-dot active"></span>' : ''}
              </div>
            </div>
          `;
            })
            .join('')}
        </div>
      </div>

      <div class="plan-footer">
        <button class="btn btn-ghost btn-finish-plan">
          归档演示序列
        </button>
      </div>
    `;
  }

  private renderCompletedState(plan: DailyPlan): void {
    const summary = plan.summary;

    this.el.innerHTML = `
      <div class="plan-header">
        <div class="plan-title-section">
          <h2>🎉 演示序列归档</h2>
          <span class="plan-date">${plan.date}</span>
        </div>
        <button class="btn-icon plan-close" title="关闭">✕</button>
      </div>

      ${
        summary
          ? `
      <div class="plan-summary-section">
        <div class="summary-text">${summary.summaryText}</div>

        <div class="summary-stats-grid">
          <div class="summary-stat-card">
            <span class="summary-stat-value">${summary.totalCount}</span>
            <span class="summary-stat-label">样片总数</span>
          </div>
          <div class="summary-stat-card stat-success">
            <span class="summary-stat-value">${summary.completedCount}</span>
            <span class="summary-stat-label">已确认</span>
          </div>
          <div class="summary-stat-card stat-pending">
            <span class="summary-stat-value">${summary.pendingCount}</span>
            <span class="summary-stat-label">待跟进</span>
          </div>
          <div class="summary-stat-card stat-warning">
            <span class="summary-stat-value">${summary.skippedCount}</span>
            <span class="summary-stat-label">已暂缓</span>
          </div>
          <div class="summary-stat-card stat-info">
            <span class="summary-stat-value">${formatDuration(summary.totalDurationMin)}</span>
            <span class="summary-stat-label">总耗时</span>
          </div>
        </div>

        ${
          summary.followUpCardIds.length > 0
            ? `
        <div class="followup-section">
          <h3>📌 下次继续讲解 (${summary.followUpCardIds.length}张)</h3>
          <div class="followup-list">
            ${summary.followUpCardIds
              .map((id) => {
                const card = store.getCard(id);
                if (!card) return '';
                return `
              <div class="followup-item" data-card-id="${card.id}">
                <span class="diff-tag diff-${card.difficulty}">${DIFFICULTY_LABELS[card.difficulty]}</span>
                <span class="card-number">${card.patternNumber}</span>
              </div>
            `;
              })
              .join('')}
          </div>
        </div>
        `
            : ''
        }
      </div>
      `
          : ''
      }

      ${
        plan.goal
          ? `
      <div class="plan-goal-review">
        <h4>演示目标回顾</h4>
        <p>${plan.goal}</p>
      </div>
      `
          : ''
      }

      <div class="plan-footer">
        <button class="btn btn-primary btn-close-plan">完成</button>
      </div>
    `;
  }

  private bindEvents(): void {
    this.el.querySelector('.plan-close')?.addEventListener('click', () => {
      this.close();
    });

    this.el.querySelector('.btn-generate-plan')?.addEventListener('click', () => {
      store.createTodayPlan();
      this.render();
    });

    const goalInput = this.el.querySelector<HTMLTextAreaElement>('.plan-goal-input');
    if (goalInput) {
      goalInput.addEventListener('change', () => {
        store.updateTodayPlan({ goal: goalInput.value });
      });
    }

    this.el.querySelectorAll('.plan-item-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = (e.target as HTMLElement).closest('.plan-item');
        const cardId = item?.getAttribute('data-card-id');
        if (cardId) {
          store.removeCardFromTodayPlan(cardId);
          this.render();
        }
      });
    });

    this.el.querySelectorAll('.btn-add-recommend').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.plan-recommend-item');
        const cardId = item?.getAttribute('data-card-id');
        if (cardId) {
          store.addCardsToTodayPlan([cardId]);
          this.render();
        }
      });
    });

    this.el.querySelector('.btn-reset-plan')?.addEventListener('click', () => {
      if (confirm('确定要重新生成演示序列吗？当前选择会被清空。')) {
        const plan = store.getTodayPlan();
        if (plan) {
          for (const item of plan.items) {
            store.removeCardFromTodayPlan(item.cardId);
          }
        }
        const recs = store.recommendTodayCards(8);
        store.addCardsToTodayPlan(recs.map((c) => c.id));
        this.render();
      }
    });

    this.el.querySelector('.btn-start-plan')?.addEventListener('click', () => {
      store.startTodayPlan();
      this.render();
    });

    this.el.querySelector('.btn-complete-item')?.addEventListener('click', () => {
      const plan = store.getTodayPlan();
      if (!plan) return;

      const items = [...plan.items].sort((a, b) => a.order - b.order);
      const currentIndex = items.findIndex(
        (i) => i.status === 'pending' || i.status === 'in_progress'
      );
      if (currentIndex < 0) return;

      const currentItem = items[currentIndex];
      const durationInput = this.el.querySelector<HTMLInputElement>('.actual-duration-input');
      const duration = Number(durationInput?.value) || 0;

      if (duration < 1) {
        alert('请填写有效的实际工时');
        return;
      }

      store.completeTodayPlanItem(currentItem.cardId, duration);
      this.render();
    });

    this.el.querySelector('.btn-skip-item')?.addEventListener('click', () => {
      const plan = store.getTodayPlan();
      if (!plan) return;

      const items = [...plan.items].sort((a, b) => a.order - b.order);
      const currentIndex = items.findIndex(
        (i) => i.status === 'pending' || i.status === 'in_progress'
      );
      if (currentIndex < 0) return;

      if (confirm('确定要暂缓这张样片吗？')) {
        store.skipTodayPlanItem(items[currentIndex].cardId);
        this.render();
      }
    });

    this.el.querySelector('.btn-finish-plan')?.addEventListener('click', () => {
      if (confirm('确定要归档本次演示序列吗？')) {
        store.finishTodayPlan();
        this.render();
      }
    });

    this.el.querySelector('.btn-close-plan')?.addEventListener('click', () => {
      this.close();
    });

    this.el.querySelectorAll('.plan-item').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        const dragEvent = e as DragEvent;
        const cardId = item.getAttribute('data-card-id');
        this.draggedCardId = cardId;
        (e.target as HTMLElement).classList.add('dragging');
        dragEvent.dataTransfer?.setData('text/plain', cardId || '');
      });

      item.addEventListener('dragend', (e) => {
        (e.target as HTMLElement).classList.remove('dragging');
        this.draggedCardId = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');

        const targetCardId = item.getAttribute('data-card-id');
        if (!this.draggedCardId || !targetCardId || this.draggedCardId === targetCardId) return;

        const plan = store.getTodayPlan();
        if (!plan) return;

        const items = [...plan.items].sort((a, b) => a.order - b.order);
        const targetIdx = items.findIndex((i) => i.cardId === targetCardId);
        if (targetIdx >= 0) {
          store.reorderTodayPlanItem(this.draggedCardId, targetIdx);
          this.render();
        }
      });
    });

    this.el.querySelectorAll('.followup-item, .plan-item-content, .plan-item-content-small').forEach((el) => {
      el.addEventListener('click', () => {
        const item = el.closest('[data-card-id]');
        const cardId = item?.getAttribute('data-card-id');
        if (cardId) {
          this.onCardClick(cardId);
        }
      });
    });
  }
}
