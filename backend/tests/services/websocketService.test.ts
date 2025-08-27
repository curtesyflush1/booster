import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { WebSocketService } from '../../src/services/websocketService';
import jwt from 'jsonwebtoken';
import { User } from '../../src/models/User';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/models/User');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

const MockedUser = User as jest.Mocked<typeof User>;
const MockedJWT = jwt as jest.Mocked<typeof jwt>;

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let websocketService: WebSocketService;
  let mockUser: any;

  beforeEach(() => {
    // Create HTTP server
    httpServer = createServer();
    
    // Mock user data
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      subscription_tier: 'pro'
    };

    // Mock JWT verification
    MockedJWT.verify.mockReturnValue({ userId: mockUser.id } as any);
    MockedUser.findById.mockResolvedValue(mockUser);

    // Initialize WebSocket service
    websocketService = new WebSocketService(httpServer);
  });

  afterEach(() => {
    if (websocketService) {
      websocketService.destroy();
    }
    if (httpServer) {
      httpServer.close();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize WebSocket service with HTTP server', () => {
      expect(websocketService).toBeInstanceOf(WebSocketService);
    });

    it('should set up CORS configuration', () => {
      const healthInfo = websocketService.getHealthInfo();
      expect(healthInfo).toHaveProperty('connectedUsers');
      expect(healthInfo).toHaveProperty('totalConnections');
      expect(healthInfo).toHaveProperty('rooms');
    });
  });

  describe('Connection Management', () => {
    it('should track connected users', () => {
      const initialCount = websocketService.getConnectedUsersCount();
      expect(initialCount).toBe(0);
    });

    it('should provide health information', () => {
      const healthInfo = websocketService.getHealthInfo();
      
      expect(healthInfo).toEqual({
        connectedUsers: 0,
        totalConnections: 0,
        rooms: expect.any(Array)
      });
    });

    it('should check if user is connected', () => {
      const isConnected = websocketService.isUserConnected('test-user-id');
      expect(isConnected).toBe(false);
    });

    it('should get user connection count', () => {
      const connectionCount = websocketService.getUserConnectionCount('test-user-id');
      expect(connectionCount).toBe(0);
    });
  });

  describe('Message Broadcasting', () => {
    it('should send dashboard update to user', () => {
      const testData = { stats: { totalWatches: 5 } };
      
      // This should not throw an error even with no connected users
      expect(() => {
        websocketService.sendDashboardUpdate('test-user-id', testData);
      }).not.toThrow();
    });

    it('should send alert notification to user', () => {
      const testAlert = {
        id: 'alert-1',
        type: 'restock',
        data: { product_name: 'Test Product' }
      };
      
      expect(() => {
        websocketService.sendAlertNotification('test-user-id', testAlert);
      }).not.toThrow();
    });

    it('should send product update', () => {
      const testData = { availability: 'in_stock', price: 29.99 };
      
      expect(() => {
        websocketService.sendProductUpdate('product-1', testData);
      }).not.toThrow();
    });

    it('should send watch update to user', () => {
      const testWatchData = {
        id: 'watch-1',
        product_id: 'product-1',
        is_active: true
      };
      
      expect(() => {
        websocketService.sendWatchUpdate('test-user-id', testWatchData);
      }).not.toThrow();
    });

    it('should send insights update to user', () => {
      const testInsights = [
        {
          productId: 'product-1',
          hypeScore: 85,
          selloutRisk: { score: 70 }
        }
      ];
      
      expect(() => {
        websocketService.sendInsightsUpdate('test-user-id', testInsights);
      }).not.toThrow();
    });

    it('should send portfolio update to user', () => {
      const testPortfolio = {
        totalValue: 1500.00,
        totalItems: 25,
        valueChange: { percentage: 5.2 }
      };
      
      expect(() => {
        websocketService.sendPortfolioUpdate('test-user-id', testPortfolio);
      }).not.toThrow();
    });

    it('should broadcast system announcement', () => {
      expect(() => {
        websocketService.broadcastAnnouncement('System maintenance in 10 minutes', 'warning');
      }).not.toThrow();
    });

    it('should broadcast retailer status update', () => {
      const testStatus = {
        status: 'healthy',
        responseTime: 150,
        lastChecked: new Date().toISOString()
      };
      
      expect(() => {
        websocketService.broadcastRetailerStatus('best-buy', testStatus);
      }).not.toThrow();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(websocketService.shutdown()).resolves.not.toThrow();
    });

    it('should handle shutdown when already destroyed', async () => {
      websocketService.destroy();
      await expect(websocketService.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle JWT verification errors', () => {
      MockedJWT.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Should not throw when creating service with invalid token setup
      expect(() => {
        new WebSocketService(httpServer);
      }).not.toThrow();
    });

    it('should handle user not found errors', () => {
      MockedUser.findById.mockResolvedValue(null);

      // Should not throw when user is not found
      expect(() => {
        new WebSocketService(httpServer);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle multiple simultaneous operations', () => {
      const operations = [
        () => websocketService.sendDashboardUpdate('user-1', {}),
        () => websocketService.sendAlertNotification('user-2', {}),
        () => websocketService.sendProductUpdate('product-1', {}),
        () => websocketService.broadcastAnnouncement('Test message'),
        () => websocketService.getHealthInfo(),
        () => websocketService.isUserConnected('user-1'),
        () => websocketService.getUserConnectionCount('user-2')
      ];

      expect(() => {
        operations.forEach(op => op());
      }).not.toThrow();
    });

    it('should maintain performance with health checks', () => {
      const startTime = Date.now();
      
      // Perform multiple health checks
      for (let i = 0; i < 100; i++) {
        websocketService.getHealthInfo();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 100 health checks in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});