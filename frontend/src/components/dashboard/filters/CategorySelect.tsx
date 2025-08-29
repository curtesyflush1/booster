import React from 'react';

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'booster-packs', label: 'Booster Packs' },
  { value: 'elite-trainer-boxes', label: 'Elite Trainer boxes' },
  { value: 'collection-boxes', label: 'Collection Boxes' },
  { value: 'tins', label: 'Tins' },
  { value: 'theme-decks', label: 'Theme Decks' },
] as const;

/**
 * Product category selection component
 */
const CategorySelectComponent: React.FC<CategorySelectProps> = ({ 
  value, 
  onChange, 
  className = "bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select product category"
  >
    {CATEGORY_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// Memoize CategorySelect to prevent unnecessary re-renders when props haven't changed
const CategorySelect = React.memo(CategorySelectComponent);

export default CategorySelect;