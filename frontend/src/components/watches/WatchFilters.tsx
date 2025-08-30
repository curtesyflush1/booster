import React, { useState, useEffect } from 'react';
import { Retailer } from '../../types';
import { apiClient } from '../../services/apiClient';

interface WatchFiltersProps {
  filters: {
    is_active?: boolean;
    retailer_id?: string;
  };
  onFiltersChange: (filters: { is_active?: boolean; retailer_id?: string }) => void;
}

export const WatchFilters: React.FC<WatchFiltersProps> = ({
  filters,
  onFiltersChange
}) => {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRetailers = async () => {
      try {
        const response = await apiClient.get<Retailer[]>('/retailers');
        setRetailers(response.data.filter(r => r.isActive));
      } catch (error) {
        console.error('Failed to load retailers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRetailers();
  }, []);

  const handleFilterChange = (key: string, value: string | boolean | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? undefined : value
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-700">
      {/* Status Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Status
        </label>
        <select
          value={filters.is_active === undefined ? '' : filters.is_active.toString()}
          onChange={(e) => handleFilterChange('is_active', 
            e.target.value === '' ? undefined : e.target.value === 'true'
          )}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Watches</option>
          <option value="true">Active Only</option>
          <option value="false">Paused Only</option>
        </select>
      </div>

      {/* Retailer Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Retailer
        </label>
        <select
          value={filters.retailer_id || ''}
          onChange={(e) => handleFilterChange('retailer_id', e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Retailers</option>
          {retailers.map((retailer) => (
            <option key={retailer.id} value={retailer.id}>
              {retailer.name}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      <div className="flex items-end">
        <button
          onClick={() => onFiltersChange({})}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};