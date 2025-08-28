import { User } from '../models/User';
import { IUserRepository } from '../types/dependencies';
import { IUser } from '../types/database';

/**
 * User repository implementation that wraps the User model
 * This provides a clean interface for dependency injection
 */
export class UserRepository implements IUserRepository {
  async findById<T>(id: string): Promise<T | null> {
    return User.findById<T>(id);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return User.findByEmail(email);
  }

  async findOneBy<T>(criteria: Partial<T>): Promise<T | null> {
    return User.findOneBy<T>(criteria);
  }

  async findAll<T>(options?: any): Promise<any> {
    return User.findAll<T>(options);
  }

  async createUser(userData: any): Promise<IUser> {
    return User.createUser(userData);
  }

  async updateById<T>(id: string, data: Partial<T>): Promise<T | null> {
    return User.updateById<T>(id, data);
  }

  async updatePreferences(userId: string, preferences: any): Promise<boolean> {
    return User.updatePreferences(userId, preferences);
  }

  async updateNotificationSettings(userId: string, settings: any): Promise<boolean> {
    return User.updateNotificationSettings(userId, settings);
  }

  async addShippingAddress(userId: string, address: any): Promise<boolean> {
    return User.addShippingAddress(userId, address);
  }

  async removeShippingAddress(userId: string, addressId: string): Promise<boolean> {
    return User.removeShippingAddress(userId, addressId);
  }

  async getUserStats(userId: string): Promise<any> {
    return User.getUserStats(userId);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return User.verifyPassword(password, hash);
  }

  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    return User.updatePassword(userId, newPassword);
  }

  async handleFailedLogin(userId: string): Promise<void> {
    return User.handleFailedLogin(userId);
  }

  async handleSuccessfulLogin(userId: string): Promise<void> {
    return User.handleSuccessfulLogin(userId);
  }

  async isAccountLocked(userId: string): Promise<boolean> {
    return User.isAccountLocked(userId);
  }

  async setResetToken(userId: string, token: string, expiresAt: Date): Promise<boolean> {
    return User.setResetToken(userId, token, expiresAt);
  }

  async verifyEmail(userId: string): Promise<boolean> {
    return User.verifyEmail(userId);
  }
}