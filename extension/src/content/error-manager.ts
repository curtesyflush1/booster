// Centralized Error Management System

interface ErrorContext {
  component: string;
  method: string;
  retailer?: string;
  url?: string;
  userAgent?: string;
  timestamp: number;
}

interface ErrorReport {
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  showToUser: boolean;
}

class ErrorManager {
  private static instance: ErrorManager;
  private errorQueue: ErrorReport[] = [];
  private maxQueueSize = 50;
  private reportingEnabled = true;

  static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  private constructor() {
    // Set up periodic error reporting
    setInterval(() => this.flushErrorQueue(), 30000); // Every 30 seconds
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => this.flushErrorQueue());
  }

  handleError(
    error: Error,
    context: Partial<ErrorContext>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    showToUser = false
  ): void {
    const fullContext: ErrorContext = {
      component: context.component || 'Unknown',
      method: context.method || 'Unknown',
      retailer: context.retailer || getCurrentRetailer()?.id,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      ...context
    };

    const errorReport: ErrorReport = {
      error,
      context: fullContext,
      severity,
      showToUser
    };

    // Log error locally
    this.logError(errorReport);
    
    // Add to queue for reporting
    this.queueError(errorReport);
    
    // Show user notification if needed
    if (showToUser) {
      this.showErrorNotification(error.message, severity);
    }
  }

  private logError(report: ErrorReport): void {
    const logLevel = this.getLogLevel(report.severity);
    const logMessage = `[${report.context.component}.${report.context.method}] ${report.error.message}`;
    
    console[logLevel](logMessage, {
      error: report.error,
      context: report.context,
      stack: report.error.stack
    });
  }

  private getLogLevel(severity: string): 'info' | 'warn' | 'error' {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warn';
      case 'high':
      case 'critical': return 'error';
      default: return 'warn';
    }
  }

  private queueError(report: ErrorReport): void {
    if (!this.reportingEnabled) return;

    this.errorQueue.push(report);
    
    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest error
    }

    // Immediately report critical errors
    if (report.severity === 'critical') {
      this.flushErrorQueue();
    }
  }

  private async flushErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errorsToReport = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await sendExtensionMessage({
        type: 'ERROR_REPORT',
        payload: {
          errors: errorsToReport.map(report => ({
            message: report.error.message,
            stack: report.error.stack,
            context: report.context,
            severity: report.severity
          })),
          timestamp: Date.now()
        }
      });
    } catch (reportingError) {
      // If reporting fails, put errors back in queue (up to limit)
      this.errorQueue.unshift(...errorsToReport.slice(0, this.maxQueueSize - this.errorQueue.length));
      console.warn('Failed to report errors:', reportingError);
    }
  }

  private showErrorNotification(message: string, severity: string): void {
    const notification = document.createElement('div');
    notification.className = `bb-notification bb-notification-error bb-notification-${severity}`;
    
    // Customize message based on severity
    const userMessage = this.getUserFriendlyMessage(message, severity);
    notification.textContent = userMessage;
    
    document.body.appendChild(notification);
    
    // Auto-remove based on severity
    const timeout = severity === 'critical' ? 10000 : 5000;
    setTimeout(() => notification.remove(), timeout);
  }

  private getUserFriendlyMessage(message: string, severity: string): string {
    const friendlyMessages = {
      'Service not available': 'BoosterBeacon service is temporarily unavailable',
      'Failed to send message': 'Connection issue - please try again',
      'Cart manager not initialized': 'Add to cart feature is loading...',
      'Form autofill service not initialized': 'Auto-fill feature is loading...'
    };

    const friendlyMessage = friendlyMessages[message as keyof typeof friendlyMessages];
    if (friendlyMessage) return friendlyMessage;

    // Generic messages based on severity
    switch (severity) {
      case 'critical':
        return 'A critical error occurred. Please refresh the page.';
      case 'high':
        return 'An error occurred. Some features may not work properly.';
      case 'medium':
        return 'A minor issue occurred. Trying again may help.';
      case 'low':
      default:
        return message;
    }
  }

  // Utility methods for common error scenarios
  serviceNotAvailableError(serviceName: string, context: Partial<ErrorContext>): void {
    this.handleError(
      new Error(`${serviceName} not available`),
      { ...context, method: context.method || 'serviceCheck' },
      'medium',
      true
    );
  }

  networkError(operation: string, context: Partial<ErrorContext>): void {
    this.handleError(
      new Error(`Network error during ${operation}`),
      { ...context, method: context.method || 'networkOperation' },
      'high',
      true
    );
  }

  validationError(field: string, context: Partial<ErrorContext>): void {
    this.handleError(
      new Error(`Validation failed for ${field}`),
      { ...context, method: context.method || 'validation' },
      'low',
      false
    );
  }

  criticalError(message: string, context: Partial<ErrorContext>): void {
    this.handleError(
      new Error(message),
      { ...context, method: context.method || 'critical' },
      'critical',
      true
    );
  }
}

// Error handling decorators/utilities
function withErrorHandling<T extends (...args: any[]) => any>(
  target: any,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<T>
): TypedPropertyDescriptor<T> {
  const originalMethod = descriptor.value!;
  
  descriptor.value = function(this: any, ...args: any[]) {
    try {
      const result = originalMethod.apply(this, args);
      
      // Handle async methods
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          ErrorManager.getInstance().handleError(
            error,
            {
              component: this.constructor.name,
              method: propertyKey
            },
            'medium',
            false
          );
          throw error; // Re-throw to maintain original behavior
        });
      }
      
      return result;
    } catch (error) {
      ErrorManager.getInstance().handleError(
        error as Error,
        {
          component: this.constructor.name,
          method: propertyKey
        },
        'medium',
        false
      );
      throw error; // Re-throw to maintain original behavior
    }
  } as T;
  
  return descriptor;
}

// Usage examples:
class ExampleServiceWithErrorHandling {
  @withErrorHandling
  async executeAddToCart(payload: any): Promise<MessageResponse> {
    // Method implementation
    // Errors will be automatically caught and reported
    throw new Error('Test error');
  }

  async manualErrorHandling(): Promise<void> {
    try {
      // Some risky operation
      await this.riskyOperation();
    } catch (error) {
      ErrorManager.getInstance().handleError(
        error as Error,
        {
          component: 'ExampleService',
          method: 'manualErrorHandling'
        },
        'high',
        true
      );
    }
  }

  private async riskyOperation(): Promise<void> {
    throw new Error('Something went wrong');
  }
}

export { ErrorManager, withErrorHandling };