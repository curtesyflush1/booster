import request from 'supertest';
import app from '../../src/index';

describe('DB-backed Auth Smoke', () => {
  const email = `ci-auth-${Date.now()}@example.com`;
  const password = 'CiAuthPass123!';

  it('registers, logs in, and accesses profile', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, password, first_name: 'CI', last_name: 'Auth', terms_accepted: true });
    expect([200, 201, 409]).toContain(reg.status);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(login.status).toBe(200);
    const token = login.body?.token || login.body?.access_token;
    expect(token).toBeTruthy();

    const profile = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(200);
  });
});

