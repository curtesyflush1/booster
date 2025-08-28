import { randomBytes, createHash } from 'crypto';

// Security test utilities
export class SecurityTestHelper {
  // Generate random strings for testing
  static generateRandomString(length: number): string {
    return randomBytes(length).toString('hex');
  }

  // Generate SQL injection payloads
  static getSQLInjectionPayloads(): string[] {
    return [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
      "' OR 1=1 --",
      "admin'--",
      "admin'/*",
      "' OR 'x'='x",
      "') OR ('1'='1",
      "' OR 1=1#"
    ];
  }

  // Generate XSS payloads
  static getXSSPayloads(): string[] {
    return [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert('XSS')>",
      "javascript:alert('XSS')",
      "<svg onload=alert('XSS')>",
      "<iframe src=javascript:alert('XSS')>",
      "<body onload=alert('XSS')>",
      "<input onfocus=alert('XSS') autofocus>",
      "<select onfocus=alert('XSS') autofocus>",
      "<textarea onfocus=alert('XSS') autofocus>",
      "<keygen onfocus=alert('XSS') autofocus>"
    ];
  }

  // Generate NoSQL injection payloads
  static getNoSQLInjectionPayloads(): any[] {
    return [
      { $ne: null },
      { $gt: "" },
      { $regex: ".*" },
      { $where: "function() { return true; }" },
      { $or: [{ email: { $exists: true } }] },
      { email: { $ne: "admin@example.com" } }
    ];
  }

  // Generate path traversal payloads
  static getPathTraversalPayloads(): string[] {
    return [
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
      "....//....//....//etc/passwd",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      "..%252f..%252f..%252fetc%252fpasswd",
      "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd"
    ];
  }

  // Generate command injection payloads
  static getCommandInjectionPayloads(): string[] {
    return [
      "; ls -la",
      "| cat /etc/passwd",
      "&& whoami",
      "|| id",
      "`whoami`",
      "$(whoami)",
      "; cat /etc/passwd #",
      "| nc -l -p 4444 -e /bin/sh"
    ];
  }

  // Generate weak passwords for testing
  static getWeakPasswords(): string[] {
    return [
      "password",
      "123456",
      "admin",
      "test",
      "qwerty",
      "password123",
      "admin123",
      "12345678",
      "abc123",
      "password1"
    ];
  }

  // Generate strong passwords for testing
  static generateStrongPassword(): string {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  // Test rate limiting
  static async testRateLimit(
    requestFn: () => Promise<any>,
    maxRequests: number,
    timeWindow: number
  ): Promise<{
    successfulRequests: number;
    rateLimitedRequests: number;
    totalTime: number;
  }> {
    const startTime = Date.now();
    let successfulRequests = 0;
    let rateLimitedRequests = 0;

    const promises = Array.from({ length: maxRequests + 5 }, async () => {
      try {
        const response = await requestFn();
        if (response.status === 429) {
          rateLimitedRequests++;
        } else if (response.status < 400) {
          successfulRequests++;
        }
      } catch (error) {
        // Handle network errors
      }
    });

    await Promise.all(promises);
    
    const totalTime = Date.now() - startTime;
    
    return {
      successfulRequests,
      rateLimitedRequests,
      totalTime
    };
  }

  // Hash password for comparison
  static hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  // Generate JWT tokens for testing
  static generateTestJWT(payload: any, secret: string = 'test-secret'): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, secret, { expiresIn: '1h' });
  }

  // Generate expired JWT token
  static generateExpiredJWT(payload: any, secret: string = 'test-secret'): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, secret, { expiresIn: '-1h' });
  }

  // Generate malformed JWT token
  static generateMalformedJWT(): string {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.MALFORMED.SIGNATURE';
  }
}

// Security test constants
export const SECURITY_CONSTANTS = {
  MAX_LOGIN_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  PASSWORD_MIN_LENGTH: 8,
  JWT_EXPIRY: 3600, // 1 hour
  SESSION_TIMEOUT: 1800, // 30 minutes
};

// Common security headers to check
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Setup and teardown
beforeEach(() => {
  // Clear any security-related state
});

afterEach(() => {
  // Clean up security test artifacts
});