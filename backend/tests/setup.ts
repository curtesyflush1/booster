/**
 * Test setup file to handle global test configuration and cleanup
 */

// Mock the intervals to prevent open handles in tests
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
const activeIntervals = new Set<NodeJS.Timeout>();

// Override setInterval to track intervals
global.setInterval = ((callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
  const interval = originalSetInterval(callback, ms, ...args);
  activeIntervals.add(interval);
  return interval;
}) as typeof setInterval;

// Override clearInterval to remove from tracking
global.clearInterval = ((intervalId: NodeJS.Timeout) => {
  activeIntervals.delete(intervalId);
  return originalClearInterval(intervalId);
}) as typeof clearInterval;

// Clean up all intervals after each test
afterEach(() => {
  activeIntervals.forEach(interval => {
    originalClearInterval(interval);
  });
  activeIntervals.clear();
});

// Global test timeout
jest.setTimeout(30000);

// Suppress console warnings in tests unless explicitly needed
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});