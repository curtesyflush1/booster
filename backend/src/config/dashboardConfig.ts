/**
 * Dashboard configuration constants
 * Centralized configuration for dashboard-related functionality
 */
export const DASHBOARD_CONFIG = {
  // Pagination limits
  DEFAULT_RECENT_ALERTS_LIMIT: 10,
  DEFAULT_WATCHED_PRODUCTS_LIMIT: 20,
  DEFAULT_TOP_PRODUCTS_LIMIT: 5,
  DEFAULT_PREDICTIVE_INSIGHTS_LIMIT: 50,
  
  // Time-based settings
  UPDATES_DEFAULT_TIMEFRAME_MINUTES: 5,
  INSIGHTS_ALERT_HISTORY_DAYS: 30,
  
  // ML Prediction parameters
  PRICE_FORECAST: {
    NEXT_WEEK_VARIANCE: { MIN: 0.95, MAX: 1.05 },
    NEXT_MONTH_VARIANCE: { MIN: 0.9, MAX: 1.1 },
    MIN_CONFIDENCE: 0.6,
    MAX_CONFIDENCE: 0.95
  },
  
  SELLOUT_RISK: {
    ALERT_MULTIPLIER: 5,
    HIGH_RISK_THRESHOLD: 5,
    TIMEFRAMES: {
      HIGH: '24-48 hours',
      NORMAL: '3-7 days'
    }
  },
  
  ROI_ESTIMATE: {
    SHORT_TERM_RANGE: { MIN: -5, MAX: 15 },
    LONG_TERM_RANGE: { MIN: 10, MAX: 60 }
  }
} as const;

/**
 * Type definitions for dashboard configuration
 */
export type DashboardConfig = typeof DASHBOARD_CONFIG;
export type PriceForecastConfig = typeof DASHBOARD_CONFIG.PRICE_FORECAST;
export type SelloutRiskConfig = typeof DASHBOARD_CONFIG.SELLOUT_RISK;
export type ROIEstimateConfig = typeof DASHBOARD_CONFIG.ROI_ESTIMATE;