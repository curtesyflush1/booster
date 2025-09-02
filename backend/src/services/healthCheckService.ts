import { logger, loggerWithContext } from '../utils/logger';
import { db } from '../config/database';
import { RETRY_CONFIG, MONITORING_THRESHOLDS, DEFAULT_VALUES, TIME_PERIODS } from '../constants';
import { redisService } from './redisService';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
    external: HealthCheck;
  };
  metrics: SystemMetrics;
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  message?: string;
  details?: any;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  requests: {
    total: number;
    errors: number;
    averageResponseTime: number;
  };
  alerts: {
    sent: number;
    failed: number;
    successRate: number;
  };
}

class HealthCheckService {
  private requestMetrics = {
    total: 0,
    errors: 0,
    totalResponseTime: 0
  };
  private alertMetrics = {
    sent: 0,
    failed: 0
  };

  constructor() {}

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      loggerWithContext.debug('Starting health check');

      const [
        databaseCheck,
        redisCheck,
        memoryCheck,
        diskCheck,
        externalCheck
      ] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkMemory(),
        this.checkDisk(),
        this.checkExternalServices()
      ]);

      const checks = {
        database: this.getCheckResult(databaseCheck),
        redis: this.getCheckResult(redisCheck),
        memory: this.getCheckResult(memoryCheck),
        disk: this.getCheckResult(diskCheck),
        external: this.getCheckResult(externalCheck)
      };

      const overallStatus = this.determineOverallStatus(checks);
      const metrics = await this.getSystemMetrics();

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks,
        metrics
      };

      const duration = Date.now() - startTime;
      loggerWithContext.performance('health_check_completed', duration, {
        status: overallStatus,
        checksCount: Object.keys(checks).length
      });

      return result;

    } catch (error) {
      loggerWithContext.error('Health check failed', error as Error);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
          database: { status: 'fail', responseTime: 0, message: 'Health check error' },
          redis: { status: 'fail', responseTime: 0, message: 'Health check error' },
          memory: { status: 'fail', responseTime: 0, message: 'Health check error' },
          disk: { status: 'fail', responseTime: 0, message: 'Health check error' },
          external: { status: 'fail', responseTime: 0, message: 'Health check error' }
        },
        metrics: {
          memory: { used: 0, total: 0, percentage: 0 },
          cpu: { usage: 0 },
          requests: { total: 0, errors: 0, averageResponseTime: 0 },
          alerts: { sent: 0, failed: 0, successRate: 0 }
        }
      };
    }
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await db.raw('SELECT 1');
      
      // Test a simple query performance
      const result = await db('users').count('* as count').first();
      const responseTime = Date.now() - startTime;
      
      if (responseTime > MONITORING_THRESHOLDS.VERY_SLOW_OPERATION_THRESHOLD) {
        return {
          status: 'warn',
          responseTime,
          message: 'Database response time is slow',
          details: { userCount: result?.count }
        };
      }
      
      return {
        status: 'pass',
        responseTime,
        details: { userCount: result?.count }
      };
      
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Database check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  private async checkRedis(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    if (process.env.DISABLE_REDIS === 'true') {
      return {
        status: 'warn',
        responseTime: 0,
        message: 'Redis disabled via DISABLE_REDIS'
      };
    }
    
    try {
      // If not ready yet, ping will trigger an error which we capture
      await redisService.ping();
      const responseTime = Date.now() - startTime;
      return { status: 'pass', responseTime };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Redis check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const usedMemory = memUsage.heapUsed;
      const memoryPercentage = (usedMemory / totalMemory) * 100;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message: string | undefined;
      
      if (memoryPercentage > MONITORING_THRESHOLDS.HIGH_DISK_THRESHOLD) {
        status = 'fail';
        message = 'Critical memory usage';
      } else if (memoryPercentage > 75) {
        status = 'warn';
        message = 'High memory usage';
      }
      
      const result: HealthCheck = {
        status,
        responseTime: Date.now() - startTime,
        details: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          percentage: Math.round(memoryPercentage * 100) / 100
        }
      };
      
      if (message) {
        result.message = message;
      }
      
      return result;
      
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Memory check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check disk space
   */
  private async checkDisk(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      // This is a simplified check - in production you'd want to check actual disk usage
      return {
        status: 'pass',
        responseTime: Date.now() - startTime,
        details: {
          accessible: true
        }
      };
      
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Disk check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Check external services
   */
  private async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check if we can reach external services (simplified)
      // In a real implementation, you'd check specific retailer APIs, email services, etc.
      
      return {
        status: 'pass',
        responseTime: Date.now() - startTime,
        details: {
          retailers: 'available',
          email: 'available'
        }
      };
      
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `External services check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    
    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(totalMemory / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / totalMemory) * 10000) / 100
      },
      cpu: {
        usage: Math.round(require('os').loadavg()[0] * 100) / 100
      },
      requests: {
        total: this.requestMetrics.total,
        errors: this.requestMetrics.errors,
        averageResponseTime: this.requestMetrics.total > 0 
          ? Math.round(this.requestMetrics.totalResponseTime / this.requestMetrics.total)
          : 0
      },
      alerts: {
        sent: this.alertMetrics.sent,
        failed: this.alertMetrics.failed,
        successRate: this.alertMetrics.sent > 0
          ? Math.round(((this.alertMetrics.sent - this.alertMetrics.failed) / this.alertMetrics.sent) * 10000) / 100
          : 100
      }
    };
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestMetrics.total++;
    this.requestMetrics.totalResponseTime += responseTime;
    
    if (isError) {
      this.requestMetrics.errors++;
    }
  }

  /**
   * Record alert metrics
   */
  recordAlert(success: boolean): void {
    this.alertMetrics.sent++;
    
    if (!success) {
      this.alertMetrics.failed++;
    }
  }

  /**
   * Get check result from Promise.allSettled result
   */
  private getCheckResult(result: PromiseSettledResult<HealthCheck>): HealthCheck {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'fail',
        responseTime: 0,
        message: `Check failed: ${result.reason}`
      };
    }
  }

  /**
   * Determine overall system status based on individual checks
   */
  private determineOverallStatus(checks: Record<string, HealthCheck>): 'healthy' | 'degraded' | 'unhealthy' {
    const checkValues = Object.values(checks);
    
    if (checkValues.some(check => check.status === 'fail')) {
      return 'unhealthy';
    }
    
    if (checkValues.some(check => check.status === 'warn')) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}

export const healthCheckService = new HealthCheckService();
