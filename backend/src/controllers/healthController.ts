import { Request, Response } from 'express';
import { healthCheckService } from '../services/healthCheckService';
import { loggerWithContext } from '../utils/logger';
import { successResponse, errorResponse } from '../utils/responseHelpers';

/**
 * Basic health check endpoint
 * GET /health
 */
export const basicHealthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    
    res.status(200).json({
      status: 'healthy',
      service: 'booster-beacon-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      correlationId: req.correlationId
    });
    
    const responseTime = Date.now() - startTime;
    healthCheckService.recordRequest(responseTime, false);
    
  } catch (error) {
    loggerWithContext.error('Basic health check failed', error as Error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'booster-beacon-api',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
};

/**
 * Comprehensive health check endpoint
 * GET /health/detailed
 */
export const detailedHealthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();
    loggerWithContext.info('Performing detailed health check', { correlationId: req.correlationId });
    
    const healthResult = await healthCheckService.performHealthCheck();
    
    // Set appropriate HTTP status based on health
    let statusCode = 200;
    if (healthResult.status === 'degraded') {
      statusCode = 200; // Still operational but with warnings
    } else if (healthResult.status === 'unhealthy') {
      statusCode = 503; // Service unavailable
    }
    
    res.status(statusCode).json({
      ...healthResult,
      correlationId: req.correlationId
    });
    
    const responseTime = Date.now() - startTime;
    healthCheckService.recordRequest(responseTime, statusCode >= 400);
    
    loggerWithContext.performance('detailed_health_check', responseTime, {
      status: healthResult.status,
      statusCode
    });
    
  } catch (error) {
    loggerWithContext.error('Detailed health check failed', error as Error);
    
    const responseTime = Date.now() - Date.now();
    healthCheckService.recordRequest(responseTime, true);
    
    res.status(503).json({
      status: 'unhealthy',
      service: 'booster-beacon-api',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      correlationId: req.correlationId
    });
  }
};

/**
 * Readiness probe endpoint (for Kubernetes/Docker)
 * GET /health/ready
 */
export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const healthResult = await healthCheckService.performHealthCheck();
    
    // Ready if database and critical services are available
    const isReady = healthResult.checks.database.status !== 'fail';
    
    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'Critical services unavailable',
        correlationId: req.correlationId
      });
    }
    
  } catch (error) {
    loggerWithContext.error('Readiness check failed', error as Error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      correlationId: req.correlationId
    });
  }
};

/**
 * Liveness probe endpoint (for Kubernetes/Docker)
 * GET /health/live
 */
export const livenessCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    // Simple check to ensure the process is alive and responsive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      correlationId: req.correlationId
    });
    
  } catch (error) {
    loggerWithContext.error('Liveness check failed', error as Error);
    res.status(503).json({
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: 'Liveness check failed',
      correlationId: req.correlationId
    });
  }
};

/**
 * System metrics endpoint
 * GET /health/metrics
 */
export const systemMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    loggerWithContext.info('Retrieving system metrics', { correlationId: req.correlationId });
    
    const healthResult = await healthCheckService.performHealthCheck();
    
    successResponse(res, {
      metrics: healthResult.metrics,
      timestamp: healthResult.timestamp,
      uptime: healthResult.uptime,
      version: healthResult.version,
      environment: healthResult.environment
    }, 'System metrics retrieved successfully');
    
  } catch (error) {
    loggerWithContext.error('Failed to retrieve system metrics', error as Error);
    errorResponse(res, 500, 'Failed to retrieve system metrics');
  }
};