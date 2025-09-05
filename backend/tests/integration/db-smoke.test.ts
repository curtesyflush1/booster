import request from 'supertest';
import app from '../../src/index';

describe('DB-backed Integration Smoke', () => {
  const email = 'ci-smoke@example.com';
  const password = 'CiSmokePass123!';

  it('health endpoints respond', async () => {
    const live = await request(app).get('/health/live');
    expect(live.status).toBe(200);
    const ready = await request(app).get('/health/ready');
    expect(ready.status).toBe(200);
    const detailed = await request(app).get('/health/detailed');
    expect(detailed.status).toBe(200);
  });

  it('registers and logs in a user via API', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email, password, first_name: 'CI', last_name: 'Smoke', terms_accepted: true });

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
    expect(profile.body).toBeTruthy();
  });
});

