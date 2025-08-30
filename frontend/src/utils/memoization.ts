/**
 * Utility functions for React memoization and performance optimization
 */

import React from 'react';

/**
 * Shallow comparison function for React.memo
 * Compares all properties of two objects at the first level
 */
export const shallowEqual = <T extends Record<string, unknown>>(
  objA: T,
  objB: T
): boolean => {
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (objA[key] !== objB[key]) {
      return false;
    }
  }

  return true;
};

/**
 * Deep comparison function for complex objects
 * Use sparingly as it can be expensive for large objects
 */
export const deepEqual = (objA: unknown, objB: unknown): boolean => {
  if (objA === objB) {
    return true;
  }

  if (objA == null || objB == null) {
    return objA === objB;
  }

  if (typeof objA !== typeof objB) {
    return false;
  }

  if (typeof objA !== 'object') {
    return objA === objB;
  }

  if (Array.isArray(objA) !== Array.isArray(objB)) {
    return false;
  }

  if (typeof objA !== 'object' || typeof objB !== 'object' || objA === null || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA as Record<string, unknown>);
  const keysB = Object.keys(objB as Record<string, unknown>);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false;
    }

    if (!deepEqual((objA as Record<string, unknown>)[key], (objB as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
};

/**
 * Memoization helper for array props
 * Compares arrays by length and item IDs (assumes items have an 'id' property)
 */
export const arrayEqual = <T extends { id: string | number }>(
  arrA: T[],
  arrB: T[]
): boolean => {
  if (arrA.length !== arrB.length) {
    return false;
  }

  return arrA.every((item, index) => item.id === arrB[index]?.id);
};

/**
 * Memoization helper for function props
 * Compares function references (useful for callback props)
 */
export const functionEqual = (fnA: (...args: unknown[]) => unknown, fnB: (...args: unknown[]) => unknown): boolean => {
  return fnA === fnB;
};

/**
 * Generic memoization comparison for common component props
 */
export const createMemoComparison = <T extends Record<string, unknown>>(
  customComparisons?: Partial<Record<keyof T, (a: unknown, b: unknown) => boolean>>
) => {
  return (prevProps: T, nextProps: T): boolean => {
    const keys = Object.keys(prevProps) as (keyof T)[];
    
    for (const key of keys) {
      const customComparison = customComparisons?.[key];
      
      if (customComparison) {
        if (!customComparison(prevProps[key], nextProps[key])) {
          return false;
        }
      } else {
        if (prevProps[key] !== nextProps[key]) {
          return false;
        }
      }
    }
    
    return true;
  };
};

/**
 * Performance monitoring utility for React components
 * Use in development to identify components that re-render frequently
 */
export const withRenderTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  if (process.env.NODE_ENV === 'development') {
    return React.memo((props: P) => {
      const renderCount = React.useRef(0);
      renderCount.current += 1;
      
      React.useEffect(() => {
        console.log(`${componentName} rendered ${renderCount.current} times`);
      });
      
      return React.createElement(Component, props);
    });
  }
  
  return Component;
};