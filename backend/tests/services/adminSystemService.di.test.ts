import { AdminSystemService } from '../../src/services/adminSystemService';
import { ISystemRepository, ILogger } from '../../src/types/dependencies';

describe('AdminSystemService - Dependency Injection', () => {
  let adminSystemService: AdminSystemService;
  let mockSystemRepository: jest.Mocked<ISystemRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Create mock dependencies
    mockSystemRepository = {
      recordHealthCheck: jest.fn(),
      getSystemHealth: jest.fn(),
      recordMetric: jest.fn(),
      getSystemMetrics: jest.fn(),
      getUserStatistics: jest.fn(),
      getAlertStatistics: jest.fn(),
      getMLModelStatistics: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Inject dependencies
    adminSystemService = new AdminSystemService(mockSystemRepository, mockLogger);
  });

  describe('getSystemHealth', () => {
    it('should get system health using injected repository', async () => {
      // Arrange
      const mockHealthData = [
        {
          service_name: 'api',
          status: 'healthy',
          metrics: { response_time: 100 },
          checked_at: new Date()
        }
      ];
      mockSystemRepository.getSystemHealth.mockResolvedValue(mockHealthData);

      // Act
      const result = await adminSystemService.getSystemHealth();

      // Assert
      expect(mockSystemRepository.getSystemHealth).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].service_name).toBe('api');
      expect(result[0].status).toBe('healthy');
    });

    it('should handle errors and log them', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockSystemRepository.getSystemHealth.mockRejectedValue(error);

      // Act & Assert
      await expect(adminSystemService.getSystemHealth()).rejects.toThrow('Failed to retrieve system health');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get system health',
        expect.objectContaining({
          error: 'Database connection failed',
          operation: 'getSystemHealth'
        })
      );
    });
  });

  describe('recordHealthCheck', () => {
    it('should record health check using injected repository', async () => {
      // Arrange
      const serviceName = 'api';
      const status = 'healthy';
      const metrics = { response_time: 100 };
      const message = 'All systems operational';

      mockSystemRepository.recordHealthCheck.mockResolvedValue();

      // Act
      await adminSystemService.recordHealthCheck(serviceName, status, metrics, message);

      // Assert
      expect(mockSystemRepository.recordHealthCheck).toHaveBeenCalledWith(
        serviceName,
        status,
        metrics,
        message
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Health check recorded',
        expect.objectContaining({
          serviceName,
          status,
          metrics
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const error = new Error('Insert failed');
      mockSystemRepository.recordHealthCheck.mockRejectedValue(error);

      // Act
      await adminSystemService.recordHealthCheck('api', 'healthy');

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record health check',
        expect.objectContaining({
          error: 'Insert failed',
          serviceName: 'api',
          status: 'healthy'
        })
      );
    });
  });

  describe('getSystemMetrics', () => {
    it('should get system metrics using injected repository', async () => {
      // Arrange
      const mockMetrics = {
        cpuMetric: { usage: 45.5, loadAverage: [0.1, 0.2, 0.3], timestamp: new Date() },
        memoryMetric: { percentage: 67.2, usedMB: 1024, totalMB: 2048, timestamp: new Date() },
        diskMetric: { percentage: 23.1, usedGB: 50, totalGB: 500, timestamp: new Date() },
        responseTimeMetric: { average: 150.5, p95: 200.1, count: 1000 },
        errorRateMetric: { rate: 0.1 }
      } as any;
      mockSystemRepository.getSystemMetrics.mockResolvedValue(mockMetrics);

      // Act
      const result = await adminSystemService.getSystemMetrics(24);

      // Assert
      expect(mockSystemRepository.getSystemMetrics).toHaveBeenCalledWith(
        expect.any(Date)
      );
      expect(result.cpu_usage).toBe(45.5);
      expect(result.memory_usage).toBe(67.2);
      expect(result.disk_usage).toBe(23.1);
      expect(result.api_response_time).toBe(150.5);
      expect(result.error_rate).toBe(0.1);
      expect(typeof result.uptime).toBe('number');
    });

    it('should validate hours parameter', async () => {
      // Act & Assert
      await expect(adminSystemService.getSystemMetrics(-1)).rejects.toThrow(
        'Invalid hours parameter. Must be between 0 and 8760'
      );
      await expect(adminSystemService.getSystemMetrics(9000)).rejects.toThrow(
        'Invalid hours parameter. Must be between 0 and 8760'
      );
    });
  });

  describe('recordMetric', () => {
    it('should record metric using injected repository', async () => {
      // Arrange
      mockSystemRepository.recordMetric.mockResolvedValue();

      // Act
      await adminSystemService.recordMetric('cpu_usage', 'gauge', 45.5, { host: 'server1' });

      // Assert
      expect(mockSystemRepository.recordMetric).toHaveBeenCalledWith(
        'cpu_usage',
        'gauge',
        45.5,
        { host: 'server1' }
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const error = new Error('Metric recording failed');
      mockSystemRepository.recordMetric.mockRejectedValue(error);

      // Act
      await adminSystemService.recordMetric('cpu_usage', 'gauge', 45.5);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record metric',
        expect.objectContaining({
          error: 'Metric recording failed',
          metricName: 'cpu_usage',
          value: 45.5
        })
      );
    });
  });

  describe('getDashboardStats', () => {
    it('should get comprehensive dashboard stats', async () => {
      // Arrange
      mockSystemRepository.getUserStatistics.mockResolvedValue({
        totalUsers: 100,
        activeUsers: 85,
        newToday: 5,
        newThisWeek: 20,
        proUsers: 15
      });

      mockSystemRepository.getAlertStatistics.mockResolvedValue({
        totalAlerts: 500,
        alertsToday: 25,
        pendingAlerts: 3,
        failedAlerts: 2,
        avgDeliveryTime: 5.5
      });

      mockSystemRepository.getMLModelStatistics.mockResolvedValue({
        activeModels: 3,
        trainingModels: 1,
        lastTraining: new Date('2023-01-01')
      });

      mockSystemRepository.getSystemMetrics.mockResolvedValue({
        cpuMetric: { usage: 45.5 },
        memoryMetric: { percentage: 67.2 },
        diskMetric: { percentage: 23.1 },
        responseTimeMetric: { average: 150.5 },
        errorRateMetric: { rate: 0.1 }
      } as any);

      // Act
      const result = await adminSystemService.getDashboardStats();

      // Assert
      expect(result.users.total).toBe(100);
      expect(result.users.conversion_rate).toBe(15); // 15/100 * 100
      expect(result.alerts.total_sent).toBe(500);
      expect(result.alerts.success_rate).toBe(99.6); // (500-2)/500 * 100
      expect(result.ml_models.active_models).toBe(3);
      expect(result.system.cpu_usage).toBe(45.5);
    });
  });
});
