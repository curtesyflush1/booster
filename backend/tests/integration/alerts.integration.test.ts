import request from 'supertest';

// Mock Alert model methods used by routes before importing app
jest.mock('../../src/models/Alert', () => ({
  Alert: {
    findByUserId: jest.fn(async (_userId: string, _opts: any) => ({ data: [{ id: 'a1' }], total: 1, page: 1, limit: 20 })),
    findById: jest.fn(async (id: string) => ({ id, user_id: 'test-user-id' })),
    markAsRead: jest.fn(async () => true),
    markAsClicked: jest.fn(async () => true),
    bulkMarkAsRead: jest.fn(async (ids: string[]) => ids.length),
    deleteById: jest.fn(async () => true),
    getUserAlertStats: jest.fn(async (_userId: string) => ({ total: 0, unread: 0, byType: {}, byStatus: {}, clickThroughRate: 0, recentAlerts: 0 })),
    getTableName: () => 'alerts',
    db: jest.fn(() => ({ whereIn: () => ({ where: () => ({ count: async () => [{ count: '1' }] }) }) }))
  }
}));

process.env.TEST_BYPASS_AUTH = 'true';
process.env.TEST_DISABLE_RATE_LIMIT = 'true';

import app from '../../src/index';

describe('Alert Routes (Integration, mocked model)', () => {
  const token = 'dummy';

  it('GET /api/alerts returns alerts with pagination', async () => {
    const res = await request(app).get('/api/alerts').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.pagination).toBeDefined();
  });

  it('PATCH /api/alerts/bulk/read marks alerts as read', async () => {
    const res = await request(app)
      .patch('/api/alerts/bulk/read')
      .set('Authorization', `Bearer ${token}`)
      .send({ alertIds: ['a1'] })
      .expect(200);
    expect(res.body.updatedCount).toBe(1);
  });

  it('PATCH /api/alerts/a1/read', async () => {
    await request(app).patch('/api/alerts/a1/read').set('Authorization', `Bearer ${token}`).send({}).expect(200);
  });

  it('DELETE /api/alerts/a1 deletes', async () => {
    await request(app).delete('/api/alerts/a1').set('Authorization', `Bearer ${token}`).expect(200);
  });
});

