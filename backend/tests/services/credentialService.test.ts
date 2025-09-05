import { CredentialService } from '../../src/services/credentialService';
import { User } from '../../src/models/User';
import { generateEncryptionKey } from '../../src/utils/encryption';
import { IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

// Mock the User model
jest.mock('../../src/models/User');
const MockedUser = User as jest.Mocked<typeof User>;

// Mock encryption key
const originalEnv = process.env.ENCRYPTION_KEY;

describe('CredentialService', () => {
  const mockUserId = 'test-user-id';
  const mockUser: IUser = {
    id: mockUserId,
    email: 'test@example.com',
    password_hash: 'hashed-password',
    subscription_tier: 'free' as SubscriptionTier,
    role: 'user',
    email_verified: true,
    failed_login_attempts: 0,
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
      days: []
    },
    timezone: 'UTC',
    preferences: {},
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = generateEncryptionKey();
  });

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Create service with mocked dependencies (use User model statics for repo methods)
  let service: CredentialService;
  let mockUserRepository: any;
  let mockLogger: any;
  
  beforeEach(() => {
    mockUserRepository = {
      findById: (User.findById as any),
      updateById: (User.updateById as any)
    };
    mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    service = new CredentialService(mockUserRepository, mockLogger);
  });

  describe('storeRetailerCredentials', () => {
    it('should store encrypted retailer credentials successfully', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);
      MockedUser.updateById.mockResolvedValue({ ...mockUser, updated_at: new Date() });

      const credentials = {
        retailer: 'bestbuy',
        username: 'testuser',
        password: 'testpassword',
        twoFactorEnabled: true
      };

      const result = await service.storeRetailerCredentials(mockUserId, credentials);

      expect(result).toBe(true);
      expect(MockedUser.findById).toHaveBeenCalledWith(mockUserId);
      expect(MockedUser.updateById).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          retailer_credentials: expect.objectContaining({
            bestbuy: expect.objectContaining({
              username: 'testuser',
              encrypted_password: expect.any(String),
              two_factor_enabled: true,
              is_active: true,
              last_verified: expect.any(Date)
            })
          })
        })
      );
    });

    it('should throw error when user not found', async () => {
      MockedUser.findById.mockResolvedValue(null);

      const credentials = {
        retailer: 'bestbuy',
        username: 'testuser',
        password: 'testpassword'
      };

      await expect(
        service.storeRetailerCredentials(mockUserId, credentials)
      ).rejects.toThrow('User not found');
    });

    it('should handle database update failure', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);
      MockedUser.updateById.mockResolvedValue(null);

      const credentials = {
        retailer: 'bestbuy',
        username: 'testuser',
        password: 'testpassword'
      };

      const result = await service.storeRetailerCredentials(mockUserId, credentials);

      expect(result).toBe(false);
    });
  });

  describe('getRetailerCredentials', () => {
    it('should retrieve and decrypt credentials successfully', async () => {
      const userWithCredentials = {
        ...mockUser,
        retailer_credentials: {
          bestbuy: {
            username: 'testuser',
            encrypted_password: 'encrypted-data',
            two_factor_enabled: true,
            last_verified: new Date(),
            is_active: true
          }
        }
      };

      MockedUser.findById.mockResolvedValue(userWithCredentials);

      // Mock the decrypt function by storing and retrieving actual encrypted data
      const testCredentials = {
        retailer: 'bestbuy',
        username: 'testuser',
        password: 'testpassword',
        twoFactorEnabled: true
      };

      // First store the credentials to get properly encrypted data
      await service.storeRetailerCredentials(mockUserId, testCredentials);
      
      // Get the encrypted data from the mock call
      const updateCall = MockedUser.updateById.mock.calls[0];
      const storedCredentials = (updateCall?.[1] as any)?.retailer_credentials?.bestbuy;
      
      // Update mock to return the properly encrypted data
      MockedUser.findById.mockResolvedValue({
        ...mockUser,
        retailer_credentials: {
          bestbuy: storedCredentials
        }
      });

      const result = await service.getRetailerCredentials(mockUserId, 'bestbuy');

      expect(result).toEqual({
        username: 'testuser',
        password: 'testpassword',
        twoFactorEnabled: true
      });
    });

    it('should return null when credentials not found', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await service.getRetailerCredentials(mockUserId, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when credentials are inactive', async () => {
      const userWithInactiveCredentials = {
        ...mockUser,
        retailer_credentials: {
          bestbuy: {
            username: 'testuser',
            encrypted_password: 'encrypted-data',
            two_factor_enabled: false,
            last_verified: new Date(),
            is_active: false
          }
        }
      };

      MockedUser.findById.mockResolvedValue(userWithInactiveCredentials);

      const result = await service.getRetailerCredentials(mockUserId, 'bestbuy');

      expect(result).toBeNull();
    });

    it('should throw error when user not found', async () => {
      MockedUser.findById.mockResolvedValue(null);

      await expect(
        service.getRetailerCredentials(mockUserId, 'bestbuy')
      ).rejects.toThrow('User not found');
    });
  });

  describe('listRetailerCredentials', () => {
    it('should list all retailer credentials without passwords', async () => {
      const userWithCredentials = {
        ...mockUser,
        retailer_credentials: {
          bestbuy: {
            username: 'bestbuy_user',
            encrypted_password: 'encrypted-data-1',
            two_factor_enabled: true,
            last_verified: new Date('2023-01-01'),
            is_active: true
          },
          walmart: {
            username: 'walmart_user',
            encrypted_password: 'encrypted-data-2',
            two_factor_enabled: false,
            last_verified: new Date('2023-01-02'),
            is_active: false
          }
        }
      };

      MockedUser.findById.mockResolvedValue(userWithCredentials);

      const result = await service.listRetailerCredentials(mockUserId);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          retailer: 'bestbuy',
          username: 'bestbuy_user',
          twoFactorEnabled: true,
          lastVerified: new Date('2023-01-01'),
          isActive: true
        },
        {
          retailer: 'walmart',
          username: 'walmart_user',
          twoFactorEnabled: false,
          lastVerified: new Date('2023-01-02'),
          isActive: false
        }
      ]);
    });

    it('should return empty array when no credentials exist', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await service.listRetailerCredentials(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('updateRetailerCredentials', () => {
    it('should update existing credentials successfully', async () => {
      const userWithCredentials = {
        ...mockUser,
        retailer_credentials: {
          bestbuy: {
            username: 'olduser',
            encrypted_password: 'old-encrypted-data',
            two_factor_enabled: false,
            last_verified: new Date('2023-01-01'),
            is_active: true
          }
        }
      };

      MockedUser.findById.mockResolvedValue(userWithCredentials);
      MockedUser.updateById.mockResolvedValue({ ...userWithCredentials, updated_at: new Date() });

      const updates = {
        username: 'newuser',
        password: 'newpassword',
        twoFactorEnabled: true
      };

      const result = await service.updateRetailerCredentials(mockUserId, 'bestbuy', updates);

      expect(result).toBe(true);
      expect(MockedUser.updateById).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          retailer_credentials: expect.objectContaining({
            bestbuy: expect.objectContaining({
              username: 'newuser',
              encrypted_password: expect.any(String),
              two_factor_enabled: true,
              last_verified: expect.any(Date)
            })
          })
        })
      );
    });

    it('should throw error when credentials not found', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);

      const updates = { username: 'newuser' };

      await expect(
        service.updateRetailerCredentials(mockUserId, 'nonexistent', updates)
      ).rejects.toThrow('Retailer credentials not found');
    });
  });

  describe('deleteRetailerCredentials', () => {
    it('should delete credentials successfully', async () => {
      const userWithCredentials = {
        ...mockUser,
        retailer_credentials: {
          bestbuy: {
            username: 'testuser',
            encrypted_password: 'encrypted-data',
            two_factor_enabled: false,
            last_verified: new Date(),
            is_active: true
          },
          walmart: {
            username: 'walmartuser',
            encrypted_password: 'encrypted-data-2',
            two_factor_enabled: false,
            last_verified: new Date(),
            is_active: true
          }
        }
      };

      MockedUser.findById.mockResolvedValue(userWithCredentials);
      MockedUser.updateById.mockResolvedValue({ ...userWithCredentials, updated_at: new Date() });

      const result = await service.deleteRetailerCredentials(mockUserId, 'bestbuy');

      expect(result).toBe(true);
      expect(MockedUser.updateById).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          retailer_credentials: {
            walmart: expect.any(Object)
          }
        })
      );
    });

    it('should throw error when credentials not found', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);

      await expect(
        service.deleteRetailerCredentials(mockUserId, 'nonexistent')
      ).rejects.toThrow('Retailer credentials not found');
    });
  });

  describe('verifyRetailerCredentials', () => {
    it('should verify credentials and update last verified timestamp', async () => {
      // First store credentials to get properly encrypted data
      MockedUser.findById.mockResolvedValue(mockUser);
      MockedUser.updateById.mockResolvedValue({ ...mockUser, updated_at: new Date() });

      const testCredentials = {
        retailer: 'bestbuy',
        username: 'testuser',
        password: 'testpassword'
      };

      await service.storeRetailerCredentials(mockUserId, testCredentials);
      
      // Get the encrypted data from the mock call
      const updateCall = MockedUser.updateById.mock.calls[0];
      const storedCredentials = (updateCall?.[1] as any)?.retailer_credentials?.bestbuy;
      
      // Create a user with the properly encrypted credentials
      const userWithCredentials = {
        ...mockUser,
        retailer_credentials: {
          bestbuy: storedCredentials
        }
      };

      // Reset mocks and set up for verification
      MockedUser.findById.mockResolvedValue(userWithCredentials);
      MockedUser.updateById.mockResolvedValue({ ...userWithCredentials, updated_at: new Date() });

      const result = await service.verifyRetailerCredentials(mockUserId, 'bestbuy');

      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Credentials verified successfully');
    });

    it('should return invalid when credentials not found', async () => {
      MockedUser.findById.mockResolvedValue(mockUser);

      const result = await service.verifyRetailerCredentials(mockUserId, 'nonexistent');

      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Credentials not found');
    });
  });
});
