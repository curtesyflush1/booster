import request from 'supertest';
import { app } from '../../src/index';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/testHelpers';

describe('API Performance Tests', () => {
  let server: any;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    server = app.listen(0);

    // Create test user and get auth token
    const userData = {
      email: 'perf-test@example.com',
      password: 'PerfTest123!',
      firstName: 'Performance',
      lastName: 'Test'
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    if (server) {
      server.close();
    }
  });

  describe('Authentication Performance', () => {
    it('should handle login requests under 200ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'perf-test@example.com',
          password: 'PerfTest123!'
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });

    it('should handle concurrent login requests', async () => {
      const concurrentRequests = 50;
      const requests = Array(concurrentRequests).fill(null).map(() => {
        const startTime = Date.now();
        return request(app)
          .post('/api/auth/login')
          .send({
            email: 'perf-test@example.com',
            password: 'PerfTest123!'
          })
          .then(response => ({
            status: response.status,
            responseTime: Date.now() - startTime
          }));
      });

      const results = await Promise.all(requests);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Calculate performance metrics
      const responseTimes = results.map(r => r.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      console.log(`Average response time: ${avgResponseTime}ms`);
      console.log(`P95 response time: ${p95ResponseTime}ms`);

      expect(avgResponseTime).toBeLessThan(500);
      expect(p95ResponseTime).toBeLessThan(1000);
    });
  });

  describe('Product Search Performance', () => {
    it('should handle product search under 300ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/products/search')
        .query({ q: 'Pokemon TCG', limit: 20 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(300);
    });

    it('should handle high-volume search requests', async () => {
      const searchQueries = [
        'Pokemon TCG Booster',
        'Elite Trainer Box',
        'Battle Deck',
        'Collection Box',
        'Premium Collection'
      ];

      const concurrentRequests = 100;
      const requests = Array(concurrentRequests).fill(null).map((_, index) => {
        const query = searchQueries[index % searchQueries.length];
        const startTime = Date.now();
        
        return request(app)
          .get('/api/products/search')
          .query({ q: query, limit: 10 })
          .set('Authorization', `Bearer ${authToken}`)
          .then(response => ({
            query,
            status: response.status,
            resultCount: response.body.products?.length || 0,
            responseTime: Date.now() - startTime
          }));
      });

      const results = await Promise.all(requests);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Performance metrics
      const responseTimes = results.map(r => r.responseTime);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`Search performance - Avg: ${avgResponseTime}ms, Max: ${maxResponseTime}ms`);

      expect(avgResponseTime).toBeLessThan(400);
      expect(maxResponseTime).toBeLessThan(2000);
    });
  });

  describe('Watch Management Performance', () => {
    it('should handle watch creation efficiently', async () => {
      const watchCount = 50;
      const startTime = Date.now();

      const requests = Array(watchCount).fill(null).map((_, index) => 
        request(app)
          .post('/api/watches')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            productId: `perf-product-${index}`,
            retailers: ['bestbuy', 'walmart'],
            maxPrice: 100,
            isActive: true
          })
      );

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All watches should be created successfully
      results.forEach(result => {
        expect(result.status).toBe(201);
      });

      const avgTimePerWatch = totalTime / watchCount;
      console.log(`Watch creation - Total: ${totalTime}ms, Avg per watch: ${avgTimePerWatch}ms`);

      expect(avgTimePerWatch).toBeLessThan(100);
    });

    it('should handle watch list retrieval efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/watches')
        .query({ limit: 100, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.watches).toBeDefined();
      expect(responseTime).toBeLessThan(200);
    });
  });

  describe('Alert Processing Performance', () => {
    it('should handle alert generation efficiently', async () => {
      const alertCount = 100;
      const startTime = Date.now();

      const requests = Array(alertCount).fill(null).map((_, index) => 
        request(app)
          .post('/api/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            userId: 'perf-user-id',
            productId: `perf-product-${index % 10}`,
            retailerId: 'bestbuy',
            type: 'restock',
            priority: 'medium',
            data: {
              productName: `Performance Test Product ${index}`,
              retailerName: 'Best Buy',
              price: 49.99,
              availability: 'in_stock',
              productUrl: `https://bestbuy.com/product/${index}`
            }
          })
      );

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All alerts should be created successfully
      results.forEach(result => {
        expect(result.status).toBe(201);
      });

      const avgTimePerAlert = totalTime / alertCount;
      console.log(`Alert generation - Total: ${totalTime}ms, Avg per alert: ${avgTimePerAlert}ms`);

      expect(avgTimePerAlert).toBeLessThan(50);
    });

    it('should handle alert inbox retrieval efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/alerts')
        .query({ limit: 50, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.alerts).toBeDefined();
      expect(responseTime).toBeLessThan(150);
    });
  });

  describe('Database Query Performance', () => {
    it('should handle complex queries efficiently', async () => {
      // Test complex search with multiple filters
      const startTime = Date.now();
      
      await request(app)
        .get('/api/products/search')
        .query({
          q: 'Pokemon',
          category: 'booster-packs',
          retailer: 'bestbuy',
          minPrice: 10,
          maxPrice: 100,
          inStock: true,
          sortBy: 'price',
          sortOrder: 'asc',
          limit: 50
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(400);
    });

    it('should handle pagination efficiently', async () => {
      const pageSize = 20;
      const pageCount = 10;
      const responseTimes: number[] = [];

      for (let page = 0; page < pageCount; page++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/products/search')
          .query({
            q: 'Pokemon',
            limit: pageSize,
            offset: page * pageSize
          })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        responseTimes.push(Date.now() - startTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`Pagination performance - Avg: ${avgResponseTime}ms, Max: ${maxResponseTime}ms`);

      expect(avgResponseTime).toBeLessThan(300);
      expect(maxResponseTime).toBeLessThan(500);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should not leak memory during high load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate high load
      const requests = Array(200).fill(null).map(() => 
        request(app)
          .get('/api/products/search')
          .query({ q: 'memory-test', limit: 10 })
          .set('Authorization', `Bearer ${authToken}`)
      );

      await Promise.all(requests);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`Memory usage - Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB, Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB (${memoryIncreasePercent.toFixed(1)}%)`);

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });

    it('should handle concurrent connections efficiently', async () => {
      const connectionCount = 100;
      const startTime = Date.now();

      // Create many concurrent connections
      const requests = Array(connectionCount).fill(null).map((_, index) => 
        request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .then(response => ({
            index,
            status: response.status,
            responseTime: Date.now() - startTime
          }))
      );

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All connections should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      const avgTimePerConnection = totalTime / connectionCount;
      console.log(`Concurrent connections - Total: ${totalTime}ms, Avg: ${avgTimePerConnection}ms`);

      expect(avgTimePerConnection).toBeLessThan(100);
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should enforce rate limits without significant performance impact', async () => {
      const requestCount = 150; // Exceed rate limit
      const startTime = Date.now();

      const requests = Array(requestCount).fill(null).map(() => 
        request(app)
          .get('/api/products/search')
          .query({ q: 'rate-limit-test' })
          .set('Authorization', `Bearer ${authToken}`)
          .then(response => ({
            status: response.status,
            responseTime: Date.now() - startTime
          }))
          .catch(error => ({
            status: error.status || 500,
            responseTime: Date.now() - startTime
          }))
      );

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // Some requests should be rate limited (429)
      const successfulRequests = results.filter(r => r.status === 200);
      const rateLimitedRequests = results.filter(r => r.status === 429);

      expect(successfulRequests.length).toBeGreaterThan(0);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);

      // Rate limiting should not significantly impact performance
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(avgResponseTime).toBeLessThan(1000);

      console.log(`Rate limiting - Successful: ${successfulRequests.length}, Rate limited: ${rateLimitedRequests.length}, Avg time: ${avgResponseTime}ms`);
    });
  });
});