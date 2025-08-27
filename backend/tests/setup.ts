/**
 * Test setup file to handle global test configuration and cleanup
 */

// Mock timers and intervals to prevent open handles
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

const activeTimeouts = new Set<NodeJS.Timeout>();
const activeIntervals = new Set<NodeJS.Timeout>();

// Override setTimeout to track timeouts
global.setTimeout = ((callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
  const timeout = originalSetTimeout(callback, ms, ...args);
  activeTimeouts.add(timeout);
  return timeout;
}) as typeof setTimeout;

// Override clearTimeout to remove from tracking
global.clearTimeout = ((timeoutId: NodeJS.Timeout) => {
  activeTimeouts.delete(timeoutId);
  return originalClearTimeout(timeoutId);
}) as typeof clearTimeout;

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

// Clean up all timers and intervals after each test
afterEach(async () => {
  // Clear all active timeouts
  activeTimeouts.forEach(timeout => {
    originalClearTimeout(timeout);
  });
  activeTimeouts.clear();
  
  // Clear all active intervals
  activeIntervals.forEach(interval => {
    originalClearInterval(interval);
  });
  activeIntervals.clear();
  
  // Wait a bit for cleanup
  await new Promise(resolve => originalSetTimeout(resolve, 100));
});

// Global test timeout
jest.setTimeout(15000);

// Suppress console output in tests unless explicitly needed
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(async () => {
  // Restore console methods
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  
  // Final cleanup
  activeTimeouts.forEach(timeout => originalClearTimeout(timeout));
  activeIntervals.forEach(interval => originalClearInterval(interval));
  
  // Wait for final cleanup
  await new Promise(resolve => originalSetTimeout(resolve, 500));
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
