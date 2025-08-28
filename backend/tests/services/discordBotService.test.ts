import { DiscordBotService } from '../../src/services/discordBotService';

// Mock discord.js
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    login: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    guilds: {
      fetch: jest.fn().mockResolvedValue({
        channels: {
          fetch: jest.fn().mockResolvedValue({
            isTextBased: () => true,
            send: jest.fn().mockResolvedValue(undefined),
            name: 'test-channel'
          })
        },
        memberCount: 100
      })
    },
    user: { tag: 'TestBot#1234' }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4
  },
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis()
  }))
}));

describe('DiscordBotService', () => {
  let discordBotService: DiscordBotService;

  beforeEach(() => {
    discordBotService = new DiscordBotService();
    jest.clearAllMocks();
  });

  describe('addServerConfig', () => {
    it('should add Discord server configuration', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {
          retailers: ['best buy', 'walmart'],
          priceRange: { max: 50 }
        },
        isActive: true
      };

      // Initialize the service first
      await discordBotService.initialize('test-token');

      const result = await discordBotService.addServerConfig(config);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.serverId).toBe(config.serverId);
      expect(result.channelId).toBe(config.channelId);
      expect(result.alertFilters).toEqual(config.alertFilters);
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('getServerConfig', () => {
    it('should retrieve server configuration', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {},
        isActive: true
      };

      await discordBotService.initialize('test-token');
      const added = await discordBotService.addServerConfig(config);
      
      const retrieved = await discordBotService.getServerConfig(config.serverId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(added.id);
      expect(retrieved?.serverId).toBe(config.serverId);
    });

    it('should return null for non-existent server', async () => {
      const result = await discordBotService.getServerConfig('nonexistent-server');
      expect(result).toBeNull();
    });
  });

  describe('updateServerConfig', () => {
    it('should update server configuration', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {},
        isActive: true
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      const updates = {
        alertFilters: { retailers: ['target'] },
        isActive: false
      };

      const updated = await discordBotService.updateServerConfig(config.serverId, updates);

      expect(updated.alertFilters).toEqual(updates.alertFilters);
      expect(updated.isActive).toBe(false);
      expect(updated.updatedAt).toBeDefined();
    });

    it('should throw error for non-existent server', async () => {
      await expect(
        discordBotService.updateServerConfig('nonexistent-server', {})
      ).rejects.toThrow('Discord server config not found');
    });
  });

  describe('removeServerConfig', () => {
    it('should remove server configuration', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {},
        isActive: true
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      await discordBotService.removeServerConfig(config.serverId);

      const retrieved = await discordBotService.getServerConfig(config.serverId);
      expect(retrieved).toBeNull();
    });
  });

  describe('sendAlert', () => {
    it('should send alert to configured servers', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {
          retailers: ['best buy']
        },
        isActive: true
      };

      const alert = {
        productName: 'Pokemon TCG Booster Pack',
        retailerName: 'best buy',
        price: 4.99,
        availability: 'In Stock',
        productUrl: 'https://example.com/product'
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      // Should not throw
      await expect(discordBotService.sendAlert(alert)).resolves.not.toThrow();
    });

    it('should filter alerts based on retailer', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {
          retailers: ['walmart'] // Only walmart alerts
        },
        isActive: true
      };

      const alert = {
        productName: 'Pokemon TCG Booster Pack',
        retailerName: 'best buy', // Different retailer
        price: 4.99,
        availability: 'In Stock',
        productUrl: 'https://example.com/product'
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      // Should not send alert due to retailer filter
      await expect(discordBotService.sendAlert(alert)).resolves.not.toThrow();
    });

    it('should filter alerts based on price range', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {
          priceRange: { max: 10 }
        },
        isActive: true
      };

      const alert = {
        productName: 'Pokemon TCG Booster Pack',
        retailerName: 'best buy',
        price: 15.99, // Above max price
        availability: 'In Stock',
        productUrl: 'https://example.com/product'
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      // Should not send alert due to price filter
      await expect(discordBotService.sendAlert(alert)).resolves.not.toThrow();
    });

    it('should filter alerts based on keywords', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {
          keywords: ['charizard', 'pikachu']
        },
        isActive: true
      };

      const alert = {
        productName: 'Pokemon TCG Booster Pack', // No matching keywords
        retailerName: 'best buy',
        price: 4.99,
        availability: 'In Stock',
        productUrl: 'https://example.com/product'
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      // Should not send alert due to keyword filter
      await expect(discordBotService.sendAlert(alert)).resolves.not.toThrow();
    });
  });

  describe('testConnection', () => {
    it('should test Discord connection successfully', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {},
        isActive: true
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      const result = await discordBotService.testConnection(config.serverId);
      expect(result).toBe(true);
    });

    it('should return false for non-existent server', async () => {
      const result = await discordBotService.testConnection('nonexistent-server');
      expect(result).toBe(false);
    });
  });

  describe('getServerStats', () => {
    it('should return server statistics', async () => {
      const config = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token',
        userId: 'user-123',
        alertFilters: {},
        isActive: true
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config);

      const stats = await discordBotService.getServerStats(config.serverId);

      expect(stats).toBeDefined();
      expect(stats.isConnected).toBe(true);
      expect(typeof stats.memberCount).toBe('number');
      expect(typeof stats.channelName).toBe('string');
    });

    it('should return disconnected for non-existent server', async () => {
      const stats = await discordBotService.getServerStats('nonexistent-server');
      expect(stats.isConnected).toBe(false);
    });
  });

  describe('getAllServerConfigs', () => {
    it('should return all server configurations', async () => {
      const config1 = {
        serverId: '123456789012345678',
        channelId: '987654321098765432',
        token: 'test-bot-token-1',
        userId: 'user-123',
        alertFilters: {},
        isActive: true
      };

      const config2 = {
        serverId: '876543210987654321',
        channelId: '123456789012345678',
        token: 'test-bot-token-2',
        userId: 'user-456',
        alertFilters: {},
        isActive: true
      };

      await discordBotService.initialize('test-token');
      await discordBotService.addServerConfig(config1);
      await discordBotService.addServerConfig(config2);

      const allConfigs = await discordBotService.getAllServerConfigs();

      expect(allConfigs).toHaveLength(2);
      expect(allConfigs.some(c => c.serverId === config1.serverId)).toBe(true);
      expect(allConfigs.some(c => c.serverId === config2.serverId)).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should shutdown Discord bot service', async () => {
      await discordBotService.initialize('test-token');
      
      await expect(discordBotService.shutdown()).resolves.not.toThrow();
    });
  });
});