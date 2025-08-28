import { IServiceDependencies } from '../types/dependencies';
import { UserRepository } from '../repositories/UserRepository';
import { AlertRepository } from '../repositories/AlertRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { WatchRepository } from '../repositories/WatchRepository';
import { SystemRepository } from '../repositories/SystemRepository';
import { DatabaseConnection } from '../repositories/DatabaseConnection';
import { LoggerWrapper } from '../utils/LoggerWrapper';

/**
 * Dependency injection container
 * Provides centralized management of service dependencies
 */
export class DependencyContainer {
  private static instance: DependencyContainer;
  private dependencies: IServiceDependencies;

  private constructor() {
    this.dependencies = this.createDefaultDependencies();
  }

  public static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  /**
   * Get all dependencies
   */
  public getDependencies(): IServiceDependencies {
    return this.dependencies;
  }

  /**
   * Get specific dependency
   */
  public getUserRepository() {
    return this.dependencies.userRepository;
  }

  public getAlertRepository() {
    return this.dependencies.alertRepository;
  }

  public getProductRepository() {
    return this.dependencies.productRepository;
  }

  public getWatchRepository() {
    return this.dependencies.watchRepository;
  }

  public getSystemRepository() {
    return this.dependencies.systemRepository;
  }

  public getLogger() {
    return this.dependencies.logger;
  }

  public getDatabase() {
    return this.dependencies.database;
  }

  /**
   * Override dependencies for testing
   */
  public setDependencies(dependencies: Partial<IServiceDependencies>): void {
    this.dependencies = {
      ...this.dependencies,
      ...dependencies
    };
  }

  /**
   * Reset to default dependencies
   */
  public resetDependencies(): void {
    this.dependencies = this.createDefaultDependencies();
  }

  /**
   * Create default production dependencies
   */
  private createDefaultDependencies(): IServiceDependencies {
    return {
      userRepository: new UserRepository(),
      alertRepository: new AlertRepository(),
      productRepository: new ProductRepository(),
      watchRepository: new WatchRepository(),
      systemRepository: new SystemRepository(),
      logger: new LoggerWrapper(),
      database: new DatabaseConnection()
    };
  }

  /**
   * Create test dependencies with mocks
   */
  public static createTestContainer(mockDependencies: Partial<IServiceDependencies>): DependencyContainer {
    const container = new DependencyContainer();
    container.setDependencies(mockDependencies);
    return container;
  }
}