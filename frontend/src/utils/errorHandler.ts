import { logger } from './logger';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export class ErrorHandler {
  /**
   * Create standardized error object
   */
  static createError(
    code: string, 
    message: string, 
    details?: any
  ): AppError {
    return {
      code,
      message,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle API errors with consistent formatting
   */
  static handleApiError(error: any): AppError {
    if (error.response?.data?.error) {
      return this.createError(
        error.response.data.error.code || 'API_ERROR',
        error.response.data.error.message || 'An API error occurred',
        error.response.data.error.details
      );
    }

    if (error.code === 'NETWORK_ERROR') {
      return this.createError(
        'NETWORK_ERROR',
        'Unable to connect to the server. Please check your internet connection.',
        { originalError: error.message }
      );
    }

    return this.createError(
      'UNKNOWN_ERROR',
      error.message || 'An unexpected error occurred',
      { originalError: error }
    );
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(error: any): AppError {
    if (error.response?.status === 401) {
      return this.createError(
        'AUTH_EXPIRED',
        'Your session has expired. Please sign in again.',
        { redirectTo: '/login' }
      );
    }

    if (error.response?.status === 403) {
      return this.createError(
        'AUTH_FORBIDDEN',
        'You do not have permission to perform this action.',
        { requiredRole: error.response.data?.requiredRole }
      );
    }

    return this.handleApiError(error);
  }

  /**
   * Log error with context
   */
  static logError(error: AppError, context?: Record<string, any>): void {
    logger.error('Application error', {
      ...error,
      context
    });
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: AppError): string {
    const userMessages: Record<string, string> = {
      'NETWORK_ERROR': 'Connection problem. Please try again.',
      'AUTH_EXPIRED': 'Please sign in again.',
      'AUTH_FORBIDDEN': 'Access denied.',
      'VALIDATION_ERROR': 'Please check your input and try again.',
      'RATE_LIMIT': 'Too many requests. Please wait a moment.',
      'SERVER_ERROR': 'Server error. Please try again later.'
    };

    return userMessages[error.code] || error.message;
  }
}

/**
 * React hook for error handling
 */
export function useErrorHandler() {
  const handleError = (error: any, context?: Record<string, any>) => {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, context);
    return appError;
  };

  const handleAuthError = (error: any, context?: Record<string, any>) => {
    const appError = ErrorHandler.handleAuthError(error);
    ErrorHandler.logError(appError, context);
    
    // Trigger auth error event for global handling
    if (appError.code === 'AUTH_EXPIRED') {
      window.dispatchEvent(new CustomEvent('auth-error'));
    }
    
    return appError;
  };

  return {
    handleError,
    handleAuthError,
    getUserMessage: ErrorHandler.getUserMessage
  };
}