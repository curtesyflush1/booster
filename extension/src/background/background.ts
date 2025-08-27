// Background script for BoosterBeacon browser extension

import { 
  ExtensionMessage, 
  MessageResponse, 
  STORAGE_KEYS, 
  ExtensionSettings,
  User,
  MessageType
} from '../shared/types';
import { 
  getStorageData, 
  setStorageData, 
  log,
  getCurrentRetailer
} from '../shared/utils';

class BackgroundService {

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    log('info', 'BoosterBeacon extension background service starting...');
    
    // Set up message listeners
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Set up alarm listeners for periodic tasks
    chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
    
    // Set up tab update listeners
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate.bind(this));
    
    // Initialize default settings if not present
    await this.initializeDefaultSettings();
    
    // Start periodic sync
    this.startPeriodicSync();
    
    log('info', 'Background service initialized successfully');
  }

  private async initializeDefaultSettings(): Promise<void> {
    const existingSettings = await getStorageData<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
    
    if (!existingSettings) {
      const defaultSettings: ExtensionSettings = {
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
      
      await setStorageData(STORAGE_KEYS.SETTINGS, defaultSettings);
      log('info', 'Default settings initialized');
    }
  }

  private handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean {
    log('info', `Received message: ${message.type}`, { sender: sender.tab?.url });
    
    // Handle message asynchronously
    this.processMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        log('error', 'Error processing message', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }

  private async processMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<MessageResponse> {
    switch (message.type) {
      case MessageType.GET_USER_STATUS:
        return this.getUserStatus();
      
      case MessageType.UPDATE_SETTINGS:
        return this.updateSettings(message.payload as Partial<ExtensionSettings>);
      
      case MessageType.ADD_TO_CART:
        return this.addToCart(message.payload, sender.tab?.id);
      
      case MessageType.GET_PRODUCT_INFO:
        return this.getProductInfo(message.payload);
      
      case MessageType.TRACK_PAGE_VIEW:
        return this.trackPageView(message.payload, sender.tab?.url);
      
      case MessageType.SHOW_NOTIFICATION:
        return this.showNotification(message.payload);
      
      case MessageType.SYNC_DATA:
        return this.syncWithServer();
      
      case 'STORE_CREDENTIALS' as MessageType:
        return this.storeRetailerCredentials(message.payload);
      
      case 'GET_CREDENTIALS' as MessageType:
        return this.getRetailerCredentials(message.payload);
      
      case 'SAVE_AUTOFILL_DATA' as MessageType:
        return this.saveAutofillData(message.payload);
      
      case 'GET_PURCHASE_ANALYTICS' as MessageType:
        return this.getPurchaseAnalytics();
      
      default:
        return { 
          success: false, 
          error: { code: 'UNKNOWN_MESSAGE_TYPE', message: 'Unknown message type' } 
        };
    }
  }

  private async getUserStatus(): Promise<MessageResponse> {
    try {
      const user = await getStorageData<User>(STORAGE_KEYS.USER);
      const authToken = await getStorageData<string>(STORAGE_KEYS.AUTH_TOKEN);
      
      return {
        success: true,
        data: {
          user,
          isAuthenticated: !!(user && authToken)
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'USER_STATUS_ERROR', message: 'Failed to get user status' } 
      };
    }
  }

  private async updateSettings(settings: Partial<ExtensionSettings>): Promise<MessageResponse> {
    try {
      const currentSettings = await getStorageData<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
      const updatedSettings = { ...currentSettings, ...settings };
      
      await setStorageData(STORAGE_KEYS.SETTINGS, updatedSettings);
      
      return { success: true, data: updatedSettings };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'SETTINGS_UPDATE_ERROR', message: 'Failed to update settings' } 
      };
    }
  }

  private async addToCart(productData: any, tabId?: number): Promise<MessageResponse> {
    try {
      // This will be implemented in the next task (automated checkout)
      // For now, just log the action
      log('info', 'Add to cart requested', productData);
      
      if (tabId) {
        // Send message to content script to handle add to cart
        chrome.tabs.sendMessage(tabId, {
          type: MessageType.EXECUTE_ADD_TO_CART,
          payload: productData,
          timestamp: Date.now()
        });
      }
      
      return { success: true, data: { message: 'Add to cart initiated' } };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'ADD_TO_CART_ERROR', message: 'Failed to add to cart' } 
      };
    }
  }

  private async getProductInfo(productData: any): Promise<MessageResponse> {
    try {
      // In a real implementation, this would call the BoosterBeacon API
      // For now, return mock data
      return {
        success: true,
        data: {
          id: 'mock-product-id',
          name: productData.name || 'Unknown Product',
          price: productData.price || 0,
          isWatched: false
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'PRODUCT_INFO_ERROR', message: 'Failed to get product info' } 
      };
    }
  }

  private async trackPageView(pageData: any, url?: string): Promise<MessageResponse> {
    try {
      const retailer = getCurrentRetailer(url || '');
      
      if (retailer) {
        log('info', `Page view tracked on ${retailer.name}`, pageData);
        
        // Store page view data for analytics
        const pageView = {
          url,
          retailer: retailer.id,
          timestamp: Date.now(),
          ...pageData
        };
        
        // In a real implementation, this would be sent to analytics
        return { success: true, data: pageView };
      }
      
      return { success: true, data: null };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'PAGE_VIEW_ERROR', message: 'Failed to track page view' } 
      };
    }
  }

  private async showNotification(notificationData: any): Promise<MessageResponse> {
    try {
      const settings = await getStorageData<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
      
      if (!settings?.notificationsEnabled) {
        return { 
          success: false, 
          error: { code: 'NOTIFICATIONS_DISABLED', message: 'Notifications disabled' } 
        };
      }
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: notificationData.title || 'BoosterBeacon Alert',
        message: notificationData.message || 'New product alert available'
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'NOTIFICATION_ERROR', message: 'Failed to show notification' } 
      };
    }
  }

  private async syncWithServer(): Promise<MessageResponse> {
    try {
      const authToken = await getStorageData<string>(STORAGE_KEYS.AUTH_TOKEN);
      
      if (!authToken) {
        return { 
          success: false, 
          error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } 
        };
      }
      
      // In a real implementation, this would sync with the BoosterBeacon API
      log('info', 'Syncing data with server...');
      
      await setStorageData(STORAGE_KEYS.LAST_SYNC, Date.now());
      
      return { success: true, data: { lastSync: Date.now() } };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'SYNC_ERROR', message: 'Failed to sync with server' } 
      };
    }
  }

  private handleAlarm(alarm: chrome.alarms.Alarm): void {
    log('info', `Alarm triggered: ${alarm.name}`);
    
    switch (alarm.name) {
      case 'sync-data':
        this.syncWithServer();
        break;
      
      case 'check-alerts':
        this.checkForNewAlerts();
        break;
    }
  }

  private handleTabUpdate(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    // Only process when the tab is completely loaded
    if (changeInfo.status === 'complete' && tab.url) {
      const retailer = getCurrentRetailer(tab.url);
      
      if (retailer) {
        log('info', `User navigated to ${retailer.name}`, { url: tab.url });
        
        // Inject content script if needed
        this.ensureContentScriptInjected(tabId);
      }
    }
  }

  private async ensureContentScriptInjected(tabId: number): Promise<void> {
    try {
      // Check if content script is already injected
      chrome.tabs.sendMessage(tabId, { type: MessageType.PING, timestamp: Date.now() }, () => {
        if (chrome.runtime.lastError) {
          // Content script not injected, inject it
          chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/content.js']
          });
        }
      });
    } catch (error) {
      log('error', 'Failed to ensure content script injection', error);
    }
  }

  private startPeriodicSync(): void {
    // Set up periodic sync alarm
    chrome.alarms.create('sync-data', { periodInMinutes: 5 });
    chrome.alarms.create('check-alerts', { periodInMinutes: 1 });
    
    log('info', 'Periodic sync started');
  }

  private async checkForNewAlerts(): Promise<void> {
    try {
      const authToken = await getStorageData<string>(STORAGE_KEYS.AUTH_TOKEN);
      
      if (!authToken) {
        return;
      }
      
      // In a real implementation, this would check for new alerts from the API
      // For now, just log the check
      log('info', 'Checking for new alerts...');
    } catch (error) {
      log('error', 'Failed to check for new alerts', error);
    }
  }

  private async storeRetailerCredentials(payload: any): Promise<MessageResponse> {
    try {
      const { retailerId, username, password } = payload;
      
      // Import and use credential manager
      const { CredentialManager } = await import('../services/credentialManager');
      const credentialManager = CredentialManager.getInstance();
      await credentialManager.initialize();
      
      await credentialManager.storeCredentials(retailerId, username, password);
      
      return { success: true, data: { message: 'Credentials stored successfully' } };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'CREDENTIAL_STORE_ERROR', message: 'Failed to store credentials' } 
      };
    }
  }

  private async getRetailerCredentials(payload: any): Promise<MessageResponse> {
    try {
      const { retailerId } = payload;
      
      // Import and use credential manager
      const { CredentialManager } = await import('../services/credentialManager');
      const credentialManager = CredentialManager.getInstance();
      await credentialManager.initialize();
      
      const credentials = await credentialManager.getCredentials(retailerId);
      
      return { 
        success: true, 
        data: { 
          hasCredentials: !!credentials,
          username: credentials?.username
        } 
      };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'CREDENTIAL_GET_ERROR', message: 'Failed to get credentials' } 
      };
    }
  }

  private async saveAutofillData(payload: any): Promise<MessageResponse> {
    try {
      // Import and use form autofill service
      const { FormAutofillService } = await import('../services/formAutofill');
      await FormAutofillService.saveAutofillData(payload);
      
      return { success: true, data: { message: 'Autofill data saved successfully' } };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'AUTOFILL_SAVE_ERROR', message: 'Failed to save autofill data' } 
      };
    }
  }

  private async getPurchaseAnalytics(): Promise<MessageResponse> {
    try {
      // This would aggregate analytics from all retailers
      // For now, return mock data
      const analytics = {
        totalPurchases: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        successfulAlerts: 0,
        automatedPurchases: 0
      };
      
      return { success: true, data: analytics };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'ANALYTICS_ERROR', message: 'Failed to get purchase analytics' } 
      };
    }
  }
}

// Initialize the background service
new BackgroundService();