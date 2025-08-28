import { IServiceDependencies, IServiceFactory } from '../types/dependencies';
import { DependencyContainer } from '../container/DependencyContainer';
import { AuthService } from './authService';
import { CredentialService } from './credentialService';
import { QuietHoursService } from './quietHoursService';
import { AdminSystemService } from './adminSystemService';

/**
 * Service factory for creating service instances with dependency injection
 */
export class ServiceFactory implements IServiceFactory {
  private container: DependencyContainer;

  constructor(container?: DependencyContainer) {
    this.container = container || DependencyContainer.getInstance();
  }

  createAuthService(dependencies?: Partial<IServiceDependencies>): AuthService {
    const deps = this.container.getDependencies();
    return new AuthService(
      dependencies?.userRepository || deps.userRepository,
      dependencies?.logger || deps.logger
    );
  }

  createAlertProcessingService(dependencies?: Partial<IServiceDependencies>): any {
    // TODO: Implement when AlertProcessingService is refactored for DI
    const deps = this.container.getDependencies();
    // return new AlertProcessingService(
    //   dependencies?.alertRepository || deps.alertRepository,
    //   dependencies?.userRepository || deps.userRepository,
    //   dependencies?.logger || deps.logger
    // );
    throw new Error('AlertProcessingService not yet refactored for DI');
  }

  createCredentialService(dependencies?: Partial<IServiceDependencies>): CredentialService {
    const deps = this.container.getDependencies();
    return new CredentialService(
      dependencies?.userRepository || deps.userRepository,
      dependencies?.logger || deps.logger
    );
  }

  createQuietHoursService(dependencies?: Partial<IServiceDependencies>): QuietHoursService {
    const deps = this.container.getDependencies();
    return new QuietHoursService(
      dependencies?.userRepository || deps.userRepository,
      dependencies?.logger || deps.logger
    );
  }

  createAdminSystemService(dependencies?: Partial<IServiceDependencies>): AdminSystemService {
    const deps = this.container.getDependencies();
    return new AdminSystemService(
      dependencies?.systemRepository || deps.systemRepository,
      dependencies?.logger || deps.logger
    );
  }

  /**
   * Create a test factory with mock dependencies
   */
  static createTestFactory(mockDependencies: Partial<IServiceDependencies>): ServiceFactory {
    const testContainer = DependencyContainer.createTestContainer(mockDependencies);
    return new ServiceFactory(testContainer);
  }
}

// Export singleton instance
export const serviceFactory = new ServiceFactory();