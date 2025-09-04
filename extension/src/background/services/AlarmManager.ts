// Centralized alarm management with error recovery and scheduling optimization
import { performanceMonitor } from '../../shared/performanceMonitor';
import { log } from '../../shared/utils';

export interface AlarmConfig {
  name: string;
  periodInMinutes: number;
  handler: () => Promise<void>;
  retryOnFailure?: boolean;
  maxRetries?: number;
  backoffMultiplier?: number;
}

export class AlarmManager {
  private alarmHandlers = new Map<string, AlarmConfig>();
  private retryAttempts = new Map<string, number>();
  
  // Optimized alarm intervals
  private readonly ALARM_CONFIGS: AlarmConfig[] = [
    {
      name: 'sync-data',
      periodInMinutes: 5,
      handler: this.handleDataSync.bind(this),
      retryOnFailure: true,
      maxRetries: 3
    },
    {
      name: 'check-alerts',
      periodInMinutes: 1,
      handler: this.handleAlertCheck.bind(this),
      retryOnFailure: true,
      maxRetries: 2
    },
    {
      name: 'memory-cleanup',
      periodInMinutes: 10,
      handler: this.handleMemoryCleanup.bind(this),
      retryOnFailure: false
    },
    {
      name: 'performance-monitor',
      periodInMinutes: 5,
      handler: this.handlePerformanceCheck.bind(this),
      retryOnFailure: false
    }
  ];

  constructor(
    private cacheManager: any,
    private syncService: any
  ) {
    this.initialize();
  }

  /**
   * Initialize alarm system
   */
  public async initialize(): Promise<void> {
    try {
      // Clear existing alarms to avoid duplicates
      await this.clearAllAlarms();
      
      // Register alarm handlers
      this.registerAlarmHandlers();
      
      // Set up Chrome alarm listener
      chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
      
      // Create alarms
      await this.createAlarms();
      
      log('info', 'Alarm system initialized successfully');
    } catch (error) {
      log('error', 'Failed to initialize alarm system', error);
      throw error;
    }
  }

  /**
   * Register all alarm handlers
   */
  private registerAlarmHandlers(): void {
    this.ALARM_CONFIGS.forEach(config => {
      this.alarmHandlers.set(config.name, config);
    });
  }

  /**
   * Create all configured alarms
   */
  private async createAlarms(): Promise<void> {
    const createPromises = this.ALARM_CONFIGS.map(config =>
      this.createAlarm(config.name, config.periodInMinutes)
    );
    
    await Promise.all(createPromises);
    log('info', `Created ${this.ALARM_CONFIGS.length} alarms`);
  }

  /**
   * Create a single alarm with error handling
   */
  private createAlarm(name: string, periodInMinutes: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.alarms.create(name, { periodInMinutes }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to create alarm ${name}: ${chrome.runtime.lastError.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear all existing alarms
   */
  private clearAllAlarms(): Promise<void> {
    return new Promise((resolve) => {
      chrome.alarms.clearAll(() => {
        resolve();
      });
    });
  }

  /**
   * Handle alarm execution with performance monitoring and error recovery
   */
  private async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    const config = this.alarmHandlers.get(alarm.name);
    if (!config) {
      log('warn', `No handler found for alarm: ${alarm.name}`);
      return;
    }

    log('info', `Executing alarm: ${alarm.name}`);

    try {
      await performanceMonitor.timeFunction(
        `alarm_${alarm.name}`,
        config.handler,
        { 
          alarmName: alarm.name,
          scheduledTime: alarm.scheduledTime,
          periodInMinutes: alarm.periodInMinutes
        }
      );

      // Reset retry count on success
      this.retryAttempts.delete(alarm.name);
      log('info', `Alarm ${alarm.name} completed successfully`);

    } catch (error) {
      log('error', `Alarm ${alarm.name} failed`, error);
      
      if (config.retryOnFailure) {
        await this.handleAlarmRetry(alarm.name, config);
      }
    }
  }

  /**
   * Handle alarm retry logic with exponential backoff
   */
  private async handleAlarmRetry(
    alarmName: string, 
    config: AlarmConfig
  ): Promise<void> {
    const currentRetries = this.retryAttempts.get(alarmName) || 0;
    const maxRetries = config.maxRetries || 3;

    if (currentRetries < maxRetries) {
      const nextRetry = currentRetries + 1;
      this.retryAttempts.set(alarmName, nextRetry);
      
      // Calculate backoff delay (exponential with jitter)
      const baseDelay = 1000; // 1 second
      const backoffMultiplier = config.backoffMultiplier || 2;
      const delay = baseDelay * Math.pow(backoffMultiplier, currentRetries) + 
                   Math.random() * 1000; // Add jitter

      log('info', `Retrying alarm ${alarmName} in ${delay}ms (attempt ${nextRetry}/${maxRetries})`);

      setTimeout(async () => {
        try {
          await config.handler();
          this.retryAttempts.delete(alarmName);
          log('info', `Alarm ${alarmName} retry succeeded`);
        } catch (retryError) {
          log('error', `Alarm ${alarmName} retry failed`, retryError);
          // Will be handled by the next scheduled execution
        }
      }, delay);
    } else {
      log('error', `Alarm ${alarmName} exceeded max retries (${maxRetries})`);
      this.retryAttempts.delete(alarmName);
    }
  }

  // Alarm handler implementations
  private async handleDataSync(): Promise<void> {
    await this.syncService.optimizedSyncWithServer();
  }

  private async handleAlertCheck(): Promise<void> {
    await this.syncService.optimizedCheckForNewAlerts();
  }

  private async handleMemoryCleanup(): Promise<void> {
    // Clean up performance metrics
    performanceMonitor.cleanup(300000); // 5 minutes
    
    // Clean up cache
    this.cacheManager.cleanupExpiredEntries();
    
    log('info', 'Memory cleanup completed');
  }

  private async handlePerformanceCheck(): Promise<void> {
    const allStats = performanceMonitor.getAllStats();
    log('info', 'Performance check completed', allStats);
    
    // Clean up old metrics
    performanceMonitor.cleanup();
  }

  /**
   * Get alarm status for monitoring
   */
  public async getAlarmStatus(): Promise<{
    active: chrome.alarms.Alarm[];
    handlers: string[];
    retryAttempts: Record<string, number>;
  }> {
    return new Promise((resolve) => {
      chrome.alarms.getAll((alarms) => {
        resolve({
          active: alarms,
          handlers: Array.from(this.alarmHandlers.keys()),
          retryAttempts: Object.fromEntries(this.retryAttempts)
        });
      });
    });
  }

  /**
   * Manually trigger an alarm for testing
   */
  public async triggerAlarm(alarmName: string): Promise<void> {
    const config = this.alarmHandlers.get(alarmName);
    if (!config) {
      throw new Error(`No handler found for alarm: ${alarmName}`);
    }

    log('info', `Manually triggering alarm: ${alarmName}`);
    await config.handler();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.clearAllAlarms();
    this.alarmHandlers.clear();
    this.retryAttempts.clear();
  }
}
