import React from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

interface SearchHeaderProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
  loading: boolean;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  children?: React.ReactNode; // For filters panel
}

export const SearchHeader: React.FC<SearchHeaderProps> = ({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  loading,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onClearFilters,
  children
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <form onSubmit={onSearch} className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search Pokémon TCG products..."
              className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? <LoadingSpinner size="sm" /> : <Search className="w-5 h-5" />}
            Search
          </button>
        </div>

        {/* Filter Toggle and Clear */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onToggleFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="bg-blue-600 text-xs px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>
      </form>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
};