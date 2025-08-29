import React from 'react';

interface RetailerSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const RETAILER_OPTIONS = [
  { value: 'all', label: 'All Retailers' },
  { value: 'best-buy', label: 'Best Buy' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'costco', label: 'Costco' },
  { value: 'sams-club', label: "Sam's Club" },
] as const;

/**
 * Retailer selection component
 */
const RetailerSelectComponent: React.FC<RetailerSelectProps> = ({ 
  value, 
  onChange, 
  className = "bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select retailer"
  >
    {RETAILER_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// Memoize RetailerSelect to prevent unnecessary re-renders when props haven't changed
const RetailerSelect = React.memo(RetailerSelectComponent);

export default RetailerSelect;