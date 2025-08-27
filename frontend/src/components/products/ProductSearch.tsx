import React, { useState, memo } from 'react';
import { Product, SearchFilters } from '../../types';
import { useProductSearch } from '../../hooks/useProductSearch';
import { SearchHeader } from './SearchHeader';
import { SearchFiltersPanel } from './SearchFiltersPanel';
import { ProductGrid } from './ProductGrid';

interface ProductSearchProps {
  onProductSelect?: (product: Product) => void;
  showWatchActions?: boolean;
  initialFilters?: Partial<SearchFilters>;
}

export const ProductSearch: React.FC<ProductSearchProps> = memo(({
  onProductSelect,
  showWatchActions = true,
  initialFilters = {}
}) => {
  const [showFilters, setShowFilters] = useState(false);
  
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    products,
    loading,
    error,
    pagination,
    searchProducts,
    loadMore,
    clearFilters,
    hasActiveFilters
  } = useProductSearch({ initialFilters });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchProducts(1, true);
  };

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="space-y-6">
      <SearchHeader
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
        loading={loading}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      >
        <SearchFiltersPanel
          filters={filters}
          onFiltersChange={handleFilterChange}
        />
      </SearchHeader>

      <ProductGrid
        products={products}
        loading={loading}
        error={error}
        searchQuery={searchQuery}
        pagination={pagination}
        onProductSelect={onProductSelect}
        showWatchActions={showWatchActions}
        onLoadMore={loadMore}
      />
    </div>
  );
});

ProductSearch.displayName = 'ProductSearch';