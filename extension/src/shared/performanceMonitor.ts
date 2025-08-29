// Performance monitoring utilities for the BoosterBeacon extension

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any> | undefined;
}

export interface PerformanceThresholds {
  warning: number;
  critical: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: Map<string, PerformanceThresholds> = new Map();
  private readonly MAX_METRICS_PER_TYPE = 100;

  private constructor() {
    this.setupDefaultThresholds();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private setupDefaultThresholds(): void {
    this.thresholds.set('message_processing', { warning: 50, critical: 100 });
    this.thresholds.set('alarm_execution', { warning: 100, critical: 200 });
    this.thresholds.set('content_script_injection', { warning: 500, critical: 1000 });
    this.thresholds.set('storage_operation', { warning: 20, critical: 50 });
    this.thresholds.set('api_call', { warning: 1000, critical: 3000 });
  }

  /**
   * Record a performance metric
   */
  public recordMetric(
    name: string, 
    value: number, 
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata: metadata || undefined
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only the most recent metrics to prevent memory leaks
    if (metrics.length > this.MAX_METRICS_PER_TYPE) {
      metrics.shift();
    }

    // Check thresholds and log warnings
    this.checkThresholds(name, value, metadata);
  }

  /**
   * Time a function execution and record the metric
   */
  public async timeFunction<T>(
    name: string,
    func: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await func();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { ...metadata, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { 
        ...metadata, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Time a synchronous function execution and record the metric
   */
  public timeSync<T>(
    name: string,
    func: () => T,
    metadata?: Record<string, any>
  ): T {
    const startTime = performance.now();
    
    try {
      const result = func();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { ...metadata, success: true });
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { 
        ...metadata, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Get performance statistics for a metric
   */
  public getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    recent: number;
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      recent: values[values.length - 1] || 0
    };
  }

  /**
   * Get all performance metrics for debugging
   */
  public getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name] of this.metrics) {
      stats[name] = this.getStats(name);
    }
    
    return stats;
  }

  /**
   * Clear old metrics to free memory
   */
  public cleanup(maxAge: number = 300000): void { // 5 minutes default
    const cutoff = Date.now() - maxAge;
    
    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }

  /**
   * Set custom thresholds for a metric
   */
  public setThresholds(name: string, thresholds: PerformanceThresholds): void {
    this.thresholds.set(name, thresholds);
  }

  private checkThresholds(
    name: string, 
    value: number, 
    metadata?: Record<string, any>
  ): void {
    const threshold = this.thresholds.get(name);
    if (!threshold) return;

    if (value >= threshold.critical) {
      console.error(`[PerformanceMonitor] CRITICAL: ${name} took ${value.toFixed(2)}ms`, metadata);
    } else if (value >= threshold.warning) {
      console.warn(`[PerformanceMonitor] WARNING: ${name} took ${value.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Create a performance-aware wrapper for chrome.alarms
   */
  public createOptimizedAlarmHandler(
    originalHandler: (alarm: chrome.alarms.Alarm) => void
  ): (alarm: chrome.alarms.Alarm) => void {
    return (alarm: chrome.alarms.Alarm) => {
      this.timeSync(
        `alarm_${alarm.name}`,
        () => originalHandler(alarm),
        { alarmName: alarm.name, scheduledTime: alarm.scheduledTime }
      );
    };
  }

  /**
   * Create a performance-aware wrapper for message handlers
   */
  public createOptimizedMessageHandler<T, R>(
    originalHandler: (message: T) => Promise<R>
  ): (message: T) => Promise<R> {
    return async (message: T) => {
      return this.timeFunction(
        'message_processing',
        () => originalHandler(message),
        { messageType: (message as any)?.type }
      );
    };
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();