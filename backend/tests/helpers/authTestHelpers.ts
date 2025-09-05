import { Request, Response, NextFunction } from 'express';
import { IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';
import jwt from 'jsonwebtoken';

export class AuthTestHelpers {
  static createMockUser(overrides: Partial<Omit<IUser, 'password_hash'>> = {}): Omit<IUser, 'password_hash'> {
    return {
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      admin_permissions: [],
      subscription_tier: SubscriptionTier.FREE,
      first_name: 'John',
      last_name: 'Doe',
      email_verified: true,
      failed_login_attempts: 0,
      shipping_addresses: [],
      payment_methods: [],
      retailer_credentials: {},
      notification_settings: {
        web_push: true,
        email: true,
        sms: false,
        discord: false
      },
      quiet_hours: {
        enabled: false,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: []
      },
      timezone: 'UTC',
      preferences: {},
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides
    };
  }

  static createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
    return {
      headers: {},
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      ...overrides
    };
  }

  static createMockResponse(): { 
    mockResponse: Partial<Response>, 
    statusSpy: jest.Mock, 
    jsonSpy: jest.Mock 
  } {
    const statusSpy = jest.fn().mockReturnThis();
    const jsonSpy = jest.fn().mockReturnThis();
    
    const mockResponse = {
      status: statusSpy,
      json: jsonSpy
    };

    return { mockResponse, statusSpy, jsonSpy };
  }

  static createMockNext(): NextFunction {
    return jest.fn();
  }

  static expectErrorResponse(
    statusSpy: jest.Mock, 
    jsonSpy: jest.Mock, 
    expectedStatus: number, 
    expectedCode: string
  ): void {
    expect(statusSpy).toHaveBeenCalledWith(expectedStatus);
    expect(jsonSpy).toHaveBeenCalledWith({
      error: {
        code: expectedCode,
        message: expect.any(String),
        timestamp: expect.any(String)
      }
    });
  }
}

// Generate test JWT token
export const generateTestToken = (userId: string): string => {
  const payload = {
    userId,
    email: 'test@example.com',
    subscriptionTier: 'free'
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h'
  });
};
