import { logger } from './logger';

export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export class ErrorHandler {
  /**
   * Create standardized error object
   */
  static createError(
    code: string, 
    message: string, 
    details?: Record<string, unknown>
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
  static handleApiError(error: unknown): AppError {
    // Type guard for API errors with response
    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'data' in error.response && error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data && error.response.data.error) {
      const apiError = error.response.data.error as Record<string, unknown>;
      return this.createError(
        (apiError.code as string) || 'API_ERROR',
        (apiError.message as string) || 'An API error occurred',
        apiError.details as Record<string, unknown>
      );
    }

    // Type guard for network errors
    if (error && typeof error === 'object' && 'code' in error && error.code === 'NETWORK_ERROR' && 'message' in error) {
      return this.createError(
        'NETWORK_ERROR',
        'Unable to connect to the server. Please check your internet connection.',
        { originalError: error.message as string }
      );
    }

    // Fallback for unknown errors
    const errorMessage = error && typeof error === 'object' && 'message' in error ? error.message as string : 'An unexpected error occurred';
    return this.createError(
      'UNKNOWN_ERROR',
      errorMessage,
      { originalError: error }
    );
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(error: unknown): AppError {
    // Type guard for auth errors with response
    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response) {
      const response = error.response as Record<string, unknown>;
      
      if (response.status === 401) {
        return this.createError(
          'AUTH_EXPIRED',
          'Your session has expired. Please sign in again.',
          { redirectTo: '/login' }
        );
      }

      if (response.status === 403) {
        const requiredRole = response.data && typeof response.data === 'object' && 'requiredRole' in response.data ? response.data.requiredRole : undefined;
        return this.createError(
          'AUTH_FORBIDDEN',
          'You do not have permission to perform this action.',
          { requiredRole }
        );
      }
    }

    return this.handleApiError(error);
  }

  /**
   * Log error with context
   */
  static logError(error: AppError, context?: Record<string, unknown>): void {
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
  const handleError = (error: unknown, context?: Record<string, unknown>) => {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, context);
    return appError;
  };

  const handleAuthError = (error: unknown, context?: Record<string, unknown>) => {
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