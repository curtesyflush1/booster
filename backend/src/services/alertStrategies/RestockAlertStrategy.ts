import { BaseAlertStrategy, AlertGenerationData, AlertPriority, AlertType } from './AlertProcessingStrategy';

/**
 * Strategy for processing restock alerts
 */
export class RestockAlertStrategy extends BaseAlertStrategy {
  override getAlertType(): AlertType {
    return 'restock';
  }

  override async calculatePriority(alertData: AlertGenerationData): Promise<AlertPriority> {
    const urgencyScore = await this.calculateUrgencyScore(alertData);
    return this.urgencyToPriority(urgencyScore);
  }

  override async calculateUrgencyScore(alertData: AlertGenerationData): Promise<number> {
    let urgencyScore = 0;

    // Base urgency from product popularity
    urgencyScore += await this.getPopularityUrgency(alertData.productId);

    // Boost for limited stock information
    if (alertData.data.stock_level && alertData.data.stock_level < 10) {
      urgencyScore += 20; // Low stock adds urgency
    }

    // Boost for high-demand retailers
    const highDemandRetailers = ['best-buy', 'walmart', 'costco'];
    if (highDemandRetailers.includes(alertData.retailerId)) {
      urgencyScore += 10;
    }

    // Time-based urgency (new releases are more urgent)
    if (alertData.data.is_new_release) {
      urgencyScore += 15;
    }

    // Cap at 100
    return Math.min(urgencyScore, 100);
  }

  override async validateSpecificRequirements(alertData: AlertGenerationData): Promise<boolean> {
    // Call base validation first
    const baseValid = await super.validateSpecificRequirements(alertData);
    if (!baseValid) return false;

    // Restock-specific validation
    // Ensure we have stock information if provided
    if (alertData.data.stock_level !== undefined) {
      return typeof alertData.data.stock_level === 'number' && alertData.data.stock_level >= 0;
    }

    return true;
  }
}