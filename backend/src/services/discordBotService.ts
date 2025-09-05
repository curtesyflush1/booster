import { Client, GatewayIntentBits, TextChannel, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger';

// Type definitions
interface AlertFilters {
  retailers?: string[];
  categories?: string[];
  priceRange?: { min?: number; max?: number };
  keywords?: string[];
}

interface DiscordServerConfig {
  id: string;
  serverId: string;
  channelId: string;
  token: string;
  userId: string;
  alertFilters: AlertFilters;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface DiscordAlert {
  productName: string;
  retailerName: string;
  price: number;
  originalPrice?: number;
  availability: string;
  cartUrl?: string;
  productUrl: string;
  imageUrl?: string;
}

interface ServerStats {
  isConnected: boolean;
  memberCount?: number;
  channelName?: string;
  lastAlert?: Date;
}

// Constants for better maintainability
const DISCORD_CONFIG = {
  EMBED_COLOR: 0x3B82F6,
  FOOTER_TEXT: 'BoosterBeacon Alert System',
  TEST_PRODUCT: {
    name: 'Test Product - Pokémon TCG Booster Pack',
    retailer: 'Test Retailer',
    price: 4.99,
    availability: 'In Stock',
    url: 'https://example.com/test'
  }
} as const;

/**
 * Discord Bot Service for sending Pokémon TCG alerts to Discord servers
 * Handles server configuration, alert filtering, and message delivery
 */
export class DiscordBotService {
  private client: Client;
  private isInitialized = false;
  private serverConfigs: Map<string, DiscordServerConfig> = new Map();

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.setupEventHandlers();
  }

  /**
   * Set up Discord client event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
      this.isInitialized = true;
    });

    this.client.on('error', (error: Error) => {
      logger.error('Discord bot error:', error);
    });

    this.client.on('disconnect', () => {
      logger.warn('Discord bot disconnected');
      this.isInitialized = false;
    });
  }

  /**
   * Initialize the Discord bot with authentication token
   */
  async initialize(botToken: string): Promise<void> {
    if (!botToken) {
      throw new Error('Discord bot token is required');
    }

    try {
      await this.client.login(botToken);
      logger.info('Discord bot service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Discord bot:', error);
      throw error;
    }
  }

  /**
   * Add a new Discord server configuration
   */
  async addServerConfig(
    config: Omit<DiscordServerConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DiscordServerConfig> {
    const serverConfig: DiscordServerConfig = {
      ...config,
      id: this.generateConfigId(config.serverId),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.serverConfigs.set(serverConfig.serverId, serverConfig);

    // Verify bot has access to the server and channel
    await this.verifyServerAccess(serverConfig);

    logger.info(`Added Discord server config for server ${config.serverId}`);
    return serverConfig;
  }

  /**
   * Remove a Discord server configuration
   */
  async removeServerConfig(serverId: string): Promise<void> {
    if (!this.serverConfigs.has(serverId)) {
      throw new Error(`Discord server config not found for server ${serverId}`);
    }

    this.serverConfigs.delete(serverId);
    logger.info(`Removed Discord server config for server ${serverId}`);
  }

  /**
   * Update an existing Discord server configuration
   */
  async updateServerConfig(
    serverId: string, 
    updates: Partial<DiscordServerConfig>
  ): Promise<DiscordServerConfig> {
    const existing = this.serverConfigs.get(serverId);
    if (!existing) {
      throw new Error(`Discord server config not found for server ${serverId}`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    this.serverConfigs.set(serverId, updated);
    logger.info(`Updated Discord server config for server ${serverId}`);
    return updated;
  }

  /**
   * Get a specific Discord server configuration
   */
  async getServerConfig(serverId: string): Promise<DiscordServerConfig | null> {
    return this.serverConfigs.get(serverId) || null;
  }

  /**
   * Get all Discord server configurations
   */
  async getAllServerConfigs(): Promise<DiscordServerConfig[]> {
    return Array.from(this.serverConfigs.values());
  }

  /**
   * Send alert to Discord servers based on filters
   */
  async sendAlert(alert: DiscordAlert, serverId?: string): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Discord bot not initialized, skipping alert');
      return;
    }

    const configs = this.getTargetConfigs(serverId);
    const results = await Promise.allSettled(
      configs.map(config => this.processAlertForConfig(alert, config))
    );

    this.logAlertResults(results, configs);
  }

  /**
   * Test connection to a Discord server
   */
  async testConnection(serverId: string): Promise<boolean> {
    try {
      const config = this.serverConfigs.get(serverId);
      if (!config) {
        return false;
      }

      await this.verifyServerAccess(config);

      const testAlert: DiscordAlert = {
        productName: DISCORD_CONFIG.TEST_PRODUCT.name,
        retailerName: DISCORD_CONFIG.TEST_PRODUCT.retailer,
        price: DISCORD_CONFIG.TEST_PRODUCT.price,
        availability: DISCORD_CONFIG.TEST_PRODUCT.availability,
        productUrl: DISCORD_CONFIG.TEST_PRODUCT.url
      };

      await this.sendAlertToChannel(testAlert, config);
      return true;
    } catch (error) {
      logger.error(`Discord connection test failed for server ${serverId}:`, error);
      return false;
    }
  }

  /**
   * Get statistics for a Discord server
   */
  async getServerStats(serverId: string): Promise<ServerStats> {
    try {
      const config = this.serverConfigs.get(serverId);
      if (!config || !this.isInitialized) {
        return { isConnected: false };
      }

      const guild = await this.client.guilds.fetch(config.serverId);
      const channel = await guild.channels.fetch(config.channelId) as TextChannel;

      return {
        isConnected: true,
        memberCount: guild.memberCount,
        channelName: channel?.name,
        // lastAlert would be tracked in database in real implementation
      };
    } catch (error) {
      logger.error(`Failed to get Discord server stats:`, error);
      return { isConnected: false };
    }
  }

  /**
   * Shutdown the Discord bot service
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.isInitialized = false;
      logger.info('Discord bot service shut down');
    }
  }

  // Private helper methods

  /**
   * Generate a unique configuration ID
   */
  private generateConfigId(serverId: string): string {
    return `discord_${serverId}_${Date.now()}`;
  }

  /**
   * Get target configurations for alert sending
   */
  private getTargetConfigs(serverId?: string): DiscordServerConfig[] {
    if (serverId) {
      const config = this.serverConfigs.get(serverId);
      return config ? [config] : [];
    }
    return Array.from(this.serverConfigs.values()).filter(config => config.isActive);
  }

  /**
   * Process alert for a specific configuration
   */
  private async processAlertForConfig(
    alert: DiscordAlert, 
    config: DiscordServerConfig
  ): Promise<void> {
    if (!this.shouldSendAlert(alert, config.alertFilters)) {
      return;
    }

    await this.sendAlertToChannel(alert, config);
    logger.info(`Sent Discord alert to server ${config.serverId}`);
  }

  /**
   * Log results of alert sending operations
   */
  private logAlertResults(
    results: PromiseSettledResult<void>[], 
    configs: DiscordServerConfig[]
  ): void {
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      logger.warn(`Failed to send Discord alerts to ${failures.length}/${configs.length} servers`);
    }
  }

  /**
   * Verify bot has access to Discord server and channel
   */
  private async verifyServerAccess(config: DiscordServerConfig): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Discord bot not initialized');
    }

    try {
      const guild = await this.client.guilds.fetch(config.serverId);
      const channel = await guild.channels.fetch(config.channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${config.channelId} not found or not a text channel`);
      }

      logger.info(`Verified access to Discord server ${config.serverId} and channel ${config.channelId}`);
    } catch (error) {
      logger.error(`Failed to verify Discord server access:`, error);
      throw error;
    }
  }

  /**
   * Check if alert should be sent based on filters
   */
  private shouldSendAlert(alert: DiscordAlert, filters: AlertFilters): boolean {
    return this.passesRetailerFilter(alert, filters) &&
           this.passesPriceRangeFilter(alert, filters) &&
           this.passesKeywordFilter(alert, filters);
  }

  /**
   * Check retailer filter
   */
  private passesRetailerFilter(alert: DiscordAlert, filters: AlertFilters): boolean {
    if (!filters.retailers || filters.retailers.length === 0) {
      return true;
    }
    return filters.retailers.includes(alert.retailerName.toLowerCase());
  }

  /**
   * Check price range filter
   */
  private passesPriceRangeFilter(alert: DiscordAlert, filters: AlertFilters): boolean {
    if (!filters.priceRange) {
      return true;
    }

    const { min, max } = filters.priceRange;
    if (min && alert.price < min) return false;
    if (max && alert.price > max) return false;
    
    return true;
  }

  /**
   * Check keyword filter
   */
  private passesKeywordFilter(alert: DiscordAlert, filters: AlertFilters): boolean {
    if (!filters.keywords || filters.keywords.length === 0) {
      return true;
    }

    const productNameLower = alert.productName.toLowerCase();
    return filters.keywords.some(keyword =>
      productNameLower.includes(keyword.toLowerCase())
    );
  }

  /**
   * Send alert to specific Discord channel
   */
  private async sendAlertToChannel(alert: DiscordAlert, config: DiscordServerConfig): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(config.serverId);
      const channel = await guild.channels.fetch(config.channelId) as TextChannel;

      if (!channel) {
        throw new Error(`Channel ${config.channelId} not found`);
      }

      const embed = this.createAlertEmbed(alert);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      logger.error(`Failed to send alert to Discord channel:`, error);
      throw error;
    }
  }

  /**
   * Create Discord embed for alert
   */
  private createAlertEmbed(alert: DiscordAlert): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('🚨 Pokémon TCG Restock Alert!')
      .setDescription(`**${alert.productName}** is now available!`)
      .setColor(DISCORD_CONFIG.EMBED_COLOR)
      .addFields([
        { name: '🏪 Retailer', value: alert.retailerName, inline: true },
        { name: '💰 Price', value: `$${alert.price.toFixed(2)}`, inline: true },
        { name: '📦 Status', value: alert.availability, inline: true }
      ])
      .setTimestamp()
      .setFooter({ text: DISCORD_CONFIG.FOOTER_TEXT });

    this.addDiscountField(embed, alert);
    this.addImageField(embed, alert);
    this.addActionFields(embed, alert);

    return embed;
  }

  /**
   * Add discount field to embed if applicable
   */
  private addDiscountField(embed: EmbedBuilder, alert: DiscordAlert): void {
    if (alert.originalPrice && alert.originalPrice !== alert.price) {
      const discount = ((alert.originalPrice - alert.price) / alert.originalPrice * 100).toFixed(1);
      embed.addFields([
        { 
          name: '🔥 Discount', 
          value: `${discount}% off (was $${alert.originalPrice.toFixed(2)})`, 
          inline: false 
        }
      ]);
    }
  }

  /**
   * Add image field to embed if available
   */
  private addImageField(embed: EmbedBuilder, alert: DiscordAlert): void {
    if (alert.imageUrl) {
      embed.setThumbnail(alert.imageUrl);
    }
  }

  /**
   * Add action fields (cart and product links) to embed
   */
  private addActionFields(embed: EmbedBuilder, alert: DiscordAlert): void {
    const actionFields = [];

    if (alert.cartUrl) {
      actionFields.push({
        name: '🛒 Quick Purchase',
        value: `[Add to Cart](${alert.cartUrl})`,
        inline: true
      });
    }

    actionFields.push({
      name: '🔗 Product Page',
      value: `[View Product](${alert.productUrl})`,
      inline: true
    });

    embed.addFields(actionFields);
  }
}

export const discordBotService = new DiscordBotService();
export default DiscordBotService;

// CommonJS compatibility for ts-jest environments that expect named constructors
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  try {
    (module as any).exports = {
      ...(module as any).exports,
      DiscordBotService,
      discordBotService,
      default: DiscordBotService,
    };
  } catch { /* noop */ }
}
