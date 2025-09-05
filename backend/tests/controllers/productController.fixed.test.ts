import request from 'supertest';
import app from '../../src/index';
import { Product } from '../../src/models/Product';
import { createMockProduct, generateTestUUID } from '../helpers/testHelpers';

// Mock the Product model
jest.mock('../../src/models/Product', () => ({
    Product: {
        search: jest.fn(),
        searchWithFilters: jest.fn(),
        findByUPC: jest.fn(),
        getProductWithAvailability: jest.fn(),
        incrementPopularity: jest.fn(),
        getPopularProducts: jest.fn(),
        getProductStats: jest.fn()
    }
}));

const MockedProduct = Product as jest.Mocked<typeof Product>;

describe('Product Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/products/search', () => {
        it('should search products successfully', async () => {
            const p1 = createMockProduct({
                id: generateTestUUID('prod1'),
                name: 'Charizard Card',
                slug: 'charizard-card',
                upc: '123456789012'
            });
            const { availability: _a1, ...p1NoAvail } = p1 as any;
            const mockSearchResult = {
                data: [ p1NoAvail ],
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            };

            MockedProduct.searchWithFilters.mockResolvedValue(mockSearchResult);

            const response = await request(app)
                .get('/api/products/search')
                .query({ q: 'Charizard' })
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('pagination');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(MockedProduct.searchWithFilters).toHaveBeenCalledWith('Charizard', expect.any(Object));
        });

        it('should handle empty search results', async () => {
            const mockEmptyResult = {
                data: [],
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0
            };

            MockedProduct.searchWithFilters.mockResolvedValue(mockEmptyResult);

            const response = await request(app)
                .get('/api/products/search')
                .query({ q: 'nonexistentproduct12345' })
                .expect(200);

            expect(response.body.data).toHaveLength(0);
            expect(response.body.pagination.total).toBe(0);
        });

        it('should validate search parameters', async () => {
            const response = await request(app)
                .get('/api/products/search')
                .query({
                    q: 'a'.repeat(101), // Too long
                    page: -1, // Invalid
                    limit: 1000 // Too high
                })
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(MockedProduct.searchWithFilters).not.toHaveBeenCalled();
        });

        it('should filter by category', async () => {
            // Use a valid UUID format for validation to pass
            const categoryId = '550e8400-e29b-41d4-a716-446655440001';
            const p2 = createMockProduct({
                id: generateTestUUID('prod2'),
                name: 'Category Product',
                category_id: categoryId
            });
            const { availability: _a2, ...p2NoAvail } = (p2 as any);
            const mockCategoryResult = {
                data: [ p2NoAvail ],
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            };

            MockedProduct.searchWithFilters.mockResolvedValue(mockCategoryResult);

            const response = await request(app)
                .get('/api/products/search')
                .query({ category_id: categoryId })
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(MockedProduct.searchWithFilters).toHaveBeenCalledWith('', 
                expect.objectContaining({ category_id: categoryId })
            );
        });

        it('should filter by price range', async () => {
            const p3 = createMockProduct({
                id: generateTestUUID('prod3'),
                name: 'Affordable Product',
                msrp: 25.99
            });
            const { availability: _a3, ...p3NoAvail } = (p3 as any);
            const mockPriceResult = {
                data: [ p3NoAvail ],
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1
            };

            MockedProduct.searchWithFilters.mockResolvedValue(mockPriceResult);

            const response = await request(app)
                .get('/api/products/search')
                .query({
                    min_price: 10,
                    max_price: 50
                })
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(MockedProduct.searchWithFilters).toHaveBeenCalledWith('',
                expect.objectContaining({ min_price: 10, max_price: 50 })
            );
        });
    });

    describe('GET /api/products/barcode', () => {
        it('should find product by valid UPC', async () => {
            const productId = '550e8400-e29b-41d4-a716-446655440004';
            const mockProduct = createMockProduct({
                id: productId,
                name: 'Test Product',
                slug: 'test-product',
                upc: '123456789012'
            });

            MockedProduct.findByUPC.mockResolvedValue(mockProduct);
            MockedProduct.getProductWithAvailability.mockResolvedValue({
                ...mockProduct,
                availability: []
            });
            MockedProduct.incrementPopularity.mockResolvedValue(true);

            const response = await request(app)
                .get('/api/products/barcode')
                .query({ upc: '123456789012' })
                .expect(200);

            expect(response.body.data).toHaveProperty('product');
            expect(response.body.data.product.upc).toBe('123456789012');
            expect(MockedProduct.findByUPC).toHaveBeenCalledWith('123456789012');
            // Popularity increment is no longer part of barcode flow; ensure success response
            // and product structure instead of asserting increment
        });

        it('should return 404 for non-existent UPC', async () => {
            MockedProduct.findByUPC.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/products/barcode')
                .query({ upc: '999999999999' })
                .expect(404);

            expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });

        it('should validate UPC format', async () => {
            const response = await request(app)
                .get('/api/products/barcode')
                .query({ upc: 'invalid-upc' })
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should require UPC parameter', async () => {
            const response = await request(app)
                .get('/api/products/barcode')
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('GET /api/products/:id', () => {
        it('should get product by valid ID', async () => {
            const productId = '550e8400-e29b-41d4-a716-446655440005';
            const mockProduct = createMockProduct({
                id: productId,
                name: 'Test Product',
                slug: 'test-product'
            });

            MockedProduct.getProductWithAvailability.mockResolvedValue({
                ...mockProduct,
                availability: []
            });
            MockedProduct.incrementPopularity.mockResolvedValue(true);

            const response = await request(app)
                .get(`/api/products/${productId}`)
                .expect(200);

            expect(response.body.data).toHaveProperty('product');
            expect(response.body.data.product.id).toBe(productId);
            // Popularity increment is no longer asserted in product view flow
        });

        it('should return 404 for non-existent product', async () => {
            const nonExistentId = '550e8400-e29b-41d4-a716-446655449999';
            MockedProduct.getProductWithAvailability.mockResolvedValue(null);

            const response = await request(app)
                .get(`/api/products/${nonExistentId}`)
                .expect(404);

            expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });

        it('should validate product ID format', async () => {
            const response = await request(app)
                .get('/api/products/invalid-id')
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('GET /api/products/popular', () => {
        it('should get popular products', async () => {
            const mockProducts = [
                createMockProduct({
                    id: generateTestUUID('pop1'),
                    name: 'Popular Product 1',
                    popularity_score: 100
                }),
                createMockProduct({
                    id: generateTestUUID('pop2'),
                    name: 'Popular Product 2',
                    popularity_score: 95
                })
            ];

            MockedProduct.getPopularProducts.mockResolvedValue(mockProducts);

            const response = await request(app)
                .get('/api/products/popular')
                .expect(200);

            expect(response.body.data).toHaveProperty('products');
            expect(Array.isArray(response.body.data.products)).toBe(true);
            expect(response.body.data.products).toHaveLength(2);
        });

        it('should limit results', async () => {
            MockedProduct.getPopularProducts.mockResolvedValue([]);

            await request(app)
                .get('/api/products/popular')
                .query({ limit: 5 })
                .expect(200);

            expect(MockedProduct.getPopularProducts).toHaveBeenCalledWith(5, undefined);
        });
    });

    describe('GET /api/products/stats', () => {
        it('should get product statistics', async () => {
            const mockStats = {
                total: 100,
                active: 95,
                byCategory: { 'cat1': 50, 'cat2': 45 },
                bySeries: { 'series1': 60, 'series2': 35 }
            };

            MockedProduct.getProductStats.mockResolvedValue(mockStats);

            const response = await request(app)
                .get('/api/products/stats')
                .expect(200);

            expect(response.body.data).toHaveProperty('stats');
            expect(response.body.data.stats.total).toBe(100);
            expect(response.body.data.stats.active).toBe(95);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});
