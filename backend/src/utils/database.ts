import { ICountResult, IStatResult } from '../types/database';

/**
 * Safely extracts count from database query result
 */
export function safeCount(result: any[]): number {
  if (!Array.isArray(result) || result.length === 0) {
    return 0;
  }
  
  const countResult = result[0] as ICountResult;
  const count = countResult?.count;
  
  if (typeof count === 'string') {
    return parseInt(count, 10) || 0;
  }
  
  return typeof count === 'number' ? count : 0;
}

/**
 * Safely extracts sum from database query result
 */
export function safeSum(result: any[], field: string): number {
  if (!Array.isArray(result) || result.length === 0) {
    return 0;
  }
  
  const sumResult = result[0];
  const sum = sumResult?.[field];
  
  if (typeof sum === 'string') {
    return parseFloat(sum) || 0;
  }
  
  return typeof sum === 'number' ? sum : 0;
}

/**
 * Safely processes statistics results with proper type checking
 */
export function safeStatsMap<T extends Record<string, number>>(
  results: any[],
  keyField: string,
  valueField: string = 'count'
): T {
  const stats = {} as T;
  
  if (!Array.isArray(results)) {
    return stats;
  }
  
  results.forEach((result: IStatResult) => {
    const key = result[keyField];
    const value = result[valueField];
    
    if (key !== undefined && value !== undefined) {
      const keyStr = String(key);
      const valueNum = typeof value === 'string' ? parseInt(value, 10) : Number(value);
      
      if (!isNaN(valueNum)) {
        (stats as any)[keyStr] = valueNum;
      }
    }
  });
  
  return stats;
}

/**
 * Type guard to check if a value is a valid database result array
 */
export function isValidResultArray(value: any): value is any[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Safely handles potentially undefined query results
 */
export function safeQueryResult<T>(result: T | undefined, defaultValue: T): T {
  return result !== undefined ? result : defaultValue;
}