import { store } from '../store';
import type { FilterCriteria, CardStatus } from '../types';
import { STATUS_LABELS, METAL_SPECS, DIFFICULTY_LABELS } from '../types';
import { collectOwners, collectMetalSpecs } from '../utils/filters';

export class Toolbar {
  private el: HTMLElement;
  private onChange: (criteria: FilterCriteria) => void;
  private onAdd: () => void;
  private onExport: () => void;
  private onToggleRoute: () => void;
  private onBatchStatus: (status: CardStatus) => void;
  private onToggleDailyPlan: () => void;
  private onAddSelectedToPlan: () => void;
  private onToggleTrainingReport: () => void;
  private criteria: FilterCriteria = {};
  private isRouteMode = false;
  private selectedCount = 0;

  constructor(
    onChange: (c: FilterCriteria) => void,
    onAdd: () => void,
    onExport: () => void,
    onToggleRoute: () => void,
    onBatchStatus: (s: CardStatus) => void,
    onToggleDailyPlan: () => void,
    onAddSelectedToPlan: () => void,
    onToggleTrainingReport: () => void
  ) {
    this.onChange = onChange;
    this.onAdd = onAdd;
    this.onExport = onExport;
    this.onToggleRoute = onToggleRoute;
    this.onBatchStatus = onBatchStatus;
    this.onToggleDailyPlan = onToggleDailyPlan;
    this.onAddSelectedToPlan = onAddSelectedToPlan;
    this.onToggleTrainingReport = onToggleTrainingReport;
    this.el = document.createElement('header');
    this.el.className = 'toolbar';
    this.render();
  }

  getElement(): HTMLElement {
    return this.el;
  }

  setSelectedCount(n: number): void {
    this.selectedCount = n;
    const batchBar = this.el.querySelector<HTMLElement>('.batch-bar');
    if (batchBar) {
      batchBar.style.display = n > 0 ? 'flex' : 'none';
      const countEl = batchBar.querySelector<HTMLElement>('.batch-count');
      if (countEl) countEl.textContent = `已选 ${n} 张`;
    }
  }

  setRouteMode(active: boolean): void {
    this.isRouteMode = active;
    const btn = this.el.querySelector<HTMLButtonElement>('.btn-route');
    if (btn) {
      btn.classList.toggle('active', active);
      btn.textContent = active ? '📋 返回卡片' : '🗺️ 演示路线';
    }
  }

  private render(): void {
    const cards = store.getCards();
    const owners = collectOwners(cards);
    const allSpecs = Array.from(new Set([...METAL_SPECS, ...collectMetalSpecs(cards)]));
    const routeBtnLabel = this.isRouteMode ? '📋 返回卡片' : '🗺️ 演示路线';
    const routeBtnActive = this.isRouteMode ? ' active' : '';
    const c = this.criteria;

    const sel = (val: string | undefined, target: string) =>
      val === target ? 'selected' : '';

    this.el.innerHTML = `
      <div class="toolbar-main">
        <div class="brand">
          <span class="brand-icon">🔨</span>
          <h1 class="brand-title">金工錾刻工艺排练台</h1>
        </div>
        <div class="toolbar-actions">
          <button class="btn btn-ghost btn-training-report" title="工艺复核单">
            📑 工艺复核
          </button>
          <button class="btn btn-ghost btn-daily-plan" title="演示编排序列">
            📋 演示序列
          </button>
          <button class="btn btn-ghost btn-route${routeBtnActive}" title="按工艺难度生成演示路线">
            ${routeBtnLabel}
          </button>
          <button class="btn btn-ghost btn-export" title="导出工艺清单">
            📤 导出清单
          </button>
          <button class="btn btn-primary btn-add" title="新增卡片">
            ➕ 新增卡片
          </button>
        </div>
      </div>
      <div class="filter-bar">
        <div class="filter-group">
          <label>金属规格</label>
          <select class="filter-select" data-filter="metalSpec">
            <option value="" ${sel(c.metalSpec, '')}>全部</option>
            ${allSpecs.map((s) => `<option value="${s}" ${sel(c.metalSpec, s)}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>难度</label>
          <select class="filter-select" data-filter="difficulty">
            <option value="">全部</option>
            ${([1, 2, 3, 4, 5] as const)
              .map(
                (d) =>
                  `<option value="${d}" ${sel(c.difficulty !== undefined ? String(c.difficulty) : undefined, String(d))}>${d} - ${DIFFICULTY_LABELS[d]}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>状态</label>
          <select class="filter-select" data-filter="status">
            <option value="" ${sel(c.status, '')}>全部</option>
            ${(Object.keys(STATUS_LABELS) as CardStatus[])
              .map((s) => `<option value="${s}" ${sel(c.status, s)}>${STATUS_LABELS[s]}</option>`)
              .join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>责任人</label>
          <select class="filter-select" data-filter="owner">
            <option value="" ${sel(c.owner, '')}>全部</option>
            ${owners.map((o) => `<option value="${o}" ${sel(c.owner, o)}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group filter-duration">
          <label>时长范围(分钟)</label>
          <div class="duration-inputs">
            <input type="number" min="0" class="filter-input" data-filter="minDuration" placeholder="最小" value="${
              c.minDuration !== undefined ? c.minDuration : ''
            }" />
            <span>~</span>
            <input type="number" min="0" class="filter-input" data-filter="maxDuration" placeholder="最大" value="${
              c.maxDuration !== undefined ? c.maxDuration : ''
            }" />
          </div>
        </div>
        <div class="filter-group">
          <label class="starred-toggle">
            <input type="checkbox" data-filter="starredOnly" ${c.starredOnly ? 'checked' : ''} />
            <span>仅重点 ⭐</span>
          </label>
        </div>
        <div class="filter-group">
          <label>排序方式</label>
          <select class="filter-select" data-filter="sortBy">
            <option value="default" ${sel(c.sortBy, 'default')}>默认</option>
            <option value="lastPracticeDate" ${sel(c.sortBy, 'lastPracticeDate')}>最近试作</option>
            <option value="practiceCount" ${sel(c.sortBy, 'practiceCount')}>试作次数</option>
            <option value="isStable" ${sel(c.sortBy, 'isStable')}>是否稳定</option>
          </select>
        </div>
        <div class="filter-group">
          <label>稳定状态</label>
          <select class="filter-select" data-filter="stableFilter">
            <option value="all" ${sel(c.stableFilter, 'all') || (!c.stableFilter ? 'selected' : '')}>全部</option>
            <option value="stable" ${sel(c.stableFilter, 'stable')}>已稳定 ✅</option>
            <option value="unstable" ${sel(c.stableFilter, 'unstable')}>未稳定</option>
          </select>
        </div>
        <div class="filter-group filter-duration">
        <label>试作次数</label>
          <div class="duration-inputs">
            <input type="number" min="0" class="filter-input" data-filter="minPracticeCount" placeholder="≥" value="${
              c.minPracticeCount !== undefined ? c.minPracticeCount : ''
            }" />
            <span>~</span>
            <input type="number" min="0" class="filter-input" data-filter="maxPracticeCount" placeholder="≤" value="${
              c.maxPracticeCount !== undefined ? c.maxPracticeCount : ''
            }" />
          </div>
        </div>
        <div class="filter-group">
          <label>最近试作</label>
          <select class="filter-select" data-filter="lastPracticeDaysAgo">
            <option value="" ${!c.lastPracticeDaysAgo ? 'selected' : ''}>全部</option>
            <option value="7" ${sel(String(c.lastPracticeDaysAgo), '7')}>近7天内</option>
            <option value="14" ${sel(String(c.lastPracticeDaysAgo), '14')}>近14天内</option>
            <option value="30" ${sel(String(c.lastPracticeDaysAgo), '30')}>近30天内</option>
            <option value="60" ${sel(String(c.lastPracticeDaysAgo), '60')}>近60天内</option>
          </select>
        </div>
        <div class="filter-group filter-duration">
          <label>试作日期范围</label>
          <div class="duration-inputs">
            <input type="date" class="filter-input" data-filter="minLastPracticeDate" value="${
              c.minLastPracticeDate || ''
            }" />
            <span>~</span>
            <input type="date" class="filter-input" data-filter="maxLastPracticeDate" value="${
              c.maxLastPracticeDate || ''
            }" />
          </div>
        </div>
        <button class="btn btn-small btn-reset" title="重置筛选">重置</button>
      </div>
      <div class="batch-bar" style="display:${this.selectedCount > 0 ? 'flex' : 'none'}">
        <span class="batch-count">已选 ${this.selectedCount} 张</span>
        <div class="batch-actions">
          <span>批量操作：</span>
          <button class="btn btn-tiny batch-add-plan">📋 加入演示序列</button>
          ${(Object.keys(STATUS_LABELS) as CardStatus[])
            .map(
              (s) =>
                `<button class="btn btn-tiny batch-status" data-status="${s}" style="border-left:3px solid var(--status-${s})">${STATUS_LABELS[s]}</button>`
            )
            .join('')}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.el.querySelector('.btn-add')?.addEventListener('click', () => this.onAdd());
    this.el.querySelector('.btn-export')?.addEventListener('click', () => this.onExport());
    this.el.querySelector('.btn-route')?.addEventListener('click', () => this.onToggleRoute());
    this.el.querySelector('.btn-daily-plan')?.addEventListener('click', () => this.onToggleDailyPlan());
    this.el.querySelector('.btn-training-report')?.addEventListener('click', () => this.onToggleTrainingReport());
    this.el.querySelector('.btn-reset')?.addEventListener('click', () => this.resetFilters());
    this.el.querySelector('.batch-add-plan')?.addEventListener('click', () => this.onAddSelectedToPlan());

    this.el.querySelectorAll<HTMLSelectElement>('select[data-filter]').forEach((sel) => {
      sel.addEventListener('change', () => this.updateFilterFromDom());
    });
    this.el.querySelectorAll<HTMLInputElement>('input[data-filter]').forEach((inp) => {
      inp.addEventListener('input', () => this.updateFilterFromDom());
      inp.addEventListener('change', () => this.updateFilterFromDom());
    });

    this.el.querySelectorAll<HTMLButtonElement>('.batch-status').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.status as CardStatus;
        if (s) this.onBatchStatus(s);
      });
    });
  }

  private updateFilterFromDom(): void {
    const get = <T extends HTMLSelectElement | HTMLInputElement>(key: string): T | null =>
      this.el.querySelector(`[data-filter="${key}"]`);

    const metalSpec = get<HTMLSelectElement>('metalSpec')?.value || undefined;
    const difficultyRaw = get<HTMLSelectElement>('difficulty')?.value;
    const difficulty = difficultyRaw ? Number(difficultyRaw) : undefined;
    const status = (get<HTMLSelectElement>('status')?.value as CardStatus) || undefined;
    const owner = get<HTMLSelectElement>('owner')?.value || undefined;
    const minDurationRaw = get<HTMLInputElement>('minDuration')?.value;
    const minDuration = minDurationRaw ? Number(minDurationRaw) : undefined;
    const maxDurationRaw = get<HTMLInputElement>('maxDuration')?.value;
    const maxDuration = maxDurationRaw ? Number(maxDurationRaw) : undefined;
    const starredOnly = get<HTMLInputElement>('starredOnly')?.checked || undefined;
    const sortBy = (get<HTMLSelectElement>('sortBy')?.value as FilterCriteria['sortBy']) || 'default';
    const stableFilter = (get<HTMLSelectElement>('stableFilter')?.value as FilterCriteria['stableFilter']) || 'all';
    const minPracticeCountRaw = get<HTMLInputElement>('minPracticeCount')?.value;
    const minPracticeCount = minPracticeCountRaw ? Number(minPracticeCountRaw) : undefined;
    const maxPracticeCountRaw = get<HTMLInputElement>('maxPracticeCount')?.value;
    const maxPracticeCount = maxPracticeCountRaw ? Number(maxPracticeCountRaw) : undefined;
    const lastPracticeDaysAgoRaw = get<HTMLSelectElement>('lastPracticeDaysAgo')?.value;
    const lastPracticeDaysAgo = lastPracticeDaysAgoRaw ? Number(lastPracticeDaysAgoRaw) : undefined;
    const minLastPracticeDate = get<HTMLInputElement>('minLastPracticeDate')?.value || undefined;
    const maxLastPracticeDate = get<HTMLInputElement>('maxLastPracticeDate')?.value || undefined;

    this.criteria = {
      metalSpec,
      difficulty,
      status,
      owner,
      minDuration,
      maxDuration,
      starredOnly,
      sortBy,
      stableFilter,
      minPracticeCount,
      maxPracticeCount,
      lastPracticeDaysAgo,
      minLastPracticeDate,
      maxLastPracticeDate
    };
    this.onChange(this.criteria);
  }

  private resetFilters(): void {
    this.criteria = {};
    this.render();
    this.onChange(this.criteria);
  }

  refresh(): void {
    this.render();
  }
}
