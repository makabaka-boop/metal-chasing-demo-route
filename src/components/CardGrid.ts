import type { Card, ExhibitRiskSnapshot } from '../types';
import { CardItem } from './CardItem';
import { store } from '../store';
import { getLatestExhibitRiskSnapshotPerCard } from '../utils/exhibitRisk';

export class CardGrid {
  private el: HTMLElement;
  private items: Map<string, CardItem> = new Map();
  private selected: Set<string> = new Set();
  private handlers: {
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleStar: (id: string) => void;
    onSelectionChange: (ids: Set<string>) => void;
    onReview: (id: string) => void;
    onAddToPlan: (id: string) => void;
  };

  constructor(handlers: CardGrid['handlers']) {
    this.handlers = handlers;
    this.el = document.createElement('section');
    this.el.className = 'card-grid';
  }

  getElement(): HTMLElement {
    return this.el;
  }

  getSelected(): Set<string> {
    return new Set(this.selected);
  }

  clearSelection(): void {
    this.selected.clear();
    for (const item of this.items.values()) item.setSelected(false);
    this.handlers.onSelectionChange(this.selected);
  }

  highlightCards(ids: string[]): void {
    const idSet = new Set(ids);
    for (const [id, item] of this.items) {
      item.setHighlighted(idSet.has(id));
    }
    setTimeout(() => {
      for (const item of this.items.values()) item.setHighlighted(false);
    }, 3000);
  }

  private ensureEmptyState(): HTMLElement {
    let empty = this.el.querySelector<HTMLElement>(':scope > .empty-state');
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-icon">📭</div>
        <p>暂无工艺卡片</p>
        <p class="muted">点击右上角"新增卡片"整理錾刻样片</p>
      `;
      this.el.appendChild(empty);
    }
    return empty;
  }

  update(cards: Card[]): void {
    const riskSnapshotMap: Map<string, ExhibitRiskSnapshot> =
      getLatestExhibitRiskSnapshotPerCard(store.getExhibitRiskSnapshots());

    const existing = new Set(this.items.keys());
    const current = new Set(cards.map((c) => c.id));

    for (const id of existing) {
      if (!current.has(id)) {
        this.items.get(id)?.getElement().remove();
        this.items.delete(id);
        this.selected.delete(id);
      }
    }

    for (const card of cards) {
      const existingItem = this.items.get(card.id);
      if (existingItem) {
        existingItem.update(card, riskSnapshotMap.get(card.id));
      } else {
        const item = new CardItem(card, riskSnapshotMap.get(card.id), {
          onEdit: this.handlers.onEdit,
          onDelete: this.handlers.onDelete,
          onDuplicate: this.handlers.onDuplicate,
          onToggleStar: this.handlers.onToggleStar,
          onReview: this.handlers.onReview,
          onAddToPlan: this.handlers.onAddToPlan,
          onToggleSelect: (id, selected) => {
            if (selected) this.selected.add(id);
            else this.selected.delete(id);
            this.handlers.onSelectionChange(this.selected);
          }
        });
        if (this.selected.has(card.id)) item.setSelected(true);
        this.items.set(card.id, item);
        this.el.appendChild(item.getElement());
      }
    }

    const orderMap = new Map(cards.map((c, i) => [c.id, i]));
    const sorted = Array.from(this.items.entries()).sort(
      (a, b) => (orderMap.get(a[0]) ?? 0) - (orderMap.get(b[0]) ?? 0)
    );
    for (const [, item] of sorted) {
      this.el.appendChild(item.getElement());
    }

    const emptyState = this.ensureEmptyState();
    emptyState.style.display = cards.length === 0 ? 'block' : 'none';
  }
}
