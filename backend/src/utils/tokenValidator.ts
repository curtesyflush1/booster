import { InvalidTokenError } from './authErrors';

export class TokenValidator {
  private static readonly TOKEN_MIN_LENGTH = 10;
  private static readonly TOKEN_MAX_LENGTH = 2048;
  private static readonly BEARER_PREFIX = 'Bearer ';

  static validateTokenFormat(token: string): void {
    if (!token || typeof token !== 'string') {
      throw new InvalidTokenError('Token must be a non-empty string');
    }

    const trimmedToken = token.trim();
    
    if (trimmedToken.length < this.TOKEN_MIN_LENGTH) {
      throw new InvalidTokenError('Token is too short');
    }

    if (trimmedToken.length > this.TOKEN_MAX_LENGTH) {
      throw new InvalidTokenError('Token is too long');
    }

    // Basic JWT format validation (header.payload.signature)
    const parts = trimmedToken.split('.');
    if (parts.length !== 3) {
      throw new InvalidTokenError('Invalid token format');
    }

    // Validate each part is base64url encoded
    for (const part of parts) {
      if (!this.isValidBase64Url(part)) {
        throw new InvalidTokenError('Invalid token encoding');
      }
    }
  }

  static extractBearerToken(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith(this.BEARER_PREFIX)) {
      return null;
    }

    const token = authHeader.substring(this.BEARER_PREFIX.length).trim();
    return token || null;
  }

  private static isValidBase64Url(str: string): boolean {
    // Base64url uses A-Z, a-z, 0-9, -, _ and no padding
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
    return base64UrlRegex.test(str);
  }
}