import { ISystemHealthMetrics, IAdminDashboardStats } from '../types/database';
import { ISystemRepository, ILogger } from '../types/dependencies';
import * as os from 'os';

// Import constants
import { MONITORING_CONFIG, PERFORMANCE_CONFIG, PLACEHOLDER_VALUES } from '../constants/monitoring';

// Type definitions for better type safety
interface ISystemMetricsResult {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  api_response_time: number;
  error_rate: number;
  uptime: number;
}

// Custom error classes for better error handling
class SystemHealthError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = 'SystemHealthError';
  }
}

class MetricsError extends Error {
  constructor(message: string, public readonly metricType: string) {
    super(message);
    this.name = 'MetricsError';
  }
}

export class AdminSystemService {
  private systemRepository: ISystemRepository;
  private logger: ILogger;

  constructor(systemRepository: ISystemRepository, logger: ILogger) {
    this.systemRepository = systemRepository;
    this.logger = logger;
  }
  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<ISystemHealthMetrics[]> {
    try {
      const healthChecks = await this.systemRepository.getSystemHealth();

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
      this.logger.error('Failed to get system health', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'getSystemHealth'
      });
      throw new SystemHealthError('Failed to retrieve system health', 'getSystemHealth');
    }
  }

  /**
   * Record system health check
   */
  async recordHealthCheck(
    serviceName: string,
    status: 'healthy' | 'degraded' | 'down',
    metrics: Record<string, any> = {},
    message?: string
  ): Promise<void> {
    try {
      await this.systemRepository.recordHealthCheck(serviceName, status, metrics, message);

      this.logger.debug('Health check recorded', {
        serviceName,
        status,
        metrics
      });
    } catch (error) {
      this.logger.error('Failed to record health check', {
        error: error instanceof Error ? error.message : String(error),
        serviceName,
        status
      });
    }
  }

  /**
   * Get system metrics for dashboard
   */
  async getSystemMetrics(hours: number = 24): Promise<ISystemMetricsResult> {
    // Input validation
    if (hours < 0 || hours > 8760) { // Max 1 year
      throw new MetricsError('Invalid hours parameter. Must be between 0 and 8760', 'validation');
    }

    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Get latest metrics
      const {
        cpuMetric,
        memoryMetric,
        diskMetric,
        responseTimeMetric,
        errorRateMetric
      } = await this.systemRepository.getSystemMetrics(startTime);

      // Calculate uptime from process start time
      const uptime = process.uptime();

      return {
        cpu_usage: cpuMetric?.usage || this.getCurrentCPUUsage(),
        memory_usage: memoryMetric?.percentage || this.getCurrentMemoryUsage(),
        disk_usage: diskMetric?.percentage || await this.getCurrentDiskUsage(),
        api_response_time: responseTimeMetric?.average || 0,
        error_rate: errorRateMetric?.rate || 0,
        uptime: uptime
      };
    } catch (error) {
      this.logger.error('Failed to get system metrics', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'getSystemMetrics',
        hours
      });
      throw new MetricsError('Failed to retrieve system metrics', 'system_metrics');
    }
  }

  /**
   * Record system metric
   */
  async recordMetric(
    metricName: string,
    metricType: 'gauge' | 'counter' | 'histogram',
    value: number,
    labels: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.systemRepository.recordMetric(metricName, metricType, value, labels);
    } catch (error) {
      this.logger.error('Failed to record metric', {
        error: error instanceof Error ? error.message : String(error),
        metricName,
        value
      });
    }
  }

  /**
   * Get start of today (00:00:00)
   */
  private getStartOfToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Get date N days ago from start of today
   */
  private getDaysAgo(days: number): Date {
    const today = this.getStartOfToday();
    return new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  }

  /**
   * Round number to specified precision
   * @param value - Number to round
   * @param digits - Number of decimal places (default: 2)
   * @returns Rounded number
   */
  private roundToPrecision(value: number, digits: number = PERFORMANCE_CONFIG.PRECISION_DIGITS): number {
    const multiplier = Math.pow(10, digits);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Get user statistics for admin dashboard
   */
  private async getUserStatistics(): Promise<IAdminDashboardStats['users']> {
    try {
      const now = new Date();
      const today = this.getStartOfToday();
      const weekAgo = this.getDaysAgo(7);

      const {
        totalUsers,
        activeUsers,
        newToday,
        newThisWeek,
        proUsers
      } = await this.systemRepository.getUserStatistics(today, weekAgo, now);

      const conversionRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

      return {
        total: totalUsers,
        active: activeUsers,
        new_today: newToday,
        new_this_week: newThisWeek,
        pro_subscribers: proUsers,
        conversion_rate: this.roundToPrecision(conversionRate)
      };
    } catch (error) {
      this.logger.error('Failed to get user statistics', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve user statistics');
    }
  }

  /**
   * Get alert statistics for admin dashboard
   */
  private async getAlertStatistics(): Promise<IAdminDashboardStats['alerts']> {
    try {
      const today = this.getStartOfToday();

      const {
        totalAlerts,
        alertsToday,
        pendingAlerts,
        failedAlerts,
        avgDeliveryTime
      } = await this.systemRepository.getAlertStatistics(today);

      const successRate = totalAlerts > 0 ? ((totalAlerts - failedAlerts) / totalAlerts) * 100 : 100;

      return {
        total_sent: totalAlerts,
        sent_today: alertsToday,
        pending: pendingAlerts,
        failed: failedAlerts,
        success_rate: this.roundToPrecision(successRate),
        avg_delivery_time: this.roundToPrecision(avgDeliveryTime)
      };
    } catch (error) {
      this.logger.error('Failed to get alert statistics', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve alert statistics');
    }
  }

  /**
   * Get ML model statistics for admin dashboard
   */
  private async getMLModelStatistics(): Promise<IAdminDashboardStats['ml_models']> {
    try {
      const {
        activeModels,
        trainingModels,
        lastTraining
      } = await this.systemRepository.getMLModelStatistics();

      return {
        active_models: activeModels,
        training_models: trainingModels,
        last_training: lastTraining,
        prediction_accuracy: 85.5 // This would come from actual model metrics
      };
    } catch (error) {
      this.logger.error('Failed to get ML model statistics', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve ML model statistics');
    }
  }

  /**
   * Get comprehensive admin dashboard statistics
   */
  async getDashboardStats(): Promise<IAdminDashboardStats> {
    try {
      const [
        userStats,
        alertStats,
        mlModelStats,
        systemMetrics
      ] = await Promise.all([
        this.getUserStatistics(),
        this.getAlertStatistics(),
        this.getMLModelStatistics(),
        this.getSystemMetrics(1) // Last hour
      ]);

      return {
        users: userStats,
        alerts: alertStats,
        ml_models: mlModelStats,
        system: {
          uptime: systemMetrics.uptime,
          cpu_usage: systemMetrics.cpu_usage,
          memory_usage: systemMetrics.memory_usage,
          disk_usage: systemMetrics.disk_usage,
          api_response_time: systemMetrics.api_response_time,
          error_rate: systemMetrics.error_rate
        }
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard stats', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('Failed to retrieve dashboard statistics');
    }
  }

  /**
   * Get current CPU usage percentage
   */
  private getCurrentCPUUsage(): number {
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

    return this.roundToPrecision(usage);
  }

  /**
   * Get current memory usage percentage
   */
  private getCurrentMemoryUsage(): number {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usage = (usedMem / totalMem) * 100;

    return this.roundToPrecision(usage);
  }

  /**
   * Get current disk usage percentage (simplified)
   */
  private async getCurrentDiskUsage(): Promise<number> {
    try {
      // This is a simplified implementation
      // In production, you'd want to use a proper disk usage library
      return PLACEHOLDER_VALUES.DISK_USAGE_PERCENTAGE;
    } catch (error) {
      this.logger.error('Failed to get disk usage', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Start system monitoring (call this on server startup)
   */
  startSystemMonitoring(): void {
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
        this.logger.error('Failed to record system metrics', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, MONITORING_CONFIG.HEALTH_CHECK_INTERVAL);

    this.logger.info('System monitoring started');
  }
}

// Export factory function for creating AdminSystemService instances
import { DependencyContainer } from '../container/DependencyContainer';

export const createAdminSystemService = (dependencies?: Partial<{ systemRepository: ISystemRepository; logger: ILogger }>) => {
  const container = DependencyContainer.getInstance();
  return new AdminSystemService(
    dependencies?.systemRepository || container.getSystemRepository(),
    dependencies?.logger || container.getLogger()
  );
};

// Export singleton instance for backward compatibility
export const adminSystemService = createAdminSystemService();