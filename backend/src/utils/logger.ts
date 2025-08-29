import * as winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

// Type definitions for better type safety
interface LogMeta {
  [key: string]: any;
  userId?: string;
  duration?: number;
  operation?: string;
  auditAction?: string;
  securityEvent?: string;
  logType?: 'info' | 'error' | 'warning' | 'debug' | 'audit' | 'performance' | 'security';
}

// LogEntry interface removed as it was unused

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Correlation ID storage for request tracking using AsyncLocalStorage
export class CorrelationIdManager {
  private static storage = new AsyncLocalStorage<string>();

  static generateId(): string {
    return uuidv4();
  }

  static setId(id: string): void {
    this.storage.enterWith(id);
  }

  static getId(): string | undefined {
    return this.storage.getStore();
  }

  static run<T>(id: string, callback: () => T): T {
    return this.storage.run(id, callback);
  }

  // Deprecated - kept for backward compatibility
  static clearId(): void {
    // AsyncLocalStorage automatically cleans up when context ends
    // This method is now a no-op but kept for API compatibility
  }
}

// Enhanced log format with correlation IDs and structured data
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const correlationId = CorrelationIdManager.getId();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      correlationId: correlationId || 'no-correlation-id',
      service: 'booster-beacon-api',
      environment: nodeEnv,
      ...meta
    };

    try {
      return JSON.stringify(logEntry);
    } catch (error) {
      // Fallback for circular references or other JSON.stringify issues
      return JSON.stringify({
        ...logEntry,
        meta: '[Circular or Non-Serializable Object]',
        serializationError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

// Create logger instance with enhanced configuration
export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: {
    service: 'booster-beacon-api',
    environment: nodeEnv,
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: nodeEnv === 'development'
        ? winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
            const id = correlationId ? `[${String(correlationId).slice(0, 8)}]` : '';
            return `${timestamp} ${level} ${id} ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
        : logFormat
    }),

    // File transports for production
    ...(nodeEnv === 'production' ? [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
      }),
      new winston.transports.File({
        filename: 'logs/audit.log',
        level: 'info',
        maxsize: 10485760, // 10MB
        maxFiles: 20,
        tailable: true,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ] : [])
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.Console(),
    ...(nodeEnv === 'production' ? [
      new winston.transports.File({
        filename: 'logs/exceptions.log',
        maxsize: 10485760,
        maxFiles: 5
      })
    ] : [])
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.Console(),
    ...(nodeEnv === 'production' ? [
      new winston.transports.File({
        filename: 'logs/rejections.log',
        maxsize: 10485760,
        maxFiles: 5
      })
    ] : [])
  ]
});

// Enhanced logging methods with structured data and better type safety
export const loggerWithContext = {
  info: (message: string, meta?: LogMeta) => {
    try {
      logger.info(message, { ...meta, logType: 'info' });
    } catch (error) {
      // Fallback logging if structured logging fails
      console.log(`[INFO] ${message}`, error);
    }
  },

  error: (message: string, error?: Error | unknown, meta?: LogMeta) => {
    try {
      const errorInfo = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: (error as any).cause
      } : error ? { error: String(error) } : undefined;

      logger.error(message, {
        ...meta,
        error: errorInfo,
        logType: 'error'
      });
    } catch (logError) {
      // Fallback logging if structured logging fails
      console.error(`[ERROR] ${message}`, error, logError);
    }
  },

  warn: (message: string, meta?: LogMeta) => {
    try {
      logger.warn(message, { ...meta, logType: 'warning' });
    } catch (error) {
      console.warn(`[WARN] ${message}`, error);
    }
  },

  debug: (message: string, meta?: LogMeta) => {
    try {
      logger.debug(message, { ...meta, logType: 'debug' });
    } catch (error) {
      console.debug(`[DEBUG] ${message}`, error);
    }
  },

  audit: (action: string, userId?: string, meta?: LogMeta) => {
    try {
      logger.info(`AUDIT: ${action}`, {
        ...meta,
        userId,
        logType: 'audit',
        auditAction: action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.log(`[AUDIT] ${action}`, { userId, error });
    }
  },

  performance: (operation: string, duration: number, meta?: LogMeta) => {
    try {
      const performanceLevel = duration > 1000 ? 'warn' : 'info';
      logger[performanceLevel](`PERFORMANCE: ${operation}`, {
        ...meta,
        duration,
        logType: 'performance',
        operation,
        performanceThreshold: duration > 1000 ? 'slow' : 'normal'
      });
    } catch (error) {
      console.log(`[PERFORMANCE] ${operation}`, { duration, error });
    }
  },

  security: (event: string, meta?: LogMeta) => {
    try {
      logger.warn(`SECURITY: ${event}`, {
        ...meta,
        logType: 'security',
        securityEvent: event,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn(`[SECURITY] ${event}`, error);
    }
  },

  // New method for timing operations
  time: (operation: string): (() => void) => {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      loggerWithContext.performance(operation, duration);
    };
  }
};

// Create logs directory if it doesn't exist with better error handling
const initializeLogsDirectory = (): void => {
  if (nodeEnv === 'production') {
    try {
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join(process.cwd(), 'logs');

      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
        console.log(`Created logs directory: ${logsDir}`);
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
      // Don't throw - allow application to continue with console logging
    }
  }
};

// Initialize logs directory
initializeLogsDirectory();

// Export utility functions for middleware integration
export const createRequestLogger = () => {
  return (req: any, _res: any, next: any) => {
    const correlationId = CorrelationIdManager.generateId();
    req.startTime = Date.now(); // Add start time for duration calculation
    
    CorrelationIdManager.run(correlationId, () => {
      loggerWithContext.info('Request started', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        correlationId
      });
      next();
    });
  };
};

// Utility function to create contextual errors with enhanced debugging info
export const createContextualError = (
  message: string,
  options: {
    statusCode?: number;
    code?: string;
    operation?: string;
    context?: Record<string, any>;
    userId?: string;
    cause?: Error;
    isOperational?: boolean;
  } = {}
): AppError => {
  const error = new Error(message) as AppError;
  
  error.statusCode = options.statusCode || 500;
  error.code = options.code || 'INTERNAL_ERROR';
  error.operation = options.operation;
  error.context = options.context;
  error.userId = options.userId;
  error.isOperational = options.isOperational ?? true;
  
  if (options.cause) {
    (error as any).cause = options.cause;
  }
  
  // Capture stack trace excluding this function
  Error.captureStackTrace(error, createContextualError);
  
  return error;
};

// Enhanced error logging function with automatic context extraction
export const logError = (
  error: Error | AppError,
  operation?: string,
  additionalContext?: Record<string, any>
): void => {
  const correlationId = CorrelationIdManager.getId();
  const appError = error as AppError;
  
  loggerWithContext.error(`Error in ${operation || appError.operation || 'unknown operation'}`, error, {
    operation: operation || appError.operation,
    userId: appError.userId,
    context: appError.context,
    correlationId,
    ...additionalContext
  });
};

// Interface for AppError (moved here to avoid circular imports)
interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  context?: Record<string, any>;
  userId?: string;
  operation?: string;
}