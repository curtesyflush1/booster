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
            const mockSearchResult = {
                data: [
                    createMockProduct({
                        id: generateTestUUID('prod1'),
                        name: 'Charizard Card',
                        slug: 'charizard-card',
                        upc: '123456789012'
                    })
                ],
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
            const categoryId = generateTestUUID('cat1');
            const mockCategoryResult = {
                data: [
                    createMockProduct({
                        id: generateTestUUID('prod2'),
                        name: 'Category Product',
                        category_id: categoryId
                    })
                ],
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
            const mockPriceResult = {
                data: [
                    createMockProduct({
                        id: generateTestUUID('prod3'),
                        name: 'Affordable Product',
                        msrp: 25.99
                    })
                ],
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
            const productId = generateTestUUID('prod4');
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
            expect(MockedProduct.incrementPopularity).toHaveBeenCalledWith(productId, 2);
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
            const productId = generateTestUUID('prod5');
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
            expect(MockedProduct.incrementPopularity).toHaveBeenCalledWith(productId, 1);
        });

        it('should return 404 for non-existent product', async () => {
            const nonExistentId = generateTestUUID('none');
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