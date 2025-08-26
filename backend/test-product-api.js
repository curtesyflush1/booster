const { Product } = require('./dist/models/Product');
const { ProductCategory } = require('./dist/models/ProductCategory');

async function testProductAPI() {
    try {
        console.log('🧪 Testing Product API functionality...\n');

        // Test 1: Get product statistics
        console.log('1. Testing product statistics...');
        try {
            const stats = await Product.getProductStats();
            console.log('✅ Product stats:', stats);
        } catch (error) {
            console.log('❌ Product stats failed:', error.message);
        }

        // Test 2: Search products
        console.log('\n2. Testing product search...');
        try {
            const searchResults = await Product.searchWithFilters('Pokemon', { limit: 3 });
            console.log('✅ Search results:', {
                total: searchResults.total,
                count: searchResults.data.length,
                products: searchResults.data.map(p => ({ id: p.id, name: p.name }))
            });
        } catch (error) {
            console.log('❌ Product search failed:', error.message);
        }

        // Test 3: Get popular products
        console.log('\n3. Testing popular products...');
        try {
            const popular = await Product.getPopularProducts(3);
            console.log('✅ Popular products:', popular.map(p => ({ name: p.name, score: p.popularity_score })));
        } catch (error) {
            console.log('❌ Popular products failed:', error.message);
        }

        // Test 4: Find product by UPC
        console.log('\n4. Testing UPC lookup...');
        try {
            const product = await Product.findByUPC('820650850011');
            if (product) {
                console.log('✅ Found product by UPC:', { name: product.name, upc: product.upc });
            } else {
                console.log('ℹ️ No product found with that UPC');
            }
        } catch (error) {
            console.log('❌ UPC lookup failed:', error.message);
        }

        // Test 5: Get categories
        console.log('\n5. Testing categories...');
        try {
            const categories = await ProductCategory.getAllWithHierarchy();
            console.log('✅ Categories:', categories.map(c => ({ name: c.name, slug: c.slug })));
        } catch (error) {
            console.log('❌ Categories failed:', error.message);
        }

        console.log('\n🎉 Product API testing completed!');
        process.exit(0);
    } catch (error) {
        console.error('💥 Test failed:', error);
        process.exit(1);
    }
}

testProductAPI();