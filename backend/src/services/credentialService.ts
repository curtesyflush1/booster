import { encrypt, decrypt, sanitizeForLogging } from '../utils/encryption';
import { IUser, IRetailerCredential } from '../types/database';
import { IUserRepository, ILogger } from '../types/dependencies';

export interface RetailerCredentialInput {
  retailer: string;
  username: string;
  password: string;
  twoFactorEnabled?: boolean;
}

export interface RetailerCredentialOutput {
  retailer: string;
  username: string;
  twoFactorEnabled: boolean;
  lastVerified?: Date;
  isActive: boolean;
}

export class CredentialService {
  private userRepository: IUserRepository;
  private logger: ILogger;

  constructor(userRepository: IUserRepository, logger: ILogger) {
    this.userRepository = userRepository;
    this.logger = logger;
  }

  /**
   * Store encrypted retailer credentials for a user
   */
  async storeRetailerCredentials(
    userId: string,
    credentials: RetailerCredentialInput
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Encrypt the password
      const encryptedPassword = encrypt(credentials.password);

      // Create credential object
      const credentialData: IRetailerCredential = {
        username: credentials.username,
        encrypted_password: encryptedPassword,
        two_factor_enabled: credentials.twoFactorEnabled || false,
        last_verified: new Date(),
        is_active: true
      };

      // Update user's retailer credentials
      const updatedCredentials = {
        ...user.retailer_credentials,
        [credentials.retailer]: credentialData
      };

      const success = await this.userRepository.updateById<IUser>(userId, {
        retailer_credentials: updatedCredentials
      });

      if (success) {
        this.logger.info('Retailer credentials stored', {
          userId,
          retailer: credentials.retailer,
          username: credentials.username,
          twoFactorEnabled: credentials.twoFactorEnabled
        });
      }

      return success !== null;
    } catch (error) {
      this.logger.error('Failed to store retailer credentials', {
        userId,
        retailer: credentials.retailer,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Retrieve and decrypt retailer credentials for a user
   */
  async getRetailerCredentials(
    userId: string,
    retailer: string
  ): Promise<{ username: string; password: string; twoFactorEnabled: boolean } | null> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const credentialData = user.retailer_credentials[retailer];
      if (!credentialData || !credentialData.is_active) {
        return null;
      }

      // Decrypt the password
      const decryptedPassword = decrypt(credentialData.encrypted_password);

      return {
        username: credentialData.username,
        password: decryptedPassword,
        twoFactorEnabled: credentialData.two_factor_enabled
      };
    } catch (error) {
      this.logger.error('Failed to retrieve retailer credentials', {
        userId,
        retailer,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * List all retailer credentials for a user (without passwords)
   */
  async listRetailerCredentials(userId: string): Promise<RetailerCredentialOutput[]> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const credentials: RetailerCredentialOutput[] = [];

      for (const [retailer, credentialData] of Object.entries(user.retailer_credentials)) {
        credentials.push({
          retailer,
          username: credentialData.username,
          twoFactorEnabled: credentialData.two_factor_enabled,
          lastVerified: credentialData.last_verified,
          isActive: credentialData.is_active
        });
      }

      return credentials;
    } catch (error) {
      this.logger.error('Failed to list retailer credentials', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update retailer credentials
   */
  async updateRetailerCredentials(
    userId: string,
    retailer: string,
    updates: Partial<RetailerCredentialInput>
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const existingCredential = user.retailer_credentials[retailer];
      if (!existingCredential) {
        throw new Error('Retailer credentials not found');
      }

      // Prepare updated credential data
      const updatedCredential: IRetailerCredential = {
        ...existingCredential,
        ...(updates.username && { username: updates.username }),
        ...(updates.password && { encrypted_password: encrypt(updates.password) }),
        ...(updates.twoFactorEnabled !== undefined && { two_factor_enabled: updates.twoFactorEnabled }),
        last_verified: new Date()
      };

      // Update user's retailer credentials
      const updatedCredentials = {
        ...user.retailer_credentials,
        [retailer]: updatedCredential
      };

      const success = await this.userRepository.updateById<IUser>(userId, {
        retailer_credentials: updatedCredentials
      });

      if (success) {
        this.logger.info('Retailer credentials updated', {
          userId,
          retailer,
          updatedFields: sanitizeForLogging(updates)
        });
      }

      return success !== null;
    } catch (error) {
      this.logger.error('Failed to update retailer credentials', {
        userId,
        retailer,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Delete retailer credentials
   */
  async deleteRetailerCredentials(userId: string, retailer: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.retailer_credentials[retailer]) {
        throw new Error('Retailer credentials not found');
      }

      // Remove the retailer credentials
      const updatedCredentials = { ...user.retailer_credentials };
      delete updatedCredentials[retailer];

      const success = await this.userRepository.updateById<IUser>(userId, {
        retailer_credentials: updatedCredentials
      });

      if (success) {
        this.logger.info('Retailer credentials deleted', { userId, retailer });
      }

      return success !== null;
    } catch (error) {
      this.logger.error('Failed to delete retailer credentials', {
        userId,
        retailer,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Verify retailer credentials by attempting to use them
   */
  async verifyRetailerCredentials(
    userId: string,
    retailer: string
  ): Promise<{ isValid: boolean; message: string }> {
    try {
      const credentials = await this.getRetailerCredentials(userId, retailer);
      if (!credentials) {
        return { isValid: false, message: 'Credentials not found' };
      }

      // In a real implementation, this would attempt to login to the retailer
      // For now, we'll just mark as verified if we can decrypt the credentials
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      // Update last verified timestamp
      const existingCredential = user.retailer_credentials[retailer];
      if (!existingCredential) {
        return { isValid: false, message: 'Credentials not found' };
      }

      const updatedCredentials = {
        ...user.retailer_credentials,
        [retailer]: {
          ...existingCredential,
          last_verified: new Date(),
          is_active: true
        } as IRetailerCredential
      };

      await this.userRepository.updateById<IUser>(userId, {
        retailer_credentials: updatedCredentials
      });

      this.logger.info('Retailer credentials verified', { userId, retailer });

      return { isValid: true, message: 'Credentials verified successfully' };
    } catch (error) {
      this.logger.error('Failed to verify retailer credentials', {
        userId,
        retailer,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Mark credentials as inactive if verification fails
      try {
        const user = await this.userRepository.findById<IUser>(userId);
        if (user && user.retailer_credentials[retailer]) {
          const existingCredential = user.retailer_credentials[retailer];
          const updatedCredentials = {
            ...user.retailer_credentials,
            [retailer]: {
              ...existingCredential,
              is_active: false
            } as IRetailerCredential
          };

          await this.userRepository.updateById<IUser>(userId, {
            retailer_credentials: updatedCredentials
          });
        }
      } catch (updateError) {
        this.logger.error('Failed to mark credentials as inactive', {
          userId,
          retailer,
          error: updateError instanceof Error ? updateError.message : 'Unknown error'
        });
      }

      return { isValid: false, message: 'Credential verification failed' };
    }
  }
}

// Export factory function for creating CredentialService instances
import { DependencyContainer } from '../container/DependencyContainer';

export const createCredentialService = (dependencies?: Partial<{ userRepository: IUserRepository; logger: ILogger }>) => {
  const container = DependencyContainer.getInstance();
  return new CredentialService(
    dependencies?.userRepository || container.getUserRepository(),
    dependencies?.logger || container.getLogger()
  );
};