import { redisService } from '../../src/services/redisService';

// Mock the redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    setEx: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    keys: jest.fn(),
    sAdd: jest.fn(),
    sIsMember: jest.fn(),
    sRem: jest.fn(),
    sMembers: jest.fn(),
    ping: jest.fn(),
    isReady: true
  }))
}));

describe('RedisService', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mocked client instance
    mockClient = (redisService as any).client;
  });

  describe('connect', () => {
    it('should connect to Redis successfully', async () => {
      mockClient.connect.mockResolvedValue(undefined);

      await redisService.connect();

      expect(mockClient.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockClient.connect.mockRejectedValue(error);

      await expect(redisService.connect()).rejects.toThrow('Connection failed');
    });

    it('should not connect if already connected', async () => {
      // Simulate already connected state
      (redisService as any).isConnected = true;
      
      await redisService.connect();

      expect(mockClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Redis successfully', async () => {
      (redisService as any).isConnected = true;
      mockClient.disconnect.mockResolvedValue(undefined);

      await redisService.disconnect();

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnection errors', async () => {
      (redisService as any).isConnected = true;
      mockClient.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      // Should not throw
      await expect(redisService.disconnect()).resolves.not.toThrow();
    });
  });

  describe('set', () => {
    it('should set a key-value pair without expiration', async () => {
      mockClient.set.mockResolvedValue('OK');

      await redisService.set('test-key', 'test-value');

      expect(mockClient.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should set a key-value pair with expiration', async () => {
      mockClient.setEx.mockResolvedValue('OK');

      await redisService.set('test-key', 'test-value', 3600);

      expect(mockClient.setEx).toHaveBeenCalledWith('test-key', 3600, 'test-value');
    });

    it('should handle set errors', async () => {
      mockClient.set.mockRejectedValue(new Error('Set failed'));

      await expect(redisService.set('test-key', 'test-value'))
        .rejects.toThrow('Set failed');
    });
  });

  describe('get', () => {
    it('should get a value by key', async () => {
      mockClient.get.mockResolvedValue('test-value');

      const result = await redisService.get('test-key');

      expect(result).toBe('test-value');
      expect(mockClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent keys', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await redisService.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should handle get errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Get failed'));

      await expect(redisService.get('test-key'))
        .rejects.toThrow('Get failed');
    });
  });

  describe('del', () => {
    it('should delete a key', async () => {
      mockClient.del.mockResolvedValue(1);

      const result = await redisService.del('test-key');

      expect(result).toBe(1);
      expect(mockClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should handle delete errors', async () => {
      mockClient.del.mockRejectedValue(new Error('Delete failed'));

      await expect(redisService.del('test-key'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockClient.exists.mockResolvedValue(1);

      const result = await redisService.exists('test-key');

      expect(result).toBe(true);
      expect(mockClient.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false if key does not exist', async () => {
      mockClient.exists.mockResolvedValue(0);

      const result = await redisService.exists('test-key');

      expect(result).toBe(false);
    });

    it('should handle exists errors', async () => {
      mockClient.exists.mockRejectedValue(new Error('Exists failed'));

      await expect(redisService.exists('test-key'))
        .rejects.toThrow('Exists failed');
    });
  });

  describe('expire', () => {
    it('should set expiration for a key', async () => {
      mockClient.expire.mockResolvedValue(true);

      const result = await redisService.expire('test-key', 3600);

      expect(result).toBe(true);
      expect(mockClient.expire).toHaveBeenCalledWith('test-key', 3600);
    });

    it('should handle expire errors', async () => {
      mockClient.expire.mockRejectedValue(new Error('Expire failed'));

      await expect(redisService.expire('test-key', 3600))
        .rejects.toThrow('Expire failed');
    });
  });

  describe('keys', () => {
    it('should return keys matching pattern', async () => {
      const keys = ['key1', 'key2', 'key3'];
      mockClient.keys.mockResolvedValue(keys);

      const result = await redisService.keys('test:*');

      expect(result).toEqual(keys);
      expect(mockClient.keys).toHaveBeenCalledWith('test:*');
    });

    it('should handle keys errors', async () => {
      mockClient.keys.mockRejectedValue(new Error('Keys failed'));

      await expect(redisService.keys('test:*'))
        .rejects.toThrow('Keys failed');
    });
  });

  describe('set operations', () => {
    describe('sadd', () => {
      it('should add member to set', async () => {
        mockClient.sAdd.mockResolvedValue(1);

        const result = await redisService.sadd('test-set', 'member1');

        expect(result).toBe(1);
        expect(mockClient.sAdd).toHaveBeenCalledWith('test-set', 'member1');
      });
    });

    describe('sismember', () => {
      it('should check if member exists in set', async () => {
        mockClient.sIsMember.mockResolvedValue(true);

        const result = await redisService.sismember('test-set', 'member1');

        expect(result).toBe(true);
        expect(mockClient.sIsMember).toHaveBeenCalledWith('test-set', 'member1');
      });
    });

    describe('srem', () => {
      it('should remove member from set', async () => {
        mockClient.sRem.mockResolvedValue(1);

        const result = await redisService.srem('test-set', 'member1');

        expect(result).toBe(1);
        expect(mockClient.sRem).toHaveBeenCalledWith('test-set', 'member1');
      });
    });

    describe('smembers', () => {
      it('should get all members of set', async () => {
        const members = ['member1', 'member2', 'member3'];
        mockClient.sMembers.mockResolvedValue(members);

        const result = await redisService.smembers('test-set');

        expect(result).toEqual(members);
        expect(mockClient.sMembers).toHaveBeenCalledWith('test-set');
      });
    });
  });

  describe('ping', () => {
    it('should ping Redis server', async () => {
      mockClient.ping.mockResolvedValue('PONG');

      const result = await redisService.ping();

      expect(result).toBe('PONG');
      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('should handle ping errors', async () => {
      mockClient.ping.mockRejectedValue(new Error('Ping failed'));

      await expect(redisService.ping())
        .rejects.toThrow('Ping failed');
    });
  });

  describe('isReady', () => {
    it('should return connection status', () => {
      (redisService as any).isConnected = true;
      mockClient.isReady = true;

      const result = redisService.isReady();

      expect(result).toBe(true);
    });

    it('should return false when not connected', () => {
      (redisService as any).isConnected = false;

      const result = redisService.isReady();

      expect(result).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return Redis client instance', () => {
      const client = redisService.getClient();

      expect(client).toBe(mockClient);
    });
  });
});