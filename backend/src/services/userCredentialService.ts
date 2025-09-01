import { encrypt, decrypt, sanitizeForLogging } from '../utils/encryption';
import { UserEncryptionService, isUserEncrypted } from '../utils/encryption/userEncryption';
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
  encryptionType: 'global' | 'user-specific';
}

/**
 * Enhanced credential service that supports per-user encryption keys
 * for maximum security of retailer credentials.
 * 
 * This service can:
 * 1. Store new credentials with user-specific encryption
 * 2. Read existing credentials (both global and user-specific)
 * 3. Migrate existing global-encrypted credentials to user-specific encryption
 */
export class UserCredentialService {
  private userRepository: IUserRepository;
  private logger: ILogger;
  private userEncryption: UserEncryptionService;

  constructor(userRepository: IUserRepository, logger: ILogger) {
    this.userRepository = userRepository;
    this.logger = logger;
    this.userEncryption = new UserEncryptionService();
  }

  /**
   * Store encrypted retailer credentials using user-specific encryption
   */
  async storeRetailerCredentials(
    userId: string,
    credentials: RetailerCredentialInput,
    userPassword: string
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Encrypt the password using user-specific key
      const encryptedPassword = await this.userEncryption.encryptWithUserKey(
        credentials.password,
        userPassword,
        userId
      );

      // Create credential object with user-specific encryption marker
      const credentialData: IRetailerCredential & { encryption_type?: string } = {
        username: credentials.username,
        encrypted_password: encryptedPassword,
        two_factor_enabled: credentials.twoFactorEnabled || false,
        last_verified: new Date(),
        is_active: true,
        encryption_type: 'user-specific' // Mark as user-encrypted
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
        this.logger.info('Retailer credentials stored with user-specific encryption', {
          userId,
          retailer: credentials.retailer,
          username: credentials.username,
          twoFactorEnabled: credentials.twoFactorEnabled,
          encryptionType: 'user-specific'
        });
      }

      return success !== null;
    } catch (error) {
      this.logger.error('Failed to store retailer credentials with user encryption', {
        userId,
        retailer: credentials.retailer,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Retrieve and decrypt retailer credentials (supports both global and user-specific encryption)
   */
  async getRetailerCredentials(
    userId: string,
    retailer: string,
    userPassword: string
  ): Promise<{ username: string; password: string; twoFactorEnabled: boolean; encryptionType: 'global' | 'user-specific' } | null> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const credentialData = user.retailer_credentials[retailer] as IRetailerCredential & { encryption_type?: string };
      if (!credentialData || !credentialData.is_active) {
        return null;
      }

      let decryptedPassword: string;
      let encryptionType: 'global' | 'user-specific';

      // Check if this is user-specific encryption
      if (credentialData.encryption_type === 'user-specific' || 
          isUserEncrypted(credentialData.encrypted_password)) {
        
        // Decrypt using user-specific key
        decryptedPassword = await this.userEncryption.decryptWithUserKey(
          credentialData.encrypted_password,
          userPassword,
          userId
        );
        encryptionType = 'user-specific';
        
        this.logger.debug('Retrieved credentials using user-specific decryption', {
          userId,
          retailer,
          encryptionType: 'user-specific'
        });
      } else {
        // Fallback to global encryption for backward compatibility
        decryptedPassword = decrypt(credentialData.encrypted_password);
        encryptionType = 'global';
        
        this.logger.debug('Retrieved credentials using global decryption', {
          userId,
          retailer,
          encryptionType: 'global'
        });
      }

      return {
        username: credentialData.username,
        password: decryptedPassword,
        twoFactorEnabled: credentialData.two_factor_enabled,
        encryptionType
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
   * Migrate existing global-encrypted credentials to user-specific encryption
   */
  async migrateCredentialsToUserEncryption(
    userId: string,
    retailer: string,
    userPassword: string
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const credentialData = user.retailer_credentials[retailer] as IRetailerCredential & { encryption_type?: string };
      if (!credentialData || !credentialData.is_active) {
        throw new Error('Retailer credentials not found');
      }

      // Skip if already user-encrypted
      if (credentialData.encryption_type === 'user-specific' || 
          isUserEncrypted(credentialData.encrypted_password)) {
        this.logger.info('Credentials already use user-specific encryption', {
          userId,
          retailer
        });
        return true;
      }

      // Migrate from global to user-specific encryption
      const migratedPassword = await this.userEncryption.migrateToUserEncryption(
        credentialData.encrypted_password,
        userPassword,
        userId,
        decrypt // Global decrypt function
      );

      // Update credential with new encryption
      const updatedCredential: IRetailerCredential & { encryption_type?: string } = {
        ...credentialData,
        encrypted_password: migratedPassword,
        encryption_type: 'user-specific',
        last_verified: new Date()
      };

      const updatedCredentials = {
        ...user.retailer_credentials,
        [retailer]: updatedCredential
      };

      const success = await this.userRepository.updateById<IUser>(userId, {
        retailer_credentials: updatedCredentials
      });

      if (success) {
        this.logger.info('Successfully migrated credentials to user-specific encryption', {
          userId,
          retailer,
          encryptionType: 'user-specific'
        });
      }

      return success !== null;
    } catch (error) {
      this.logger.error('Failed to migrate credentials to user encryption', {
        userId,
        retailer,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Migrate all user credentials to user-specific encryption
   */
  async migrateAllCredentialsToUserEncryption(
    userId: string,
    userPassword: string
  ): Promise<{ migrated: string[]; skipped: string[]; failed: string[] }> {
    const results = {
      migrated: [] as string[],
      skipped: [] as string[],
      failed: [] as string[]
    };

    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const retailers = Object.keys(user.retailer_credentials);
      
      for (const retailer of retailers) {
        try {
          const credentialData = user.retailer_credentials[retailer] as IRetailerCredential & { encryption_type?: string };
          
          // Skip if already user-encrypted
          if (credentialData.encryption_type === 'user-specific' || 
              isUserEncrypted(credentialData.encrypted_password)) {
            results.skipped.push(retailer);
            continue;
          }

          // Attempt migration
          const success = await this.migrateCredentialsToUserEncryption(userId, retailer, userPassword);
          if (success) {
            results.migrated.push(retailer);
          } else {
            results.failed.push(retailer);
          }
        } catch (error) {
          this.logger.error('Failed to migrate individual retailer credentials', {
            userId,
            retailer,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          results.failed.push(retailer);
        }
      }

      this.logger.info('Completed credential migration for user', {
        userId,
        migrated: results.migrated.length,
        skipped: results.skipped.length,
        failed: results.failed.length
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to migrate all credentials for user', {
        userId,
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
        const typedCredential = credentialData as IRetailerCredential & { encryption_type?: string };
        
        // Determine encryption type
        let encryptionType: 'global' | 'user-specific' = 'global';
        if (typedCredential.encryption_type === 'user-specific' || 
            UserEncryptionService.isUserEncrypted(typedCredential.encrypted_password)) {
          encryptionType = 'user-specific';
        }

        credentials.push({
          retailer,
          username: typedCredential.username,
          twoFactorEnabled: typedCredential.two_factor_enabled,
          lastVerified: typedCredential.last_verified,
          isActive: typedCredential.is_active,
          encryptionType
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
   * Update retailer credentials (always uses user-specific encryption for new data)
   */
  async updateRetailerCredentials(
    userId: string,
    retailer: string,
    updates: Partial<RetailerCredentialInput>,
    userPassword: string
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const existingCredential = user.retailer_credentials[retailer] as IRetailerCredential & { encryption_type?: string };
      if (!existingCredential) {
        throw new Error('Retailer credentials not found');
      }

      // Prepare updated credential data
      let updatedCredential: IRetailerCredential & { encryption_type?: string } = {
        ...existingCredential,
        ...(updates.username && { username: updates.username }),
        ...(updates.twoFactorEnabled !== undefined && { two_factor_enabled: updates.twoFactorEnabled }),
        last_verified: new Date(),
        encryption_type: 'user-specific' // Always use user-specific for updates
      };

      // If password is being updated, encrypt with user-specific key
      if (updates.password) {
        updatedCredential.encrypted_password = await this.userEncryption.encryptWithUserKey(
          updates.password,
          userPassword,
          userId
        );
      }

      // Update user's retailer credentials
      const updatedCredentials = {
        ...user.retailer_credentials,
        [retailer]: updatedCredential
      };

      const success = await this.userRepository.updateById<IUser>(userId, {
        retailer_credentials: updatedCredentials
      });

      if (success) {
        this.logger.info('Retailer credentials updated with user-specific encryption', {
          userId,
          retailer,
          updatedFields: sanitizeForLogging(updates),
          encryptionType: 'user-specific'
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
   * Verify retailer credentials by attempting to decrypt them
   */
  async verifyRetailerCredentials(
    userId: string,
    retailer: string,
    userPassword: string
  ): Promise<{ isValid: boolean; message: string; encryptionType?: 'global' | 'user-specific' }> {
    try {
      const credentials = await this.getRetailerCredentials(userId, retailer, userPassword);
      if (!credentials) {
        return { isValid: false, message: 'Credentials not found' };
      }

      // Update last verified timestamp
      const user = await this.userRepository.findById<IUser>(userId);
      if (!user) {
        return { isValid: false, message: 'User not found' };
      }

      const existingCredential = user.retailer_credentials[retailer] as IRetailerCredential & { encryption_type?: string };
      if (!existingCredential) {
        return { isValid: false, message: 'Credentials not found' };
      }

      const updatedCredentials = {
        ...user.retailer_credentials,
        [retailer]: {
          ...existingCredential,
          last_verified: new Date(),
          is_active: true
        } as IRetailerCredential & { encryption_type?: string }
      };

      await this.userRepository.updateById<IUser>(userId, {
        retailer_credentials: updatedCredentials
      });

      this.logger.info('Retailer credentials verified', { 
        userId, 
        retailer,
        encryptionType: credentials.encryptionType
      });

      return { 
        isValid: true, 
        message: 'Credentials verified successfully',
        encryptionType: credentials.encryptionType
      };
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

  /**
   * Get performance metrics for user encryption operations
   */
  getPerformanceMetrics() {
    return this.userEncryption.getPerformanceMetrics();
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics() {
    this.userEncryption.resetPerformanceMetrics();
  }
}

// Export factory function for creating UserCredentialService instances
import { DependencyContainer } from '../container/DependencyContainer';

export const createUserCredentialService = (dependencies?: Partial<{ userRepository: IUserRepository; logger: ILogger }>) => {
  const container = DependencyContainer.getInstance();
  return new UserCredentialService(
    dependencies?.userRepository || container.getUserRepository(),
    dependencies?.logger || container.getLogger()
  );
};
