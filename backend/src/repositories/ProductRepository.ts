import { Product } from '../models/Product';
import { IProductRepository } from '../types/dependencies';

/**
 * Product repository implementation that wraps the Product model
 * This provides a clean interface for dependency injection
 */
export class ProductRepository implements IProductRepository {
  async findById<T>(id: string): Promise<T | null> {
    return Product.findById<T>(id);
  }

  async findBy<T>(criteria: Partial<T>): Promise<T[]> {
    const result = await Product.findBy<T>(criteria);
    return result.data;
  }
}