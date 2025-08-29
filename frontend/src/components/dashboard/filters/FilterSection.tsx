import React from 'react';

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable filter section component
 */
const FilterSectionComponent: React.FC<FilterSectionProps> = ({ title, icon, children }) => (
  <div className="flex items-center space-x-2">
    {icon}
    <span className="text-sm font-medium text-gray-300">{title}:</span>
    {children}
  </div>
);

// Memoize FilterSection since it's a reusable component rendered frequently in filter panels
const FilterSection = React.memo(FilterSectionComponent);

export default FilterSection;