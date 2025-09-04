// BoosterBeacon Extension Popup Script

import {
  ExtensionSettings,
  User,
  Alert,
  STORAGE_KEYS,
  MessageType,
  RetailerId
} from '../shared/types';
import {
  sendExtensionMessage,
  getStorageData,
  setStorageData,
  getCurrentRetailer,
  formatRelativeTime,
  formatCurrency,
  log
} from '../shared/utils';

// Constants for better maintainability
const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    productId: 'product-1',
    retailerId: 'bestbuy',
    productName: 'Pokémon TCG: Scarlet & Violet Elite Trainer Box',
    retailerName: 'Best Buy',
    price: 49.99,
    productUrl: 'https://bestbuy.com/product-1',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
  },
  {
    id: '2',
    productId: 'product-2',
    retailerId: 'walmart',
    productName: 'Pokémon TCG: Paldea Evolved Booster Box',
    retailerName: 'Walmart',
    price: 89.99,
    productUrl: 'https://walmart.com/product-2',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
  }
];

const SETTINGS_CHECKBOXES = [
  'notifications-enabled',
  'auto-fill-enabled',
  'quick-actions-enabled',
  'bestbuy-enabled',
  'walmart-enabled',
  'costco-enabled',
  'samsclub-enabled'
] as const;

type ViewType = 'main' | 'settings';
type ToastType = 'success' | 'error' | 'info';

class PopupController {
  private currentView: ViewType = 'main';
  private user: User | null = null;
  private settings: ExtensionSettings | null = null;
  private currentTab: chrome.tabs.Tab | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    log('info', 'Popup initializing...');

    // Get current tab information
    await this.getCurrentTab();

    // Load user data and settings
    await this.loadUserData();
    await this.loadSettings();

    // Set up event listeners
    this.setupEventListeners();

    // Update UI based on current state
    this.updateUI();

    // Update page info based on current tab
    this.updatePageInfo();

    log('info', 'Popup initialized successfully');
  }

  private async getCurrentTab(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab || null;
    } catch (error) {
      log('error', 'Failed to get current tab', error);
    }
  }

  private async loadUserData(): Promise<void> {
    try {
      const response = await sendExtensionMessage({ type: MessageType.GET_USER_STATUS });

      if (response.success && response.data) {
        const data = response.data as { user: User; isAuthenticated: boolean };
        this.user = data.user;
        this.updateConnectionStatus(data.isAuthenticated);
      } else {
        this.updateConnectionStatus(false);
      }
    } catch (error) {
      log('error', 'Failed to load user data', error);
      this.updateConnectionStatus(false);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings = await getStorageData<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
    } catch (error) {
      log('error', 'Failed to load settings', error);
    }
  }

  private setupEventListeners(): void {
    this.setupAuthenticationListeners();
    this.setupActionListeners();
    this.setupNavigationListeners();
    this.setupSettingsListeners();
  }

  private setupAuthenticationListeners(): void {
    const signInBtn = document.getElementById('sign-in-btn');
    const createAccountBtn = document.getElementById('create-account-btn');

    signInBtn?.addEventListener('click', () => this.handleSignIn());
    createAccountBtn?.addEventListener('click', () => this.handleCreateAccount());
  }

  private setupActionListeners(): void {
    const syncDataBtn = document.getElementById('sync-data-btn');
    const viewAlertsBtn = document.getElementById('view-alerts-btn');
    const manageWatchesBtn = document.getElementById('manage-watches-btn');

    syncDataBtn?.addEventListener('click', () => this.handleSyncData());
    viewAlertsBtn?.addEventListener('click', () => this.handleViewAlerts());
    manageWatchesBtn?.addEventListener('click', () => this.handleManageWatches());
  }

  private setupNavigationListeners(): void {
    const settingsBtn = document.getElementById('settings-btn');
    const helpBtn = document.getElementById('help-btn');
    const openAppBtn = document.getElementById('open-app-btn');
    const backToMainBtn = document.getElementById('back-to-main');

    settingsBtn?.addEventListener('click', () => this.showSettings());
    helpBtn?.addEventListener('click', () => this.handleHelp());
    openAppBtn?.addEventListener('click', () => this.handleOpenApp());
    backToMainBtn?.addEventListener('click', () => this.showMain());
  }

  private setupSettingsListeners(): void {
    SETTINGS_CHECKBOXES.forEach(id => {
      const checkbox = document.getElementById(id) as HTMLInputElement;
      checkbox?.addEventListener('change', () => this.handleSettingChange(id, checkbox.checked));
    });
  }

  private updateUI(): void {
    const authSection = document.getElementById('auth-section');
    const mainContent = document.getElementById('main-content');

    if (this.user && authSection && mainContent) {
      authSection.style.display = 'none';
      mainContent.style.display = 'block';
      this.updateMainContent();
    } else if (authSection && mainContent) {
      authSection.style.display = 'flex';
      mainContent.style.display = 'none';
    }
  }

  private updateMainContent(): void {
    // Update stats (mock data for now)
    this.updateElement('active-watches', '12');
    this.updateElement('recent-alerts', '3');

    // Load recent alerts
    this.loadRecentAlerts();
  }

  private updatePageInfo(): void {
    if (!this.currentTab?.url) return;

    const retailer = getCurrentRetailer(this.currentTab.url);
    const retailerElement = document.getElementById('current-retailer');
    const statusElement = document.getElementById('page-status-text');

    if (retailer && retailerElement && statusElement) {
      retailerElement.textContent = retailer.name;
      statusElement.textContent = 'Supported retailer';
      statusElement.className = 'page-status-text supported';
    } else if (retailerElement && statusElement) {
      retailerElement.textContent = 'Unknown Site';
      statusElement.textContent = 'Not supported';
      statusElement.className = 'page-status-text';
    }
  }

  private updateConnectionStatus(isConnected: boolean): void {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    if (statusDot && statusText) {
      if (isConnected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
      } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Disconnected';
      }
    }
  }

  private async loadRecentAlerts(): Promise<void> {
    try {
      // In a real implementation, this would load from storage or API
      this.renderAlerts(MOCK_ALERTS);
    } catch (error) {
      log('error', 'Failed to load recent alerts', error);
      this.renderEmptyAlerts();
    }
  }

  private renderEmptyAlerts(): void {
    const alertsList = document.getElementById('alerts-list');
    if (alertsList) {
      alertsList.innerHTML = `
        <div class="no-alerts">
          <span class="no-alerts-icon">📭</span>
          <span class="no-alerts-text">Failed to load alerts</span>
        </div>
      `;
    }
  }

  private renderAlerts(alerts: Alert[]): void {
    const alertsList = document.getElementById('alerts-list');
    if (!alertsList) return;

    if (alerts.length === 0) {
      this.renderNoAlertsMessage(alertsList);
      return;
    }

    alertsList.innerHTML = alerts.map(alert => this.createAlertHTML(alert)).join('');
    this.attachAlertClickListeners(alertsList);
  }

  private renderNoAlertsMessage(container: HTMLElement): void {
    container.innerHTML = `
      <div class="no-alerts">
        <span class="no-alerts-icon">📭</span>
        <span class="no-alerts-text">No recent alerts</span>
      </div>
    `;
  }

  private createAlertHTML(alert: Alert): string {
    return `
      <div class="alert-item" data-alert-id="${alert.id}">
        <div class="alert-header">
          <div class="alert-product">${alert.productName}</div>
          <div class="alert-time">${formatRelativeTime(alert.timestamp)}</div>
        </div>
        <div class="alert-details">
          <div class="alert-retailer">${alert.retailerName}</div>
          <div class="alert-price">${formatCurrency(alert.price)}</div>
        </div>
      </div>
    `;
  }

  private attachAlertClickListeners(container: HTMLElement): void {
    container.querySelectorAll('.alert-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const alertId = (e.currentTarget as HTMLElement).dataset['alertId'];
        if (alertId) {
          this.handleAlertClick(alertId);
        }
      });
    });
  }

  private showSettings(): void {
    this.currentView = 'settings';
    document.getElementById('main-content')!.style.display = 'none';
    document.getElementById('settings-section')!.style.display = 'block';
    this.loadSettingsValues();
    log('info', `Switched to ${this.currentView} view`);
  }

  private showMain(): void {
    this.currentView = 'main';
    document.getElementById('settings-section')!.style.display = 'none';
    document.getElementById('main-content')!.style.display = 'block';
    log('info', `Switched to ${this.currentView} view`);
  }

  private loadSettingsValues(): void {
    if (!this.settings) return;

    // Load general settings
    this.setCheckboxValue('notifications-enabled', this.settings.notificationsEnabled);
    this.setCheckboxValue('auto-fill-enabled', this.settings.autoFillEnabled);
    this.setCheckboxValue('quick-actions-enabled', this.settings.quickActionsEnabled);

    // Load retailer settings
    Object.entries(this.settings.retailerSettings).forEach(([retailerId, settings]) => {
      this.setCheckboxValue(`${retailerId}-enabled`, settings.enabled);
    });
  }

  private setCheckboxValue(id: string, value: boolean): void {
    const checkbox = document.getElementById(id) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = value;
    }
  }

  private async handleSettingChange(settingId: string, value: boolean): Promise<void> {
    if (!this.settings) return;

    try {
      // Update local settings object
      if (settingId === 'notifications-enabled') {
        this.settings.notificationsEnabled = value;
      } else if (settingId === 'auto-fill-enabled') {
        this.settings.autoFillEnabled = value;
      } else if (settingId === 'quick-actions-enabled') {
        this.settings.quickActionsEnabled = value;
      } else if (settingId.endsWith('-enabled')) {
        const retailerId = settingId.replace('-enabled', '') as RetailerId;
        if (this.settings.retailerSettings[retailerId]) {
          this.settings.retailerSettings[retailerId].enabled = value;
        }
      }

      // Save to storage
      await setStorageData(STORAGE_KEYS.SETTINGS, this.settings);

      // Notify background script
      await sendExtensionMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: this.settings
      });

      log('info', `Setting ${settingId} updated to ${value}`);
    } catch (error) {
      log('error', 'Failed to update setting', error);
    }
  }

  private handleSignIn(): void {
    this.openBoosterBeaconApp('/login');
  }

  private handleCreateAccount(): void {
    this.openBoosterBeaconApp('/register');
  }

  private async handleSyncData(): Promise<void> {
    try {
      const response = await sendExtensionMessage({ type: MessageType.SYNC_DATA });

      if (response.success) {
        this.showTemporaryMessage('Data synced successfully!');
        // Refresh the UI
        await this.loadUserData();
        this.updateMainContent();
      } else {
        this.showTemporaryMessage('Failed to sync data', 'error');
      }
    } catch (error) {
      log('error', 'Failed to sync data', error);
      this.showTemporaryMessage('An error occurred', 'error');
    }
  }

  private handleViewAlerts(): void {
    this.openBoosterBeaconApp('/alerts');
  }

  private handleManageWatches(): void {
    this.openBoosterBeaconApp('/watches');
  }

  private handleHelp(): void {
    this.openBoosterBeaconApp('/help');
  }

  private handleOpenApp(): void {
    this.openBoosterBeaconApp('/dashboard');
  }

  private handleAlertClick(alertId: string): void {
    // In a real implementation, this would open the specific alert or product page
    log('info', `Alert clicked: ${alertId}`);
    this.openBoosterBeaconApp(`/alerts/${alertId}`);
  }

  private openBoosterBeaconApp(path: string = ''): void {
    const url = `https://app.boosterbeacon.com${path}`;
    chrome.tabs.create({ url });
    window.close();
  }

  private showTemporaryMessage(message: string, type: ToastType = 'success'): void {
    const messageEl = this.createMessageElement(message, type);
    document.body.appendChild(messageEl);
    this.scheduleMessageRemoval(messageEl);
  }

  private createMessageElement(message: string, type: ToastType): HTMLElement {
    const messageEl = document.createElement('div');
    messageEl.className = `temp-message temp-message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = this.getMessageStyles(type);
    return messageEl;
  }

  private getMessageStyles(type: ToastType): string {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6'
    };

    return `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: ${colors[type]};
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
  }

  private scheduleMessageRemoval(element: HTMLElement, delay: number = 2000): void {
    setTimeout(() => {
      element.remove();
    }, delay);
  }

  private updateElement(id: string, text: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
