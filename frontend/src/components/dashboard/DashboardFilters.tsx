import React from 'react';
import { Calendar, Package, Store } from 'lucide-react';

interface DashboardFiltersProps {
  filters: {
    timeRange: string;
    productCategory: string;
    retailer: string;
  };
  onFilterChange: (filters: any) => void;
}

const DashboardFilters: React.FC<DashboardFiltersProps> = ({ filters, onFilterChange }) => {
  const handleFilterChange = (key: string, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="card-dark p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium text-gray-300">Filters:</h3>
          
          {/* Time Range Filter */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={filters.timeRange}
              onChange={(e) => handleFilterChange('timeRange', e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          {/* Product Category Filter */}
          <div className="flex items-center space-x-2">
            <Package className="w-4 h-4 text-gray-400" />
            <select
              value={filters.productCategory}
              onChange={(e) => handleFilterChange('productCategory', e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Categories</option>
              <option value="booster-packs">Booster Packs</option>
              <option value="elite-trainer-boxes">Elite Trainer Boxes</option>
              <option value="collection-boxes">Collection Boxes</option>
              <option value="tins">Tins</option>
              <option value="theme-decks">Theme Decks</option>
            </select>
          </div>

          {/* Retailer Filter */}
          <div className="flex items-center space-x-2">
            <Store className="w-4 h-4 text-gray-400" />
            <select
              value={filters.retailer}
              onChange={(e) => handleFilterChange('retailer', e.target.value)}
              className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Retailers</option>
              <option value="best-buy">Best Buy</option>
              <option value="walmart">Walmart</option>
              <option value="costco">Costco</option>
              <option value="sams-club">Sam's Club</option>
            </select>
          </div>
        </div>

        {/* Reset Filters */}
        <button
          onClick={() => onFilterChange({
            timeRange: '7d',
            productCategory: 'all',
            retailer: 'all'
          })}
          className="btn btn-secondary btn-sm"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
};

export default DashboardFilters;