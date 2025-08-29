import { AlertProcessingStrategy, AlertType } from './AlertProcessingStrategy';
import { RestockAlertStrategy } from './RestockAlertStrategy';
import { PriceDropAlertStrategy } from './PriceDropAlertStrategy';

/**
 * Factory for creating alert processing strategies
 */
export class AlertProcessorFactory {
  private static strategies: Map<AlertType, AlertProcessingStrategy> = new Map();

  /**
   * Initialize the factory with all available strategies
   */
  static initialize(): void {
    this.strategies.set('restock', new RestockAlertStrategy());
    this.strategies.set('price_drop', new PriceDropAlertStrategy());
    // Add more strategies as needed
  }

  /**
   * Get the appropriate strategy for an alert type
   */
  static getProcessor(type: AlertType): AlertProcessingStrategy {
    if (this.strategies.size === 0) {
      this.initialize();
    }

    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(`No strategy found for alert type: ${type}`);
    }

    return strategy;
  }

  /**
   * Register a new strategy (useful for plugins or extensions)
   */
  static registerStrategy(type: AlertType, strategy: AlertProcessingStrategy): void {
    this.strategies.set(type, strategy);
  }

  /**
   * Get all available alert types
   */
  static getAvailableTypes(): AlertType[] {
    if (this.strategies.size === 0) {
      this.initialize();
    }
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if a strategy exists for the given type
   */
  static hasStrategy(type: AlertType): boolean {
    if (this.strategies.size === 0) {
      this.initialize();
    }
    return this.strategies.has(type);
  }
}

// Initialize strategies on module load
AlertProcessorFactory.initialize();