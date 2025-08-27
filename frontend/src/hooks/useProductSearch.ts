import { useState, useEffect, useCallback } from 'react';
import { Product, SearchFilters, PaginatedResponse } from '../types';
import { apiClient } from '../services/apiClient';
import { useDebounce } from './useDebounce';
import { SEARCH_CONSTANTS } from '../constants/search';

interface UseProductSearchOptions {
  initialFilters?: Partial<SearchFilters>;
  pageSize?: number;
}

interface UseProductSearchReturn {
  // State
  searchQuery: string;
  filters: SearchFilters;
  products: Product[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  
  // Actions
  setSearchQuery: (query: string) => void;
  setFilters: (filters: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => void;
  searchProducts: (page?: number, resetResults?: boolean) => Promise<void>;
  loadMore: () => void;
  clearFilters: () => void;
  
  // Computed
  hasActiveFilters: boolean;
}

export const useProductSearch = ({
  initialFilters = {},
  pageSize = SEARCH_CONSTANTS.DEFAULT_PAGE_SIZE
}: UseProductSearchOptions = {}): UseProductSearchReturn => {
  const [searchQuery, setSearchQuery] = useState(initialFilters.query || '');
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: SEARCH_CONSTANTS.DEFAULT_SORT_BY,
    sortOrder: SEARCH_CONSTANTS.DEFAULT_SORT_ORDER,
    ...initialFilters
  });
  
  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_CONSTANTS.DEBOUNCE_DELAY);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  const searchProducts = useCallback(async (page = 1, resetResults = true) => {
    setLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(debouncedSearchQuery && { query: debouncedSearchQuery }),
        ...(filters.category && { category: filters.category }),
        ...(filters.retailer && { retailer: filters.retailer }),
        ...(filters.minPrice && { minPrice: filters.minPrice.toString() }),
        ...(filters.maxPrice && { maxPrice: filters.maxPrice.toString() }),
        ...(filters.inStockOnly && { inStockOnly: 'true' }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.sortOrder && { sortOrder: filters.sortOrder })
      });

      const response = await apiClient.get<PaginatedResponse<Product>>(
        `/products/search?${searchParams}`
      );

      if (resetResults) {
        setProducts(response.data.data);
      } else {
        setProducts(prev => [...prev, ...response.data.data]);
      }
      
      setPagination(response.data.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to search products');
      console.error('Product search error:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, filters, pagination.limit]);

  const loadMore = useCallback(() => {
    if (pagination.hasNext && !loading) {
      searchProducts(pagination.page + 1, false);
    }
  }, [pagination.hasNext, pagination.page, loading, searchProducts]);

  const clearFilters = useCallback(() => {
    setFilters({
      sortBy: SEARCH_CONSTANTS.DEFAULT_SORT_BY,
      sortOrder: SEARCH_CONSTANTS.DEFAULT_SORT_ORDER
    });
    setSearchQuery('');
  }, []);

  const hasActiveFilters = Boolean(
    filters.category || 
    filters.retailer || 
    filters.minPrice || 
    filters.maxPrice || 
    filters.inStockOnly
  );

  // Auto-search when filters change
  useEffect(() => {
    searchProducts(1, true);
  }, [filters]);

  return {
    // State
    searchQuery,
    filters,
    products,
    loading,
    error,
    pagination,
    
    // Actions
    setSearchQuery,
    setFilters,
    searchProducts,
    loadMore,
    clearFilters,
    
    // Computed
    hasActiveFilters
  };
};