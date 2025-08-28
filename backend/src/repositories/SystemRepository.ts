import { BaseModel } from '../models/BaseModel';
import { 
  ISystemRepository, 
  ISystemMetrics, 
  IUserStatistics, 
  IAlertStatistics, 
  IMLModelStatistics,
  ICPUMetric,
  IMemoryMetric,
  IDiskMetric,
  IResponseTimeMetric,
  IErrorRateMetric
} from '../types/dependencies';

export class SystemRepository implements ISystemRepository {
  /**
   * Record system health check
   */
  async recordHealthCheck(
    serviceName: string,
    status: string,
    metrics: Record<string, any> = {},
    message?: string
  ): Promise<void> {
    const knex = BaseModel.getKnex();
    await knex('system_health').insert({
      service_name: serviceName,
      status,
      metrics,
      message,
      checked_at: new Date()
    });
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<any[]> {
    const knex = BaseModel.getKnex();
    
    return knex('system_health')
      .select('*')
      .whereIn('id', function(this: any) {
        this.select(knex.raw('MAX(id)'))
          .from('system_health')
          .groupBy('service_name');
      })
      .orderBy('service_name');
  }

  /**
   * Record system metric
   */
  async recordMetric(
    metricName: string,
    metricType: string,
    value: number,
    labels: Record<string, any> = {}
  ): Promise<void> {
    const knex = BaseModel.getKnex();
    await knex('system_metrics').insert({
      metric_name: metricName,
      metric_type: metricType,
      value,
      labels,
      recorded_at: new Date()
    });
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(startTime: Date): Promise<ISystemMetrics> {
    const knex = BaseModel.getKnex();

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

    return {
      cpuMetric: this.mapToCPUMetric(cpuMetric),
      memoryMetric: this.mapToMemoryMetric(memoryMetric),
      diskMetric: this.mapToDiskMetric(diskMetric),
      responseTimeMetric: this.mapToResponseTimeMetric(responseTimeMetric),
      errorRateMetric: this.mapToErrorRateMetric(errorRateMetric)
    };
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(today: Date, weekAgo: Date, now: Date): Promise<IUserStatistics> {
    const knex = BaseModel.getKnex();

    const [
      totalUsersResult,
      activeUsersResult,
      newTodayResult,
      newWeekResult,
      proUsersResult
    ] = await Promise.all([
      knex('users').count('* as count').first(),
      knex('users')
        .where('locked_until', null)
        .orWhere('locked_until', '<', now)
        .count('* as count')
        .first(),
      knex('users')
        .where('created_at', '>=', today)
        .count('* as count')
        .first(),
      knex('users')
        .where('created_at', '>=', weekAgo)
        .count('* as count')
        .first(),
      knex('users')
        .where('subscription_tier', 'pro')
        .count('* as count')
        .first()
    ]);

    return {
      totalUsers: parseInt(totalUsersResult?.count as string) || 0,
      activeUsers: parseInt(activeUsersResult?.count as string) || 0,
      newToday: parseInt(newTodayResult?.count as string) || 0,
      newThisWeek: parseInt(newWeekResult?.count as string) || 0,
      proUsers: parseInt(proUsersResult?.count as string) || 0
    };
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(today: Date): Promise<IAlertStatistics> {
    const knex = BaseModel.getKnex();

    const [
      totalAlertsResult,
      alertsTodayResult,
      pendingAlertsResult,
      failedAlertsResult,
      avgDeliveryResult
    ] = await Promise.all([
      knex('alerts').count('* as count').first(),
      knex('alerts')
        .where('created_at', '>=', today)
        .count('* as count')
        .first(),
      knex('alerts')
        .where('status', 'pending')
        .count('* as count')
        .first(),
      knex('alerts')
        .where('status', 'failed')
        .count('* as count')
        .first(),
      knex('alerts')
        .whereNotNull('sent_at')
        .select(knex.raw('AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_seconds'))
        .first()
    ]);

    return {
      totalAlerts: parseInt(totalAlertsResult?.count as string) || 0,
      alertsToday: parseInt(alertsTodayResult?.count as string) || 0,
      pendingAlerts: parseInt(pendingAlertsResult?.count as string) || 0,
      failedAlerts: parseInt(failedAlertsResult?.count as string) || 0,
      avgDeliveryTime: parseFloat((avgDeliveryResult as any)?.avg_seconds) || 0
    };
  }

  /**
   * Get ML model statistics
   */
  async getMLModelStatistics(): Promise<IMLModelStatistics> {
    const knex = BaseModel.getKnex();

    const [
      activeModelsResult,
      trainingModelsResult,
      lastTrainingResult
    ] = await Promise.all([
      knex('ml_models')
        .where('status', 'active')
        .count('* as count')
        .first(),
      knex('ml_models')
        .where('status', 'training')
        .count('* as count')
        .first(),
      knex('ml_models')
        .max('training_started_at as last_training')
        .first()
    ]);

    return {
      activeModels: parseInt(activeModelsResult?.count as string) || 0,
      trainingModels: parseInt(trainingModelsResult?.count as string) || 0,
      lastTraining: lastTrainingResult?.last_training || null
    };
  }

  /**
   * Helper methods to map database results to typed interfaces
   */
  private mapToCPUMetric(data: any): ICPUMetric {
    return {
      usage: parseFloat(data?.value) || 0,
      loadAverage: data?.labels?.loadAverage || [0, 0, 0],
      timestamp: data?.recorded_at || new Date()
    };
  }

  private mapToMemoryMetric(data: any): IMemoryMetric {
    return {
      used: parseFloat(data?.value) || 0,
      total: parseFloat(data?.labels?.total) || 0,
      percentage: parseFloat(data?.labels?.percentage) || 0,
      heapUsed: parseFloat(data?.labels?.heapUsed) || 0,
      heapTotal: parseFloat(data?.labels?.heapTotal) || 0
    };
  }

  private mapToDiskMetric(data: any): IDiskMetric {
    return {
      used: parseFloat(data?.labels?.used) || 0,
      total: parseFloat(data?.labels?.total) || 0,
      percentage: parseFloat(data?.value) || 0,
      available: parseFloat(data?.labels?.available) || 0
    };
  }

  private mapToResponseTimeMetric(data: any): IResponseTimeMetric {
    return {
      average: parseFloat(data?.avg_value) || 0,
      p95: parseFloat(data?.labels?.p95) || 0,
      p99: parseFloat(data?.labels?.p99) || 0,
      count: parseInt(data?.labels?.count) || 0
    };
  }

  private mapToErrorRateMetric(data: any): IErrorRateMetric {
    return {
      rate: parseFloat(data?.avg_value) || 0,
      count: parseInt(data?.labels?.errorCount) || 0,
      total: parseInt(data?.labels?.totalRequests) || 0
    };
  }
}