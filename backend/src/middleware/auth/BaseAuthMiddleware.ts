import { Request, Response, NextFunction } from 'express';
import { authService } from '../../services/authService';
import { logger } from '../../utils/logger';
import { AuthResponseFactory } from '../../utils/authResponseFactory';

export abstract class BaseAuthMiddleware {
  protected extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7).trim();
    return token || null;
  }

  protected async authenticateToken(token: string, req: Request): Promise<boolean> {
    try {
      const user = await authService.validateAccessToken(token);
      req.user = user;
      return true;
    } catch (error) {
      this.logAuthenticationError(error, req);
      return false;
    }
  }

  protected logAuthenticationError(error: unknown, req: Request): void {
    logger.error('Authentication failed', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  }

  protected logOptionalAuthError(error: unknown, req: Request): void {
    logger.debug('Optional authentication failed', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method
    });
  }

  abstract execute(req: Request, res: Response, next: NextFunction): Promise<void>;
}