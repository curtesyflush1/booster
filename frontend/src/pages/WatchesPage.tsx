import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Eye, Package, Grid as GridIcon, List as ListIcon } from 'lucide-react';
import { Product, Watch } from '../types';
import { WatchList } from '../components/watches/WatchList';
import { WatchPacks } from '../components/watches/WatchPacks';
import { ProductGrid } from '../components/products/ProductGrid';
import { ProductDetail } from '../components/products/ProductDetail';
import { apiClient } from '../services/apiClient';
import { transformBackendProduct, BackendProduct } from '../utils/fieldMapping';

const WatchesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'watches' | 'packs'>('watches');
  // Default to grid view per Step 4 requirement (reuse ProductGrid)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  // State for grid view
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadWatchedProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch watches (first page with a generous limit)
      const res = await apiClient.get<{ data: Array<{ product_id: string }>; pagination?: any }>(
        `/watches?limit=100&is_active=true`
      );
      const watchItems = res.data?.data || [];
      const productIds = Array.from(new Set(watchItems.map(w => w.product_id).filter(Boolean)));

      if (productIds.length === 0) {
        setProducts([]);
        return;
      }

      // Fetch each product detail (in parallel). In the future, replace with a batch endpoint.
      const fetched = await Promise.all(
        productIds.map(async (id) => {
          try {
            const pr = await apiClient.get<{ data: { product: BackendProduct } }>(`/products/${id}`);
            const backendProduct = pr.data?.data?.product as BackendProduct | undefined;
            return backendProduct ? transformBackendProduct(backendProduct) : null;
          } catch (_e) {
            return null;
          }
        })
      );

      setProducts(fetched.filter(Boolean) as Product[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load watched products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'watches') {
      loadWatchedProducts();
    }
  }, [activeTab, loadWatchedProducts]);

  const handleWatchSelect = (_watch: Watch) => {
    // TODO: Open watch edit modal
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Tabs */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              Watch Management
            </h1>
            <p className="text-gray-400">
              Manage your product watches and subscribe to curated watch packs
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('watches')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'watches'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            My Watches
          </button>
          
          <button
            onClick={() => setActiveTab('packs')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'packs'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Package className="w-4 h-4" />
            Watch Packs
          </button>
        </div>
        {activeTab === 'watches' && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={loadWatchedProducts}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm"
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'watches' ? (
        selectedProduct ? (
          <ProductDetail
            productId={selectedProduct.id}
            onClose={() => setSelectedProduct(null)}
          />
        ) : (
          <ProductGrid
            products={products}
            loading={loading}
            error={error}
            searchQuery={''}
            pagination={{ total: products.length, hasNext: false }}
            onProductSelect={(p) => setSelectedProduct(p)}
            showWatchActions={true}
            onLoadMore={() => {}}
          />
        )
      ) : (
        <WatchPacks />
      )}
    </div>
  );
};

export default WatchesPage;
