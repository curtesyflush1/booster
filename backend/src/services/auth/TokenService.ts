import jwt from 'jsonwebtoken';
import { IAuthToken } from '../../types/database';
import { logger } from '../../utils/logger';

export interface TokenConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

export class TokenService {
  constructor(private config: TokenConfig) {}

  async generateTokens(userId: string): Promise<IAuthToken> {
    const payload = { userId };

    const accessToken = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.accessTokenExpiry
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, this.config.jwtRefreshSecret, {
      expiresIn: this.config.refreshTokenExpiry
    } as jwt.SignOptions);

    const expiresIn = this.parseExpiryToSeconds(this.config.accessTokenExpiry);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: 'Bearer'
    };
  }

  async validateAccessToken(token: string): Promise<{ userId: string }> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as { userId: string };
      return decoded;
    } catch (error) {
      logger.error('Access token validation failed', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Invalid access token');
    }
  }

  async validateRefreshToken(token: string): Promise<{ userId: string }> {
    try {
      const decoded = jwt.verify(token, this.config.jwtRefreshSecret) as { userId: string };
      return decoded;
    } catch (error) {
      logger.error('Refresh token validation failed', { error: error instanceof Error ? error.message : String(error) });
      throw new Error('Invalid refresh token');
    }
  }

  private parseExpiryToSeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // 15 minutes default
    }
  }
}