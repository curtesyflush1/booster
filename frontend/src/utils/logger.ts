/**
 * Frontend logging utility
 * Provides consistent logging interface for client-side code
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * Log debug information (development only)
   */
  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data);
    }
  }

  /**
   * Log general information
   */
  info(message: string, data?: any): void {
    console.info(`[INFO] ${message}`, data);
    this.sendToService('info', message, data);
  }

  /**
   * Log warnings
   */
  warn(message: string, data?: any): void {
    console.warn(`[WARN] ${message}`, data);
    this.sendToService('warn', message, data);
  }

  /**
   * Log errors
   */
  error(message: string, data?: any): void {
    console.error(`[ERROR] ${message}`, data);
    this.sendToService('error', message, data);
  }

  /**
   * Send logs to backend service (in production)
   */
  private sendToService(level: LogLevel, message: string, data?: any): void {
    if (this.isDevelopment) return;

    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    // Send to backend logging service
    fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logEntry)
    }).catch(() => {
      // Silently fail - don't log errors about logging
    });
  }
}

export const logger = new Logger();