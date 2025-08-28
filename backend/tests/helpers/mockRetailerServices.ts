import { jest } from '@jest/globals';

// Mock retailer service implementations
export const createMockRetailerService = (retailerId: string) => ({
  checkAvailability: jest.fn(),
  searchProducts: jest.fn(),
  getHealthStatus: jest.fn(),
  getMetrics: jest.fn(),
  getConfig: jest.fn().mockReturnValue({
    id: retailerId,
    name: retailerId.charAt(0).toUpperCase() + retailerId.slice(1),
    enabled: true,
    rateLimits: {
      requestsPerSecond: 1,
      requestsPerMinute: 60,
      requestsPerHour: 3600
    }
  }),
  resetCircuitBreaker: jest.fn(),
  shutdown: jest.fn()
});

// Export mock instances
export const mockBestBuyService = createMockRetailerService('bestbuy');
export const mockWalmartService = createMockRetailerService('walmart');
export const mockCostcoService = createMockRetailerService('costco');
export const mockSamsClubService = createMockRetailerService('samsclub');

// Mock the service classes
jest.mock('../../src/services/retailers/BestBuyService', () => ({
  BestBuyService: jest.fn().mockImplementation(() => mockBestBuyService)
}));

jest.mock('../../src/services/retailers/WalmartService', () => ({
  WalmartService: jest.fn().mockImplementation(() => mockWalmartService)
}));

jest.mock('../../src/services/retailers/CostcoService', () => ({
  CostcoService: jest.fn().mockImplementation(() => mockCostcoService)
}));

jest.mock('../../src/services/retailers/SamsClubService', () => ({
  SamsClubService: jest.fn().mockImplementation(() => mockSamsClubService)
}));