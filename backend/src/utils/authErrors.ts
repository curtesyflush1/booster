export class AuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AuthError {
  constructor(message: string = 'Validation failed') {
    super(message, 'VALIDATION_ERROR');
  }
}

export class UserNotFoundError extends AuthError {
  constructor(message: string = 'User not found') {
    super(message, 'USER_NOT_FOUND');
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message: string = 'Invalid credentials') {
    super(message, 'INVALID_CREDENTIALS');
  }
}

export class AccountLockedError extends AuthError {
  constructor(message: string = 'Account is temporarily locked') {
    super(message, 'ACCOUNT_LOCKED');
  }
}

export class TokenExpiredError extends AuthError {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED');
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message: string = 'Invalid token') {
    super(message, 'INVALID_TOKEN');
  }
}

export class UserExistsError extends AuthError {
  constructor(message: string = 'User already exists') {
    super(message, 'USER_EXISTS');
  }
}

// Error factory for consistent error creation
export class AuthErrorFactory {
  static createValidationError(field: string): ValidationError {
    return new ValidationError(`Invalid ${field} provided`);
  }

  static createTokenError(type: 'expired' | 'invalid' | 'missing'): AuthError {
    switch (type) {
      case 'expired':
        return new TokenExpiredError();
      case 'invalid':
        return new InvalidTokenError();
      case 'missing':
        return new InvalidTokenError('Authentication token is required');
      default:
        return new InvalidTokenError();
    }
  }
}