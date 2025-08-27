// Jest setup file for BoosterBeacon extension tests

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null,
    getManifest: jest.fn(() => ({
      version: '1.0.0',
      name: 'BoosterBeacon'
    }))
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  notifications: {
    create: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  }
};

// Set up global chrome object
(globalThis as any).chrome = mockChrome;

// Mock window.location for URL-based tests
delete (window as any).location;
(window as any).location = {
  href: 'https://example.com',
  hostname: 'example.com'
};

// Mock console methods to reduce noise in tests
globalThis.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});