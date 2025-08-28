// Dashboard API response types
export interface DashboardResponse {
  dashboard: {
    stats: {
      totalWatches: number;
      unreadAlerts: number;
      totalAlerts: number;
      successfulPurchases: number;
      clickThroughRate: number;
      recentAlerts: number;
    };
    recentAlerts: any[];
    watchedProducts: any[];
    insights: {
      topPerformingProducts: any[];
      alertTrends: any;
      engagementMetrics: {
        clickThroughRate: number;
        totalClicks: number;
        averageResponseTime: string;
      };
    };
  };
}

export interface InsightsResponse {
  insights: Array<{
    productId: string;
    productName: string;
    priceForcast: {
      nextWeek: number;
      nextMonth: number;
      confidence: number;
    };
    selloutRisk: {
      score: number;
      timeframe: string;
      confidence: number;
    };
    roiEstimate: {
      shortTerm: number;
      longTerm: number;
      confidence: number;
    };
    hypeScore: number;
    updatedAt: string;
  }>;
}

export interface PortfolioResponse {
  portfolio: {
    totalValue: number;
    totalItems: number;
    valueChange: {
      amount: number;
      percentage: number;
      period: string;
    };
    topHoldings: any[];
    gapAnalysis: {
      missingSets: Array<{
        setName: string;
        completionPercentage: number;
        missingItems: number;
      }>;
      recommendedPurchases: Array<{
        productId: string;
        priority: 'high' | 'medium' | 'low';
        reason: string;
      }>;
    };
    performance: {
      alertsGenerated: number;
      successfulPurchases: number;
      missedOpportunities: number;
      averageResponseTime: string;
    };
  };
}

export interface UpdatesResponse {
  updates: {
    newAlerts: any[];
    watchUpdates: any[];
    timestamp: string;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
  };
}