import { monitoringService } from '../../src/services/monitoringService';
import { healthCheckService } from '../../src/services/healthCheckService';

// Mock the health check service
jest.mock('../../src/services/healthCheckService');

describe('MonitoringService', () => {
  beforeEach(() => {
    // Clear all metrics before each test
    monitoringService['metrics'].clear();
    monitoringService['activeAlerts'].clear();
  });

  describe('Metric Recording', () => {
    it('should record metrics correctly', () => {
      const metric = 'test_metric';
      const value = 42;
      const labels = { service: 'test' };

      monitoringService.recordMetric(metric, value, labels);

      const metrics = monitoringService.getMetrics(metric);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.metric).toBe(metric);
      expect(metrics[0]?.value).toBe(value);
      expect(metrics[0]?.labels).toEqual(labels);
    });

    it('should filter metrics by time range', () => {
      const metric = 'test_metric';
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Record metrics at different times
      monitoringService.recordMetric(metric, 1);
      monitoringService.recordMetric(metric, 2);
      monitoringService.recordMetric(metric, 3);

      // Manually set timestamps for testing
      const allMetrics = monitoringService.getMetrics(metric);
      if (allMetrics[0]) allMetrics[0].timestamp = twoHoursAgo;
      if (allMetrics[1]) allMetrics[1].timestamp = oneHourAgo;
      if (allMetrics[2]) allMetrics[2].timestamp = now;

      const recentMetrics = monitoringService.getMetrics(metric, oneHourAgo);
      expect(recentMetrics).toHaveLength(2);
    });

    it('should calculate metric statistics correctly', () => {
      const metric = 'test_metric';
      const values = [10, 20, 30, 40, 50];

      values.forEach(value => {
        monitoringService.recordMetric(metric, value);
      });

      const stats = monitoringService.getMetricStats(metric);
      expect(stats.count).toBe(5);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.avg).toBe(30);
      expect(stats.sum).toBe(150);
    });
  });

  describe('Alert Rules', () => {
    it('should add and retrieve alert rules', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        metric: 'test_metric',
        operator: 'gt' as const,
        threshold: 100,
        duration: 60,
        severity: 'high' as const,
        enabled: true,
        notificationChannels: ['email']
      };

      monitoringService.addAlertRule(rule);

      const rules = monitoringService.getAlertRules();
      expect(rules).toHaveLength(7); // 6 default rules + 1 test rule
      expect(rules.find(r => r.id === 'test_rule')).toEqual(rule);
    });

    it('should remove alert rules', () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        metric: 'test_metric',
        operator: 'gt' as const,
        threshold: 100,
        duration: 60,
        severity: 'high' as const,
        enabled: true,
        notificationChannels: ['email']
      };

      monitoringService.addAlertRule(rule);
      expect(monitoringService.getAlertRules().find(r => r.id === 'test_rule')).toBeDefined();

      monitoringService.removeAlertRule('test_rule');
      expect(monitoringService.getAlertRules().find(r => r.id === 'test_rule')).toBeUndefined();
    });
  });

  describe('Alert Evaluation', () => {
    it('should evaluate conditions correctly', () => {
      const service = monitoringService as any;

      expect(service.evaluateCondition(10, 'gt', 5)).toBe(true);
      expect(service.evaluateCondition(10, 'gt', 15)).toBe(false);
      expect(service.evaluateCondition(10, 'lt', 15)).toBe(true);
      expect(service.evaluateCondition(10, 'lt', 5)).toBe(false);
      expect(service.evaluateCondition(10, 'eq', 10)).toBe(true);
      expect(service.evaluateCondition(10, 'eq', 5)).toBe(false);
      expect(service.evaluateCondition(10, 'gte', 10)).toBe(true);
      expect(service.evaluateCondition(10, 'lte', 10)).toBe(true);
    });

    it('should fire alerts when thresholds are exceeded', (done) => {
      const rule = {
        id: 'test_alert',
        name: 'Test Alert',
        metric: 'test_metric',
        operator: 'gt' as const,
        threshold: 50,
        duration: 1, // 1 second for quick testing
        severity: 'high' as const,
        enabled: true,
        notificationChannels: ['email']
      };

      monitoringService.addAlertRule(rule);

      // Listen for alert event
      monitoringService.once('alert', (alert) => {
        expect(alert.ruleId).toBe('test_alert');
        expect(alert.value).toBe(75);
        expect(alert.threshold).toBe(50);
        expect(alert.status).toBe('firing');
        done();
      });

      // Record metric that exceeds threshold
      monitoringService.recordMetric('test_metric', 75);

      // Trigger alert evaluation
      setTimeout(() => {
        (monitoringService as any).checkAlertRules();
      }, 100);
    });
  });

  describe('System Metrics Collection', () => {
    it('should collect system metrics', async () => {
      const mockHealthData = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        uptime: 3600,
        version: '1.0.0',
        environment: 'test',
        checks: {
          database: { status: 'pass' as const, responseTime: 10 },
          redis: { status: 'pass' as const, responseTime: 5 },
          memory: { status: 'pass' as const, responseTime: 1 },
          disk: { status: 'pass' as const, responseTime: 1 },
          external: { status: 'pass' as const, responseTime: 20 }
        },
        metrics: {
          memory: { used: 512, total: 1024, percentage: 50 },
          cpu: { usage: 25 },
          requests: { total: 100, errors: 2, averageResponseTime: 150 },
          alerts: { sent: 10, failed: 1, successRate: 90 }
        }
      };

      (healthCheckService.performHealthCheck as jest.Mock).mockResolvedValue(mockHealthData);

      // Trigger system metrics collection
      await (monitoringService as any).collectSystemMetrics();

      // Verify metrics were recorded
      expect(monitoringService.getMetrics('memory_usage_percent')).toHaveLength(1);
      expect(monitoringService.getMetrics('cpu_usage_percent')).toHaveLength(1);
      expect(monitoringService.getMetrics('avg_response_time_ms')).toHaveLength(1);
      expect(monitoringService.getMetrics('error_rate_percent')).toHaveLength(1);
      expect(monitoringService.getMetrics('database_health')).toHaveLength(1);
      expect(monitoringService.getMetrics('uptime_seconds')).toHaveLength(1);
    });
  });

  describe('Request and Alert Metrics', () => {
    it('should record request metrics', () => {
      const service = monitoringService as any;
      
      service.recordRequest(100, false);
      service.recordRequest(200, true);
      service.recordRequest(150, false);

      expect(service.requestMetrics.total).toBe(3);
      expect(service.requestMetrics.errors).toBe(1);
      expect(service.requestMetrics.totalResponseTime).toBe(450);
    });

    it('should record alert metrics', () => {
      const service = monitoringService as any;
      
      service.recordAlert(true);
      service.recordAlert(false);
      service.recordAlert(true);

      expect(service.alertMetrics.sent).toBe(3);
      expect(service.alertMetrics.failed).toBe(1);
    });
  });

  describe('Metrics Cleanup', () => {
    it('should clean up old metrics', () => {
      const metric = 'test_metric';
      const now = new Date();
      const oldTime = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      // Record some metrics
      monitoringService.recordMetric(metric, 1);
      monitoringService.recordMetric(metric, 2);

      // Manually set one metric to be old
      const metrics = monitoringService.getMetrics(metric);
      if (metrics[0]) metrics[0].timestamp = oldTime;

      // Trigger cleanup
      (monitoringService as any).cleanupOldMetrics();

      // Should only have 1 metric left (the recent one)
      expect(monitoringService.getMetrics(metric)).toHaveLength(1);
    });
  });
});