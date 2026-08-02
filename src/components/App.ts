import { store } from '../store';
import type { FilterCriteria, CardStatus, Card } from '../types';
import { Toolbar } from './Toolbar';
import { AlertPanel } from './AlertPanel';
import { CardGrid } from './CardGrid';
import { CardForm } from './CardForm';
import { RouteView } from './RouteView';
import { ReviewModal } from './ReviewModal';
import { DailyPlanPanel } from './DailyPlanPanel';
import { TrainingReportPanel } from './TrainingReportPanel';
import { validateAll } from '../utils/validators';
import { filterCards } from '../utils/filters';
import { exportToCSV } from '../utils/csv';
import { generatePracticeRoute } from '../utils/router';

export class App {
  private root: HTMLElement;
  private toolbar: Toolbar;
  private alertPanel: AlertPanel;
  private cardGrid: CardGrid;
  private routeView: RouteView;
  private cardForm: CardForm;
  private reviewModal: ReviewModal;
  private dailyPlanPanel: DailyPlanPanel;
  private trainingReportPanel: TrainingReportPanel;
  private dailyPlanToggle: HTMLElement;
  private criteria: FilterCriteria = {};
  private isRouteMode = false;
  private editingId: string | null = null;
  private isDailyPlanOpen = false;
  private isTrainingReportOpen = false;
  private unsubscribe: () => void;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'app';

    this.toolbar = new Toolbar(
      (c) => this.handleFilterChange(c),
      () => this.openForm(),
      () => this.handleExport(),
      () => this.toggleRouteMode(),
      (s) => this.handleBatchStatus(s),
      () => this.toggleDailyPlan(),
      () => this.handleAddSelectedToPlan(),
      () => this.toggleTrainingReport()
    );
    this.alertPanel = new AlertPanel((ids) => this.handleLocate(ids));
    this.cardGrid = new CardGrid({
      onEdit: (id) => this.openForm(id),
      onDelete: (id) => store.deleteCard(id),
      onDuplicate: (id) => store.duplicateCard(id),
      onToggleStar: (id) => store.toggleStar(id),
      onSelectionChange: () => this.handleSelectionChange(),
      onReview: (id) => this.openReview(id),
      onAddToPlan: (id) => this.addCardToPlan(id)
    });
    this.routeView = new RouteView((id) => this.openForm(id));
    this.cardForm = new CardForm(
      (data) => this.handleSave(data),
      () => (this.editingId = null)
    );
    this.reviewModal = new ReviewModal();
    this.dailyPlanPanel = new DailyPlanPanel(
      (id) => this.openForm(id),
      () => this.closeDailyPlan()
    );
    this.trainingReportPanel = new TrainingReportPanel(
      (id) => this.openForm(id),
      () => this.closeTrainingReport()
    );
    this.dailyPlanToggle = document.createElement('div');
    this.dailyPlanToggle.className = 'daily-plan-toggle';
    this.dailyPlanToggle.style.display = 'none';

    this.render();
    this.unsubscribe = store.subscribe(() => this.refresh());
    this.refresh();
  }

  private render(): void {
    this.root.innerHTML = '';
    this.root.appendChild(this.toolbar.getElement());
    this.root.appendChild(this.alertPanel.getElement());
    const main = document.createElement('main');
    main.className = 'app-main';
    main.appendChild(this.cardGrid.getElement());
    main.appendChild(this.routeView.getElement());
    this.root.appendChild(main);
    this.root.appendChild(this.dailyPlanToggle);
    document.body.appendChild(this.cardForm.getElement());
    document.body.appendChild(this.reviewModal.getElement());
    document.body.appendChild(this.dailyPlanPanel.getElement());
    document.body.appendChild(this.trainingReportPanel.getElement());
    this.updateViewMode();
    this.bindToggleEvent();
  }

  private bindToggleEvent(): void {
    this.dailyPlanToggle.addEventListener('click', () => {
      this.toggleDailyPlan();
    });
  }

  private refresh(): void {
    const all = store.getCards();
    const alerts = validateAll(all);
    this.alertPanel.update(alerts);

    const riskSnapshotMap = store.getLatestExhibitRiskSnapshotMap();

    if (!this.isRouteMode) {
      const filtered = filterCards(all, this.criteria);
      this.cardGrid.update(filtered);
    } else {
      const filtered = filterCards(all, this.criteria);
      const route = generatePracticeRoute(filtered, riskSnapshotMap);
      this.routeView.update(route, riskSnapshotMap);
    }

    this.toolbar.refresh();
    this.toolbar.setRouteMode(this.isRouteMode);
    this.toolbar.setSelectedCount(this.cardGrid.getSelected().size);
    this.handleSelectionChange();
    this.updateDailyPlanToggle();
    this.dailyPlanPanel.refresh();
    this.trainingReportPanel.refresh();
  }

  private handleFilterChange(c: FilterCriteria): void {
    this.criteria = c;
    this.refresh();
  }

  private handleExport(): void {
    const all = store.getCards();
    const filtered = filterCards(all, this.criteria);
    const riskSnapshotMap = store.getLatestExhibitRiskSnapshotMap();
    const data = this.isRouteMode
      ? generatePracticeRoute(filtered, riskSnapshotMap)
      : filtered;
    if (data.length === 0) {
      alert('暂无数据可导出');
      return;
    }
    exportToCSV(data, riskSnapshotMap);
  }

  private toggleRouteMode(): void {
    this.isRouteMode = !this.isRouteMode;
    this.cardGrid.clearSelection();
    this.updateViewMode();
    this.refresh();
  }

  private updateViewMode(): void {
    this.cardGrid.getElement().style.display = this.isRouteMode ? 'none' : '';
    this.routeView.getElement().style.display = this.isRouteMode ? '' : 'none';
  }

  private handleBatchStatus(status: CardStatus): void {
    const ids = Array.from(this.cardGrid.getSelected());
    if (ids.length === 0) return;
    store.batchUpdateStatus(ids, status);
    this.cardGrid.clearSelection();
  }

  private handleSelectionChange(): void {
    this.toolbar.setSelectedCount(this.cardGrid.getSelected().size);
  }

  private handleLocate(ids: string[]): void {
    if (this.isRouteMode) {
      this.isRouteMode = false;
      this.updateViewMode();
      this.toolbar.setRouteMode(false);
    }
    this.criteria = {};
    this.toolbar.refresh();
    this.toolbar.setRouteMode(false);
    const all = store.getCards();
    this.cardGrid.update(all);
    setTimeout(() => this.cardGrid.highlightCards(ids), 100);
  }

  private openForm(id?: string): void {
    if (id) {
      const card = store.getCard(id);
      if (card) {
        this.editingId = id;
        this.cardForm.open(card);
      }
    } else {
      this.editingId = null;
      this.cardForm.open();
    }
  }

  private openReview(id: string): void {
    this.reviewModal.open(id);
  }

  private handleSave(data: Omit<Card, 'id' | 'createdAt' | 'updatedAt'>): void {
    if (this.editingId) {
      store.updateCard(this.editingId, data);
    } else {
      store.addCard(data);
    }
    this.cardForm.close();
    this.editingId = null;
  }

  private toggleDailyPlan(): void {
    if (this.isDailyPlanOpen) {
      this.closeDailyPlan();
    } else {
      this.openDailyPlan();
    }
  }

  private openDailyPlan(): void {
    this.isDailyPlanOpen = true;
    this.dailyPlanPanel.open();
    this.dailyPlanPanel.getElement().style.display = 'flex';
  }

  private closeDailyPlan(): void {
    this.isDailyPlanOpen = false;
    this.dailyPlanPanel.getElement().style.display = 'none';
  }

  private toggleTrainingReport(): void {
    if (this.isTrainingReportOpen) {
      this.closeTrainingReport();
    } else {
      this.openTrainingReport();
    }
  }

  private openTrainingReport(): void {
    this.isTrainingReportOpen = true;
    this.trainingReportPanel.open();
  }

  private closeTrainingReport(): void {
    this.isTrainingReportOpen = false;
  }

  private updateDailyPlanToggle(): void {
    const plan = store.getTodayPlan();
    if (plan) {
      this.dailyPlanToggle.style.display = 'flex';
      const completedCount = plan.items.filter((i) => i.status === 'completed').length;
      const totalCount = plan.items.length;

      let icon = '📋';
      let text = '演示序列';
      if (plan.status === 'in_progress') {
        icon = '🔥';
        text = '排练中';
      } else if (plan.status === 'completed') {
        icon = '🎉';
        text = '已归档';
      }

      this.dailyPlanToggle.innerHTML = `
        <span class="plan-toggle-icon">${icon}</span>
        <span class="plan-toggle-text">${text}</span>
        <span class="plan-toggle-badge">${completedCount}/${totalCount}</span>
      `;
    } else {
      this.dailyPlanToggle.style.display = 'flex';
      this.dailyPlanToggle.innerHTML = `
        <span class="plan-toggle-icon">✨</span>
        <span class="plan-toggle-text">演示序列</span>
      `;
    }
  }

  private addCardToPlan(cardId: string): void {
    store.addCardsToTodayPlan([cardId]);
    if (!this.isDailyPlanOpen) {
      this.openDailyPlan();
    }
  }

  private handleAddSelectedToPlan(): void {
    const ids = Array.from(this.cardGrid.getSelected());
    if (ids.length === 0) {
      alert('请先选择要编排的工艺卡片');
      return;
    }
    store.addCardsToTodayPlan(ids);
    if (!this.isDailyPlanOpen) {
      this.openDailyPlan();
    }
  }

  destroy(): void {
    this.unsubscribe();
  }
}
