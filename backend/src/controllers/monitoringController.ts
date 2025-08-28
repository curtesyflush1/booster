import { Request, Response } from 'express';
import { monitoringService } from '../services/monitoringService';
import { loggerWithContext } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/responseHelpers';
import { DASHBOARD_TIME_WINDOWS, TIME_UNITS } from '../constants';

/**
 * Get system metrics
 * GET /api/monitoring/metrics
 */
export const getMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { metric, startTime, endTime, aggregation } = req.query;
    
    loggerWithContext.info('Retrieving metrics', {
      metric,
      startTime,
      endTime,
      aggregation,
      correlationId: req.correlationId
    });

    if (metric && typeof metric === 'string') {
      // Get specific metric
      const start = startTime ? new Date(startTime as string) : undefined;
      const end = endTime ? new Date(endTime as string) : undefined;
      
      if (aggregation === 'stats') {
        const stats = monitoringService.getMetricStats(metric, start, end);
        successResponse(res, { metric, stats }, 'Metric statistics retrieved successfully');
      } else {
        const data = monitoringService.getMetrics(metric, start, end);
        successResponse(res, { metric, data }, 'Metric data retrieved successfully');
      }
    } else {
      // Get all available metrics (last hour by default)
      const end = new Date();
      const start = new Date(end.getTime() - DASHBOARD_TIME_WINDOWS.DEFAULT_MONITORING_WINDOW);
      
      const availableMetrics = [
        'memory_usage_percent',
        'cpu_usage_percent',
        'avg_response_time_ms',
        'error_rate_percent',
        'database_health',
        'redis_health',
        'uptime_seconds'
      ];
      
      const metricsData = availableMetrics.reduce((acc, metricName) => {
        acc[metricName] = monitoringService.getMetricStats(metricName, start, end);
        return acc;
      }, {} as Record<string, any>);
      
      successResponse(res, metricsData, 'All metrics retrieved successfully');
    }
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve metrics', error as Error);
    errorResponse(res, 500, 'Failed to retrieve metrics');
  }
};

/**
 * Record a custom metric
 * POST /api/monitoring/metrics
 */
export const recordMetric = async (req: Request, res: Response): Promise<void> => {
  try {
    const { metric, value, labels } = req.body;
    
    if (!metric || typeof metric !== 'string') {
      errorResponse(res, 400, 'Metric name is required');
      return;
    }
    
    if (typeof value !== 'number') {
      errorResponse(res, 400, 'Metric value must be a number');
      return;
    }
    
    monitoringService.recordMetric(metric, value, labels);
    
    loggerWithContext.info('Custom metric recorded', {
      metric,
      value,
      labels,
      correlationId: req.correlationId
    });
    
    successResponse(res, { metric, value, labels }, 'Metric recorded successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to record metric', error as Error);
    errorResponse(res, 500, 'Failed to record metric');
  }
};

/**
 * Get alert rules
 * GET /api/monitoring/alerts/rules
 */
export const getAlertRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = monitoringService.getAlertRules();
    
    successResponse(res, rules, 'Alert rules retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve alert rules', error as Error);
    errorResponse(res, 500, 'Failed to retrieve alert rules');
  }
};

/**
 * Create or update alert rule
 * POST /api/monitoring/alerts/rules
 */
export const createAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = req.body;
    
    monitoringService.addAlertRule(rule);
    
    loggerWithContext.audit('alert_rule_created', req.user?.id, {
      ruleId: rule.id,
      ruleName: rule.name,
      correlationId: req.correlationId
    });
    
    successResponse(res, rule, 'Alert rule created successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to create alert rule', error as Error);
    errorResponse(res, 500, 'Failed to create alert rule');
  }
};

/**
 * Delete alert rule
 * DELETE /api/monitoring/alerts/rules/:ruleId
 */
export const deleteAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params;
    
    if (!ruleId) {
      errorResponse(res, 400, 'Rule ID is required');
      return;
    }
    
    monitoringService.removeAlertRule(ruleId);
    
    loggerWithContext.audit('alert_rule_deleted', req.user?.id, {
      ruleId,
      correlationId: req.correlationId
    });
    
    successResponse(res, null, 'Alert rule deleted successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to delete alert rule', error as Error);
    errorResponse(res, 500, 'Failed to delete alert rule');
  }
};

/**
 * Get active alerts
 * GET /api/monitoring/alerts/active
 */
export const getActiveAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const alerts = monitoringService.getActiveAlerts();
    
    successResponse(res, alerts, 'Active alerts retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve active alerts', error as Error);
    errorResponse(res, 500, 'Failed to retrieve active alerts');
  }
};

/**
 * Get alert history
 * GET /api/monitoring/alerts/history
 */
export const getAlertHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 100;
    
    const history = monitoringService.getAlertHistory(limitNum);
    
    successResponse(res, history, 'Alert history retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve alert history', error as Error);
    errorResponse(res, 500, 'Failed to retrieve alert history');
  }
};

/**
 * Get monitoring dashboard data
 * GET /api/monitoring/dashboard
 */
export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeRange } = req.query;
    const hours = timeRange ? parseInt(timeRange as string) : 24;
    
    const end = new Date();
    const start = new Date(end.getTime() - hours * TIME_UNITS.HOUR);
    
    // Get key metrics
    const metrics = {
      memory: monitoringService.getMetricStats('memory_usage_percent', start, end),
      cpu: monitoringService.getMetricStats('cpu_usage_percent', start, end),
      responseTime: monitoringService.getMetricStats('avg_response_time_ms', start, end),
      errorRate: monitoringService.getMetricStats('error_rate_percent', start, end),
      uptime: monitoringService.getMetricStats('uptime_seconds', start, end)
    };
    
    // Get alerts
    const activeAlerts = monitoringService.getActiveAlerts();
    const alertHistory = monitoringService.getAlertHistory(50);
    
    // Get recent metric data for charts
    const chartData = {
      memory: monitoringService.getMetrics('memory_usage_percent', start, end),
      cpu: monitoringService.getMetrics('cpu_usage_percent', start, end),
      responseTime: monitoringService.getMetrics('avg_response_time_ms', start, end),
      errorRate: monitoringService.getMetrics('error_rate_percent', start, end)
    };
    
    const dashboardData = {
      timeRange: { start, end, hours },
      metrics,
      alerts: {
        active: activeAlerts,
        history: alertHistory,
        summary: {
          total: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          high: activeAlerts.filter(a => a.severity === 'high').length,
          medium: activeAlerts.filter(a => a.severity === 'medium').length,
          low: activeAlerts.filter(a => a.severity === 'low').length
        }
      },
      charts: chartData
    };
    
    successResponse(res, dashboardData, 'Dashboard data retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve dashboard data', error as Error);
    errorResponse(res, 500, 'Failed to retrieve dashboard data');
  }
};