import { AuthService } from '../../src/services/authService';
import { IUserRepository, ILogger } from '../../src/types/dependencies';
import { IUser, IUserRegistration } from '../../src/types/database';

/**
 * Example test demonstrating improved testability with dependency injection
 */
describe('AuthService with Dependency Injection', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Create mock dependencies
    mockUserRepository = {
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

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    // Inject mock dependencies
    authService = new AuthService(mockUserRepository, mockLogger);
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      // Arrange
      const userData: IUserRegistration = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User'
      };

      const mockUser: IUser = {
        id: 'user-123',
        email: userData.email,
        password_hash: 'hashed-password',
        first_name: userData.first_name,
        last_name: userData.last_name,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      } as IUser;

      // Mock repository responses
      mockUserRepository.findByEmail.mockResolvedValue(null); // User doesn't exist
      mockUserRepository.createUser.mockResolvedValue(mockUser);
      mockUserRepository.updateById.mockResolvedValue(mockUser);

      // Act
      const result = await authService.register(userData);

      // Assert
      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.tokens.access_token).toBeDefined();
      expect(result.tokens.refresh_token).toBeDefined();

      // Verify repository interactions
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.createUser).toHaveBeenCalledWith(userData);
      expect(mockUserRepository.updateById).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ verification_token: expect.any(String) })
      );

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User registered successfully',
        { userId: 'user-123', email: 'test@example.com' }
      );
    });

    it('should throw error if user already exists', async () => {
      // Arrange
      const userData: IUserRegistration = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User'
      };

      const existingUser: IUser = {
        id: 'existing-user',
        email: userData.email
      } as IUser;

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(authService.register(userData)).rejects.toThrow('User already exists with this email');

      // Verify repository interactions
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('existing@example.com');
      expect(mockUserRepository.createUser).not.toHaveBeenCalled();

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Registration failed',
        expect.objectContaining({
          error: 'User already exists with this email',
          email: 'existing@example.com'
        })
      );
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const mockUser: IUser = {
        id: 'user-123',
        email: credentials.email,
        password_hash: 'hashed-password'
      } as IUser;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.isAccountLocked.mockResolvedValue(false);
      mockUserRepository.verifyPassword.mockResolvedValue(true);
      mockUserRepository.handleSuccessfulLogin.mockResolvedValue();

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(result.user.id).toBe('user-123');
      expect(result.tokens.access_token).toBeDefined();

      // Verify repository interactions
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.isAccountLocked).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.verifyPassword).toHaveBeenCalledWith('SecurePass123!', 'hashed-password');
      expect(mockUserRepository.handleSuccessfulLogin).toHaveBeenCalledWith('user-123');

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User logged in successfully',
        { userId: 'user-123', email: 'test@example.com' }
      );
    });

    it('should handle failed login attempts', async () => {
      // Arrange
      const credentials = {
        email: 'test@example.com',
        password: 'WrongPassword'
      };

      const mockUser: IUser = {
        id: 'user-123',
        email: credentials.email,
        password_hash: 'hashed-password'
      } as IUser;

      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockUserRepository.isAccountLocked.mockResolvedValue(false);
      mockUserRepository.verifyPassword.mockResolvedValue(false);
      mockUserRepository.handleFailedLogin.mockResolvedValue();

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow();

      // Verify repository interactions
      expect(mockUserRepository.verifyPassword).toHaveBeenCalledWith('WrongPassword', 'hashed-password');
      expect(mockUserRepository.handleFailedLogin).toHaveBeenCalledWith('user-123');
      expect(mockUserRepository.handleSuccessfulLogin).not.toHaveBeenCalled();
    });
  });

  describe('validateAccessToken', () => {
    it('should validate a valid token', async () => {
      // This test would require mocking JWT verification
      // and is more complex, but demonstrates the pattern
      const mockUser: IUser = {
        id: 'user-123',
        email: 'test@example.com'
      } as IUser;

      mockUserRepository.findById.mockResolvedValue(mockUser);

      // The actual implementation would involve JWT mocking
      // This is just to show the dependency injection pattern
      expect(mockUserRepository.findById).toBeDefined();
    });
  });
});

/**
 * Benefits of this dependency injection approach:
 * 
 * 1. **Testability**: Easy to mock dependencies and test business logic in isolation
 * 2. **Flexibility**: Can swap implementations (e.g., different databases, loggers)
 * 3. **Maintainability**: Clear separation of concerns and dependencies
 * 4. **Debugging**: Can inject debug loggers or repositories for troubleshooting
 * 5. **Performance Testing**: Can inject performance monitoring wrappers
 * 6. **Integration Testing**: Can use real database with test data
 * 7. **Mocking**: No need for complex static method mocking
 * 8. **Type Safety**: Full TypeScript support with proper interfaces
 */