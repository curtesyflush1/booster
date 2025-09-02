import React, { useEffect, useState, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { Camera, Package } from 'lucide-react';
import { Product, PaginatedResponse, SearchFilters } from '../types';
import { ProductDetail } from '../components/products/ProductDetail';
import { BarcodeScanner } from '../components/products/BarcodeScanner';
import { ProductGrid } from '../components/products/ProductGrid';
import { apiClient } from '../services/apiClient';
import { BackendProduct, transformBackendProducts } from '../utils/fieldMapping';

const ProductsPage: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'detail'>('search');
  const [discoverMode, setDiscoverMode] = useState<'recent' | 'popular'>('recent');
  
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
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filters, setFilters] = useState<Partial<SearchFilters>>({
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSelectedProductId(product.id);
    setActiveTab('detail');
  };

  const handleProductFound = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('detail');
  };

  const handleBackToSearch = () => {
    setSelectedProduct(null);
    setSelectedProductId(null);
    setActiveTab('search');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('productId');
      url.searchParams.delete('slug');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const loadProducts = useCallback(async (page = 1, append = false) => {
    setLoading(true);
    setError(null);
    try {
      // When no search query and on first page, show recent products list
      const isInitialNoQuery = (!searchQuery || searchQuery.trim() === '') && page === 1;
      if (isInitialNoQuery && !filters.category && !filters.retailer && !filters.inStockOnly && !filters.minPrice && !filters.maxPrice) {
        const endpoint = discoverMode === 'popular' ? 'popular' : 'recent';
        const res = await apiClient.get<{ data: { products: BackendProduct[] } }>(
          `/products/${endpoint}?limit=${pagination.limit}`
        );
        const list = (res.data as any)?.data?.products || [];
        const transformed = transformBackendProducts(list);
        // Deduplicate by id for safety
        const unique = Array.from(new Map(transformed.map(p => [p.id, p])).values());
        setProducts(unique);
        setPagination({
          page: 1,
          limit: pagination.limit,
          total: transformed.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        });
        return;
      }

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
      setProducts(prev => {
        const merged = append ? [...prev, ...transformed] : transformed;
        return Array.from(new Map(merged.map(p => [p.id, p])).values());
      });
      setPagination(response.data.pagination);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
   }, [pagination.limit, searchQuery, filters, discoverMode]);

  const loadMore = useCallback(() => {
    if (pagination.hasNext && !loading) {
      loadProducts(pagination.page + 1, true);
    }
  }, [pagination.hasNext, pagination.page, loading, loadProducts]);

  useEffect(() => {
    // Initial fetch
    loadProducts(1, false);
  }, [loadProducts]);

  // Support deep-linking to product detail via ?productId=
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const pid = url.searchParams.get('productId');
      const slug = url.searchParams.get('slug');
      if (pid) {
        setSelectedProductId(pid);
        setActiveTab('detail');
      } else if (slug) {
        // Resolve slug to product ID, then open detail
        (async () => {
          try {
            const res = await apiClient.get<any>(`/products/slug/${encodeURIComponent(slug)}`);
            const product = (res.data as any)?.data?.product || (res.data as any)?.product || res.data;
            if (product?.id) {
              setSelectedProductId(product.id);
              setActiveTab('detail');
            }
          } catch {
            // ignore
          }
        })();
      }
    } catch {}
  }, []);

  // When discover mode changes and there is no active search query, reload
  useEffect(() => {
    if (!searchQuery) {
      loadProducts(1, false);
    }
  }, [discoverMode]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts(1, false);
  };

  // Trigger search automatically when user types or filters change
  useEffect(() => {
    if (activeTab !== 'search') return;
    loadProducts(1, false);
  }, [debouncedSearchQuery, filters, loadProducts, activeTab]);

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
            {activeTab === 'search' && !searchQuery && (
              <span
                className={`ml-3 align-middle inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  discoverMode === 'popular' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'
                }`}
              >
                {discoverMode === 'popular' ? 'Showing Popular Products' : 'Showing Recent Releases'}
              </span>
            )}
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

      {/* Discover Toggle */}
      {activeTab === 'search' && (
        <div className="mb-4 flex items-center gap-2">
          <div className="inline-flex bg-gray-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setDiscoverMode('recent')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                discoverMode === 'recent' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              Recent
            </button>
            <button
              type="button"
              onClick={() => setDiscoverMode('popular')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                discoverMode === 'popular' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              Popular
            </button>
          </div>
          <span className="text-gray-400 text-sm">Browse curated lists or search below</span>
        </div>
      )}

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
          searchQuery={searchQuery}
          pagination={{ total: pagination.total, hasNext: pagination.hasNext }}
          onProductSelect={handleProductSelect}
          showWatchActions={true}
          onLoadMore={loadMore}
        />
      ) : selectedProductId ? (
        <ProductDetail 
          productId={selectedProductId}
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
