import { IUser } from '../types/database';

/**
 * Type guards for better type safety throughout the application
 */

/**
 * Check if user object has password hash
 */
export function isUserWithPassword(user: any): user is IUser & { password_hash: string } {
  return user && typeof user.password_hash === 'string';
}

/**
 * Check if user object is valid
 */
export function isValidUser(user: any): user is IUser {
  return user && 
         typeof user.id === 'string' && 
         typeof user.email === 'string' &&
         user.created_at instanceof Date;
}

/**
 * Check if error is an operational error
 */
export function isOperationalError(error: any): error is Error & { isOperational: boolean } {
  return error && 
         error instanceof Error && 
         typeof error.isOperational === 'boolean';
}

/**
 * Check if object has required authentication properties
 */
export function hasAuthProperties(obj: any): obj is { user: IUser; tokens: any } {
  return obj && 
         obj.user && 
         obj.tokens &&
         isValidUser(obj.user);
}

/**
 * Type guard for request with user
 */
export function hasAuthenticatedUser(req: any): req is { user: IUser } {
  return req && req.user && isValidUser(req.user);
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid email format
 */
export function isValidEmail(value: any): value is string {
  if (!isNonEmptyString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if value is a valid UUID
 */
export function isValidUUID(value: any): value is string {
  if (!isNonEmptyString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Check if object has pagination properties
 */
export function hasPaginationData<T>(obj: any): obj is { data: T[]; total: number; page: number; limit: number } {
  return obj &&
         Array.isArray(obj.data) &&
         typeof obj.total === 'number' &&
         typeof obj.page === 'number' &&
         typeof obj.limit === 'number';
}

/**
 * Safe user data extractor that removes sensitive fields
 */
export function extractSafeUserData(user: IUser): Omit<IUser, 'password_hash'> {
  if (isUserWithPassword(user)) {
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }
  return user;
}