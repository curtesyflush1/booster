import { Watch } from '../models/Watch';
import { IWatchRepository } from '../types/dependencies';

/**
 * Watch repository implementation that wraps the Watch model
 * This provides a clean interface for dependency injection
 */
export class WatchRepository implements IWatchRepository {
  async findById<T>(id: string): Promise<T | null> {
    return Watch.findById<T>(id);
  }

  async updateById<T>(id: string, data: Partial<T>): Promise<T | null> {
    return Watch.updateById<T>(id, data);
  }
}