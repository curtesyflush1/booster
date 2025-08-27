import { Response } from 'express';

export interface ApiError {
  code: string;
  message: string;
  timestamp: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Convenience functions for consistent API responses
export const successResponse = <T>(
  res: Response, 
  data: T, 
  message?: string, 
  statusCode: number = 200
): void => {
  const response: any = { success: true, data };
  if (message) response.message = message;
  res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response, 
  statusCode: number, 
  message: string, 
  code?: string,
  details?: any
): void => {
  res.status(statusCode).json({
    success: false,
    error: {
      code: code || `HTTP_${statusCode}`,
      message,
      timestamp: new Date().toISOString(),
      ...(details && { details })
    }
  });
};

export class ResponseHelper {
  static success<T>(res: Response, data: T, statusCode: number = 200): void {
    res.status(statusCode).json({ data });
  }

  static successWithPagination<T>(
    res: Response, 
    data: T[], 
    pagination: { page: number; limit: number; total: number },
    statusCode: number = 200
  ): void {
    res.status(statusCode).json({
      data,
      pagination: {
        ...pagination,
        totalPages: Math.ceil(pagination.total / pagination.limit)
      }
    });
  }

  static error(
    res: Response, 
    code: string, 
    message: string, 
    statusCode: number = 400,
    details?: any
  ): void {
    res.status(statusCode).json({
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        ...(details && { details })
      }
    });
  }

  static validationError(res: Response, message: string): void {
    this.error(res, 'VALIDATION_ERROR', message, 400);
  }

  static badRequest(res: Response, message: string): void {
    this.error(res, 'BAD_REQUEST', message, 400);
  }

  static notFound(res: Response, resource: string): void {
    this.error(res, `${resource.toUpperCase()}_NOT_FOUND`, `${resource} not found`, 404);
  }

  static internalError(res: Response, message: string = 'Internal server error'): void {
    this.error(res, 'INTERNAL_ERROR', message, 500);
  }
}