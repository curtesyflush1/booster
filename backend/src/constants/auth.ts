export const AUTH_ERROR_CODES = {
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INSUFFICIENT_SUBSCRIPTION: 'INSUFFICIENT_SUBSCRIPTION',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED'
} as const;

export const AUTH_ERROR_MESSAGES = {
  MISSING_TOKEN: 'Authentication token is required',
  INVALID_TOKEN: 'Invalid or expired authentication token',
  AUTHENTICATION_REQUIRED: 'Authentication is required',
  INSUFFICIENT_SUBSCRIPTION: (tier: string) => `This feature requires ${tier} subscription`,
  EMAIL_NOT_VERIFIED: 'Email verification is required to access this feature'
} as const;

// Note: HTTP_STATUS has been moved to constants/http.ts for better organization
// Import HTTP_STATUS from constants/http.ts instead