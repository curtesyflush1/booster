// BoosterBeacon Extension Options Page Script

import { 
  ExtensionSettings, 
  User, 
  STORAGE_KEYS,
  MessageType,
  RetailerId,
  RetailerSettings
} from '../shared/types';
import { 
  sendExtensionMessage, 
  getStorageData, 
  setStorageData, 
  clearStorageData,
  formatRelativeTime,
  log
} from '../shared/utils';

class OptionsController {
  private settings: ExtensionSettings | null = null;
  private user: User | null = null;
  private hasUnsavedChanges = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    log('info', 'Options page initializing...');
    
    // Load current settings and user data
    await this.loadSettings();
    await this.loadUserData();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Update UI with current values
    this.updateUI();
    
    // Check for updates on load
    this.updateLastSyncTime();
    
    log('info', 'Options page initialized successfully');
  }

  private async loadSettings(): Promise<void> {
    try {
      this.settings = await getStorageData<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
      
      if (!this.settings) {
        // Initialize with default settings
        this.settings = {
          isEnabled: true,
          autoFillEnabled: true,
          notificationsEnabled: true,
          quickActionsEnabled: true,
          retailerSettings: {
            bestbuy: { enabled: true, autoLogin: false, autoFill: true },
            walmart: { enabled: true, autoLogin: false, autoFill: true },
            costco: { enabled: true, autoLogin: false, autoFill: true },
            samsclub: { enabled: true, autoLogin: false, autoFill: true }
          }
        };
        
        await setStorageData(STORAGE_KEYS.SETTINGS, this.settings);
      }
    } catch (error) {
      log('error', 'Failed to load settings', error);
      this.showStatusMessage('Failed to load settings', 'error');
    }
  }

  private async loadUserData(): Promise<void> {
    try {
      const response = await sendExtensionMessage({ type: MessageType.GET_USER_STATUS });
      
      if (response.success && response.data) {
        const data = response.data as { user: User; isAuthenticated: boolean };
        this.user = data.user;
        this.updateAccountStatus(data.isAuthenticated);
      } else {
        this.updateAccountStatus(false);
      }
    } catch (error) {
      log('error', 'Failed to load user data', error);
      this.updateAccountStatus(false);
    }
  }

  private setupEventListeners(): void {
    // Header action buttons
    const saveBtn = document.getElementById('save-settings-btn');
    const resetBtn = document.getElementById('reset-settings-btn');
    
    saveBtn?.addEventListener('click', () => this.saveSettings());
    resetBtn?.addEventListener('click', () => this.resetSettings());
    
    // Account actions
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    const syncNowBtn = document.getElementById('sync-now-btn');
    const clearDataBtn = document.getElementById('clear-data-btn');
    
    signInBtn?.addEventListener('click', () => this.handleSignIn());
    signOutBtn?.addEventListener('click', () => this.handleSignOut());
    syncNowBtn?.addEventListener('click', () => this.handleSyncNow());
    clearDataBtn?.addEventListener('click', () => this.handleClearData());
    
    // Advanced actions
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    const exportBtn = document.getElementById('export-settings-btn');
    const importBtn = document.getElementById('import-settings-btn');
    const importFileInput = document.getElementById('import-file-input') as HTMLInputElement;
    
    checkUpdatesBtn?.addEventListener('click', () => this.handleCheckUpdates());
    exportBtn?.addEventListener('click', () => this.handleExportSettings());
    importBtn?.addEventListener('click', () => importFileInput?.click());
    importFileInput?.addEventListener('change', (e) => this.handleImportSettings(e));
    
    // Status message close
    const statusClose = document.getElementById('status-close');
    statusClose?.addEventListener('click', () => this.hideStatusMessage());
    
    // Setting change listeners
    this.setupSettingListeners();
    
    // Warn about unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });
  }

  private setupSettingListeners(): void {
    const settingIds = [
      'extension-enabled',
      'notifications-enabled',
      'auto-fill-enabled',
      'quick-actions-enabled',
      'bestbuy-enabled',
      'walmart-enabled',
      'costco-enabled',
      'samsclub-enabled',
      'debug-mode'
    ];
    
    settingIds.forEach(id => {
      const element = document.getElementById(id) as HTMLInputElement;
      element?.addEventListener('change', () => {
        this.hasUnsavedChanges = true;
        this.updateSaveButtonState();
      });
    });
  }

  private updateUI(): void {
    if (!this.settings) return;
    
    // Update general settings
    this.setCheckboxValue('extension-enabled', this.settings.isEnabled);
    this.setCheckboxValue('notifications-enabled', this.settings.notificationsEnabled);
    this.setCheckboxValue('auto-fill-enabled', this.settings.autoFillEnabled);
    this.setCheckboxValue('quick-actions-enabled', this.settings.quickActionsEnabled);
    
    // Update retailer settings
    Object.entries(this.settings.retailerSettings).forEach(([retailerId, settings]) => {
      const id = retailerId as RetailerId;
      this.setCheckboxValue(`${id}-enabled`, (settings as RetailerSettings).enabled);
    });
    
    // Update extension version
    const versionEl = document.getElementById('extension-version');
    if (versionEl) {
      versionEl.textContent = chrome.runtime.getManifest().version;
    }
  }

  private updateAccountStatus(isAuthenticated: boolean): void {
    const statusText = document.getElementById('account-status-text');
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    
    if (statusText && signInBtn && signOutBtn) {
      if (isAuthenticated && this.user) {
        statusText.textContent = `Signed in as ${this.user.email} (${this.user.subscriptionTier} tier)`;
        signInBtn.style.display = 'none';
        signOutBtn.style.display = 'inline-flex';
      } else {
        statusText.textContent = 'Not signed in';
        signInBtn.style.display = 'inline-flex';
        signOutBtn.style.display = 'none';
      }
    }
  }

  private async updateLastSyncTime(): Promise<void> {
    try {
      const lastSync = await getStorageData<number>(STORAGE_KEYS.LAST_SYNC);
      const syncTimeEl = document.getElementById('last-sync-time');
      
      if (syncTimeEl) {
        if (lastSync) {
          syncTimeEl.textContent = formatRelativeTime(lastSync);
        } else {
          syncTimeEl.textContent = 'Never';
        }
      }
    } catch (error) {
      log('error', 'Failed to update last sync time', error);
    }
  }

  private setCheckboxValue(id: string, value: boolean): void {
    const checkbox = document.getElementById(id) as HTMLInputElement;
    if (checkbox) {
      checkbox.checked = value;
    }
  }

  private getCheckboxValue(id: string): boolean {
    const checkbox = document.getElementById(id) as HTMLInputElement;
    return checkbox ? checkbox.checked : false;
  }

  private updateSaveButtonState(): void {
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
      saveBtn.textContent = this.hasUnsavedChanges ? 'Save Changes' : 'Save Settings';
      saveBtn.className = this.hasUnsavedChanges ? 'btn btn-primary' : 'btn btn-secondary';
    }
  }

  private async saveSettings(): Promise<void> {
    if (!this.settings) return;
    
    try {
      // Update settings object with current form values
      this.settings.isEnabled = this.getCheckboxValue('extension-enabled');
      this.settings.notificationsEnabled = this.getCheckboxValue('notifications-enabled');
      this.settings.autoFillEnabled = this.getCheckboxValue('auto-fill-enabled');
      this.settings.quickActionsEnabled = this.getCheckboxValue('quick-actions-enabled');
      
      // Update retailer settings
      if (this.settings.retailerSettings) {
        Object.keys(this.settings.retailerSettings).forEach(key => {
          const id = key as RetailerId;
          const rs = this.settings!.retailerSettings[id] as RetailerSettings | undefined;
          if (rs) {
            rs.enabled = this.getCheckboxValue(`${id}-enabled`);
          }
        });
      }
      
      // Save to storage
      await setStorageData(STORAGE_KEYS.SETTINGS, this.settings);
      
      // Notify background script
      await sendExtensionMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: this.settings
      });
      
      this.hasUnsavedChanges = false;
      this.updateSaveButtonState();
      this.showStatusMessage('Settings saved successfully!', 'success');
      
      log('info', 'Settings saved successfully');
    } catch (error) {
      log('error', 'Failed to save settings', error);
      this.showStatusMessage('Failed to save settings', 'error');
    }
  }

  private async resetSettings(): Promise<void> {
    if (!confirm('Are you sure you want to reset all settings to their default values?')) {
      return;
    }
    
    try {
      // Reset to default settings
      this.settings = {
        isEnabled: true,
        autoFillEnabled: true,
        notificationsEnabled: true,
        quickActionsEnabled: true,
        retailerSettings: {
          bestbuy: { enabled: true, autoLogin: false, autoFill: true },
          walmart: { enabled: true, autoLogin: false, autoFill: true },
          costco: { enabled: true, autoLogin: false, autoFill: true },
          samsclub: { enabled: true, autoLogin: false, autoFill: true }
        }
      };
      
      await setStorageData(STORAGE_KEYS.SETTINGS, this.settings);
      
      // Update UI
      this.updateUI();
      this.hasUnsavedChanges = false;
      this.updateSaveButtonState();
      
      this.showStatusMessage('Settings reset to defaults', 'success');
      
      log('info', 'Settings reset to defaults');
    } catch (error) {
      log('error', 'Failed to reset settings', error);
      this.showStatusMessage('Failed to reset settings', 'error');
    }
  }

  private handleSignIn(): void {
    chrome.tabs.create({ url: 'https://app.boosterbeacon.com/login' });
  }

  private async handleSignOut(): Promise<void> {
    if (!confirm('Are you sure you want to sign out?')) {
      return;
    }
    
    try {
      // Clear user data from storage
      await Promise.all([
        setStorageData(STORAGE_KEYS.USER, null),
        setStorageData(STORAGE_KEYS.AUTH_TOKEN, null)
      ]);
      
      this.user = null;
      this.updateAccountStatus(false);
      this.showStatusMessage('Signed out successfully', 'success');
      
      log('info', 'User signed out');
    } catch (error) {
      log('error', 'Failed to sign out', error);
      this.showStatusMessage('Failed to sign out', 'error');
    }
  }

  private async handleSyncNow(): Promise<void> {
    try {
      const syncBtn = document.getElementById('sync-now-btn');
      if (syncBtn) {
        syncBtn.textContent = 'Syncing...';
        syncBtn.classList.add('loading');
      }
      
      const response = await sendExtensionMessage({ type: MessageType.SYNC_DATA });
      
      if (response.success) {
        this.showStatusMessage('Data synced successfully!', 'success');
        this.updateLastSyncTime();
      } else {
        this.showStatusMessage('Failed to sync data', 'error');
      }
    } catch (error) {
      log('error', 'Failed to sync data', error);
      this.showStatusMessage('An error occurred during sync', 'error');
    } finally {
      const syncBtn = document.getElementById('sync-now-btn');
      if (syncBtn) {
        syncBtn.textContent = 'Sync Now';
        syncBtn.classList.remove('loading');
      }
    }
  }

  private async handleClearData(): Promise<void> {
    if (!confirm('Are you sure you want to clear all extension data? This action cannot be undone.')) {
      return;
    }
    
    try {
      await clearStorageData();
      
      // Reload settings
      await this.loadSettings();
      await this.loadUserData();
      this.updateUI();
      
      this.showStatusMessage('Extension data cleared successfully', 'success');
      
      log('info', 'Extension data cleared');
    } catch (error) {
      log('error', 'Failed to clear extension data', error);
      this.showStatusMessage('Failed to clear extension data', 'error');
    }
  }

  private handleCheckUpdates(): void {
    // In a real implementation, this would check for extension updates
    this.showStatusMessage('Extension is up to date', 'info');
  }

  private handleExportSettings(): void {
    if (!this.settings) return;
    
    try {
      const exportData = {
        version: chrome.runtime.getManifest().version,
        timestamp: new Date().toISOString(),
        settings: this.settings
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `boosterbeacon-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      this.showStatusMessage('Settings exported successfully', 'success');
      
      log('info', 'Settings exported');
    } catch (error) {
      log('error', 'Failed to export settings', error);
      this.showStatusMessage('Failed to export settings', 'error');
    }
  }

  private async handleImportSettings(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.settings) {
        throw new Error('Invalid settings file format');
      }
      
      // Validate settings structure
      const settings = importData.settings as ExtensionSettings;
      if (typeof settings.isEnabled !== 'boolean' || !settings.retailerSettings) {
        throw new Error('Invalid settings structure');
      }
      
      // Import settings
      this.settings = settings;
      await setStorageData(STORAGE_KEYS.SETTINGS, this.settings);
      
      // Update UI
      this.updateUI();
      this.hasUnsavedChanges = false;
      this.updateSaveButtonState();
      
      this.showStatusMessage('Settings imported successfully', 'success');
      
      log('info', 'Settings imported');
    } catch (error) {
      log('error', 'Failed to import settings', error);
      this.showStatusMessage('Failed to import settings. Please check the file format.', 'error');
    } finally {
      // Clear the file input
      input.value = '';
    }
  }

  private showStatusMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const statusMessage = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    
    if (statusMessage && statusText) {
      statusText.textContent = message;
      statusMessage.className = `status-message ${type}`;
      statusMessage.style.display = 'flex';
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        this.hideStatusMessage();
      }, 5000);
    }
  }

  private hideStatusMessage(): void {
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
      statusMessage.style.display = 'none';
    }
  }
}

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});
