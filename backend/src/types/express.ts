import { Request } from 'express';
import { IUser } from './database';

/**
 * Extended Request interface for authenticated routes
 * Contains user information added by authentication middleware
 */
export interface AuthenticatedRequest extends Request {
  user: Omit<IUser, 'password_hash'>;
}

/**
 * Extended Request interface for optional authentication
 * User may or may not be present
 */
export interface OptionalAuthRequest extends Request {
  user?: Omit<IUser, 'password_hash'>;
}

/**
 * Extended Request interface for admin routes
 * Contains user with admin role verification
 */
export interface AdminRequest extends AuthenticatedRequest {
  user: Omit<IUser, 'password_hash'> & {
    role: 'admin' | 'super_admin';
  };
}

/**
 * Type guard to check if request has authenticated user
 */
export const isAuthenticatedRequest = (req: Request): req is AuthenticatedRequest => {
  return req.user !== undefined;
};

/**
 * Type guard to check if request has admin user
 */
export const isAdminRequest = (req: Request): req is AdminRequest => {
  return req.user !== undefined && ['admin', 'super_admin'].includes(req.user.role);
};