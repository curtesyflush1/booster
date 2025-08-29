import { DashboardData, PortfolioData, ProductInsights } from '../services/dashboardService';

/**
 * Dashboard API response types
 */

export interface ConsolidatedDashboardResponse {
  dashboard: DashboardData;
  portfolio: PortfolioData;
  insights: ProductInsights[];
  timestamp: string;
}

export interface DashboardUpdatesResponse {
  updates: {
    newAlerts: any[];
    watchUpdates: any[];
    timestamp: string;
  };
}

export interface PredictiveInsightsResponse {
  insights: ProductInsights[];
}

export interface PortfolioResponse {
  portfolio: PortfolioData;
}

export interface DashboardResponse {
  dashboard: DashboardData;
}