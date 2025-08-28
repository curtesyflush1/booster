import { BaseModel } from '../models/BaseModel';
import { ISystemHealth, ISystemMetric, ISystemHealthMetrics, IAdminDashboardStats } from '../types/database';
import { logger } from '../utils/logger';
import os from 'os';

export class AdminSystemService {
  /**
   * Get current system health status
   */
  static async getSystemHealth(): Promise<ISystemHealthMetrics[]> {
    try {
      const knex = BaseModel.getKnex();
      
      // Get latest health check for each service
      const healthChecks = await knex('system_health')
        .select('*')
        .whereIn('id', function(this: any) {
          this.select(knex.raw('MAX(id)'))
            .from('system_health')
            .groupBy('service_name');
        })
        .orderBy('service_name');

      return healthChecks.map((check: any) => ({
        service_name: check.service_name,
        status: check.status,
        response_time: check.metrics?.response_time,
        error_rate: check.metrics?.error_rate,
        uptime_percentage: check.metrics?.uptime_percentage,
        last_check: check.checked_at,
        details: check.metrics
      })) as ISystemHealthMetrics[];
    } catch (error) {
      logger.error('Failed to get system health', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve system health');
    }
  }

  /**
   * Record system health check
   */
  static async recordHealthCheck(
    serviceName: string,
    status: 'healthy' | 'degraded' | 'down',
    metrics: Record<string, any> = {},
    message?: string
  ): Promise<void> {
    try {
      const knex = BaseModel.getKnex();
      await knex('system_health').insert({
        service_name: serviceName,
        status,
        metrics,
        message,
        checked_at: new Date()
      });

      logger.debug('Health check recorded', {
        serviceName,
        status,
        metrics
      });
    } catch (error) {
      logger.error('Failed to record health check', {
        error: error instanceof Error ? error.message : String(error),
        serviceName,
        status
      });
    }
  }

  /**
   * Get system metrics for dashboard
   */
  static async getSystemMetrics(hours: number = 24): Promise<{
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    api_response_time: number;
    error_rate: number;
    uptime: number;
  }> {
    try {
      const knex = BaseModel.getKnex();
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Get latest metrics
      const [
        cpuMetric,
        memoryMetric,
        diskMetric,
        responseTimeMetric,
        errorRateMetric
      ] = await Promise.all([
        knex('system_metrics')
          .where('metric_name', 'cpu_usage')
          .where('recorded_at', '>=', startTime)
          .orderBy('recorded_at', 'desc')
          .first(),
        knex('system_metrics')
          .where('metric_name', 'memory_usage')
          .where('recorded_at', '>=', startTime)
          .orderBy('recorded_at', 'desc')
          .first(),
        knex('system_metrics')
          .where('metric_name', 'disk_usage')
          .where('recorded_at', '>=', startTime)
          .orderBy('recorded_at', 'desc')
          .first(),
        knex('system_metrics')
          .where('metric_name', 'api_response_time')
          .where('recorded_at', '>=', startTime)
          .avg('value as avg_value')
          .first(),
        knex('system_metrics')
          .where('metric_name', 'error_rate')
          .where('recorded_at', '>=', startTime)
          .avg('value as avg_value')
          .first()
      ]);

      // Calculate uptime from process start time
      const uptime = process.uptime();

      return {
        cpu_usage: cpuMetric?.value || this.getCurrentCPUUsage(),
        memory_usage: memoryMetric?.value || this.getCurrentMemoryUsage(),
        disk_usage: diskMetric?.value || await this.getCurrentDiskUsage(),
        api_response_time: parseFloat(responseTimeMetric?.avg_value) || 0,
        error_rate: parseFloat(errorRateMetric?.avg_value) || 0,
        uptime: uptime
      };
    } catch (error) {
      logger.error('Failed to get system metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve system metrics');
    }
  }

  /**
   * Record system metric
   */
  static async recordMetric(
    metricName: string,
    metricType: 'gauge' | 'counter' | 'histogram',
    value: number,
    labels: Record<string, any> = {}
  ): Promise<void> {
    try {
      const knex = BaseModel.getKnex();
      await knex('system_metrics').insert({
        metric_name: metricName,
        metric_type: metricType,
        value,
        labels,
        recorded_at: new Date()
      });
    } catch (error) {
      logger.error('Failed to record metric', {
        error: error instanceof Error ? error.message : String(error),
        metricName,
        value
      });
    }
  }

  /**
   * Get comprehensive admin dashboard statistics
   */
  static async getDashboardStats(): Promise<IAdminDashboardStats> {
    try {
      const knex = BaseModel.getKnex();
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Get user statistics
      const [
        totalUsersResult,
        activeUsersResult,
        newTodayResult,
        newWeekResult,
        proUsersResult
      ] = await Promise.all([
        knex('users').count('* as count').first(),
        knex('users').where('locked_until', null).orWhere('locked_until', '<', now).count('* as count').first(),
        knex('users').where('created_at', '>=', today).count('* as count').first(),
        knex('users').where('created_at', '>=', new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)).count('* as count').first(),
        knex('users').where('subscription_tier', 'pro').count('* as count').first()
      ]);

      const totalUsers = parseInt(totalUsersResult?.count as string) || 0;
      const activeUsers = parseInt(activeUsersResult?.count as string) || 0;
      const newToday = parseInt(newTodayResult?.count as string) || 0;
      const newThisWeek = parseInt(newWeekResult?.count as string) || 0;
      const proUsers = parseInt(proUsersResult?.count as string) || 0;

      // Get alert statistics
      const [
        totalAlertsResult,
        alertsTodayResult,
        pendingAlertsResult,
        failedAlertsResult,
        avgDeliveryResult
      ] = await Promise.all([
        knex('alerts').count('* as count').first(),
        knex('alerts').where('created_at', '>=', today).count('* as count').first(),
        knex('alerts').where('status', 'pending').count('* as count').first(),
        knex('alerts').where('status', 'failed').count('* as count').first(),
        knex('alerts')
          .whereNotNull('sent_at')
          .select(knex.raw('AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_seconds'))
          .first()
      ]);

      const totalAlerts = parseInt(totalAlertsResult?.count as string) || 0;
      const alertsToday = parseInt(alertsTodayResult?.count as string) || 0;
      const pendingAlerts = parseInt(pendingAlertsResult?.count as string) || 0;
      const failedAlerts = parseInt(failedAlertsResult?.count as string) || 0;
      const avgDeliveryTime = parseFloat((avgDeliveryResult as any)?.avg_seconds) || 0;

      // Get ML model statistics
      const [
        activeModelsResult,
        trainingModelsResult,
        lastTrainingResult
      ] = await Promise.all([
        knex('ml_models').where('status', 'active').count('* as count').first(),
        knex('ml_models').where('status', 'training').count('* as count').first(),
        knex('ml_models').max('training_started_at as last_training').first()
      ]);

      const activeModels = parseInt(activeModelsResult?.count as string) || 0;
      const trainingModels = parseInt(trainingModelsResult?.count as string) || 0;

      // Get system metrics
      const systemMetrics = await this.getSystemMetrics(1); // Last hour

      const successRate = totalAlerts > 0 ? ((totalAlerts - failedAlerts) / totalAlerts) * 100 : 100;
      const conversionRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

      return {
        users: {
          total: totalUsers,
          active: activeUsers,
          new_today: newToday,
          new_this_week: newThisWeek,
          pro_subscribers: proUsers,
          conversion_rate: Math.round(conversionRate * 100) / 100
        },
        alerts: {
          total_sent: totalAlerts,
          sent_today: alertsToday,
          pending: pendingAlerts,
          failed: failedAlerts,
          success_rate: Math.round(successRate * 100) / 100,
          avg_delivery_time: Math.round(avgDeliveryTime * 100) / 100
        },
        system: {
          uptime: systemMetrics.uptime,
          cpu_usage: systemMetrics.cpu_usage,
          memory_usage: systemMetrics.memory_usage,
          disk_usage: systemMetrics.disk_usage,
          api_response_time: systemMetrics.api_response_time,
          error_rate: systemMetrics.error_rate
        },
        ml_models: {
          active_models: activeModels,
          training_models: trainingModels,
          last_training: lastTrainingResult?.last_training || null,
          prediction_accuracy: 85.5 // This would come from actual model metrics
        }
      };
    } catch (error) {
      logger.error('Failed to get dashboard stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve dashboard statistics');
    }
  }

  /**
   * Get current CPU usage percentage
   */
  private static getCurrentCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return Math.round(usage * 100) / 100;
  }

  /**
   * Get current memory usage percentage
   */
  private static getCurrentMemoryUsage(): number {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = (usedMem / totalMem) * 100;

    return Math.round(usage * 100) / 100;
  }

  /**
   * Get current disk usage percentage (simplified)
   */
  private static async getCurrentDiskUsage(): Promise<number> {
    try {
      // This is a simplified implementation
      // In production, you'd want to use a proper disk usage library
      return 45.2; // Placeholder value
    } catch (error) {
      logger.error('Failed to get disk usage', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Start system monitoring (call this on server startup)
   */
  static startSystemMonitoring(): void {
    // Record system metrics every minute
    setInterval(async () => {
      try {
        await Promise.all([
          this.recordMetric('cpu_usage', 'gauge', this.getCurrentCPUUsage()),
          this.recordMetric('memory_usage', 'gauge', this.getCurrentMemoryUsage()),
          this.recordMetric('disk_usage', 'gauge', await this.getCurrentDiskUsage()),
          this.recordMetric('uptime', 'gauge', process.uptime())
        ]);
      } catch (error) {
        logger.error('Failed to record system metrics', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 60000); // Every minute

    logger.info('System monitoring started');
  }
}