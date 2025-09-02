import { IModelRunner } from './IModelRunner';
import { HeuristicModelRunner } from './HeuristicModelRunner';
import { PricePredictionModelRunner } from './PricePredictionModelRunner';

/**
 * Provides the active model runner. Today this returns the heuristic
 * implementation; later it can load trained models dynamically.
 */
export class ModelFactory {
  private static singleton: IModelRunner | null = null;

  static getActiveRunner(): IModelRunner {
    if (!this.singleton) {
      try {
        this.singleton = new PricePredictionModelRunner();
      } catch {
        this.singleton = new HeuristicModelRunner();
      }
    }
    return this.singleton;
  }
}

