import { ILogger } from '../types/dependencies';
import { logger as winstonLogger } from './logger';

/**
 * Logger wrapper for dependency injection
 */
export class LoggerWrapper implements ILogger {
  private logger: any;

  constructor(loggerInstance?: any) {
    this.logger = loggerInstance || winstonLogger;
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}