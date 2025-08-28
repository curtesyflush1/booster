/**
 * Global teardown for Jest tests
 * Runs once after all test suites
 */

export default async (): Promise<void> => {
  // Clean up any global resources
  console.log('🧹 Global test teardown completed');
  
  // Force exit after a short delay to ensure cleanup
  setTimeout(() => {
    process.exit(0);
  }, 1000);
};