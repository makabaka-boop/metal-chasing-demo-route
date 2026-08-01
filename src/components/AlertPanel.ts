import type { ValidationAlert, AlertType } from '../types';

const ALERT_META: Record<AlertType, { icon: string }> = {
  duplicate_number: { icon: '🆔' },
  duration_too_long: { icon: '⏰' },
  total_duration_too_long: { icon: '📊' },
  mistakes_empty: { icon: '📝' },
  owner_overloaded: { icon: '👥' },
  starred_no_notes: { icon: '⭐' },
  stable_achieved: { icon: '✅' }
};

export class AlertPanel {
  private el: HTMLElement;
  private onLocate: (cardIds: string[]) => void;

  constructor(onLocate: (cardIds: string[]) => void) {
    this.onLocate = onLocate;
    this.el = document.createElement('section');
    this.el.className = 'alert-panel';
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(alerts: ValidationAlert[]): void {
    if (alerts.length === 0) {
      this.el.style.display = 'none';
      this.el.innerHTML = '';
      return;
    }
    this.el.style.display = 'block';
    this.el.innerHTML = `
      <div class="alert-header">
        <span>⚠️ 智能校验发现 ${alerts.length} 项需要关注</span>
      </div>
      <div class="alert-list">
        ${alerts
          .map(
            (a) => `
          <div class="alert-item alert-${a.severity}" data-ids="${a.cardIds.join(',')}">
            <span class="alert-icon">${ALERT_META[a.type].icon}</span>
            <span class="alert-message">${a.message}</span>
            <button class="btn btn-tiny alert-locate">定位卡片</button>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    this.el.querySelectorAll<HTMLElement>('.alert-item').forEach((item) => {
      const btn = item.querySelector<HTMLButtonElement>('.alert-locate');
      btn?.addEventListener('click', () => {
        const idsStr = item.dataset.ids || '';
        const ids = idsStr.split(',').filter(Boolean);
        this.onLocate(ids);
      });
    });
  }
}
