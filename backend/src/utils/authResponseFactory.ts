import { Response } from 'express';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '../constants/auth';
import { HTTP_STATUS } from '../constants/http';
import { SubscriptionTier } from '../types/subscription';

export interface AuthErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export class AuthResponseFactory {
  static sendError(res: Response, statusCode: number, code: string, message: string): void {
    res.status(statusCode).json({
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  static sendMissingToken(res: Response): void {
    this.sendError(
      res, 
      HTTP_STATUS.UNAUTHORIZED, 
      AUTH_ERROR_CODES.MISSING_TOKEN, 
      AUTH_ERROR_MESSAGES.MISSING_TOKEN
    );
  }

  static sendInvalidToken(res: Response): void {
    this.sendError(
      res, 
      HTTP_STATUS.UNAUTHORIZED, 
      AUTH_ERROR_CODES.INVALID_TOKEN, 
      AUTH_ERROR_MESSAGES.INVALID_TOKEN
    );
  }

  static sendAuthenticationRequired(res: Response): void {
    this.sendError(
      res, 
      HTTP_STATUS.UNAUTHORIZED, 
      AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED, 
      AUTH_ERROR_MESSAGES.AUTHENTICATION_REQUIRED
    );
  }

  static sendInsufficientSubscription(res: Response, requiredTier: SubscriptionTier): void {
    this.sendError(
      res, 
      HTTP_STATUS.FORBIDDEN, 
      AUTH_ERROR_CODES.INSUFFICIENT_SUBSCRIPTION, 
      AUTH_ERROR_MESSAGES.INSUFFICIENT_SUBSCRIPTION(requiredTier)
    );
  }

  static sendEmailNotVerified(res: Response): void {
    this.sendError(
      res, 
      HTTP_STATUS.FORBIDDEN, 
      AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED, 
      AUTH_ERROR_MESSAGES.EMAIL_NOT_VERIFIED
    );
  }
}