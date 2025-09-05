import { healthCheckService } from '../../src/services/healthCheckService';
import { db } from '../../src/config/database';

// Mock database
jest.mock('../../src/config/database');

describe('HealthCheckService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Health Check', () => {
    it('should pass when database is healthy', async () => {
      (db.raw as jest.Mock).mockResolvedValue([]);
      (db as any).mockReturnValue({
        count: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ count: '100' })
        })
      });

      const result = await (healthCheckService as any).checkDatabase();

      expect(result.status).toBe('pass');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.details?.userCount).toBe('100');
    });

    it('should fail when database is unreachable', async () => {
      (db.raw as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      const result = await (healthCheckService as any).checkDatabase();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Database check failed');
    });

    it('should warn when database is slow', async () => {
      (db.raw as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 3000))
      );
      (db as any).mockReturnValue({
        count: jest.fn().mockReturnValue({
          first: jest.fn().mockResolvedValue({ count: '100' })
        })
      });

      const result = await (healthCheckService as any).checkDatabase();

      expect(result.status).toBe('warn');
      expect(result.message).toContain('slow');
    });
  });

  describe('Memory Health Check', () => {
    it('should pass with normal memory usage', async () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = (jest.fn().mockReturnValue({
        rss: 150 * 1024 * 1024, // 150MB
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 200 * 1024 * 1024, // 200MB
        external: 50 * 1024 * 1024, // 50MB
        arrayBuffers: 10 * 1024 * 1024 // 10MB
      }) as unknown) as typeof process.memoryUsage;

      // Mock os.totalmem to return 8GB
      jest.doMock('os', () => ({
        totalmem: () => 8 * 1024 * 1024 * 1024
      }));

      const result = await (healthCheckService as any).checkMemory();

      expect(result.status).toBe('pass');
      expect(result.details?.percentage).toBeLessThan(75);

      process.memoryUsage = originalMemoryUsage;
    });

    it('should warn with high memory usage', async () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = (jest.fn().mockReturnValue({
        rss: 1000 * 1024 * 1024, // ~1000MB
        heapUsed: 800 * 1024 * 1024, // 800MB
        heapTotal: 900 * 1024 * 1024, // 900MB
        external: 100 * 1024 * 1024, // 100MB
        arrayBuffers: 50 * 1024 * 1024 // 50MB
      }) as unknown) as typeof process.memoryUsage;

      // Mock os.totalmem to return 1GB (so 800MB is 80%)
      jest.doMock('os', () => ({
        totalmem: () => 1024 * 1024 * 1024
      }));

      const result = await (healthCheckService as any).checkMemory();

      expect(result.status).toBe('warn');
      expect(result.message).toContain('High memory usage');

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Comprehensive Health Check', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock all checks to pass
      (healthCheckService as any).checkDatabase = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 10
      });
      (healthCheckService as any).checkRedis = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 5
      });
      (healthCheckService as any).checkMemory = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkDisk = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkExternalServices = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 20
      });

      const result = await healthCheckService.performHealthCheck();

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('pass');
      expect(result.checks.redis.status).toBe('pass');
      expect(result.checks.memory.status).toBe('pass');
      expect(result.checks.disk.status).toBe('pass');
      expect(result.checks.external.status).toBe('pass');
    });

    it('should return degraded status when some checks warn', async () => {
      // Mock some checks to warn
      (healthCheckService as any).checkDatabase = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 10
      });
      (healthCheckService as any).checkRedis = jest.fn().mockResolvedValue({
        status: 'warn',
        responseTime: 5,
        message: 'Redis not configured'
      });
      (healthCheckService as any).checkMemory = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkDisk = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkExternalServices = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 20
      });

      const result = await healthCheckService.performHealthCheck();

      expect(result.status).toBe('degraded');
    });

    it('should return unhealthy status when any check fails', async () => {
      // Mock database check to fail
      (healthCheckService as any).checkDatabase = jest.fn().mockResolvedValue({
        status: 'fail',
        responseTime: 0,
        message: 'Database connection failed'
      });
      (healthCheckService as any).checkRedis = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 5
      });
      (healthCheckService as any).checkMemory = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkDisk = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkExternalServices = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 20
      });

      const result = await healthCheckService.performHealthCheck();

      expect(result.status).toBe('unhealthy');
    });

    it('should include system metrics in health check result', async () => {
      // Mock all checks to pass
      (healthCheckService as any).checkDatabase = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 10
      });
      (healthCheckService as any).checkRedis = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 5
      });
      (healthCheckService as any).checkMemory = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkDisk = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 1
      });
      (healthCheckService as any).checkExternalServices = jest.fn().mockResolvedValue({
        status: 'pass',
        responseTime: 20
      });

      const result = await healthCheckService.performHealthCheck();

      expect(result.metrics).toBeDefined();
      expect(result.metrics.memory).toBeDefined();
      expect(result.metrics.cpu).toBeDefined();
      expect(result.metrics.requests).toBeDefined();
      expect(result.metrics.alerts).toBeDefined();
    });
  });

  describe('Request and Alert Metrics Recording', () => {
    it('should record request metrics correctly', () => {
      healthCheckService.recordRequest(100, false);
      healthCheckService.recordRequest(200, true);

      const metrics = (healthCheckService as any).requestMetrics;
      expect(metrics.total).toBe(2);
      expect(metrics.errors).toBe(1);
      expect(metrics.totalResponseTime).toBe(300);
    });

    it('should record alert metrics correctly', () => {
      healthCheckService.recordAlert(true);
      healthCheckService.recordAlert(false);
      healthCheckService.recordAlert(true);

      const metrics = (healthCheckService as any).alertMetrics;
      expect(metrics.sent).toBe(3);
      expect(metrics.failed).toBe(1);
    });
  });
});
