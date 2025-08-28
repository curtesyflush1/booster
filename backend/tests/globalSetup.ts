/**
 * Global setup for Jest tests
 * Runs once before all test suites
 */

export default async (): Promise<void> => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'sqlite::memory:';
  process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test database
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.DISABLE_RATE_LIMITING = 'true';
  process.env.LOG_LEVEL = 'error';
  process.env.DISABLE_EXTERNAL_SERVICES = 'true';
  
  // Disable real external service calls
  process.env.AWS_SES_REGION = 'us-east-1';
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.TWILIO_ACCOUNT_SID = 'test';
  process.env.TWILIO_AUTH_TOKEN = 'test';
  process.env.DISCORD_BOT_TOKEN = 'test';
  
  console.log('🧪 Global test setup completed');
};