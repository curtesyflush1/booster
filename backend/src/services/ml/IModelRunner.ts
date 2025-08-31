import { ProductInsights } from '../dashboardService';

// Align naming with frontend expectation; alias backend insights shape
export type MLPrediction = ProductInsights;

/**
 * Interface for ML model runners that produce product insights.
 * Swapping implementations (heuristic vs learned models) should
 * not require changes to dashboard services or controllers.
 */
export interface IModelRunner {
  /**
   * Produce insights for a given product.
   */
  predict(productId: string): Promise<MLPrediction | null>;
}
