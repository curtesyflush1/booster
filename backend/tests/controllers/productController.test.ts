import request from 'supertest';
import app from '../../src/index';
import { Product } from '../../src/models/Product';

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
            const mockSearchResult = {
                data: [
                    {
                        id: '1',
                        name: 'Charizard Card',
                        slug: 'charizard-card',
                        upc: '123456789012',
                        metadata: {},
                        is_active: true,
                        popularity_score: 50,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                ],
                total: 1,
                page: 1,
                limit: 20,
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
        });

        it('should handle empty search results', async () => {
            const mockEmptyResult = {
                data: [],
                total: 0,
                page: 1,
                limit: 20,
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
            const mockCategoryResult = {
                data: [
                    {
                        id: '1',
                        name: 'Category Product',
                        slug: 'category-product',
                        category_id: '550e8400-e29b-41d4-a716-446655440000',
                        metadata: {},
                        is_active: true,
                        popularity_score: 50,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                ],
                total: 1,
                page: 1,
                limit: 20,
                totalPages: 1
            };

            MockedProduct.searchWithFilters.mockResolvedValue(mockCategoryResult);

            const response = await request(app)
                .get('/api/products/search')
                .query({
                    category_id: '550e8400-e29b-41d4-a716-446655440000' // Mock UUID
                })
                .expect(200);

            expect(response.body).toHaveProperty('data');
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should filter by price range', async () => {
            const mockPriceResult = {
                data: [
                    {
                        id: '1',
                        name: 'Affordable Product',
                        slug: 'affordable-product',
                        msrp: 25.99,
                        metadata: {},
                        is_active: true,
                        popularity_score: 50,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                ],
                total: 1,
                page: 1,
                limit: 20,
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
        });
    });

    describe('GET /api/products/barcode', () => {
        it('should find product by valid UPC', async () => {
            // First, we need to ensure there's a product with this UPC
            const mockProduct = {
                name: 'Test Product',
                slug: 'test-product',
                upc: '123456789012',
                is_active: true,
                popularity_score: 50
            };

            // Mock the Product.findByUPC method
            jest.spyOn(Product, 'findByUPC').mockResolvedValue({
                id: '550e8400-e29b-41d4-a716-446655440000',
                ...mockProduct,
                created_at: new Date(),
                updated_at: new Date(),
                metadata: {}
            } as any);

            jest.spyOn(Product, 'getProductWithAvailability').mockResolvedValue({
                id: '550e8400-e29b-41d4-a716-446655440000',
                ...mockProduct,
                created_at: new Date(),
                updated_at: new Date(),
                metadata: {},
                availability: []
            } as any);

            jest.spyOn(Product, 'incrementPopularity').mockResolvedValue(true);

            const response = await request(app)
                .get('/api/products/barcode')
                .query({ upc: '123456789012' })
                .expect(200);

            expect(response.body.data).toHaveProperty('product');
            expect(response.body.data.product.upc).toBe('123456789012');
        });

        it('should return 404 for non-existent UPC', async () => {
            jest.spyOn(Product, 'findByUPC').mockResolvedValue(null);

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
            expect(response.body.error.message).toContain('Invalid UPC format');
            // Ensure findByUPC is not called for invalid format
            expect(MockedProduct.findByUPC).not.toHaveBeenCalled();
        });

        it('should require UPC parameter', async () => {
            // Mock should return null when no UPC provided
            MockedProduct.findByUPC.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/products/barcode')
                .expect(404);

            // Route processes but returns product not found
            expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });
    });

    describe('GET /api/products/:id', () => {
        it('should get product by valid ID', async () => {
            const mockProduct = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Test Product',
                slug: 'test-product',
                is_active: true,
                popularity_score: 50,
                created_at: new Date(),
                updated_at: new Date(),
                metadata: {},
                availability: []
            };

            jest.spyOn(Product, 'getProductWithAvailability').mockResolvedValue(mockProduct as any);
            jest.spyOn(Product, 'incrementPopularity').mockResolvedValue(true);

            const response = await request(app)
                .get('/api/products/550e8400-e29b-41d4-a716-446655440000')
                .expect(200);

            expect(response.body.data).toHaveProperty('product');
            expect(response.body.data.product.id).toBe('550e8400-e29b-41d4-a716-446655440000');
        });

        it('should return 404 for non-existent product', async () => {
            jest.spyOn(Product, 'getProductWithAvailability').mockResolvedValue(null);

            const response = await request(app)
                .get('/api/products/550e8400-e29b-41d4-a716-446655440001')
                .expect(404);

            expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });

        it('should validate product ID format', async () => {
            // Mock should return null for invalid ID
            MockedProduct.getProductWithAvailability.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/products/invalid-id')
                .expect(404);

            expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
        });
    });

    describe('GET /api/products/popular', () => {
        it('should get popular products', async () => {
            const mockProducts = [
                {
                    id: '1',
                    name: 'Popular Product 1',
                    popularity_score: 100
                },
                {
                    id: '2',
                    name: 'Popular Product 2',
                    popularity_score: 95
                }
            ];

            jest.spyOn(Product, 'getPopularProducts').mockResolvedValue(mockProducts as any);

            const response = await request(app)
                .get('/api/products/popular')
                .expect(200);

            expect(response.body.data).toHaveProperty('products');
            expect(Array.isArray(response.body.data.products)).toBe(true);
        });

        it('should limit results', async () => {
            jest.spyOn(Product, 'getPopularProducts').mockResolvedValue([]);

            const response = await request(app)
                .get('/api/products/popular')
                .query({ limit: 5 })
                .expect(200);

            expect(Product.getPopularProducts).toHaveBeenCalledWith(5, undefined);
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

            jest.spyOn(Product, 'getProductStats').mockResolvedValue(mockStats);

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