import { BaseAlertStrategy, AlertGenerationData, AlertPriority, AlertType } from './AlertProcessingStrategy';

/**
 * Strategy for processing price drop alerts
 */
export class PriceDropAlertStrategy extends BaseAlertStrategy {
  private static readonly SIGNIFICANT_DROP_THRESHOLD = 20; // 20% price drop
  private static readonly MAJOR_DROP_THRESHOLD = 40; // 40% price drop

  override getAlertType(): AlertType {
    return 'price_drop';
  }

  override async calculatePriority(alertData: AlertGenerationData): Promise<AlertPriority> {
    const urgencyScore = await this.calculateUrgencyScore(alertData);
    return this.urgencyToPriority(urgencyScore);
  }

  override async calculateUrgencyScore(alertData: AlertGenerationData): Promise<number> {
    let urgencyScore = 0;

    // Base urgency from product popularity
    urgencyScore += await this.getPopularityUrgency(alertData.productId);

    // Calculate price drop percentage
    const dropPercentage = this.calculatePriceDropPercentage(alertData);
    
    if (dropPercentage >= PriceDropAlertStrategy.MAJOR_DROP_THRESHOLD) {
      urgencyScore += 40; // Major price drop
    } else if (dropPercentage >= PriceDropAlertStrategy.SIGNIFICANT_DROP_THRESHOLD) {
      urgencyScore += 25; // Significant price drop
    } else if (dropPercentage >= 10) {
      urgencyScore += 15; // Moderate price drop
    }

    // Boost for historically high-priced items
    if (alertData.data.original_price && alertData.data.original_price > 100) {
      urgencyScore += 10;
    }

    // Boost for limited-time sales
    if (alertData.data.is_limited_time) {
      urgencyScore += 15;
    }

    return Math.min(urgencyScore, 100);
  }

  override async validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean> {
    const baseValid = await super.validateSpecificRequirements(alertData);
    if (!baseValid) return false;

    // Price drop specific validation
    const { price, original_price } = alertData.data;

    // Must have both current and original price
    if (typeof price !== 'number' || typeof original_price !== 'number') {
      return false;
    }

    // Current price must be less than original price
    if (price >= original_price) {
      return false;
    }

    // Prices must be positive
    return price > 0 && original_price > 0;
  }

  private calculatePriceDropPercentage(alertData: AlertGenerationData): number {
    const { price, original_price } = alertData.data;
    
    if (!price || !original_price || original_price <= 0) {
      return 0;
    }

    return ((original_price - price) / original_price) * 100;
  }
}