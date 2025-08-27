import { Request, Response, NextFunction } from 'express';
import { 
  getDashboardData, 
  getPredictiveInsights, 
  getPortfolioData, 
  getDashboardUpdates 
} from '../../src/controllers/dashboardController';
import { User } from '../../src/models/User';
import { Watch } from '../../src/models/Watch';
import { Alert } from '../../src/models/Alert';
import { Product } from '../../src/models/Product';

// Mock the models
jest.mock('../../src/models/User');
jest.mock('../../src/models/Watch');
jest.mock('../../src/models/Alert');
jest.mock('../../src/models/Product');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

const MockedUser = User as jest.Mocked<typeof User>;
const MockedWatch = Watch as jest.Mocked<typeof Watch>;
const MockedAlert = Alert as jest.Mocked<typeof Alert>;
const MockedProduct = Product as jest.Mocked<typeof Product>;

describe('Dashboard Controller', () => {
  const mockUserId = 'test-user-id';
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request/response
    mockReq = {
      user: { id: mockUserId } as any,
      query: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('getDashboardData', () => {
    it('should return dashboard data for authenticated user', async () => {
      // Mock user stats
      MockedUser.getUserStats.mockResolvedValue({
        watchCount: 8,
        alertCount: 25,
        accountAge: 30
      });

      // Mock watch stats
      MockedWatch.getUserWatchStats.mockResolvedValue({
        total: 10,
        active: 8,
        totalAlerts: 25,
        recentAlerts: 3,
        topProducts: [
          { product_id: 'product-1', alert_count: 5 },
          { product_id: 'product-2', alert_count: 3 }
        ]
      });

      // Mock alert stats
      MockedAlert.getUserAlertStats.mockResolvedValue({
        total: 25,
        unread: 2,
        byType: { restock: 15, price_drop: 10 },
        byStatus: { sent: 20, pending: 5 },
        clickThroughRate: 75.5,
        recentAlerts: 3
      });

      // Mock recent alerts
      MockedAlert.findByUserId.mockResolvedValue({
        data: [
          {
            id: 'alert-1',
            user_id: mockUserId,
            product_id: 'product-1',
            retailer_id: 'retailer-1',
            type: 'restock',
            priority: 'medium',
            status: 'sent',
            delivery_channels: ['web_push'],
            retry_count: 0,
            data: {
              product_name: 'Test Product',
              retailer_name: 'Test Retailer',
              price: 29.99,
              availability_status: 'in_stock',
              product_url: 'https://example.com/product'
            },
            created_at: new Date(),
            updated_at: new Date()
          } as any
        ],
        total: 1,
        page: 1,
        limit: 10
      });

      // Mock product lookup
      MockedProduct.findById.mockResolvedValue({
        id: 'product-1',
        name: 'Test Product',
        msrp: 29.99,
        popularity_score: 85
      });

      await getDashboardData(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        dashboard: expect.objectContaining({
          stats: expect.objectContaining({
            totalWatches: 8,
            unreadAlerts: 2,
            successfulPurchases: 0,
            clickThroughRate: 75.5
          }),
          recentAlerts: expect.any(Array),
          watchedProducts: expect.any(Array),
          insights: expect.any(Object)
        })
      });
    });

    it('should return 401 for unauthenticated requests', async () => {
      delete mockReq.user;

      await getDashboardData(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          code: 'AUTHENTICATION_REQUIRED'
        })
      });
    });
  });

  describe('getPredictiveInsights', () => {
    it('should return predictive insights for user products', async () => {
      // Mock watch data
      MockedWatch.findByUserId.mockResolvedValue({
        data: [
          { 
            id: 'watch-1',
            product_id: 'product-1', 
            user_id: mockUserId,
            retailer_ids: ['retailer-1'],
            availability_type: 'both',
            is_active: true,
            alert_count: 0,
            created_at: new Date(),
            updated_at: new Date()
          } as any,
          { 
            id: 'watch-2',
            product_id: 'product-2', 
            user_id: mockUserId,
            retailer_ids: ['retailer-1'],
            availability_type: 'both',
            is_active: true,
            alert_count: 0,
            created_at: new Date(),
            updated_at: new Date()
          } as any
        ],
        total: 2,
        page: 1,
        limit: 50
      });

      // Mock product data
      MockedProduct.findById
        .mockResolvedValueOnce({
          id: 'product-1',
          name: 'Product 1',
          msrp: 29.99,
          popularity_score: 85
        })
        .mockResolvedValueOnce({
          id: 'product-2',
          name: 'Product 2',
          msrp: 39.99,
          popularity_score: 65
        });

      // Mock alert history
      MockedAlert.findByProductId
        .mockResolvedValueOnce([
          { 
            id: 'alert-1', 
            product_id: 'product-1',
            user_id: mockUserId,
            retailer_id: 'retailer-1',
            type: 'restock',
            priority: 'medium',
            status: 'sent',
            delivery_channels: [],
            retry_count: 0,
            data: {
              product_name: 'Product 1',
              retailer_name: 'Retailer 1',
              availability_status: 'in_stock',
              product_url: 'https://example.com'
            },
            created_at: new Date(),
            updated_at: new Date()
          } as any,
          { 
            id: 'alert-2', 
            product_id: 'product-1',
            user_id: mockUserId,
            retailer_id: 'retailer-1',
            type: 'restock',
            priority: 'medium',
            status: 'sent',
            delivery_channels: [],
            retry_count: 0,
            data: {
              product_name: 'Product 1',
              retailer_name: 'Retailer 1',
              availability_status: 'in_stock',
              product_url: 'https://example.com'
            },
            created_at: new Date(),
            updated_at: new Date()
          } as any
        ])
        .mockResolvedValueOnce([
          { 
            id: 'alert-3', 
            product_id: 'product-2',
            user_id: mockUserId,
            retailer_id: 'retailer-1',
            type: 'restock',
            priority: 'medium',
            status: 'sent',
            delivery_channels: [],
            retry_count: 0,
            data: {
              product_name: 'Product 2',
              retailer_name: 'Retailer 1',
              availability_status: 'in_stock',
              product_url: 'https://example.com'
            },
            created_at: new Date(),
            updated_at: new Date()
          } as any
        ]);

      await getPredictiveInsights(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        insights: expect.arrayContaining([
          expect.objectContaining({
            productId: expect.any(String),
            productName: expect.any(String),
            priceForcast: expect.any(Object),
            selloutRisk: expect.any(Object),
            roiEstimate: expect.any(Object),
            hypeScore: expect.any(Number)
          })
        ])
      });
    });

    it('should filter insights by product IDs when provided', async () => {
      mockReq.query = { productIds: 'product-1' };
      
      MockedProduct.findById.mockResolvedValue({
        id: 'product-1',
        name: 'Product 1',
        msrp: 29.99,
        popularity_score: 85
      });

      MockedAlert.findByProductId.mockResolvedValue([]);

      await getPredictiveInsights(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const call = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(call.insights).toHaveLength(1);
      expect(call.insights[0].productId).toBe('product-1');
    });
  });

  describe('getPortfolioData', () => {
    it('should return portfolio tracking data', async () => {
      // Mock watch stats
      MockedWatch.getUserWatchStats.mockResolvedValue({
        total: 10,
        active: 8,
        totalAlerts: 25,
        recentAlerts: 3,
        topProducts: [
          { product_id: 'product-1', alert_count: 5 }
        ]
      });

      // Mock alert stats
      MockedAlert.getUserAlertStats.mockResolvedValue({
        total: 25,
        unread: 2,
        byType: { restock: 15, price_drop: 10 },
        byStatus: { sent: 20, pending: 5 },
        clickThroughRate: 75.5,
        recentAlerts: 3
      });

      // Mock product data
      MockedProduct.findById.mockResolvedValue({
        id: 'product-1',
        name: 'Product 1',
        msrp: 29.99,
        popularity_score: 85
      });

      await getPortfolioData(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        portfolio: expect.objectContaining({
          totalValue: expect.any(Number),
          totalItems: expect.any(Number),
          valueChange: expect.any(Object),
          topHoldings: expect.any(Array),
          gapAnalysis: expect.any(Object),
          performance: expect.any(Object)
        })
      });
    });
  });

  describe('getDashboardUpdates', () => {
    it('should return recent dashboard updates', async () => {
      const sinceDate = new Date(Date.now() - 5 * 60 * 1000);
      mockReq.query = { since: sinceDate.toISOString() };

      // Mock recent alerts
      MockedAlert.findByUserId.mockResolvedValue({
        data: [
          {
            id: 'alert-1',
            user_id: mockUserId,
            product_id: 'product-1',
            retailer_id: 'retailer-1',
            type: 'restock',
            priority: 'medium',
            status: 'sent',
            delivery_channels: [],
            retry_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
            data: { 
              product_name: 'Test Product',
              retailer_name: 'Test Retailer',
              availability_status: 'in_stock',
              product_url: 'https://example.com'
            }
          } as any
        ],
        total: 1,
        page: 1,
        limit: 5
      });

      await getDashboardUpdates(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        updates: expect.objectContaining({
          newAlerts: expect.any(Array),
          watchUpdates: expect.any(Array),
          timestamp: expect.any(String)
        })
      });
    });

    it('should use default time range when since parameter is not provided', async () => {
      MockedAlert.findByUserId.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 5
      });

      await getDashboardUpdates(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const call = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(call.updates.newAlerts).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      MockedUser.getUserStats.mockRejectedValue(new Error('Database error'));

      await getDashboardData(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});