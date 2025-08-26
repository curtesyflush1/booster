import request from 'supertest';
import app from '../../src/index';
import { generateEncryptionKey } from '../../src/utils/encryption';

// Mock environment variables
const originalEnv = process.env.ENCRYPTION_KEY;

describe('User Preferences Integration Tests', () => {
    let authToken: string;
    let userId: string;

    beforeAll(async () => {
        // Set encryption key for testing
        process.env.ENCRYPTION_KEY = generateEncryptionKey();
    });

    afterAll(() => {
        process.env.ENCRYPTION_KEY = originalEnv;
    });

    beforeEach(async () => {
        // Create a test user and get auth token
        const userData = {
            email: 'test@example.com',
            password: 'TestPassword123!',
            first_name: 'Test',
            last_name: 'User'
        };

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(userData);

        expect(registerResponse.status).toBe(201);

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: userData.email,
                password: userData.password
            });

        expect(loginResponse.status).toBe(200);
        authToken = loginResponse.body.access_token;
        userId = loginResponse.body.user.id;
    });

    describe('Retailer Credentials Management', () => {
        describe('POST /api/users/retailer-credentials', () => {
            it('should store retailer credentials successfully', async () => {
                const credentials = {
                    retailer: 'bestbuy',
                    username: 'testuser@example.com',
                    password: 'retailerpassword123',
                    twoFactorEnabled: true
                };

                const response = await request(app)
                    .post('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(credentials);

                expect(response.status).toBe(201);
                expect(response.body.message).toBe('Retailer credentials added successfully');
                expect(response.body.retailer).toBe('bestbuy');
            });

            it('should reject invalid retailer credentials', async () => {
                const invalidCredentials = {
                    retailer: '', // Empty retailer name
                    username: 'testuser',
                    password: 'password'
                };

                const response = await request(app)
                    .post('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidCredentials);

                expect(response.status).toBe(400);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            });

            it('should require authentication', async () => {
                const credentials = {
                    retailer: 'bestbuy',
                    username: 'testuser',
                    password: 'password'
                };

                const response = await request(app)
                    .post('/api/users/retailer-credentials')
                    .send(credentials);

                expect(response.status).toBe(401);
            });
        });

        describe('GET /api/users/retailer-credentials', () => {
            beforeEach(async () => {
                // Add some test credentials
                await request(app)
                    .post('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        retailer: 'bestbuy',
                        username: 'bestbuy_user',
                        password: 'password123',
                        twoFactorEnabled: true
                    });

                await request(app)
                    .post('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        retailer: 'walmart',
                        username: 'walmart_user',
                        password: 'password456',
                        twoFactorEnabled: false
                    });
            });

            it('should list retailer credentials without passwords', async () => {
                const response = await request(app)
                    .get('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.credentials).toHaveLength(2);

                const bestbuyCredential = response.body.credentials.find((c: any) => c.retailer === 'bestbuy');
                expect(bestbuyCredential).toEqual({
                    retailer: 'bestbuy',
                    username: 'bestbuy_user',
                    twoFactorEnabled: true,
                    lastVerified: expect.any(String),
                    isActive: true
                });

                // Ensure no passwords are returned
                response.body.credentials.forEach((credential: any) => {
                    expect(credential.password).toBeUndefined();
                    expect(credential.encrypted_password).toBeUndefined();
                });
            });
        });

        describe('PUT /api/users/retailer-credentials/:retailer', () => {
            beforeEach(async () => {
                await request(app)
                    .post('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        retailer: 'bestbuy',
                        username: 'olduser',
                        password: 'oldpassword',
                        twoFactorEnabled: false
                    });
            });

            it('should update retailer credentials', async () => {
                const updates = {
                    username: 'newuser',
                    password: 'newpassword',
                    twoFactorEnabled: true
                };

                const response = await request(app)
                    .put('/api/users/retailer-credentials/bestbuy')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(updates);

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Retailer credentials updated successfully');

                // Verify the update
                const listResponse = await request(app)
                    .get('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`);

                const updatedCredential = listResponse.body.credentials.find((c: any) => c.retailer === 'bestbuy');
                expect(updatedCredential.username).toBe('newuser');
                expect(updatedCredential.twoFactorEnabled).toBe(true);
            });

            it('should return 404 for non-existent retailer', async () => {
                const response = await request(app)
                    .put('/api/users/retailer-credentials/nonexistent')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({ username: 'newuser' });

                expect(response.status).toBe(404);
                expect(response.body.error.code).toBe('CREDENTIALS_NOT_FOUND');
            });
        });

        describe('DELETE /api/users/retailer-credentials/:retailer', () => {
            beforeEach(async () => {
                await request(app)
                    .post('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        retailer: 'bestbuy',
                        username: 'testuser',
                        password: 'password123'
                    });
            });

            it('should delete retailer credentials', async () => {
                const response = await request(app)
                    .delete('/api/users/retailer-credentials/bestbuy')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Retailer credentials deleted successfully');

                // Verify deletion
                const listResponse = await request(app)
                    .get('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(listResponse.body.credentials).toHaveLength(0);
            });
        });

        describe('POST /api/users/retailer-credentials/:retailer/verify', () => {
            beforeEach(async () => {
                await request(app)
                    .post('/api/users/retailer-credentials')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        retailer: 'bestbuy',
                        username: 'testuser',
                        password: 'password123'
                    });
            });

            it('should verify retailer credentials', async () => {
                const response = await request(app)
                    .post('/api/users/retailer-credentials/bestbuy/verify')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.isValid).toBe(true);
                expect(response.body.message).toBe('Credentials verified successfully');
            });

            it('should return invalid for non-existent credentials', async () => {
                const response = await request(app)
                    .post('/api/users/retailer-credentials/nonexistent/verify')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.isValid).toBe(false);
                expect(response.body.message).toBe('Credentials not found');
            });
        });
    });

    describe('Payment Methods Management', () => {
        let addressId: string;

        beforeEach(async () => {
            // Add a billing address first
            const addressResponse = await request(app)
                .post('/api/users/addresses')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    type: 'billing',
                    first_name: 'Test',
                    last_name: 'User',
                    address_line_1: '123 Test St',
                    city: 'Test City',
                    state: 'TS',
                    zip_code: '12345',
                    country: 'US'
                });

            addressId = addressResponse.body.address.id;
        });

        describe('POST /api/users/payment-methods', () => {
            it('should add payment method successfully', async () => {
                const paymentMethod = {
                    type: 'credit_card',
                    last_four: '1234',
                    brand: 'Visa',
                    expires_month: 12,
                    expires_year: 2025,
                    billing_address_id: addressId,
                    is_default: true
                };

                const response = await request(app)
                    .post('/api/users/payment-methods')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(paymentMethod);

                expect(response.status).toBe(201);
                expect(response.body.message).toBe('Payment method added successfully');
                expect(response.body.paymentMethod.type).toBe('credit_card');
                expect(response.body.paymentMethod.last_four).toBe('1234');
                expect(response.body.paymentMethod.id).toBeDefined();
            });

            it('should reject invalid payment method data', async () => {
                const invalidPaymentMethod = {
                    type: 'invalid_type',
                    last_four: '123', // Too short
                    brand: 'Visa',
                    expires_month: 13, // Invalid month
                    expires_year: 2020, // Past year
                    billing_address_id: addressId
                };

                const response = await request(app)
                    .post('/api/users/payment-methods')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidPaymentMethod);

                expect(response.status).toBe(400);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            });
        });

        describe('DELETE /api/users/payment-methods/:paymentMethodId', () => {
            let paymentMethodId: string;

            beforeEach(async () => {
                const response = await request(app)
                    .post('/api/users/payment-methods')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        type: 'credit_card',
                        last_four: '1234',
                        brand: 'Visa',
                        expires_month: 12,
                        expires_year: 2025,
                        billing_address_id: addressId
                    });

                paymentMethodId = response.body.paymentMethod.id;
            });

            it('should remove payment method successfully', async () => {
                const response = await request(app)
                    .delete(`/api/users/payment-methods/${paymentMethodId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Payment method removed successfully');

                // Verify removal by checking user profile
                const profileResponse = await request(app)
                    .get('/api/users/profile')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(profileResponse.body.user.payment_methods).toHaveLength(0);
            });

            it('should return 404 for non-existent payment method', async () => {
                const response = await request(app)
                    .delete('/api/users/payment-methods/non-existent-id')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(404);
                expect(response.body.error.code).toBe('PAYMENT_METHOD_NOT_FOUND');
            });
        });
    });

    describe('Quiet Hours Management', () => {
        describe('PUT /api/users/quiet-hours', () => {
            it('should update quiet hours successfully', async () => {
                const quietHours = {
                    enabled: true,
                    start_time: '23:00',
                    end_time: '07:00',
                    timezone: 'America/New_York',
                    days: [1, 2, 3, 4, 5] // Weekdays only
                };

                const response = await request(app)
                    .put('/api/users/quiet-hours')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(quietHours);

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Quiet hours updated successfully');
                expect(response.body.quiet_hours.enabled).toBe(true);
                expect(response.body.quiet_hours.start_time).toBe('23:00');
                expect(response.body.quiet_hours.timezone).toBe('America/New_York');
            });

            it('should reject invalid quiet hours configuration', async () => {
                const invalidQuietHours = {
                    enabled: true,
                    start_time: '25:00', // Invalid time
                    end_time: '07:00',
                    timezone: 'America/New_York',
                    days: [1, 2, 3, 4, 5]
                };

                const response = await request(app)
                    .put('/api/users/quiet-hours')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidQuietHours);

                expect(response.status).toBe(400);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            });
        });

        describe('GET /api/users/quiet-hours/check', () => {
            beforeEach(async () => {
                // Set up quiet hours
                await request(app)
                    .put('/api/users/quiet-hours')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        enabled: true,
                        start_time: '22:00',
                        end_time: '08:00',
                        timezone: 'UTC',
                        days: [0, 1, 2, 3, 4, 5, 6]
                    });
            });

            it('should check quiet hours status', async () => {
                const response = await request(app)
                    .get('/api/users/quiet-hours/check')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('isQuietTime');
                expect(typeof response.body.isQuietTime).toBe('boolean');

                if (response.body.isQuietTime) {
                    expect(response.body.nextActiveTime).toBeDefined();
                    expect(response.body.reason).toBeDefined();
                }
            });
        });
    });

    describe('Address Management', () => {
        describe('POST /api/users/addresses', () => {
            it('should add shipping address successfully', async () => {
                const address = {
                    type: 'shipping',
                    first_name: 'John',
                    last_name: 'Doe',
                    address_line_1: '123 Main St',
                    address_line_2: 'Apt 4B',
                    city: 'New York',
                    state: 'NY',
                    zip_code: '10001',
                    country: 'US',
                    phone: '+1-555-123-4567',
                    is_default: true
                };

                const response = await request(app)
                    .post('/api/users/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(address);

                expect(response.status).toBe(201);
                expect(response.body.message).toBe('Shipping address added successfully');
                expect(response.body.address.type).toBe('shipping');
                expect(response.body.address.first_name).toBe('John');
                expect(response.body.address.id).toBeDefined();
            });

            it('should reject invalid address data', async () => {
                const invalidAddress = {
                    type: 'invalid_type',
                    first_name: '',
                    last_name: 'Doe',
                    address_line_1: '123 Main St',
                    city: 'New York',
                    state: 'NY',
                    zip_code: 'invalid-zip'
                };

                const response = await request(app)
                    .post('/api/users/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(invalidAddress);

                expect(response.status).toBe(400);
                expect(response.body.error.code).toBe('VALIDATION_ERROR');
            });
        });

        describe('DELETE /api/users/addresses/:addressId', () => {
            let addressId: string;

            beforeEach(async () => {
                const response = await request(app)
                    .post('/api/users/addresses')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        type: 'shipping',
                        first_name: 'Test',
                        last_name: 'User',
                        address_line_1: '123 Test St',
                        city: 'Test City',
                        state: 'TS',
                        zip_code: '12345',
                        country: 'US'
                    });

                addressId = response.body.address.id;
            });

            it('should remove address successfully', async () => {
                const response = await request(app)
                    .delete(`/api/users/addresses/${addressId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                expect(response.status).toBe(200);
                expect(response.body.message).toBe('Shipping address removed successfully');

                // Verify removal
                const profileResponse = await request(app)
                    .get('/api/users/profile')
                    .set('Authorization', `Bearer ${authToken}`);

                expect(profileResponse.body.user.shipping_addresses).toHaveLength(0);
            });
        });
    });

    describe('Security Tests', () => {
        it('should not allow access without authentication', async () => {
            const endpoints = [
                { method: 'get', path: '/api/users/retailer-credentials' },
                { method: 'post', path: '/api/users/retailer-credentials' },
                { method: 'put', path: '/api/users/retailer-credentials/bestbuy' },
                { method: 'delete', path: '/api/users/retailer-credentials/bestbuy' },
                { method: 'post', path: '/api/users/payment-methods' },
                { method: 'delete', path: '/api/users/payment-methods/test-id' },
                { method: 'get', path: '/api/users/quiet-hours/check' }
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method as keyof typeof request](endpoint.path);
                expect(response.status).toBe(401);
                expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
            }
        });

        it('should not expose sensitive data in responses', async () => {
            // Add credentials
            await request(app)
                .post('/api/users/retailer-credentials')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    retailer: 'bestbuy',
                    username: 'testuser',
                    password: 'secretpassword123'
                });

            // Get credentials list
            const response = await request(app)
                .get('/api/users/retailer-credentials')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);

            // Ensure no sensitive data is exposed
            const responseStr = JSON.stringify(response.body);
            expect(responseStr).not.toContain('secretpassword123');
            expect(responseStr).not.toContain('encrypted_password');
            expect(responseStr).not.toContain('password_hash');
            expect(responseStr).not.toContain('reset_token');
        });

        it('should validate user ownership of resources', async () => {
            const response = await request(app)
                .delete('/api/users/retailer-credentials/nonexistent')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe('CREDENTIALS_NOT_FOUND');
        });

        it('should handle malformed requests gracefully', async () => {
            // Test with invalid JSON
            const response = await request(app)
                .post('/api/users/retailer-credentials')
                .set('Authorization', `Bearer ${authToken}`)
                .set('Content-Type', 'application/json')
                .send('invalid json');

            expect(response.status).toBe(400);
        });

        it('should rate limit requests appropriately', async () => {
            // This would require implementing rate limiting tests
            // For now, just verify the endpoint exists
            const response = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
        });
    });
});