// Set NODE_ENV to test for all Jest tests
process.env.NODE_ENV = 'test';

// Disable rate limiting in most tests (can be overridden per test)
process.env.DISABLE_RATE_LIMITING = 'true';

// Set test database URL if needed
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/booster_test';

// Set JWT secrets for testing
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';