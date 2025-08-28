import { AdminSystemService } from '../../src/services/adminSystemService';
import { BaseModel } from '../../src/models/BaseModel';

// Mock the BaseModel to avoid database dependencies
jest.mock('../../src/models/BaseModel', () => ({
  BaseModel: {
    getKnex: jest.fn()
  }
}));

describe('AdminSystemService', () => {
  let mockKnex: any;

  beforeEach(() => {
    mockKnex = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      max: jest.fn().mockReturnThis(),
      avg: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      first: jest.fn(),
      raw: jest.fn()
    };

    (BaseModel.getKnex as jest.Mock).mockReturnValue(mockKnex);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      // Mock user statistics
      mockKnex.first
        .mockResolvedValueOnce({ count: '100' }) // total users
        .mockResolvedValueOnce({ count: '95' })  // active users
        .mockResolvedValueOnce({ count: '5' })   // new today
        .mockResolvedValueOnce({ count: '15' })  // new this week
        .mockResolvedValueOnce({ count: '20' })  // pro users
        // Mock alert statistics
        .mockResolvedValueOnce({ count: '500' }) // total alerts
        .mockResolvedValueOnce({ count: '25' })  // alerts today
        .mockResolvedValueOnce({ count: '10' })  // pending alerts
        .mockResolvedValueOnce({ count: '5' })   // failed alerts
        .mockResolvedValueOnce({ avg_seconds: '15.5' }) // avg delivery time
        // Mock ML model statistics
        .mockResolvedValueOnce({ count: '3' })   // active models
        .mockResolvedValueOnce({ count: '1' })   // training models
        .mockResolvedValueOnce({ last_training: new Date('2024-01-01') }); // last training

      // Mock system metrics
      jest.spyOn(AdminSystemService, 'getSystemMetrics').mockResolvedValue({
        cpu_usage: 45.2,
        memory_usage: 67.8,
        disk_usage: 23.1,
        api_response_time: 120.5,
        error_rate: 0.5,
        uptime: 86400
      });

      const result = await AdminSystemService.getDashboardStats();

      expect(result).toEqual({
        users: {
          total: 100,
          active: 95,
          new_today: 5,
          new_this_week: 15,
          pro_subscribers: 20,
          conversion_rate: 20
        },
        alerts: {
          total_sent: 500,
          sent_today: 25,
          pending: 10,
          failed: 5,
          success_rate: 99,
          avg_delivery_time: 15.5
        },
        ml_models: {
          active_models: 3,
          training_models: 1,
          last_training: new Date('2024-01-01'),
          prediction_accuracy: 85.5
        },
        system: {
          uptime: 86400,
          cpu_usage: 45.2,
          memory_usage: 67.8,
          disk_usage: 23.1,
          api_response_time: 120.5,
          error_rate: 0.5
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockKnex.first.mockRejectedValue(new Error('Database connection failed'));

      await expect(AdminSystemService.getDashboardStats()).rejects.toThrow('Failed to retrieve dashboard statistics');
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics for specified time period', async () => {
      mockKnex.first
        .mockResolvedValueOnce({ value: 45.2 })    // CPU usage
        .mockResolvedValueOnce({ value: 67.8 })    // Memory usage
        .mockResolvedValueOnce({ value: 23.1 })    // Disk usage
        .mockResolvedValueOnce({ avg_value: '120.5' }) // API response time
        .mockResolvedValueOnce({ avg_value: '0.5' });  // Error rate

      const result = await AdminSystemService.getSystemMetrics(24);

      expect(result).toEqual({
        cpu_usage: 45.2,
        memory_usage: 67.8,
        disk_usage: 23.1,
        api_response_time: 120.5,
        error_rate: 0.5,
        uptime: expect.any(Number)
      });
    });
  });
});