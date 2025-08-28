import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { authService } from '../../src/services/authService';
import { AdminUserService } from '../../src/services/adminUserService';
import { AdminMLService } from '../../src/services/adminMLService';
import { AdminSystemService } from '../../src/services/adminSystemService';

describe('Admin Controller', () => {
  let adminToken: string;
  let userToken: string;
  let adminUserId: string;
  let regularUserId: string;

  beforeAll(async () => {
    // Create admin user
    const adminUser = await User.createUser({
      email: 'test-admin@example.com',
      password: 'password123',
      first_name: 'Admin',
      last_name: 'User'
    });
    
    // Update to admin role
    await User.updateById(adminUser.id, {
      role: 'super_admin',
      admin_permissions: [
        'user_management',
        'user_suspend',
        'user_delete',
        'ml_model_training',
        'ml_data_review',
        'system_monitoring',
        'analytics_view',
        'audit_log_view'
      ]
    });

    adminUserId = adminUser.id;

    // Create regular user
    const regularUser = await User.createUser({
      email: 'test-user@example.com',
      password: 'password123',
      first_name: 'Regular',
      last_name: 'User'
    });

    regularUserId = regularUser.id;

    // Get tokens
    const adminLoginResult = await authService.login({
      email: 'test-admin@example.com',
      password: 'password123'
    });
    adminToken = adminLoginResult.tokens.access_token;

    const userLoginResult = await authService.login({
      email: 'test-user@example.com',
      password: 'password123'
    });
    userToken = userLoginResult.tokens.access_token;
  });

  describe('GET /api/admin/dashboard/stats', () => {
    it('should return dashboard statistics for admin', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data).toHaveProperty('ml_models');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/admin/dashboard/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should deny access without authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/stats')
        .expect(401);
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return paginated users list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    it('should support search filtering', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=test-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should support role filtering', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=super_admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/users/:userId', () => {
    it('should return user details for admin', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${regularUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id', regularUserId);
      expect(response.body.data).toHaveProperty('email', 'test-user@example.com');
      expect(response.body.data).toHaveProperty('watch_count');
      expect(response.body.data).toHaveProperty('alert_count');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      await request(app)
        .get(`/api/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/admin/users/:userId/role', () => {
    it('should update user role for super admin', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'admin',
          permissions: ['user_management', 'analytics_view']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');

      // Verify the role was updated
      const updatedUser = await User.findById(regularUserId) as any;
      expect(updatedUser?.role).toBe('admin');
      expect(updatedUser?.admin_permissions).toEqual(['user_management', 'analytics_view']);
    });

    it('should validate role values', async () => {
      await request(app)
        .put(`/api/admin/users/${regularUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'invalid_role',
          permissions: []
        })
        .expect(400);
    });
  });

  describe('PUT /api/admin/users/:userId/suspend', () => {
    it('should suspend user', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          suspend: true,
          reason: 'Test suspension'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('suspended successfully');

      // Verify the user was suspended
      const suspendedUser = await User.findById(regularUserId) as any;
      expect(suspendedUser?.locked_until).toBeTruthy();
    });

    it('should unsuspend user', async () => {
      const response = await request(app)
        .put(`/api/admin/users/${regularUserId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          suspend: false,
          reason: 'Test unsuspension'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('unsuspended successfully');

      // Verify the user was unsuspended
      const unsuspendedUser = await User.findById(regularUserId) as any;
      expect(unsuspendedUser?.locked_until).toBeNull();
    });
  });

  describe('GET /api/admin/ml/models', () => {
    it('should return ML models list for admin', async () => {
      const response = await request(app)
        .get('/api/admin/ml/models')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/admin/system/health', () => {
    it('should return system health status for admin', async () => {
      const response = await request(app)
        .get('/api/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/admin/audit/logs', () => {
    it('should return audit logs for admin', async () => {
      const response = await request(app)
        .get('/api/admin/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('logs');
      expect(response.body.data).toHaveProperty('total');
      expect(Array.isArray(response.body.data.logs)).toBe(true);
    });

    it('should support filtering by action', async () => {
      const response = await request(app)
        .get('/api/admin/audit/logs?action=user_role_updated')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  afterAll(async () => {
    // Clean up test users
    await User.deleteById(adminUserId);
    await User.deleteById(regularUserId);
  });
});