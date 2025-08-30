import React from 'react';
import { SearchFilters } from '../../types';
import { PRODUCT_CATEGORIES, SUPPORTED_RETAILERS, SORT_OPTIONS } from '../../constants/search';

interface SearchFiltersPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: Partial<SearchFilters>) => void;
}

export const SearchFiltersPanel: React.FC<SearchFiltersPanelProps> = ({
  filters,
  onFiltersChange
}) => {


  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Category Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Category
        </label>
        <select
          value={filters.category || ''}
          onChange={(e) => onFiltersChange({ category: e.target.value || undefined })}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Retailer Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Retailer
        </label>
        <select
          value={filters.retailer || ''}
          onChange={(e) => onFiltersChange({ retailer: e.target.value || undefined })}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Retailers</option>
          {SUPPORTED_RETAILERS.map(retailer => (
            <option key={retailer.value} value={retailer.value}>
              {retailer.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Price Range
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice || ''}
            onChange={(e) => onFiltersChange({ 
              minPrice: e.target.value ? Number(e.target.value) : undefined 
            })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice || ''}
            onChange={(e) => onFiltersChange({ 
              maxPrice: e.target.value ? Number(e.target.value) : undefined 
            })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Sort Options */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Sort By
        </label>
        <div className="flex gap-2">
          <select
            value={filters.sortBy || 'popularity'}
            onChange={(e) => onFiltersChange({ sortBy: e.target.value as 'popularity' | 'price' | 'name' | 'releaseDate' })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={filters.sortOrder || 'desc'}
            onChange={(e) => onFiltersChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="asc">↑</option>
            <option value="desc">↓</option>
          </select>
        </div>
      </div>

      {/* Additional Filters */}
      <div className="md:col-span-2 lg:col-span-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={filters.inStockOnly || false}
              onChange={(e) => onFiltersChange({ inStockOnly: e.target.checked })}
              className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            In Stock Only
          </label>
        </div>
      </div>
    </div>
  );
};