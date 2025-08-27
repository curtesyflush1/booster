/**
 * Test Data Factory - Provides consistent, reusable test data creation
 * Following the Factory Pattern for better maintainability
 */

import { IUser, IProduct, IWatch, IWatchPack, IUserWatchPack } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

export class TestDataFactory {
  private static userCounter = 0;
  private static productCounter = 0;

  // Ensure unique values across test runs
  private static getUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Creates user data with sensible defaults and optional overrides
   */
  static createUserData(overrides: Partial<IUser> = {}): Partial<IUser> {
    this.userCounter++;
    const uniqueId = this.getUniqueId();

    return {
      email: `test-${uniqueId}@example.com`,
      password_hash: 'hashed-password-123',
      subscription_tier: SubscriptionTier.FREE,
      first_name: 'Test',
      last_name: `User${this.userCounter}`,
      email_verified: true,
      failed_login_attempts: 0,
      shipping_addresses: [],
      payment_methods: [],
      retailer_credentials: {},
      notification_settings: {
        web_push: true,
        email: true,
        sms: false,
        discord: false
      },
      quiet_hours: {
        enabled: false,
        start_time: '22:00',
        end_time: '08:00',
        timezone: 'UTC',
        days: []
      },
      timezone: 'UTC',
      preferences: {},
      ...overrides
    };
  }

  /**
   * Creates product data with sensible defaults and optional overrides
   */
  static createProductData(overrides: Partial<IProduct> = {}): Partial<IProduct> {
    this.productCounter++;
    const name = overrides.name || `Test Product ${this.productCounter}`;

    // Generate deterministic UPC for testing
    const timestamp = Date.now().toString();
    const upc = timestamp.substring(timestamp.length - 12).padStart(12, '0');

    return {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      upc,
      sku: `SKU-${this.productCounter.toString().padStart(6, '0')}`,
      msrp: 99.99,
      set_name: 'Test Set',
      series: 'Test Series',
      description: `Description for ${name}`,
      is_active: true,
      popularity_score: 50,
      metadata: {},
      ...overrides
    };
  }

  /**
   * Creates watch data with sensible defaults
   */
  static createWatchData(
    userId: string,
    productId: string,
    overrides: Partial<IWatch> = {}
  ): Partial<IWatch> {
    return {
      user_id: userId,
      product_id: productId,
      retailer_ids: ['retailer-1'],
      availability_type: 'both',
      is_active: true,
      alert_preferences: {
        email: true,
        push: true
      },
      alert_count: 0,
      ...overrides
    };
  }

  /**
   * Creates watch pack data with sensible defaults
   */
  static createWatchPackData(
    productIds: string[],
    overrides: Partial<IWatchPack> = {}
  ): Partial<IWatchPack> {
    const name = overrides.name || `Test Watch Pack ${Date.now()}`;

    return {
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      description: `Description for ${name}`,
      product_ids: productIds,
      is_active: true,
      auto_update: true,
      subscriber_count: 0,
      ...overrides
    };
  }

  /**
   * Creates user watch pack subscription data
   */
  static createUserWatchPackData(
    userId: string,
    watchPackId: string,
    overrides: Partial<IUserWatchPack> = {}
  ): Partial<IUserWatchPack> {
    return {
      user_id: userId,
      watch_pack_id: watchPackId,
      customizations: {
        alert_preferences: {
          email: true,
          push: false
        }
      },
      is_active: true,
      ...overrides
    };
  }

  /**
   * Reset counters for clean test runs
   */
  static reset(): void {
    this.userCounter = 0;
    this.productCounter = 0;
  }

  /**
   * Creates multiple products efficiently
   */
  static createMultipleProductsData(count: number, namePrefix = 'Test Product'): Partial<IProduct>[] {
    return Array.from({ length: count }, (_, i) =>
      this.createProductData({ name: `${namePrefix} ${i + 1}` })
    );
  }

  /**
   * Creates realistic Pokemon TCG product data
   */
  static createPokemonProductData(overrides: Partial<IProduct> = {}): Partial<IProduct> {
    const sets = ['Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Gym Heroes'];
    const series = ['Classic', 'Neo', 'E-Card', 'EX', 'Diamond & Pearl'];
    const randomSet = sets[Math.floor(Math.random() * sets.length)];
    const randomSeries = series[Math.floor(Math.random() * series.length)];

    return this.createProductData({
      set_name: randomSet,
      series: randomSeries,
      msrp: Math.floor(Math.random() * 200) + 50, // $50-$250
      popularity_score: Math.floor(Math.random() * 100),
      metadata: {
        card_count: Math.floor(Math.random() * 300) + 100,
        rarity: ['Common', 'Uncommon', 'Rare', 'Ultra Rare'][Math.floor(Math.random() * 4)]
      },
      ...overrides
    });
  }
}