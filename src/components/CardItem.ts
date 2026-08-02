import type { Card } from '../types';
import { STATUS_LABELS, STATUS_COLORS, DIFFICULTY_LABELS, STABILITY_THRESHOLD, EXHIBIT_RISK_LEVEL_LABELS } from '../types';
import { formatDuration } from '../utils/router';
import { store } from '../store';
import { pickRepresentativeExhibitRisk } from '../utils/exhibitRisk';

export class CardItem {
  private el: HTMLElement;
  private card: Card;
  private isSelected = false;
  private isHighlighted = false;
  private onEdit: (id: string) => void;
  private onDelete: (id: string) => void;
  private onDuplicate: (id: string) => void;
  private onToggleStar: (id: string) => void;
  private onToggleSelect: (id: string, selected: boolean) => void;
  private onReview: (id: string) => void;
  private onAddToPlan: (id: string) => void;

  constructor(
    card: Card,
    handlers: {
      onEdit: (id: string) => void;
      onDelete: (id: string) => void;
      onDuplicate: (id: string) => void;
      onToggleStar: (id: string) => void;
      onToggleSelect: (id: string, selected: boolean) => void;
      onReview: (id: string) => void;
      onAddToPlan: (id: string) => void;
    }
  ) {
    this.card = card;
    this.onEdit = handlers.onEdit;
    this.onDelete = handlers.onDelete;
    this.onDuplicate = handlers.onDuplicate;
    this.onToggleStar = handlers.onToggleStar;
    this.onToggleSelect = handlers.onToggleSelect;
    this.onReview = handlers.onReview;
    this.onAddToPlan = handlers.onAddToPlan;
    this.el = document.createElement('article');
    this.el.className = 'card-item';
    this.render();
  }

  getElement(): HTMLElement {
    return this.el;
  }

  getCardId(): string {
    return this.card.id;
  }

  setHighlighted(v: boolean): void {
    this.isHighlighted = v;
    this.el.classList.toggle('card-highlight', v);
    if (v) {
      this.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  setSelected(v: boolean): void {
    this.isSelected = v;
    this.el.classList.toggle('card-selected', v);
    const cb = this.el.querySelector<HTMLInputElement>('.card-select');
    if (cb) cb.checked = v;
  }

  update(card: Card): void {
    this.card = card;
    this.render();
    if (this.isSelected) this.el.classList.add('card-selected');
    if (this.isHighlighted) this.el.classList.add('card-highlight');
  }

  private render(): void {
    const c = this.card;
    const diffWidth = (c.difficulty / 5) * 100;
    const stepsPreview = c.steps.split('\n')[0].slice(0, 40);
    const stats = store.getCardReviewStats(c.id);
    const inPlan = store.isCardInTodayPlan(c.id);
    const planStatus = store.getTodayPlanItemStatus(c.id);

    let planBadge = '';
    if (inPlan && planStatus) {
      const statusLabels: Record<string, string> = {
        pending: '待排',
        in_progress: '排练中',
        completed: '已完成',
        skipped: '暂不演示'
      };
      planBadge = `<span class="plan-status-badge plan-status-${planStatus}">📋 ${statusLabels[planStatus]}</span>`;
    }

    // 复用 store 快照，取代表性风险，不在组件内重新拼装风险判断
    const risk = pickRepresentativeExhibitRisk(store.getExhibitRiskSnapshots(c.id));
    const showRisk = risk && !risk.resolved;
    const riskBadge = showRisk
      ? `<span class="risk-badge risk-badge-${risk!.riskLevel}${risk!.riskLevel === 'critical' ? ' risk-badge-critical-pulse' : ''}" title="${risk!.recommendedAction}">⚠ ${EXHIBIT_RISK_LEVEL_LABELS[risk!.riskLevel]}</span>`
      : '';
    const riskReasons = showRisk && risk!.riskReasons.length > 0
      ? `<div class="card-risk-reasons risk-tone-${risk!.riskLevel}">
          ${risk!.riskReasons.slice(0, 2).map((r) => `<span class="risk-reason">• ${r}</span>`).join('')}
        </div>`
      : '';

    this.el.innerHTML = `
      <div class="card-header" style="border-left:4px solid ${STATUS_COLORS[c.status]}">
        <label class="card-select-wrap">
          <input type="checkbox" class="card-select" ${this.isSelected ? 'checked' : ''} />
        </label>
        <div class="card-title">
          <span class="card-number">${c.patternNumber}</span>
          <span class="card-spec">${c.metalSpec}</span>
        </div>
        ${stats.isStable ? '<span class="stable-badge" title="工艺表现已稳定">✅ 稳定</span>' : ''}
        ${riskBadge}
        ${planBadge}
        <button class="btn-icon card-star" title="${c.starred ? '取消收藏' : '重点收藏'}">
          ${c.starred ? '⭐' : '☆'}
        </button>
      </div>
      <div class="card-body">
        <div class="card-difficulty">
          <span class="diff-label">难度 ${c.difficulty} · ${DIFFICULTY_LABELS[c.difficulty]}</span>
          <div class="diff-bar"><div class="diff-bar-fill" style="width:${diffWidth}%"></div></div>
        </div>
        <div class="card-meta">
          <span class="card-badge" style="background:${STATUS_COLORS[c.status]}">${STATUS_LABELS[c.status]}</span>
          <span class="card-duration">⏱ ${formatDuration(c.durationMin)}</span>
          <span class="card-owner">👤 ${c.owner || '未分配'}</span>
          ${stats.practiceCount > 0 ? `<span class="card-practice-count">📝 试作${stats.practiceCount}次</span>` : ''}
        </div>
        ${riskReasons}
        <div class="card-preview">
          ${stepsPreview ? `<p>${stepsPreview}${c.steps.length > 40 ? '...' : ''}</p>` : '<p class="muted">暂无步骤描述</p>'}
        </div>
        ${c.mistakes ? `<div class="card-mistakes">⚠ ${c.mistakes.slice(0, 30)}${c.mistakes.length > 30 ? '...' : ''}</div>` : ''}
        ${c.reviewNotes ? `<div class="card-review">💡 ${c.reviewNotes.slice(0, 30)}${c.reviewNotes.length > 30 ? '...' : ''}</div>` : ''}
        ${stats.practiceCount > 0 && !stats.isStable ? `<div class="card-stability-progress">工艺稳定度：${stats.completedCount}/${STABILITY_THRESHOLD}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn btn-small card-review-btn">📝 试作记录</button>
        <button class="btn btn-small card-add-plan" ${inPlan ? 'disabled' : ''}>
          ${inPlan ? '✓ 已编排' : '📋 加入演示'}
        </button>
        <button class="btn btn-small card-edit">编辑</button>
        <button class="btn btn-small card-dup">复制</button>
        <button class="btn btn-small btn-danger card-del">删除</button>
      </div>
    `;

    this.el.querySelector('.card-star')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggleStar(c.id);
    });
    this.el.querySelector<HTMLInputElement>('.card-select')?.addEventListener('change', (e) => {
      const cb = e.target as HTMLInputElement;
      this.isSelected = cb.checked;
      this.el.classList.toggle('card-selected', cb.checked);
      this.onToggleSelect(c.id, cb.checked);
    });
    this.el.querySelector('.card-review-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onReview(c.id);
    });
    this.el.querySelector('.card-add-plan')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!inPlan) {
        this.onAddToPlan(c.id);
      }
    });
    this.el.querySelector('.card-edit')?.addEventListener('click', () => this.onEdit(c.id));
    this.el.querySelector('.card-dup')?.addEventListener('click', () => this.onDuplicate(c.id));
    this.el.querySelector('.card-del')?.addEventListener('click', () => {
      if (confirm(`确认删除卡片"${c.patternNumber}"？`)) this.onDelete(c.id);
    });
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button, input, label')) return;
      this.onEdit(c.id);
    });
  }
}
