import React from 'react';
import { Calendar, Package, Store } from 'lucide-react';
import FilterSection from './filters/FilterSection';
import TimeRangeSelect from './filters/TimeRangeSelect';
import CategorySelect from './filters/CategorySelect';
import RetailerSelect from './filters/RetailerSelect';
import ResetFiltersButton from './filters/ResetFiltersButton';

interface DashboardFiltersProps {
  filters: {
    timeRange: string;
    productCategory: string;
    retailer: string;
  };
  onFilterChange: (filters: { timeRange: string; productCategory: string; retailer: string }) => void;
}

const DEFAULT_FILTERS = {
  timeRange: '7d',
  productCategory: 'all',
  retailer: 'all'
};

const DashboardFilters: React.FC<DashboardFiltersProps> = ({ filters, onFilterChange }) => {
  const handleFilterChange = (key: string, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  const handleReset = () => {
    onFilterChange(DEFAULT_FILTERS);
  };

  return (
    <div className="card-dark p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium text-gray-300">Filters:</h3>
          
          <FilterSection title="Time Range" icon={<Calendar className="w-4 h-4 text-gray-400" />}>
            <TimeRangeSelect 
              value={filters.timeRange} 
              onChange={(value) => handleFilterChange('timeRange', value)} 
            />
          </FilterSection>

          <FilterSection title="Category" icon={<Package className="w-4 h-4 text-gray-400" />}>
            <CategorySelect 
              value={filters.productCategory} 
              onChange={(value) => handleFilterChange('productCategory', value)} 
            />
          </FilterSection>

          <FilterSection title="Retailer" icon={<Store className="w-4 h-4 text-gray-400" />}>
            <RetailerSelect 
              value={filters.retailer} 
              onChange={(value) => handleFilterChange('retailer', value)} 
            />
          </FilterSection>
        </div>

        <ResetFiltersButton onReset={handleReset} />
      </div>
    </div>
  );
};

export default DashboardFilters;