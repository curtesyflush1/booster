import { createAdminSystemService } from '../../src/services/adminSystemService';

describe('AdminSystemService', () => {
  afterEach(() => { jest.clearAllMocks(); });

  describe('getDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      const service = createAdminSystemService({
        systemRepository: {
          getUserStatistics: jest.fn().mockResolvedValue({
            totalUsers: 100,
            activeUsers: 95,
            newToday: 5,
            newThisWeek: 15,
            proUsers: 20
          }),
          getAlertStatistics: jest.fn().mockResolvedValue({
            totalAlerts: 500,
            alertsToday: 25,
            pendingAlerts: 10,
            failedAlerts: 5,
            avgDeliveryTime: 15.5
          }),
          getMLModelStatistics: jest.fn().mockResolvedValue({
            activeModels: 3,
            trainingModels: 1,
            lastTraining: new Date('2024-01-01')
          }),
          getSystemMetrics: jest.fn().mockResolvedValue({
            cpuMetric: { usage: 45.2 },
            memoryMetric: { percentage: 67.8 },
            diskMetric: { percentage: 23.1 },
            responseTimeMetric: { average: 120.5 },
            errorRateMetric: { rate: 0.5 }
          })
        } as any,
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any
      });

      const result = await service.getDashboardStats();

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
          uptime: expect.any(Number),
          cpu_usage: 45.2,
          memory_usage: 67.8,
          disk_usage: 23.1,
          api_response_time: 120.5,
          error_rate: 0.5
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      const service = createAdminSystemService({
        systemRepository: {
          getUserStatistics: jest.fn().mockRejectedValue(new Error('Database connection failed')),
          getAlertStatistics: jest.fn(),
          getMLModelStatistics: jest.fn(),
          getSystemMetrics: jest.fn()
        } as any,
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any
      });

      await expect(service.getDashboardStats()).rejects.toThrow('Failed to retrieve dashboard statistics');
    });
  });

  describe('getSystemMetrics', () => {
    it('should return system metrics for specified time period', async () => {
      const service = createAdminSystemService({
        systemRepository: {
          getSystemMetrics: jest.fn().mockResolvedValue({
            cpuMetric: { usage: 45.2 },
            memoryMetric: { percentage: 67.8 },
            diskMetric: { percentage: 23.1 },
            responseTimeMetric: { average: 120.5 },
            errorRateMetric: { rate: 0.5 }
          })
        } as any,
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any
      });

      const result = await service.getSystemMetrics(24);

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
