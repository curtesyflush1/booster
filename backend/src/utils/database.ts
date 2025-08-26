import { ICountResult, IStatResult, ISumResult } from '../types/database';

// Database utility functions with proper type safety

/**
 * Helper function to validate database result arrays
 * @param result - Database query result to validate
 * @returns True if result is a valid non-empty array
 */
function isValidDatabaseResult(result: any[] | null | undefined): result is any[] {
  return Array.isArray(result) && result.length > 0;
}

/**
 * Safely converts a value to a number, handling strings and edge cases
 * @param value - Value to convert to number
 * @param isInteger - Whether to parse as integer (default: false)
 * @returns Parsed number or 0 for invalid values
 */
function safeNumberConversion(value: string | number | null | undefined, isInteger = false): number {
  if (value === null || value === undefined) {
    return 0;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  
  if (typeof value === 'string') {
    // Handle empty strings
    if (value.trim() === '') {
      return 0;
    }
    
    const parsed = isInteger ? parseInt(value, 10) : parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  // Handle unexpected types (boolean, object, etc.)
  return 0;
}

/**
 * Safely extracts count from database query result
 * @param result - Array of count results from database query
 * @returns Parsed count as number, defaults to 0 for invalid/empty results
 * @example
 * safeCount([{ count: '42' }]) // returns 42
 * safeCount([]) // returns 0
 */
export function safeCount(result: (ICountResult | Record<string, any>)[] | null | undefined): number {
  if (!isValidDatabaseResult(result)) {
    return 0;
  }
  
  const countResult = result[0];
  return safeNumberConversion(countResult?.count, true);
}

/**
 * Safely extracts sum from database query result
 * @param result - Array of sum results from database query
 * @param field - Field name to extract sum from
 * @returns Parsed sum as number, defaults to 0 for invalid/empty results
 * @example
 * safeSum([{ total: '123.45' }], 'total') // returns 123.45
 */
export function safeSum(result: (ISumResult | Record<string, any>)[] | null | undefined, field: string): number {
  if (!isValidDatabaseResult(result)) {
    return 0;
  }
  
  const sumResult = result[0];
  return safeNumberConversion(sumResult?.[field]);
}

/**
 * Safely processes statistics results with proper type checking
 * @param results - Array of statistical results from database query
 * @param keyField - Field name to use as object keys
 * @param valueField - Field name to use as object values (defaults to 'count')
 * @returns Object mapping keys to numeric values
 * @example
 * safeStatsMap([{type: 'restock', count: '10'}], 'type') // returns {restock: 10}
 */
export function safeStatsMap<T extends Record<string, number>>(
  results: (IStatResult | Record<string, any>)[] | null | undefined,
  keyField: string,
  valueField: string = 'count'
): T {
  const stats = {} as T;
  
  if (!Array.isArray(results) || !keyField?.trim() || !valueField?.trim()) {
    return stats;
  }
  
  results.forEach((result) => {
    const key = result[keyField];
    const value = result[valueField];
    
    // Skip if key or value is missing
    if (key == null || value == null) {
      return;
    }
    
    const keyStr = String(key);
    
    // Only process values that can be converted to valid numbers
    // Exclude strings that can't be parsed (like 'invalid')
    if (typeof value === 'number' && !isNaN(value)) {
      (stats as any)[keyStr] = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '' && !isNaN(Number(trimmed))) {
        const valueNum = safeNumberConversion(value, true);
        (stats as any)[keyStr] = valueNum;
      }
    } else if (value === 0) {
      // Explicitly handle 0 values
      (stats as any)[keyStr] = 0;
    }
  });
  
  return stats;
}

/**
 * Type guard to check if a value is a valid database result array
 * @param value - Value to check
 * @returns True if value is a non-empty array
 * @example
 * isValidResultArray([{count: 1}]) // returns true
 * isValidResultArray([]) // returns false
 * isValidResultArray(null) // returns false
 */
export function isValidResultArray(value: any): value is any[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Safely handles potentially undefined query results with fallback
 * @param result - Query result that might be undefined
 * @param defaultValue - Default value to return if result is undefined
 * @returns The result if defined, otherwise the default value
 * @example
 * safeQueryResult(undefined, []) // returns []
 * safeQueryResult([{id: 1}], []) // returns [{id: 1}]
 */
export function safeQueryResult<T>(result: T | undefined, defaultValue: T): T {
  return result !== undefined ? result : defaultValue;
}