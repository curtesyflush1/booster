import { IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';

export const createMockUser = (overrides: Partial<Omit<IUser, 'password_hash'>> = {}): Omit<IUser, 'password_hash'> => ({
  id: 'user-123',
  email: 'test@example.com',
  subscription_tier: SubscriptionTier.FREE,
  role: 'user',
  first_name: 'John',
  last_name: 'Doe',
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
  updated_at: new Date(),
  ...overrides
});

export const createFreeUser = (overrides?: Partial<Omit<IUser, 'password_hash'>>) => 
  createMockUser({ subscription_tier: SubscriptionTier.FREE, ...overrides });

export const createProUser = (overrides?: Partial<Omit<IUser, 'password_hash'>>) => 
  createMockUser({ subscription_tier: SubscriptionTier.PRO, ...overrides });

export const createUnverifiedUser = (overrides?: Partial<Omit<IUser, 'password_hash'>>) => 
  createMockUser({ email_verified: false, ...overrides });