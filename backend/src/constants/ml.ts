/**
 * Machine Learning and Dashboard constants
 */

// ML Prediction Variance Ranges
export const ML_PREDICTION_VARIANCE = {
  // Price forecast variance ranges
  NEXT_WEEK_MIN: 0.95,
  NEXT_WEEK_MAX: 1.05,
  NEXT_MONTH_MIN: 0.9,
  NEXT_MONTH_MAX: 1.1,
  
  // Confidence levels
  MIN_CONFIDENCE: 0.6,
  MAX_CONFIDENCE: 0.95,
} as const;

// ROI Estimation Ranges
export const ROI_ESTIMATION = {
  // Short-term ROI range (percentage)
  SHORT_TERM_MIN: -5,
  SHORT_TERM_MAX: 15,
  
  // Long-term ROI range (percentage)
  LONG_TERM_MIN: -10,
  LONG_TERM_MAX: 50,
} as const;

// Dashboard Time Windows
export const DASHBOARD_TIME_WINDOWS = {
  // Default monitoring window (1 hour in milliseconds)
  DEFAULT_MONITORING_WINDOW: 60 * 60 * 1000,
  
  // Dashboard updates max age (30 days in milliseconds)
  UPDATES_MAX_AGE: 30 * 24 * 60 * 60 * 1000,
} as const;

// ML Model Performance Thresholds
export const ML_THRESHOLDS = {
  // Minimum data points required for predictions
  MIN_DATA_POINTS: 10,
  
  // Accuracy thresholds
  MIN_ACCURACY: 0.7,
  TARGET_ACCURACY: 0.85,
  
  // Prediction confidence thresholds
  LOW_CONFIDENCE: 0.6,
  MEDIUM_CONFIDENCE: 0.75,
  HIGH_CONFIDENCE: 0.9,
} as const;