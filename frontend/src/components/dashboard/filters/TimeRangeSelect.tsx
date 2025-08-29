import React from 'react';

interface TimeRangeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const TIME_RANGE_OPTIONS = [
  { value: '1d', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
] as const;

/**
 * Time range selection component
 */
const TimeRangeSelectComponent: React.FC<TimeRangeSelectProps> = ({ 
  value, 
  onChange, 
  className = "bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select time range"
  >
    {TIME_RANGE_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// Memoize TimeRangeSelect to prevent unnecessary re-renders when props haven't changed
const TimeRangeSelect = React.memo(TimeRangeSelectComponent);

export default TimeRangeSelect;