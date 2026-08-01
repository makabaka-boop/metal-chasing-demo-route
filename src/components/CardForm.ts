import type { Card, CardStatus } from '../types';
import {
  STATUS_LABELS,
  METAL_SPECS,
  DIFFICULTY_LABELS
} from '../types';

export class CardForm {
  private el: HTMLElement;
  private overlay: HTMLElement;
  private onSave: (data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => void;
  private onClose: () => void;

  constructor(
    onSave: (data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>) => void,
    onClose: () => void
  ) {
    this.onSave = onSave;
    this.onClose = onClose;
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.el = document.createElement('div');
    this.el.className = 'modal card-form';
    this.overlay.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.overlay;
  }

  open(card?: Card): void {
    this.render(card);
    this.overlay.style.display = 'flex';
    const first = this.el.querySelector<HTMLInputElement>('input, textarea, select');
    setTimeout(() => first?.focus(), 50);
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.onClose();
  }

  private render(card?: Card): void {
    const d = card || {
      patternNumber: '',
      metalSpec: METAL_SPECS[0],
      difficulty: 1 as const,
      steps: '',
      durationMin: 30,
      mistakes: '',
      owner: '',
      status: 'pending' as CardStatus,
      starred: false,
      reviewNotes: ''
    };

    this.el.innerHTML = `
      <div class="modal-header">
        <h2>${card ? '✏️ 编辑工艺卡' : '➕ 新增工艺卡'}</h2>
        <button class="btn-icon form-close" title="关闭">✕</button>
      </div>
      <form class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>图案编号 *</label>
            <input type="text" name="patternNumber" value="${d.patternNumber}" required placeholder="如 Z-001" />
          </div>
          <div class="form-group">
            <label>金属规格 *</label>
            <select name="metalSpec" required>
              ${METAL_SPECS.map(
                (s) => `<option value="${s}" ${s === d.metalSpec ? 'selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>难度等级</label>
            <select name="difficulty">
              ${([1, 2, 3, 4, 5] as const)
                .map(
                  (lv) =>
                    `<option value="${lv}" ${lv === d.difficulty ? 'selected' : ''}>${lv} - ${DIFFICULTY_LABELS[lv]}</option>`
                )
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label>预计工时(分钟) *</label>
            <input type="number" name="durationMin" min="1" value="${d.durationMin}" required />
          </div>
          <div class="form-group">
            <label>状态</label>
            <select name="status">
              ${(Object.keys(STATUS_LABELS) as CardStatus[])
                .map(
                  (s) =>
                    `<option value="${s}" ${s === d.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>责任人</label>
            <input type="text" name="owner" value="${d.owner}" placeholder="如 张三" />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" name="starred" ${d.starred ? 'checked' : ''} />
              <span>⭐ 展示重点</span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>錾刻步骤</label>
          <textarea name="steps" rows="4" placeholder="按步骤描述操作要点...">${d.steps}</textarea>
        </div>
        <div class="form-group">
          <label>常见失误</label>
          <textarea name="mistakes" rows="2" placeholder="此图案容易出现的错误，供复盘参考...">${d.mistakes}</textarea>
        </div>
        <div class="form-group">
          <label>讲解提示</label>
          <textarea name="reviewNotes" rows="2" placeholder="演示或讲解时需要提醒的工艺要点...">${d.reviewNotes}</textarea>
        </div>
        <div class="form-error" style="display:none"></div>
      </form>
      <div class="modal-footer">
        <button class="btn btn-ghost form-cancel">取消</button>
        <button class="btn btn-primary form-save">保存</button>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.el.querySelector('.form-close')?.addEventListener('click', () => this.close());
    this.el.querySelector('.form-cancel')?.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
    document.addEventListener('keydown', this.handleEsc);

    this.el.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSave();
    });
    this.el.querySelector('.form-save')?.addEventListener('click', () => this.handleSave());
  }

  private handleEsc = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
      document.removeEventListener('keydown', this.handleEsc);
    }
  };

  private handleSave(): void {
    const form = this.el.querySelector<HTMLFormElement>('form');
    if (!form) return;
    const fd = new FormData(form);
    const errEl = this.el.querySelector<HTMLElement>('.form-error');

    const patternNumber = String(fd.get('patternNumber') || '').trim();
    const metalSpec = String(fd.get('metalSpec') || '').trim();
    const difficulty = Number(fd.get('difficulty')) as 1 | 2 | 3 | 4 | 5;
    const steps = String(fd.get('steps') || '').trim();
    const durationMin = Number(fd.get('durationMin'));
    const mistakes = String(fd.get('mistakes') || '').trim();
    const owner = String(fd.get('owner') || '').trim();
    const status = String(fd.get('status')) as CardStatus;
    const starred = Boolean(fd.get('starred'));
    const reviewNotes = String(fd.get('reviewNotes') || '').trim();

    if (!patternNumber) return this.showError('请填写图案编号', errEl);
    if (!metalSpec) return this.showError('请选择金属规格', errEl);
    if (!durationMin || durationMin < 1) return this.showError('请填写有效的预计工时', errEl);
    if (![1, 2, 3, 4, 5].includes(difficulty)) return this.showError('无效的难度等级', errEl);

    document.removeEventListener('keydown', this.handleEsc);
    this.onSave({
      patternNumber,
      metalSpec,
      difficulty,
      steps,
      durationMin,
      mistakes,
      owner,
      status,
      starred,
      reviewNotes
    });
  }

  private showError(msg: string, el: HTMLElement | null): void {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }
}
