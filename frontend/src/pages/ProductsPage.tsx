import React, { useEffect, useState, useCallback } from 'react';
import { Camera, Package } from 'lucide-react';
import { Product, PaginatedResponse, SearchFilters } from '../types';
import { ProductSearch } from '../components/products/ProductSearch';
import { ProductDetail } from '../components/products/ProductDetail';
import { BarcodeScanner } from '../components/products/BarcodeScanner';
import { ProductGrid } from '../components/products/ProductGrid';
import { apiClient } from '../services/apiClient';
import { BackendProduct, transformBackendProducts } from '../utils/fieldMapping';

const ProductsPage: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'detail'>('search');
  
  // Basic product list state (for initial display)
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Partial<SearchFilters>>({
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('detail');
  };

  const handleProductFound = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('detail');
  };

  const handleBackToSearch = () => {
    setSelectedProduct(null);
    setActiveTab('search');
  };

  const loadProducts = useCallback(async (page = 1, append = false) => {
    setLoading(true);
    setError(null);
    try {
      // Build query params for search + filters
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });
      if (searchQuery) params.set('q', searchQuery);
      if (filters.category) params.set('category_id', filters.category);
      if (filters.retailer) params.set('retailer_id', filters.retailer);
      if (typeof filters.minPrice === 'number') params.set('min_price', String(filters.minPrice));
      if (typeof filters.maxPrice === 'number') params.set('max_price', String(filters.maxPrice));
      if (filters.inStockOnly) params.set('availability', 'in_stock');
      if (filters.sortBy) params.set('sort_by', filters.sortBy as string);
      if (filters.sortOrder) params.set('sort_order', filters.sortOrder as string);

      // Use the backend search endpoint
      const response = await apiClient.get<PaginatedResponse<BackendProduct>>(
        `/products/search?${params.toString()}`
      );
      const transformed = transformBackendProducts(response.data.data);
      setProducts(prev => (append ? [...prev, ...transformed] : transformed));
      setPagination(response.data.pagination);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, searchQuery, filters]);

  const loadMore = useCallback(() => {
    if (pagination.hasNext && !loading) {
      loadProducts(pagination.page + 1, true);
    }
  }, [pagination.hasNext, pagination.page, loading, loadProducts]);

  useEffect(() => {
    // Initial fetch
    loadProducts(1, false);
  }, [loadProducts]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(1, false);
  };

  // Check if device supports camera for barcode scanning
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            {activeTab === 'detail' && selectedProduct ? selectedProduct.name : 'Product Catalog'}
          </h1>
          <p className="text-gray-400">
            {activeTab === 'detail' 
              ? 'View product details, availability, and price history'
              : 'Search and discover Pokémon TCG products'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {activeTab === 'detail' && (
            <button
              onClick={handleBackToSearch}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Package className="w-4 h-4" />
              Back to Search
            </button>
          )}

          {isMobile && hasCamera && activeTab === 'search' && (
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
              Scan Barcode
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      {activeTab === 'search' && (
        <form onSubmit={onSubmitSearch} className="mb-6 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products (name, set, series)"
            className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <label className="inline-flex items-center gap-2 text-gray-300">
            <input
              type="checkbox"
              checked={!!filters.inStockOnly}
              onChange={(e) => setFilters(prev => ({ ...prev, inStockOnly: e.target.checked }))}
              className="accent-blue-600"
            />
            In stock only
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            disabled={loading}
          >
            Search
          </button>
        </form>
      )}

      {/* Content */}
      {activeTab === 'search' ? (
        <ProductGrid
          products={products}
          loading={loading}
          error={error}
          searchQuery={''}
          pagination={{ total: pagination.total, hasNext: pagination.hasNext }}
          onProductSelect={handleProductSelect}
          showWatchActions={true}
          onLoadMore={loadMore}
        />
      ) : selectedProduct ? (
        <ProductDetail 
          productId={selectedProduct.id}
          onClose={handleBackToSearch}
        />
      ) : null}

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={handleProductFound}
      />
    </div>
  );
};

export default ProductsPage;
