/**
 * Test setup file to handle global test configuration and cleanup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DISABLE_RATE_LIMITING = 'true';
process.env.LOG_LEVEL = 'error';

// Global test timeout
jest.setTimeout(30000);

// Suppress console output in tests unless explicitly needed
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Only suppress in test environment
  if (process.env.NODE_ENV === 'test') {
    console.warn = jest.fn();
    console.error = jest.fn();
    console.log = jest.fn();
  }
});

afterAll(async () => {
  // Restore console methods
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock external services for testing
jest.mock('../src/services/emailDeliveryService', () => ({
  emailDeliveryService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
    sendAlert: jest.fn().mockResolvedValue({ success: true }),
    validateConfiguration: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../src/services/discordBotService', () => ({
  discordBotService: {
    sendAlert: jest.fn().mockResolvedValue({ success: true }),
    validateConfiguration: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../src/services/websocketService', () => ({
  websocketService: {
    broadcast: jest.fn(),
    sendToUser: jest.fn(),
    initialize: jest.fn()
  }
}));
