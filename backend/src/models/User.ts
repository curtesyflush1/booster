import * as bcrypt from 'bcrypt';
import { BaseModel } from './BaseModel';
import { IUser, IValidationError, IUserRegistration } from '../types/database';
import { INTERVALS, VALIDATION_LIMITS, TIME_UNITS, DEFAULT_VALUES } from '../constants';

export class User extends BaseModel<IUser> {
  protected static override tableName = 'users';

  // Validation rules for user data
  validate(data: Partial<IUser>): IValidationError[] {
    const errors: IValidationError[] = [];

    // Email validation
    if (data.email !== undefined) {
      const emailError = User.validateRequired(data.email, 'email') ||
                        User.validateEmail(data.email);
      if (emailError) errors.push(emailError);
    }

    // Password validation (for registration)
    if (data.password_hash !== undefined) {
      const passwordError = User.validateRequired(data.password_hash, 'password') ||
                           User.validateLength(data.password_hash, 'password', VALIDATION_LIMITS.MIN_PASSWORD_LENGTH, VALIDATION_LIMITS.MAX_PASSWORD_LENGTH);
      if (passwordError) errors.push(passwordError);
    }

    // Subscription tier validation
    if (data.subscription_tier !== undefined) {
      const tierError = User.validateEnum(
        data.subscription_tier,
        'subscription_tier',
        ['free', 'pro']
      );
      if (tierError) errors.push(tierError);
    }

    // Role validation
    if (data.role !== undefined) {
      const roleError = User.validateEnum(
        data.role,
        'role',
        ['user', 'admin', 'super_admin']
      );
      if (roleError) errors.push(roleError);
    }

    // Name validation
    if (data.first_name !== undefined && data.first_name !== null) {
      const firstNameError = User.validateLength(data.first_name, 'first_name', 1, VALIDATION_LIMITS.MAX_FIRST_NAME_LENGTH);
      if (firstNameError) errors.push(firstNameError);
    }

    if (data.last_name !== undefined && data.last_name !== null) {
      const lastNameError = User.validateLength(data.last_name, 'last_name', 1, VALIDATION_LIMITS.MAX_LAST_NAME_LENGTH);
      if (lastNameError) errors.push(lastNameError);
    }

    // Timezone validation
    if (data.timezone !== undefined) {
      // Basic timezone validation - could be enhanced with a proper timezone library
      const timezoneError = User.validateLength(data.timezone, 'timezone', 1, VALIDATION_LIMITS.MAX_TIMEZONE_LENGTH);
      if (timezoneError) errors.push(timezoneError);
    }

    return errors;
  }

  // Sanitize user input
  sanitize(data: Partial<IUser>): Partial<IUser> {
    const sanitized: Partial<IUser> = { ...data };

    // Trim and lowercase email
    if (sanitized.email) {
      sanitized.email = sanitized.email.trim().toLowerCase();
    }

    // Trim names
    if (sanitized.first_name) {
      sanitized.first_name = sanitized.first_name.trim();
    }
    if (sanitized.last_name) {
      sanitized.last_name = sanitized.last_name.trim();
    }

    // Ensure arrays and objects have default values
    if (!sanitized.shipping_addresses) {
      sanitized.shipping_addresses = [];
    }
    if (!sanitized.payment_methods) {
      sanitized.payment_methods = [];
    }
    if (!sanitized.retailer_credentials) {
      sanitized.retailer_credentials = {};
    }
    if (!sanitized.notification_settings) {
      sanitized.notification_settings = {
        web_push: true,
        email: true,
        sms: false,
        discord: false
      };
    }
    if (!sanitized.quiet_hours) {
      sanitized.quiet_hours = {
        enabled: false,
        start_time: DEFAULT_VALUES.DEFAULT_QUIET_START_TIME,
        end_time: DEFAULT_VALUES.DEFAULT_QUIET_END_TIME,
        timezone: 'UTC',
        days: []
      };
    }
    if (!sanitized.preferences) {
      sanitized.preferences = {};
    }
    if (!sanitized.admin_permissions) {
      sanitized.admin_permissions = [];
    }
    if (!sanitized.role) {
      sanitized.role = 'user';
    }

    return sanitized;
  }

  // Hash password before storing
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = VALIDATION_LIMITS.BCRYPT_SALT_ROUNDS;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password against hash
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Create user with password hashing
  static async createUser(userData: IUserRegistration): Promise<IUser> {
    const user = new User();
    const sanitizedData = user.sanitize(userData as Partial<IUser>);
    
    // Validate the data
    const errors = user.validate(sanitizedData);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    // Hash the password
    if (userData.password) {
      sanitizedData.password_hash = await this.hashPassword(userData.password);
    }

    // Remove the plain password from the data
    delete (sanitizedData as any).password;

    return this.create<IUser>(sanitizedData);
  }

  // Find user by email
  static async findByEmail(email: string): Promise<IUser | null> {
    const user = await this.findOneBy<IUser>({ email: email.trim().toLowerCase() });
    return user ? this.parseUserPermissions(user) : null;
  }

  // Find user by ID with parsed permissions
  static async findByIdWithPermissions(id: string): Promise<IUser | null> {
    const user = await this.findById<IUser>(id) as IUser | null;
    return user ? this.parseUserPermissions(user) : null;
  }

  // Parse JSON fields from database
  private static parseUserPermissions(user: IUser): IUser {
    if (user.admin_permissions && typeof user.admin_permissions === 'string') {
      try {
        user.admin_permissions = JSON.parse(user.admin_permissions as string);
      } catch (error) {
        user.admin_permissions = [];
      }
    }
    if (!Array.isArray(user.admin_permissions)) {
      user.admin_permissions = [];
    }
    return user;
  }

  // Update user password
  static async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await this.hashPassword(newPassword);
    const updated = await this.updateById<IUser>(userId, {
      password_hash: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    });
    return updated !== null;
  }

  // Set password reset token
  static async setResetToken(userId: string, token: string, expiresAt: Date): Promise<boolean> {
    const updated = await this.updateById<IUser>(userId, {
      reset_token: token,
      reset_token_expires: expiresAt
    });
    return updated !== null;
  }

  // Verify email
  static async verifyEmail(userId: string): Promise<boolean> {
    const updated = await this.updateById<IUser>(userId, {
      email_verified: true,
      verification_token: null
    });
    return updated !== null;
  }

  // Handle failed login attempt
  static async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.findById<IUser>(userId);
    if (!user) return;

    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    const updateData: Partial<IUser> = {
      failed_login_attempts: failedAttempts
    };

    // Lock account after max failed attempts for configured duration
    if (failedAttempts >= VALIDATION_LIMITS.MAX_FAILED_LOGIN_ATTEMPTS) {
      updateData.locked_until = new Date(Date.now() + INTERVALS.ACCOUNT_LOCKOUT_DURATION);
    }

    await this.updateById<IUser>(userId, updateData);
  }

  // Handle successful login
  static async handleSuccessfulLogin(userId: string): Promise<void> {
    await this.updateById<IUser>(userId, {
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date()
    });
  }

  // Check if account is locked
  static async isAccountLocked(userId: string): Promise<boolean> {
    const user = await this.findById<IUser>(userId);
    if (!user || !user.locked_until) return false;
    
    return new Date() < user.locked_until;
  }

  // Update user preferences
  static async updatePreferences(userId: string, preferences: Record<string, any>): Promise<boolean> {
    const user = await this.findById<IUser>(userId);
    if (!user) return false;

    const updatedPreferences = { ...user.preferences, ...preferences };
    const updated = await this.updateById<IUser>(userId, {
      preferences: updatedPreferences
    });
    return updated !== null;
  }

  // Update notification settings
  static async updateNotificationSettings(
    userId: string,
    settings: Partial<IUser['notification_settings']>
  ): Promise<boolean> {
    const user = await this.findById<IUser>(userId);
    if (!user) return false;

    const updatedSettings = { ...user.notification_settings, ...settings };
    const updated = await this.updateById<IUser>(userId, {
      notification_settings: updatedSettings
    });
    return updated !== null;
  }

  // Add shipping address
  static async addShippingAddress(userId: string, address: IUser['shipping_addresses'][0]): Promise<boolean> {
    const user = await this.findById<IUser>(userId);
    if (!user) return false;

    const addresses = [...user.shipping_addresses, address];
    const updated = await this.updateById<IUser>(userId, {
      shipping_addresses: addresses
    });
    return updated !== null;
  }

  // Remove shipping address
  static async removeShippingAddress(userId: string, addressId: string): Promise<boolean> {
    const user = await this.findById<IUser>(userId);
    if (!user) return false;

    const addresses = user.shipping_addresses.filter(addr => addr.id !== addressId);
    const updated = await this.updateById<IUser>(userId, {
      shipping_addresses: addresses
    });
    return updated !== null;
  }

  // Get user statistics
  static async getUserStats(userId: string): Promise<{
    watchCount: number;
    alertCount: number;
    lastLogin?: Date;
    accountAge: number;
  } | null> {
    const user = await this.findById<IUser>(userId);
    if (!user) return null;

    // These would typically be calculated with joins or separate queries
    // For now, returning basic stats
    const accountAge = Math.floor(
      (Date.now() - user.created_at.getTime()) / TIME_UNITS.DAY
    );

    return {
      watchCount: 0, // Would be calculated from watches table
      alertCount: 0, // Would be calculated from alerts table
      ...(user.last_login && { lastLogin: user.last_login }),
      accountAge
    };
  }
}