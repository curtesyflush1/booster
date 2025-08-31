import { IModelRunner } from './IModelRunner';
import { HeuristicModelRunner } from './HeuristicModelRunner';

/**
 * Provides the active model runner. Today this returns the heuristic
 * implementation; later it can load trained models dynamically.
 */
export class ModelFactory {
  private static singleton: IModelRunner | null = null;

  static getActiveRunner(): IModelRunner {
    if (!this.singleton) {
      this.singleton = new HeuristicModelRunner();
    }
    return this.singleton;
  }
}

