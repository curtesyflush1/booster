/**
 * Performance Monitoring Utilities for State Management
 * 
 * This module provides tools to monitor React component performance,
 * context re-renders, and state management efficiency.
 */

import React from 'react';

interface PerformanceMetric {
  componentName: string;
  renderTime: number;
  timestamp: number;
  props?: Record<string, any>;
  contextUpdates?: string[];
}

interface ContextRenderMetric {
  contextName: string;
  renderCount: number;
  lastRender: number;
  averageRenderTime: number;
  consumers: string[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private contextMetrics: Map<string, ContextRenderMetric> = new Map();
  private isEnabled: boolean = false;

  constructor() {
    // Only enable in development
    this.isEnabled = import.meta.env.DEV;
  }

  /**
   * Start monitoring a component render
   */
  startRender(componentName: string): () => void {
    if (!this.isEnabled) return () => {};

    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      this.recordMetric({
        componentName,
        renderTime,
        timestamp: Date.now()
      });

      // Warn about slow renders
      if (renderTime > 16) { // 16ms = 60fps threshold
        console.warn(`🐌 Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }
    };
  }

  /**
   * Record a context update
   */
  recordContextUpdate(contextName: string, consumerComponent: string): void {
    if (!this.isEnabled) return;

    const existing = this.contextMetrics.get(contextName);
    const now = performance.now();

    if (existing) {
      existing.renderCount++;
      existing.lastRender = now;
      existing.averageRenderTime = (existing.averageRenderTime + now) / 2;
      
      if (!existing.consumers.includes(consumerComponent)) {
        existing.consumers.push(consumerComponent);
      }
    } else {
      this.contextMetrics.set(contextName, {
        contextName,
        renderCount: 1,
        lastRender: now,
        averageRenderTime: now,
        consumers: [consumerComponent]
      });
    }

    // Warn about excessive context updates
    const metric = this.contextMetrics.get(contextName)!;
    if (metric.renderCount > 100) {
      console.warn(`🔄 High context update frequency: ${contextName} has updated ${metric.renderCount} times`);
    }
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Get performance report
   */
  getReport(): {
    componentMetrics: PerformanceMetric[];
    contextMetrics: ContextRenderMetric[];
    slowComponents: string[];
    frequentContextUpdates: string[];
  } {
    const slowComponents = this.metrics
      .filter(m => m.renderTime > 16)
      .map(m => m.componentName)
      .filter((name, index, arr) => arr.indexOf(name) === index);

    const frequentContextUpdates = Array.from(this.contextMetrics.values())
      .filter(m => m.renderCount > 50)
      .map(m => m.contextName);

    return {
      componentMetrics: this.metrics.slice(-50), // Last 50 renders
      contextMetrics: Array.from(this.contextMetrics.values()),
      slowComponents,
      frequentContextUpdates
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.contextMetrics.clear();
  }

  /**
   * Log performance summary to console
   */
  logSummary(): void {
    if (!this.isEnabled) return;

    const report = this.getReport();
    
    console.group('🔍 Performance Monitor Summary');
    
    if (report.slowComponents.length > 0) {
      console.warn('Slow Components:', report.slowComponents);
    }
    
    if (report.frequentContextUpdates.length > 0) {
      console.warn('Frequent Context Updates:', report.frequentContextUpdates);
    }
    
    console.table(report.contextMetrics);
    console.groupEnd();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * HOC to monitor component performance
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const displayName = componentName || Component.displayName || Component.name || 'Unknown';
  
  const MonitoredComponent: React.FC<P> = (props) => {
    const endRender = performanceMonitor.startRender(displayName);
    
    React.useEffect(() => {
      endRender();
    });

    return React.createElement(Component, props);
  };

  MonitoredComponent.displayName = `withPerformanceMonitoring(${displayName})`;
  
  return MonitoredComponent;
}

/**
 * Hook to monitor context consumption
 */
export function useContextMonitoring(contextName: string, componentName: string): void {
  React.useEffect(() => {
    performanceMonitor.recordContextUpdate(contextName, componentName);
  });
}

/**
 * Hook to measure render performance
 */
export function useRenderPerformance(componentName: string): void {
  const renderStartTime = React.useRef<number>(0);
  
  // Start timing at the beginning of render
  renderStartTime.current = performance.now();
  
  React.useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    
    if (renderTime > 16) {
      console.warn(`🐌 ${componentName} render took ${renderTime.toFixed(2)}ms`);
    }
  });
}

/**
 * Development-only performance debugging
 */
export const PerformanceDebugger = {
  /**
   * Log context re-render information
   */
  logContextRender: (contextName: string, state: any, prevState?: any) => {
    if (!import.meta.env.DEV) return;
    
    console.group(`🔄 ${contextName} Context Update`);
    console.log('New State:', state);
    
    if (prevState) {
      console.log('Previous State:', prevState);
      console.log('Changed Keys:', Object.keys(state).filter(key => 
        JSON.stringify(state[key]) !== JSON.stringify(prevState[key])
      ));
    }
    
    console.groupEnd();
  },

  /**
   * Log component re-render with props comparison
   */
  logComponentRender: (componentName: string, props: any, prevProps?: any) => {
    if (!import.meta.env.DEV) return;
    
    console.group(`🔄 ${componentName} Re-render`);
    console.log('Props:', props);
    
    if (prevProps) {
      const changedProps = Object.keys(props).filter(key =>
        props[key] !== prevProps[key]
      );
      
      if (changedProps.length > 0) {
        console.log('Changed Props:', changedProps);
        changedProps.forEach(key => {
          console.log(`  ${key}:`, { old: prevProps[key], new: props[key] });
        });
      } else {
        console.warn('Re-render with no prop changes - check for unnecessary re-renders');
      }
    }
    
    console.groupEnd();
  }
};

// Auto-log performance summary every 30 seconds in development
if (import.meta.env.DEV) {
  setInterval(() => {
    performanceMonitor.logSummary();
  }, 30000);
}

export default performanceMonitor;