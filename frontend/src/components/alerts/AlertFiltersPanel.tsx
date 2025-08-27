import React, { useState } from 'react';
import { Search, Calendar, Filter, X } from 'lucide-react';
import { AlertFilters } from '../../services/alertService';

interface AlertFiltersPanelProps {
  filters: AlertFilters;
  onFiltersChange: (filters: AlertFilters) => void;
}

const AlertFiltersPanel: React.FC<AlertFiltersPanelProps> = ({
  filters,
  onFiltersChange
}) => {
  const [localFilters, setLocalFilters] = useState<AlertFilters>(filters);

  const handleFilterChange = (key: keyof AlertFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: AlertFilters = {
      page: 1,
      limit: filters.limit || 20
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = () => {
    return !!(
      localFilters.status ||
      localFilters.type ||
      localFilters.unread_only ||
      localFilters.search ||
      localFilters.start_date ||
      localFilters.end_date
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white flex items-center space-x-2">
          <Filter className="w-4 h-4" />
          <span>Filter Alerts</span>
        </h3>
        
        {hasActiveFilters() && (
          <button
            onClick={clearFilters}
            className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Product or retailer..."
              value={localFilters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
              className="w-full pl-10 pr-3 py-2 bg-background-tertiary border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            Status
          </label>
          <select
            value={localFilters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            className="w-full px-3 py-2 bg-background-tertiary border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            Alert Type
          </label>
          <select
            value={localFilters.type || ''}
            onChange={(e) => handleFilterChange('type', e.target.value || undefined)}
            className="w-full px-3 py-2 bg-background-tertiary border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="restock">📦 Restock</option>
            <option value="price_drop">💰 Price Drop</option>
            <option value="low_stock">⚠️ Low Stock</option>
            <option value="pre_order">🎯 Pre-order</option>
          </select>
        </div>

        {/* Read Status */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            Read Status
          </label>
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="readStatus"
                checked={!localFilters.unread_only}
                onChange={() => handleFilterChange('unread_only', false)}
                className="w-4 h-4 text-primary-500 bg-background-tertiary border-gray-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-300">All</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="readStatus"
                checked={localFilters.unread_only === true}
                onChange={() => handleFilterChange('unread_only', true)}
                className="w-4 h-4 text-primary-500 bg-background-tertiary border-gray-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-300">Unread Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            Start Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={localFilters.start_date || ''}
              onChange={(e) => handleFilterChange('start_date', e.target.value || undefined)}
              className="w-full pl-10 pr-3 py-2 bg-background-tertiary border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-400">
            End Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={localFilters.end_date || ''}
              onChange={(e) => handleFilterChange('end_date', e.target.value || undefined)}
              className="w-full pl-10 pr-3 py-2 bg-background-tertiary border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Results Per Page */}
      <div className="flex items-center justify-between pt-4 border-t border-background-tertiary">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-medium text-gray-400">
            Results per page:
          </label>
          <select
            value={localFilters.limit || 20}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
            className="px-2 py-1 bg-background-tertiary border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {hasActiveFilters() && (
          <div className="text-xs text-gray-400">
            {Object.entries(localFilters).filter(([key, value]) => 
              value !== undefined && value !== '' && key !== 'page' && key !== 'limit'
            ).length} filter(s) active
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertFiltersPanel;