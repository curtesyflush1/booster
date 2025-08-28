import { EventEmitter } from 'events';
import { loggerWithContext } from '../utils/logger';
import { healthCheckService } from './healthCheckService';
import { MONITORING_CONFIG, INTERVALS } from '../constants';

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
}

export interface MetricData {
  timestamp: Date;
  metric: string;
  value: number;
  labels?: Record<string, string> | undefined;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved';
  startsAt: Date;
  endsAt?: Date;
  message: string;
}

class MonitoringService extends EventEmitter {
  private metrics: Map<string, MetricData[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private metricsRetentionHours = MONITORING_CONFIG.METRICS_RETENTION_HOURS;
  private alertCheckInterval = MONITORING_CONFIG.ALERT_CHECK_INTERVAL;
  private metricsCleanupInterval = INTERVALS.METRICS_CLEANUP_INTERVAL;

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Record a metric value
   */
  recordMetric(metric: string, value: number, labels?: Record<string, string>): void {
    const data: MetricData = {
      timestamp: new Date(),
      metric,
      value,
      ...(labels && { labels })
    };

    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    const metricData = this.metrics.get(metric)!;
    metricData.push(data);

    // Keep only recent data
    const cutoff = new Date(Date.now() - this.metricsRetentionHours * 60 * 60 * 1000);
    this.metrics.set(metric, metricData.filter(d => d.timestamp > cutoff));

    loggerWithContext.debug('Metric recorded', {
      metric,
      value,
      labels
    });

    // Emit metric event for real-time processing
    this.emit('metric', data);
  }

  /**
   * Get metric data for a time range
   */
  getMetrics(metric: string, startTime?: Date, endTime?: Date): MetricData[] {
    const data = this.metrics.get(metric) || [];
    
    if (!startTime && !endTime) {
      return data;
    }

    return data.filter(d => {
      if (startTime && d.timestamp < startTime) return false;
      if (endTime && d.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Get aggregated metric statistics
   */
  getMetricStats(metric: string, startTime?: Date, endTime?: Date): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  } {
    const data = this.getMetrics(metric, startTime, endTime);
    
    if (data.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, sum: 0 };
    }

    const values = data.map(d => d.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: data.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / data.length,
      sum
    };
  }

  /**
   * Add or update an alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    
    loggerWithContext.info('Alert rule added', {
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      threshold: rule.threshold,
      severity: rule.severity
    });
  }

  /**
   * Remove an alert rule
   */
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    
    // Resolve any active alerts for this rule
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.ruleId === ruleId) {
        this.resolveAlert(alertId);
      }
    }
    
    loggerWithContext.info('Alert rule removed', { ruleId });
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    // In a real implementation, this would query a database
    // For now, return resolved alerts from memory
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.status === 'resolved')
      .slice(-limit);
  }

  /**
   * Initialize default monitoring rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        metric: 'memory_usage_percent',
        operator: 'gt',
        threshold: 85,
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        metric: 'cpu_usage_percent',
        operator: 'gt',
        threshold: 80,
        duration: 300,
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        metric: 'error_rate_percent',
        operator: 'gt',
        threshold: 5,
        duration: 60,
        severity: 'critical',
        enabled: true,
        notificationChannels: ['email', 'slack', 'pagerduty']
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        metric: 'avg_response_time_ms',
        operator: 'gt',
        threshold: 2000,
        duration: 180,
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email']
      },
      {
        id: 'database_connection_failure',
        name: 'Database Connection Failure',
        metric: 'database_health',
        operator: 'eq',
        threshold: 0,
        duration: 30,
        severity: 'critical',
        enabled: true,
        notificationChannels: ['email', 'slack', 'pagerduty']
      },
      {
        id: 'low_disk_space',
        name: 'Low Disk Space',
        metric: 'disk_usage_percent',
        operator: 'gt',
        threshold: 90,
        duration: 600, // 10 minutes
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      }
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
  }

  /**
   * Start monitoring processes
   */
  private startMonitoring(): void {
    // Start alert checking
    setInterval(() => {
      this.checkAlertRules();
    }, this.alertCheckInterval);

    // Start metrics cleanup
    setInterval(() => {
      this.cleanupOldMetrics();
    }, this.metricsCleanupInterval);

    // Start system metrics collection
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // Every minute

    loggerWithContext.info('Monitoring service started', {
      alertCheckInterval: this.alertCheckInterval,
      metricsCleanupInterval: this.metricsCleanupInterval,
      metricsRetentionHours: this.metricsRetentionHours
    });
  }

  /**
   * Check alert rules against current metrics
   */
  private async checkAlertRules(): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        loggerWithContext.error('Error evaluating alert rule', error as Error, {
          ruleId: rule.id,
          ruleName: rule.name
        });
      }
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - rule.duration * 1000);
    
    const metricData = this.getMetrics(rule.metric, startTime, endTime);
    
    if (metricData.length === 0) {
      return; // No data to evaluate
    }

    // Calculate the value to compare (using average for now)
    const values = metricData.map(d => d.value);
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    
    const isTriggered = this.evaluateCondition(avgValue, rule.operator, rule.threshold);
    const alertId = `${rule.id}_${rule.metric}`;
    const existingAlert = this.activeAlerts.get(alertId);

    if (isTriggered && !existingAlert) {
      // Fire new alert
      this.fireAlert(rule, avgValue);
    } else if (!isTriggered && existingAlert && existingAlert.status === 'firing') {
      // Resolve existing alert
      this.resolveAlert(alertId);
    }
  }

  /**
   * Evaluate condition based on operator
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Fire a new alert
   */
  private fireAlert(rule: AlertRule, value: number): void {
    const alertId = `${rule.id}_${rule.metric}`;
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      status: 'firing',
      startsAt: new Date(),
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`
    };

    this.activeAlerts.set(alertId, alert);

    loggerWithContext.warn('Alert fired', {
      alertId,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity
    });

    // Emit alert event for notification handling
    this.emit('alert', alert);
  }

  /**
   * Resolve an active alert
   */
  private resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.status = 'resolved';
    alert.endsAt = new Date();

    loggerWithContext.info('Alert resolved', {
      alertId,
      ruleName: alert.ruleName,
      duration: alert.endsAt.getTime() - alert.startsAt.getTime()
    });

    // Emit resolved event
    this.emit('alertResolved', alert);

    // Remove from active alerts after a delay
    setTimeout(() => {
      this.activeAlerts.delete(alertId);
    }, 300000); // Keep resolved alerts for 5 minutes
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Get health check data
      const healthData = await healthCheckService.performHealthCheck();
      
      // Record system metrics
      this.recordMetric('memory_usage_percent', healthData.metrics.memory.percentage);
      this.recordMetric('cpu_usage_percent', healthData.metrics.cpu.usage);
      this.recordMetric('avg_response_time_ms', healthData.metrics.requests.averageResponseTime);
      this.recordMetric('error_rate_percent', 
        healthData.metrics.requests.total > 0 
          ? (healthData.metrics.requests.errors / healthData.metrics.requests.total) * 100 
          : 0
      );
      this.recordMetric('database_health', healthData.checks.database.status === 'pass' ? 1 : 0);
      this.recordMetric('redis_health', healthData.checks.redis.status === 'pass' ? 1 : 0);
      
      // Record uptime
      this.recordMetric('uptime_seconds', process.uptime());
      
    } catch (error) {
      loggerWithContext.error('Failed to collect system metrics', error as Error);
    }
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.metricsRetentionHours * 60 * 60 * 1000);
    let totalCleaned = 0;

    for (const [metric, data] of this.metrics) {
      const originalLength = data.length;
      const filteredData = data.filter(d => d.timestamp > cutoff);
      this.metrics.set(metric, filteredData);
      
      const cleaned = originalLength - filteredData.length;
      totalCleaned += cleaned;
    }

    if (totalCleaned > 0) {
      loggerWithContext.debug('Cleaned up old metrics', {
        totalCleaned,
        retentionHours: this.metricsRetentionHours
      });
    }
  }
}

export const monitoringService = new MonitoringService();