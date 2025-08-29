import React from 'react';

interface ResetFiltersButtonProps {
  onReset: () => void;
  className?: string;
}

/**
 * Reset filters button component
 */
const ResetFiltersButtonComponent: React.FC<ResetFiltersButtonProps> = ({ 
  onReset, 
  className = "btn btn-secondary btn-sm"
}) => (
  <button
    onClick={onReset}
    className={className}
    type="button"
    aria-label="Reset all filters"
  >
    Reset Filters
  </button>
);

// Memoize ResetFiltersButton to prevent unnecessary re-renders when props haven't changed
const ResetFiltersButton = React.memo(ResetFiltersButtonComponent);

export default ResetFiltersButton;