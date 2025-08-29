import React from 'react';
import { Search } from 'lucide-react';
import { Product } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  pagination: {
    total: number;
    hasNext: boolean;
  };
  onProductSelect?: (product: Product) => void;
  showWatchActions?: boolean;
  onLoadMore: () => void;
}

const ProductGridComponent: React.FC<ProductGridProps> = ({
  products,
  loading,
  error,
  searchQuery,
  pagination,
  onProductSelect,
  showWatchActions = true,
  onLoadMore
}) => {
  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  if (loading && products.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (products.length === 0 && !loading && searchQuery) {
    return (
      <div className="text-center py-12">
        <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No products found</h3>
        <p className="text-gray-400">
          Try adjusting your search terms or filters
        </p>
      </div>
    );
  }

  return (
    <div>
      {products.length > 0 && (
        <div className="mb-4 text-gray-400">
          Showing {products.length} of {pagination.total} products
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={onProductSelect}
            showWatchActions={showWatchActions}
          />
        ))}
      </div>

      {/* Load More */}
      {pagination.hasNext && (
        <div className="flex justify-center mt-8">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? <LoadingSpinner size="sm" /> : null}
            Load More Products
          </button>
        </div>
      )}
    </div>
  );
};

// Memoize ProductGrid to prevent unnecessary re-renders when props haven't changed
export const ProductGrid = React.memo(ProductGridComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.products.length === nextProps.products.length &&
    prevProps.products.every((product, index) => product.id === nextProps.products[index]?.id) &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.pagination.total === nextProps.pagination.total &&
    prevProps.pagination.hasNext === nextProps.pagination.hasNext &&
    prevProps.showWatchActions === nextProps.showWatchActions &&
    prevProps.onProductSelect === nextProps.onProductSelect &&
    prevProps.onLoadMore === nextProps.onLoadMore
  );
});