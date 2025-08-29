import { UserCredentialService } from '../../src/services/userCredentialService';
import { UserEncryptionService } from '../../src/utils/encryption/userEncryption';
import { IUser, IRetailerCredential } from '../../src/types/database';
import { IUserRepository, ILogger } from '../../src/types/dependencies';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock dependencies
const mockUserRepository: jest.Mocked<IUserRepository> = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  findOneBy: jest.fn(),
  findAll: jest.fn(),
  createUser: jest.fn(),
  updateById: jest.fn(),
  updatePreferences: jest.fn(),
  updateNotificationSettings: jest.fn(),
  addShippingAddress: jest.fn(),
  removeShippingAddress: jest.fn(),
  getUserStats: jest.fn(),
  verifyPassword: jest.fn(),
  updatePassword: jest.fn(),
  handleFailedLogin: jest.fn(),
  handleSuccessfulLogin: jest.fn(),
  isAccountLocked: jest.fn(),
  setResetToken: jest.fn(),
  verifyEmail: jest.fn()
};

const mockLogger: jest.Mocked<ILogger> = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('UserCredentialService', () => {
  let userCredentialService: UserCredentialService;
  const testUserId = 'test-user-123';
  const testUserPassword = 'userPassword123!';
  const testRetailerPassword = 'retailerPassword456!';
  const testRetailer = 'bestbuy';

  const mockUser: IUser = {
    id: testUserId,
    email: 'test@example.com',
    password_hash: 'hashedPassword',
    subscription_tier: SubscriptionTier.FREE,
    role: 'user',
    email_verified: true,
    verification_token: null,
    reset_token: null,
    reset_token_expires: null,
    failed_login_attempts: 0,
    locked_until: null,
    admin_permissions: [],
    shipping_addresses: [],
    payment_methods: [],
    retailer_credentials: {},
    notification_settings: {
      web_push: true,
      email: true,
      sms: false,
      discord: false
    },
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '08:00',
      timezone: 'UTC',
      days: [1, 2, 3, 4, 5] // Monday to Friday
    },
    timezone: 'UTC',
    preferences: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    userCredentialService = new UserCredentialService(mockUserRepository, mockLogger);
    jest.clearAllMocks();
  });

  describe('storeRetailerCredentials', () => {
    it('should store credentials with user-specific encryption', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockResolvedValue(mockUser);

      const result = await userCredentialService.storeRetailerCredentials(
        testUserId,
        {
          retailer: testRetailer,
          username: 'testuser',
          password: testRetailerPassword,
          twoFactorEnabled: true
        },
        testUserPassword
      );

      expect(result).toBe(true);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(testUserId);
      expect(mockUserRepository.updateById).toHaveBeenCalled();
      
      const updateCall = mockUserRepository.updateById.mock.calls[0];
      const updatedCredentials = (updateCall[1] as any).retailer_credentials;
      expect(updatedCredentials[testRetailer]).toBeDefined();
      expect(updatedCredentials[testRetailer].username).toBe('testuser');
      expect(updatedCredentials[testRetailer].two_factor_enabled).toBe(true);
      expect(updatedCredentials[testRetailer].encryption_type).toBe('user-specific');
      expect(updatedCredentials[testRetailer].encrypted_password).toContain('user-v1:');
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userCredentialService.storeRetailerCredentials(
        testUserId,
        {
          retailer: testRetailer,
          username: 'testuser',
          password: testRetailerPassword
        },
        testUserPassword
      )).rejects.toThrow('User not found');
    });

    it('should log successful storage', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockResolvedValue(mockUser);

      await userCredentialService.storeRetailerCredentials(
        testUserId,
        {
          retailer: testRetailer,
          username: 'testuser',
          password: testRetailerPassword
        },
        testUserPassword
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retailer credentials stored with user-specific encryption',
        expect.objectContaining({
          userId: testUserId,
          retailer: testRetailer,
          encryptionType: 'user-specific'
        })
      );
    });
  });

  describe('getRetailerCredentials', () => {
    it('should retrieve and decrypt user-encrypted credentials', async () => {
      const userEncryption = new UserEncryptionService();
      const encryptedPassword = await userEncryption.encryptWithUserKey(
        testRetailerPassword,
        testUserPassword,
        testUserId
      );

      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: {
            username: 'testuser',
            encrypted_password: encryptedPassword,
            two_factor_enabled: true,
            is_active: true,
            last_verified: new Date(),
            encryption_type: 'user-specific'
          } as IRetailerCredential & { encryption_type: string }
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);

      const result = await userCredentialService.getRetailerCredentials(
        testUserId,
        testRetailer,
        testUserPassword
      );

      expect(result).toBeDefined();
      expect(result!.username).toBe('testuser');
      expect(result!.password).toBe(testRetailerPassword);
      expect(result!.twoFactorEnabled).toBe(true);
      expect(result!.encryptionType).toBe('user-specific');
    });

    it('should retrieve and decrypt global-encrypted credentials (backward compatibility)', async () => {
      // Mock global encryption (simplified for test)
      const globalEncrypted = 'v1:iv:tag:globalEncryptedData';
      
      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: {
            username: 'testuser',
            encrypted_password: globalEncrypted,
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date()
          } as IRetailerCredential
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);

      // Mock the global decrypt function
      const originalDecrypt = require('../../src/utils/encryption').decrypt;
      jest.doMock('../../src/utils/encryption', () => ({
        ...jest.requireActual('../../src/utils/encryption'),
        decrypt: jest.fn().mockReturnValue(testRetailerPassword)
      }));

      const result = await userCredentialService.getRetailerCredentials(
        testUserId,
        testRetailer,
        testUserPassword
      );

      expect(result).toBeDefined();
      expect(result!.username).toBe('testuser');
      expect(result!.password).toBe(testRetailerPassword);
      expect(result!.encryptionType).toBe('global');
    });

    it('should return null if credentials not found', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userCredentialService.getRetailerCredentials(
        testUserId,
        'nonexistent',
        testUserPassword
      );

      expect(result).toBeNull();
    });

    it('should return null if credentials are inactive', async () => {
      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: {
            username: 'testuser',
            encrypted_password: 'encrypted',
            two_factor_enabled: false,
            is_active: false,
            last_verified: new Date()
          } as IRetailerCredential
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);

      const result = await userCredentialService.getRetailerCredentials(
        testUserId,
        testRetailer,
        testUserPassword
      );

      expect(result).toBeNull();
    });
  });

  describe('migrateCredentialsToUserEncryption', () => {
    it('should migrate global-encrypted credentials to user-specific', async () => {
      const globalEncrypted = 'v1:iv:tag:globalEncryptedData';
      
      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: {
            username: 'testuser',
            encrypted_password: globalEncrypted,
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date()
          } as IRetailerCredential
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);
      mockUserRepository.updateById.mockResolvedValue(userWithCredentials);

      // Mock the global decrypt function
      jest.doMock('../../src/utils/encryption', () => ({
        ...jest.requireActual('../../src/utils/encryption'),
        decrypt: jest.fn().mockReturnValue(testRetailerPassword)
      }));

      const result = await userCredentialService.migrateCredentialsToUserEncryption(
        testUserId,
        testRetailer,
        testUserPassword
      );

      expect(result).toBe(true);
      expect(mockUserRepository.updateById).toHaveBeenCalled();
      
      const updateCall = mockUserRepository.updateById.mock.calls[0];
      const updatedCredentials = (updateCall[1] as any).retailer_credentials;
      expect(updatedCredentials[testRetailer].encryption_type).toBe('user-specific');
      expect(updatedCredentials[testRetailer].encrypted_password).toContain('user-v1:');
    });

    it('should skip migration if already user-encrypted', async () => {
      const userEncryption = new UserEncryptionService();
      const userEncrypted = await userEncryption.encryptWithUserKey(
        testRetailerPassword,
        testUserPassword,
        testUserId
      );

      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: {
            username: 'testuser',
            encrypted_password: userEncrypted,
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date(),
            encryption_type: 'user-specific'
          } as IRetailerCredential & { encryption_type: string }
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);

      const result = await userCredentialService.migrateCredentialsToUserEncryption(
        testUserId,
        testRetailer,
        testUserPassword
      );

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Credentials already use user-specific encryption',
        expect.objectContaining({ userId: testUserId, retailer: testRetailer })
      );
    });
  });

  describe('migrateAllCredentialsToUserEncryption', () => {
    it('should migrate all global credentials to user-specific', async () => {
      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          'bestbuy': {
            username: 'user1',
            encrypted_password: 'v1:iv:tag:global1',
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date()
          } as IRetailerCredential,
          'walmart': {
            username: 'user2',
            encrypted_password: 'v1:iv:tag:global2',
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date()
          } as IRetailerCredential
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);
      mockUserRepository.updateById.mockResolvedValue(userWithCredentials);

      // Mock the global decrypt function
      jest.doMock('../../src/utils/encryption', () => ({
        ...jest.requireActual('../../src/utils/encryption'),
        decrypt: jest.fn().mockReturnValue(testRetailerPassword)
      }));

      const result = await userCredentialService.migrateAllCredentialsToUserEncryption(
        testUserId,
        testUserPassword
      );

      expect(result.migrated).toEqual(['bestbuy', 'walmart']);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('should handle mixed encryption types correctly', async () => {
      const userEncryption = new UserEncryptionService();
      const userEncrypted = await userEncryption.encryptWithUserKey(
        testRetailerPassword,
        testUserPassword,
        testUserId
      );

      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          'bestbuy': {
            username: 'user1',
            encrypted_password: 'v1:iv:tag:global1',
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date()
          } as IRetailerCredential,
          'walmart': {
            username: 'user2',
            encrypted_password: userEncrypted,
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date(),
            encryption_type: 'user-specific'
          } as IRetailerCredential & { encryption_type: string }
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);
      mockUserRepository.updateById.mockResolvedValue(userWithCredentials);

      // Mock the global decrypt function
      jest.doMock('../../src/utils/encryption', () => ({
        ...jest.requireActual('../../src/utils/encryption'),
        decrypt: jest.fn().mockReturnValue(testRetailerPassword)
      }));

      const result = await userCredentialService.migrateAllCredentialsToUserEncryption(
        testUserId,
        testUserPassword
      );

      expect(result.migrated).toEqual(['bestbuy']);
      expect(result.skipped).toEqual(['walmart']);
      expect(result.failed).toEqual([]);
    });
  });

  describe('listRetailerCredentials', () => {
    it('should list credentials with encryption type information', async () => {
      const userEncryption = new UserEncryptionService();
      const userEncrypted = await userEncryption.encryptWithUserKey(
        testRetailerPassword,
        testUserPassword,
        testUserId
      );

      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          'bestbuy': {
            username: 'user1',
            encrypted_password: 'v1:iv:tag:global1',
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date('2023-01-01')
          } as IRetailerCredential,
          'walmart': {
            username: 'user2',
            encrypted_password: userEncrypted,
            two_factor_enabled: true,
            is_active: true,
            last_verified: new Date('2023-01-02'),
            encryption_type: 'user-specific'
          } as IRetailerCredential & { encryption_type: string }
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);

      const result = await userCredentialService.listRetailerCredentials(testUserId);

      expect(result).toHaveLength(2);
      
      const bestbuyCredential = result.find(c => c.retailer === 'bestbuy');
      expect(bestbuyCredential).toBeDefined();
      expect(bestbuyCredential!.encryptionType).toBe('global');
      expect(bestbuyCredential!.username).toBe('user1');
      expect(bestbuyCredential!.twoFactorEnabled).toBe(false);

      const walmartCredential = result.find(c => c.retailer === 'walmart');
      expect(walmartCredential).toBeDefined();
      expect(walmartCredential!.encryptionType).toBe('user-specific');
      expect(walmartCredential!.username).toBe('user2');
      expect(walmartCredential!.twoFactorEnabled).toBe(true);
    });
  });

  describe('updateRetailerCredentials', () => {
    it('should update credentials with user-specific encryption', async () => {
      const existingCredential: IRetailerCredential = {
        username: 'olduser',
        encrypted_password: 'v1:iv:tag:oldpassword',
        two_factor_enabled: false,
        is_active: true,
        last_verified: new Date()
      };

      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: existingCredential
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);
      mockUserRepository.updateById.mockResolvedValue(userWithCredentials);

      const result = await userCredentialService.updateRetailerCredentials(
        testUserId,
        testRetailer,
        {
          username: 'newuser',
          password: 'newpassword',
          twoFactorEnabled: true
        },
        testUserPassword
      );

      expect(result).toBe(true);
      expect(mockUserRepository.updateById).toHaveBeenCalled();
      
      const updateCall = mockUserRepository.updateById.mock.calls[0];
      const updatedCredentials = (updateCall[1] as any).retailer_credentials;
      expect(updatedCredentials[testRetailer].username).toBe('newuser');
      expect(updatedCredentials[testRetailer].two_factor_enabled).toBe(true);
      expect(updatedCredentials[testRetailer].encryption_type).toBe('user-specific');
      expect(updatedCredentials[testRetailer].encrypted_password).toContain('user-v1:');
    });
  });

  describe('verifyRetailerCredentials', () => {
    it('should verify user-encrypted credentials successfully', async () => {
      const userEncryption = new UserEncryptionService();
      const encryptedPassword = await userEncryption.encryptWithUserKey(
        testRetailerPassword,
        testUserPassword,
        testUserId
      );

      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: {
            username: 'testuser',
            encrypted_password: encryptedPassword,
            two_factor_enabled: true,
            is_active: true,
            last_verified: new Date(),
            encryption_type: 'user-specific'
          } as IRetailerCredential & { encryption_type: string }
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);
      mockUserRepository.updateById.mockResolvedValue(userWithCredentials);

      const result = await userCredentialService.verifyRetailerCredentials(
        testUserId,
        testRetailer,
        testUserPassword
      );

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Credentials verified successfully');
      expect(result.encryptionType).toBe('user-specific');
    });

    it('should handle verification failure gracefully', async () => {
      const userWithCredentials: IUser = {
        ...mockUser,
        retailer_credentials: {
          [testRetailer]: {
            username: 'testuser',
            encrypted_password: 'invalid-encrypted-data',
            two_factor_enabled: false,
            is_active: true,
            last_verified: new Date()
          } as IRetailerCredential
        }
      };

      mockUserRepository.findById.mockResolvedValue(userWithCredentials);
      mockUserRepository.updateById.mockResolvedValue(userWithCredentials);

      const result = await userCredentialService.verifyRetailerCredentials(
        testUserId,
        testRetailer,
        testUserPassword
      );

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Credential verification failed');
    });
  });

  describe('performance metrics', () => {
    it('should provide performance metrics', () => {
      const metrics = userCredentialService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });

    it('should reset performance metrics', () => {
      userCredentialService.resetPerformanceMetrics();
      const metrics = userCredentialService.getPerformanceMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });
  });
});