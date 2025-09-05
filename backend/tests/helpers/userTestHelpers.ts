import { IUser } from '../../src/types/database';
import { SubscriptionTier } from '../../src/types/subscription';
import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';

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

// Integration helpers
type CreateTestUserInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: 'user' | 'admin' | 'super_admin';
};

export const createTestUser = async (opts: CreateTestUserInput): Promise<{ user: any; token: string }> => {
  const {
    email,
    password,
    firstName = 'Test',
    lastName = 'User',
    role = 'user'
  } = opts;

  // Register via API to ensure password hashing works for login
  const reg = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      terms_accepted: true
    });

  // Some handlers return 201 with token, others may return 200; accept either
  if (![200, 201].includes(reg.status)) {
    // If already exists, proceed to login
  }

  // Login to get token
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const token = (login.body && (login.body.token || login.body.access_token)) || '';

  // Update role directly in DB if needed
  let user = await User.findOneBy<IUser>({ email } as any);
  if (user && role !== user.role) {
    await User.updateById<IUser>(user.id, {
      role,
      admin_permissions: role !== 'user' ? JSON.stringify(['user_management', 'analytics_view']) : JSON.stringify([])
    } as any);
    user = await User.findOneBy<IUser>({ email } as any);
  }

  return { user, token } as any;
};

export const loginTestUser = async (email: string, password: string): Promise<string> => {
  const login = await request(app).post('/api/auth/login').send({ email, password });
  if (![200].includes(login.status)) {
    throw new Error(`Login failed for ${email}: status ${login.status}`);
  }
  return (login.body && (login.body.token || login.body.access_token)) || '';
};
