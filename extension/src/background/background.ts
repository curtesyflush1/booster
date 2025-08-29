// Background script for BoosterBeacon browser extension
// Optimized for performance and minimal browser impact

import { 
  ExtensionMessage, 
  MessageResponse, 
  STORAGE_KEYS, 
  ExtensionSettings,
  User,
  MessageType,
  RetailerId
} from '../shared/types';
import { 
  getStorageData, 
  setStorageData, 
  log,
  getCurrentRetailer,
  throttle,
  debounce
} from '../shared/utils';
import { performanceMonitor } from '../shared/performanceMonitor';
import { PermissionManager } from '../services/permissionManager';
import { CacheManager } from './services/CacheManager';
import { MessageHandler } from './services/MessageHandler';
import { AlarmManager } from './services/AlarmManager';
import { SyncService } from './services/SyncService';

// Performance monitoring and optimization constants
const PERFORMANCE_THRESHOLDS = {
  MAX_PROCESSING_TIME: 100, // Max 100ms for background tasks
  MEMORY_CHECK_INTERVAL: 300000, // Check memory every 5 minutes
  SYNC_INTERVAL: 300000, // Sync every 5 minutes (reduced from 5 minutes to be more efficient)
  ALERT_CHECK_INTERVAL: 60000, // Check alerts every minute
  BATCH_SIZE: 10, // Process items in batches to avoid blocking
  IDLE_TIMEOUT: 30000 // 30 seconds idle before cleanup
} as const;

// Alarm names for better organization
const ALARM_NAMES = {
  SYNC_DATA: 'sync-data',
  CHECK_ALERTS: 'check-alerts',
  MEMORY_CLEANUP: 'memory-cleanup',
  PERFORMANCE_MONITOR: 'performance-monitor'
} as const;



class BackgroundService {
  private permissionManager = PermissionManager.getInstance();
  private cacheManager: CacheManager;
  private messageHandler: MessageHandler;
  private alarmManager: AlarmManager;
  private syncService: SyncService;
  
  // Throttled and debounced methods for performance
  private throttledTabUpdate = throttle(this.handleTabUpdateInternal.bind(this), 1000);
  private debouncedContentScriptInjection = debounce(this.ensureContentScriptInjected.bind(this), 500);

  constructor() {
    // Initialize services with dependency injection
    this.cacheManager = new CacheManager();
    this.syncService = new SyncService(this.cacheManager);
    this.messageHandler = new MessageHandler(this.cacheManager, null, null);
    this.alarmManager = new AlarmManager(this.cacheManager, this.syncService);
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const startTime = performance.now();
    log('info', 'BoosterBeacon extension background service starting...');
    
    try {
      // Set up message listeners with error handling
      chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
      
      // Set up throttled tab update listeners to reduce CPU usage
      chrome.tabs.onUpdated.addListener(this.throttledTabUpdate);
      
      // Set up permission change listeners
      this.permissionManager.setupPermissionListeners();
      
      // Initialize services in parallel for better performance
      await Promise.all([
        this.initializeDefaultSettings(),
        this.validatePermissions(),
        this.alarmManager.initialize()
      ]);
      
      const initTime = performance.now() - startTime;
      log('info', `Background service initialized successfully in ${initTime.toFixed(2)}ms`);
      
      // Track initialization performance
      performanceMonitor.recordMetric('initialization', initTime);
      
    } catch (error) {
      log('error', 'Failed to initialize background service', error);
      // Attempt graceful degradation
      await this.startMinimalMode();
    }
  }

  private async initializeDefaultSettings(): Promise<void> {
    try {
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
    } catch (error) {
      log('error', 'Failed to initialize default settings', error);
    }
  }

  /**
   * Preload frequently accessed data into cache for better performance
   */
  private async preloadCache(): Promise<void> {
    try {
      // Preload data through cache manager
      await Promise.all([
        this.cacheManager.getCachedSettings(),
        this.cacheManager.getCachedUser()
      ]);
      
      log('info', 'Cache preloaded successfully');
    } catch (error) {
      log('error', 'Failed to preload cache', error);
    }
  }

  /**
   * Get cached settings with automatic refresh (delegated to CacheManager)
   */
  private async getCachedSettings(): Promise<ExtensionSettings | null> {
    return this.cacheManager.getCachedSettings();
  }

  /**
   * Get cached user with automatic refresh (delegated to CacheManager)
   */
  private async getCachedUser(): Promise<User | null> {
    return this.cacheManager.getCachedUser();
  }

  /**
   * Setup performance monitoring and cleanup tasks
   */
  private setupPerformanceMonitoring(): void {
    // Create performance monitoring alarm
    chrome.alarms.create(ALARM_NAMES.PERFORMANCE_MONITOR, { 
      periodInMinutes: 5 // Check performance every 5 minutes
    });
    
    // Create memory cleanup alarm
    chrome.alarms.create(ALARM_NAMES.MEMORY_CLEANUP, { 
      periodInMinutes: 10 // Cleanup every 10 minutes
    });
  }

  /**
   * Start optimized periodic tasks with better scheduling
   */
  private startOptimizedPeriodicTasks(): void {
    // Clear any existing alarms to avoid duplicates
    chrome.alarms.clearAll(() => {
      // Set up sync alarm with longer interval to reduce CPU usage
      chrome.alarms.create(ALARM_NAMES.SYNC_DATA, { 
        periodInMinutes: 5 // Sync every 5 minutes instead of every minute
      });
      
      // Set up alert checking with optimized interval
      chrome.alarms.create(ALARM_NAMES.CHECK_ALERTS, { 
        periodInMinutes: 1 // Check alerts every minute
      });
      
      // Set up performance monitoring
      this.setupPerformanceMonitoring();
      
      log('info', 'Optimized periodic tasks started');
    });
  }

  /**
   * Start minimal mode for graceful degradation
   */
  private async startMinimalMode(): Promise<void> {
    log('warn', 'Starting in minimal mode due to initialization errors');
    
    // Only set up essential alarms
    chrome.alarms.create(ALARM_NAMES.SYNC_DATA, { periodInMinutes: 10 });
    
    // Set minimal settings through cache manager
    const minimalSettings: ExtensionSettings = {
      isEnabled: true,
      autoFillEnabled: false,
      notificationsEnabled: true,
      quickActionsEnabled: false,
      retailerSettings: {
        bestbuy: { enabled: true, autoLogin: false, autoFill: false },
        walmart: { enabled: true, autoLogin: false, autoFill: false },
        costco: { enabled: true, autoLogin: false, autoFill: false },
        samsclub: { enabled: true, autoLogin: false, autoFill: false }
      }
    };
    
    await setStorageData(STORAGE_KEYS.SETTINGS, minimalSettings);
  }

  /**
   * Record performance metrics for monitoring (legacy method - now uses PerformanceMonitor)
   */
  private recordPerformanceMetric(type: string, value: number): void {
    performanceMonitor.recordMetric(type, value);
  }

  private handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean {
    const startTime = performance.now();
    
    log('info', `Processing message: ${message.type}`, { 
      sender: sender.tab?.url,
      requestId: message.requestId 
    });
    
    // Delegate to message handler service
    this.messageHandler.processMessage(message, sender)
      .then((response) => {
        // Add performance info to response in debug mode
        if (process.env.NODE_ENV === 'development') {
          const processingTime = performance.now() - startTime;
          response.processingTime = processingTime;
        }
        
        sendResponse(response);
      })
      .catch((error) => {
        log('error', 'Error processing message', { 
          error, 
          messageType: message.type
        });
        
        sendResponse({ 
          success: false, 
          error: { 
            code: 'MESSAGE_PROCESSING_ERROR', 
            message: error.message || 'Unknown error occurred' 
          } 
        });
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
      
      case 'REQUEST_RETAILER_PERMISSION' as MessageType:
        return this.requestRetailerPermission(message.payload);
      
      case 'CHECK_RETAILER_PERMISSIONS' as MessageType:
        return this.checkRetailerPermissions();
      
      case 'REMOVE_RETAILER_PERMISSION' as MessageType:
        return this.removeRetailerPermission(message.payload);
      
      default:
        return { 
          success: false, 
          error: { code: 'UNKNOWN_MESSAGE_TYPE', message: 'Unknown message type' } 
        };
    }
  }

  private async getUserStatus(): Promise<MessageResponse> {
    try {
      // Use cached user data for better performance
      const user = await this.getCachedUser();
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
      // Delegate to cache manager for consistent handling
      const updatedSettings = await this.cacheManager.updateSettings(settings);
      
      log('info', 'Settings updated successfully');
      
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
      // Use cached settings for better performance
      const settings = await this.getCachedSettings();
      
      if (!settings?.notificationsEnabled) {
        return { 
          success: false, 
          error: { code: 'NOTIFICATIONS_DISABLED', message: 'Notifications disabled' } 
        };
      }
      
      // Create notification with error handling
      const notificationId = await new Promise<string>((resolve, reject) => {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: notificationData.title || 'BoosterBeacon Alert',
          message: notificationData.message || 'New product alert available',
          priority: notificationData.priority || 1
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(notificationId);
          }
        });
      });
      
      log('info', 'Notification created successfully', { notificationId });
      
      return { success: true, data: { notificationId } };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'NOTIFICATION_ERROR', message: 'Failed to show notification' } 
      };
    }
  }

  private async syncWithServer(): Promise<MessageResponse> {
    try {
      // Delegate to optimized sync method
      await this.optimizedSyncWithServer();
      
      const lastSync = Date.now();
      return { success: true, data: { lastSync } };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'SYNC_ERROR', message: 'Failed to sync with server' } 
      };
    }
  }

  private handleAlarm(alarm: chrome.alarms.Alarm): void {
    log('info', `Alarm triggered: ${alarm.name}`, { 
      scheduledTime: alarm.scheduledTime,
      periodInMinutes: alarm.periodInMinutes 
    });
    
    // Execute alarm tasks with performance monitoring
    performanceMonitor.timeFunction(
      `alarm_${alarm.name}`,
      () => this.executeAlarmTask(alarm.name),
      { 
        alarmName: alarm.name,
        scheduledTime: alarm.scheduledTime,
        periodInMinutes: alarm.periodInMinutes
      }
    )
      .then(() => {
        log('info', `Alarm ${alarm.name} completed successfully`);
      })
      .catch((error) => {
        log('error', `Alarm ${alarm.name} failed`, error);
      });
  }

  /**
   * Execute alarm tasks with proper error handling and performance optimization
   */
  private async executeAlarmTask(alarmName: string): Promise<void> {
    switch (alarmName) {
      case ALARM_NAMES.SYNC_DATA:
        await this.optimizedSyncWithServer();
        break;
      
      case ALARM_NAMES.CHECK_ALERTS:
        await this.optimizedCheckForNewAlerts();
        break;
      
      case ALARM_NAMES.MEMORY_CLEANUP:
        await this.performMemoryCleanup();
        break;
      
      case ALARM_NAMES.PERFORMANCE_MONITOR:
        await this.performPerformanceCheck();
        break;
      
      default:
        log('warn', `Unknown alarm: ${alarmName}`);
    }
  }

  /**
   * Optimized server sync with batching and caching
   */
  private async optimizedSyncWithServer(): Promise<void> {
    try {
      // Check if user is authenticated using cache
      const user = await this.getCachedUser();
      const authToken = await getStorageData<string>(STORAGE_KEYS.AUTH_TOKEN);
      
      if (!user || !authToken) {
        log('info', 'Skipping sync - user not authenticated');
        return;
      }
      
      // Check last sync time to avoid unnecessary syncs
      const lastSync = await getStorageData<number>(STORAGE_KEYS.LAST_SYNC);
      const now = Date.now();
      
      if (lastSync && (now - lastSync) < PERFORMANCE_THRESHOLDS.SYNC_INTERVAL) {
        log('info', 'Skipping sync - too recent');
        return;
      }
      
      // Perform lightweight sync
      log('info', 'Performing optimized server sync...');
      
      // In a real implementation, this would be a lightweight API call
      // For now, just update the last sync time
      await setStorageData(STORAGE_KEYS.LAST_SYNC, now);
      
      log('info', 'Server sync completed successfully');
    } catch (error) {
      log('error', 'Optimized server sync failed', error);
    }
  }

  /**
   * Optimized alert checking with intelligent scheduling
   */
  private async optimizedCheckForNewAlerts(): Promise<void> {
    try {
      // Check if user is authenticated using cache
      const user = await this.getCachedUser();
      const authToken = await getStorageData<string>(STORAGE_KEYS.AUTH_TOKEN);
      
      if (!user || !authToken) {
        return; // Skip silently if not authenticated
      }
      
      // Check user settings to see if alerts are enabled
      const settings = await this.getCachedSettings();
      if (!settings?.notificationsEnabled) {
        return; // Skip if notifications disabled
      }
      
      // Perform lightweight alert check
      log('info', 'Checking for new alerts...');
      
      // In a real implementation, this would be an optimized API call
      // that only fetches new alerts since last check
      
    } catch (error) {
      log('error', 'Alert check failed', error);
    }
  }

  /**
   * Perform memory cleanup to prevent memory leaks
   */
  private async performMemoryCleanup(): Promise<void> {
    try {
      const now = Date.now();
      
      // Clean up performance metrics
      performanceMonitor.cleanup(300000); // 5 minutes
      
      // Cache cleanup is handled by CacheManager automatically
      
      log('info', 'Memory cleanup completed');
    } catch (error) {
      log('error', 'Memory cleanup failed', error);
    }
  }

  /**
   * Monitor performance and adjust behavior if needed
   */
  private async performPerformanceCheck(): Promise<void> {
    try {
      // Get performance statistics from the performance monitor
      const allStats = performanceMonitor.getAllStats();
      
      // Get cache performance statistics
      const cacheStats = this.cacheManager.getCacheStats();
      
      // Log comprehensive performance summary
      log('info', 'Performance check completed', {
        ...allStats,
        cache: cacheStats
      });
      
      // Check for performance issues
      const messageStats = performanceMonitor.getStats('message_processing');
      if (messageStats && messageStats.average > PERFORMANCE_THRESHOLDS.MAX_PROCESSING_TIME) {
        log('warn', 'Poor message processing performance detected', {
          average: messageStats.average.toFixed(2),
          max: messageStats.max.toFixed(2),
          count: messageStats.count
        });
      }
      
      // Check cache performance
      if (cacheStats.hitRate < 70 && (cacheStats.hits + cacheStats.misses) > 10) {
        log('warn', 'Poor cache hit rate detected', {
          hitRate: cacheStats.hitRate,
          hits: cacheStats.hits,
          misses: cacheStats.misses
        });
      }
      
      // Clean up old metrics to prevent memory leaks
      performanceMonitor.cleanup();
      
    } catch (error) {
      log('error', 'Performance check failed', error);
    }
  }

  /**
   * Throttled tab update handler to reduce CPU usage
   */
  private handleTabUpdateInternal(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    // Only process when the tab is completely loaded and URL is available
    if (changeInfo.status !== 'complete' || !tab.url) {
      return;
    }
    
    // Skip processing for non-HTTP(S) URLs
    if (!tab.url.startsWith('http')) {
      return;
    }
    
    const retailer = getCurrentRetailer(tab.url);
    
    if (retailer) {
      log('info', `User navigated to ${retailer.name}`, { 
        url: tab.url,
        tabId 
      });
      
      // Use debounced content script injection to avoid rapid injections
      this.debouncedContentScriptInjection(tabId);
    }
  }

  /**
   * Optimized content script injection with caching and error handling
   */
  private async ensureContentScriptInjected(tabId: number): Promise<void> {
    try {
      // Get tab info to validate before injection
      const tab = await new Promise<chrome.tabs.Tab>((resolve, reject) => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(tab);
          }
        });
      });
      
      // Skip if tab is not valid or not on a supported retailer
      if (!tab.url || !getCurrentRetailer(tab.url)) {
        return;
      }
      
      // Check if content script is already injected with timeout
      const isInjected = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 1000); // 1 second timeout
        
        chrome.tabs.sendMessage(
          tabId, 
          { type: MessageType.PING, timestamp: Date.now() }, 
          (response) => {
            clearTimeout(timeout);
            resolve(!chrome.runtime.lastError && !!response);
          }
        );
      });
      
      if (!isInjected) {
        // Content script not injected, inject it with performance monitoring
        await performanceMonitor.timeFunction(
          'content_script_injection',
          () => chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/content.js']
          }),
          { tabId, url: tab.url }
        );
        
        log('info', `Content script injected into tab ${tabId}`);
      }
    } catch (error) {
      // Log error but don't throw to avoid breaking other functionality
      log('error', 'Failed to ensure content script injection', { 
        error: error.message, 
        tabId 
      });
    }
  }

  /**
   * Legacy method - now delegates to optimized version
   */
  private async checkForNewAlerts(): Promise<void> {
    await this.optimizedCheckForNewAlerts();
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

  private async requestRetailerPermission(payload: any): Promise<MessageResponse> {
    try {
      const { retailerId, reason } = payload;
      
      if (!retailerId) {
        return { 
          success: false, 
          error: { code: 'INVALID_RETAILER', message: 'Retailer ID is required' } 
        };
      }

      const granted = await this.permissionManager.requestRetailerPermission(
        retailerId as RetailerId, 
        reason || 'Enable product monitoring and checkout assistance'
      );

      return { 
        success: true, 
        data: { 
          retailerId, 
          granted,
          message: granted ? 'Permission granted' : 'Permission denied'
        } 
      };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'PERMISSION_REQUEST_ERROR', message: 'Failed to request permission' } 
      };
    }
  }

  private async checkRetailerPermissions(): Promise<MessageResponse> {
    try {
      const statuses = await this.permissionManager.getAllPermissionStatuses();
      const validation = await this.permissionManager.validateRequiredPermissions();
      
      return { 
        success: true, 
        data: { 
          retailerStatuses: statuses,
          validation,
          missingRequired: validation.missing,
          optionalRetailers: validation.optional
        } 
      };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'PERMISSION_CHECK_ERROR', message: 'Failed to check permissions' } 
      };
    }
  }

  private async removeRetailerPermission(payload: any): Promise<MessageResponse> {
    try {
      const { retailerId } = payload;
      
      if (!retailerId) {
        return { 
          success: false, 
          error: { code: 'INVALID_RETAILER', message: 'Retailer ID is required' } 
        };
      }

      const removed = await this.permissionManager.removeRetailerPermission(retailerId as RetailerId);

      return { 
        success: true, 
        data: { 
          retailerId, 
          removed,
          message: removed ? 'Permission removed' : 'Permission not found or could not be removed'
        } 
      };
    } catch (error) {
      return { 
        success: false, 
        error: { code: 'PERMISSION_REMOVE_ERROR', message: 'Failed to remove permission' } 
      };
    }
  }

  private async validatePermissions(): Promise<void> {
    try {
      const validation = await this.permissionManager.validateRequiredPermissions();
      
      if (!validation.valid) {
        log('warn', 'Missing required permissions', validation.missing);
        // Could show notification or badge to indicate missing permissions
      }
      
      // Check if user has enabled retailers without permissions
      const missingRetailerPermissions = await this.permissionManager.checkRequiredPermissions();
      if (missingRetailerPermissions.length > 0) {
        log('info', 'Missing retailer permissions for enabled retailers', missingRetailerPermissions);
        // Could prompt user to grant permissions
      }
    } catch (error) {
      log('error', 'Failed to validate permissions', error);
    }
  }
}

// Initialize the background service
new BackgroundService();