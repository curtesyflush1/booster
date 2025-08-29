// Optimized sync service with intelligent scheduling and error recovery
import { STORAGE_KEYS } from '../../shared/types';
import { getStorageData, setStorageData, log } from '../../shared/utils';
import { performanceMonitor } from '../../shared/performanceMonitor';

export class SyncService {
  private readonly SYNC_INTERVAL = 300000; // 5 minutes
  private readonly ALERT_CHECK_INTERVAL = 60000; // 1 minute
  private lastSyncTime = 0;
  private lastAlertCheck = 0;

  constructor(private cacheManager: any) {}

  /**
   * Optimized server sync with intelligent scheduling
   */
  public async optimizedSyncWithServer(): Promise<void> {
    try {
      const now = Date.now();
      
      // Check if sync is needed based on interval
      if (now - this.lastSyncTime < this.SYNC_INTERVAL) {
        log('info', 'Skipping sync - too recent');
        return;
      }

      // Check authentication status using cache
      const user = await this.cacheManager.getCachedUser();
      const authToken = await this.cacheManager.getAuthToken();
      
      if (!user || !authToken) {
        log('info', 'Skipping sync - user not authenticated');
        return;
      }

      log('info', 'Performing optimized server sync...');
      
      // Perform lightweight sync operations
      await this.performLightweightSync(user, authToken);
      
      // Update last sync time
      this.lastSyncTime = now;
      await setStorageData(STORAGE_KEYS.LAST_SYNC, now);
      
      log('info', 'Server sync completed successfully');
    } catch (error) {
      log('error', 'Optimized server sync failed', error);
      throw error;
    }
  }

  /**
   * Optimized alert checking with intelligent filtering
   */
  public async optimizedCheckForNewAlerts(): Promise<void> {
    try {
      const now = Date.now();
      
      // Check if alert check is needed
      if (now - this.lastAlertCheck < this.ALERT_CHECK_INTERVAL) {
        return;
      }

      // Check authentication and settings
      const [user, authToken, settings] = await Promise.all([
        this.cacheManager.getCachedUser(),
        this.cacheManager.getAuthToken(),
        this.cacheManager.getCachedSettings()
      ]);
      
      if (!user || !authToken) {
        return; // Skip silently if not authenticated
      }
      
      if (!settings?.notificationsEnabled) {
        return; // Skip if notifications disabled
      }

      log('info', 'Checking for new alerts...');
      
      // Perform lightweight alert check
      await this.performLightweightAlertCheck(user, authToken);
      
      this.lastAlertCheck = now;
    } catch (error) {
      log('error', 'Alert check failed', error);
      throw error;
    }
  }

  /**
   * Perform lightweight sync operations
   */
  private async performLightweightSync(user: any, authToken: string): Promise<void> {
    // In a real implementation, this would make optimized API calls
    // For now, simulate sync operations
    
    const syncOperations = [
      this.syncUserPreferences(user.id, authToken),
      this.syncWatchList(user.id, authToken),
      this.syncAlertHistory(user.id, authToken)
    ];

    // Execute sync operations with timeout
    await Promise.race([
      Promise.all(syncOperations),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout')), 10000)
      )
    ]);
  }

  /**
   * Perform lightweight alert check
   */
  private async performLightweightAlertCheck(user: any, authToken: string): Promise<void> {
    // In a real implementation, this would check for new alerts
    // since the last check timestamp
    
    const lastCheck = await getStorageData<number>('lastAlertCheck') || 0;
    
    // Simulate alert check API call
    await this.checkAlertsFromServer(user.id, authToken, lastCheck);
    
    await setStorageData('lastAlertCheck', Date.now());
  }

  /**
   * Sync user preferences (mock implementation)
   */
  private async syncUserPreferences(userId: string, authToken: string): Promise<void> {
    // Mock API call with performance monitoring
    await performanceMonitor.timeFunction(
      'sync_user_preferences',
      () => new Promise(resolve => setTimeout(resolve, 100)),
      { userId }
    );
  }

  /**
   * Sync watch list (mock implementation)
   */
  private async syncWatchList(userId: string, authToken: string): Promise<void> {
    await performanceMonitor.timeFunction(
      'sync_watch_list',
      () => new Promise(resolve => setTimeout(resolve, 150)),
      { userId }
    );
  }

  /**
   * Sync alert history (mock implementation)
   */
  private async syncAlertHistory(userId: string, authToken: string): Promise<void> {
    await performanceMonitor.timeFunction(
      'sync_alert_history',
      () => new Promise(resolve => setTimeout(resolve, 75)),
      { userId }
    );
  }

  /**
   * Check alerts from server (mock implementation)
   */
  private async checkAlertsFromServer(
    userId: string, 
    authToken: string, 
    lastCheck: number
  ): Promise<void> {
    await performanceMonitor.timeFunction(
      'check_alerts_server',
      () => new Promise(resolve => setTimeout(resolve, 200)),
      { userId, lastCheck }
    );
  }

  /**
   * Force sync for testing or manual triggers
   */
  public async forceSync(): Promise<void> {
    this.lastSyncTime = 0;
    await this.optimizedSyncWithServer();
  }

  /**
   * Force alert check for testing
   */
  public async forceAlertCheck(): Promise<void> {
    this.lastAlertCheck = 0;
    await this.optimizedCheckForNewAlerts();
  }

  /**
   * Get sync status for monitoring
   */
  public getSyncStatus(): {
    lastSyncTime: number;
    lastAlertCheck: number;
    nextSyncDue: number;
    nextAlertCheckDue: number;
  } {
    const now = Date.now();
    return {
      lastSyncTime: this.lastSyncTime,
      lastAlertCheck: this.lastAlertCheck,
      nextSyncDue: this.lastSyncTime + this.SYNC_INTERVAL,
      nextAlertCheckDue: this.lastAlertCheck + this.ALERT_CHECK_INTERVAL
    };
  }
}