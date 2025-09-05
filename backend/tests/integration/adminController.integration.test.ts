import request from 'supertest';

// Mock admin controller handlers before importing the app
jest.mock('../../src/controllers/adminController', () => ({
  getDashboardStats: (_req: any, res: any) => res.status(200).json({ success: true, data: { users: {}, alerts: {}, system: {}, ml_models: {} } }),
  getUserStats: (_req: any, res: any) => res.status(200).json({ success: true, data: { total: 1, active: 1 } }),
  getUsers: (_req: any, res: any) => res.status(200).json({ success: true, data: { users: [], total: 0, page: 1, limit: 20 } }),
  getUserDetails: (_req: any, res: any) => res.status(200).json({ success: true, data: { id: 'user-1', email: 'test@example.com', watch_count: 0, alert_count: 0 } }),
  updateUserRole: (_req: any, res: any) => res.status(200).json({ success: true, message: 'Role updated successfully' }),
  suspendUser: (_req: any, res: any) => res.status(200).json({ success: true, message: 'User suspended successfully' }),
  deleteUser: (_req: any, res: any) => res.status(200).json({ success: true, message: 'User deleted successfully' }),
  getMLModels: (_req: any, res: any) => res.status(200).json({ success: true, data: [] }),
  getSystemHealth: (_req: any, res: any) => res.status(200).json({ success: true, data: { status: 'healthy' } })
}));

// Ensure auth bypass in integration tests
process.env.TEST_BYPASS_AUTH = 'true';
process.env.TEST_DISABLE_RATE_LIMIT = 'true';

import app from '../../src/index';

describe('Admin Controller (Integration, mocked handlers)', () => {
  const token = 'dummy';

  it('GET /api/admin/dashboard/stats returns 200', async () => {
    await request(app).get('/api/admin/dashboard/stats').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('GET /api/admin/users returns 200 with pagination', async () => {
    const res = await request(app).get('/api/admin/users?page=1&limit=20').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('users');
  });
});

