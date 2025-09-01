import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { DashboardStats, Alert, MLPrediction, Product } from '../types';
import RecentActivity from '../components/dashboard/RecentActivity';
import DashboardFilters from '../components/dashboard/DashboardFilters';
import { useWebSocket } from '../hooks/useWebSocket';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';

// Lazy load heavy dashboard components for better code splitting
const DashboardOverview = lazy(() => import('../components/dashboard/DashboardOverview'));
const PredictiveInsights = lazy(() => import('../components/dashboard/PredictiveInsights'));
const PortfolioTracking = lazy(() => import('../components/dashboard/PortfolioTracking'));

interface DashboardData {
  stats: DashboardStats;
  recentAlerts: Alert[];
  watchedProducts: Product[];
  insights: Record<string, unknown>;
}

interface PortfolioData {
  totalValue: number;
  totalItems: number;
  valueChange: {
    amount: number;
    percentage: number;
    period: string;
  };
  topHoldings: Product[];
  gapAnalysis: Record<string, unknown>;
  performance: Record<string, unknown>;
}

const DashboardPage: React.FC = () => {
  const { user, isLoading } = useAuth();
  // Always call hooks at top-level to preserve order across renders
  const { isTopTier } = useSubscription();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [predictiveInsights, setPredictiveInsights] = useState<MLPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'portfolio'>('overview');
  const [filters, setFilters] = useState({
    timeRange: '7d',
    productCategory: 'all',
    retailer: 'all'
  });

  // WebSocket connection for real-time updates
  const { isConnected, lastMessage } = useWebSocket();

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: { type: string; data?: unknown; alert?: unknown; insights?: unknown; portfolio?: unknown }) => {
    switch (message.type) {
      case 'dashboard_update':
        // Update dashboard stats
        if (dashboardData && message.data && typeof message.data === 'object') {
          setDashboardData(prev => prev ? { ...prev, ...(message.data as Record<string, unknown>) } : null);
        }
        break;
      
      case 'new_alert':
        // Add new alert to recent alerts
        if (dashboardData && message.alert) {
          setDashboardData(prev => prev ? {
            ...prev,
            recentAlerts: [message.alert as Alert, ...prev.recentAlerts.slice(0, 9)]
          } : null);
        }
        break;
      
      case 'insights_update':
        // Update predictive insights
        if (message.insights && Array.isArray(message.insights)) {
          setPredictiveInsights(message.insights as MLPrediction[]);
        }
        break;
      
      case 'portfolio_update':
        // Update portfolio data
        if (message.portfolio && typeof message.portfolio === 'object') {
          setPortfolioData(message.portfolio as PortfolioData);
        }
        break;
    }
  }, [dashboardData]);

  // Load initial dashboard data only when user is authenticated
  useEffect(() => {
    if (isLoading || !user || !apiClient.isAuthenticated()) {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/dashboard', { params: filters });
        setDashboardData((response.data as any).dashboard);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [filters, user, isLoading]);

  // Load portfolio data (runs only once)
  useEffect(() => {
    if (isLoading || !user || !apiClient.isAuthenticated()) return;

    const fetchPortfolioData = async () => {
      try {
        const response = await apiClient.get('/dashboard/portfolio');
        setPortfolioData((response.data as any).portfolio);
      } catch (err) {
        console.error('Error loading portfolio data:', err);
        // Handle portfolio-specific error if needed
      }
    };
    fetchPortfolioData();
  }, [user, isLoading]);

  // Load predictive insights (runs only once)
  useEffect(() => {
    if (isLoading || !user || !apiClient.isAuthenticated()) return;

    const fetchPredictiveInsights = async () => {
      try {
        const response = await apiClient.get('/dashboard/insights');
        setPredictiveInsights((response.data as any).insights || []);
      } catch (err) {
        console.error('Error loading predictive insights:', err);
        // Handle insights-specific error if needed
      }
    };
    fetchPredictiveInsights();
  }, [user, isLoading]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage, handleWebSocketMessage]);



  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const refreshData = () => {
    // Manually trigger re-fetch for all data
    // This can be optimized to refresh only the active tab's data
    setFilters({ ...filters }); 
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card-dark p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-display font-bold text-white mb-2">
                Welcome back, {user?.firstName || 'Collector'}!
              </h1>
              <p className="text-gray-400">
                Here's what's happening with your Pokémon TCG alerts.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-sm text-gray-400">
                  {isConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={refreshData}
                className="btn btn-secondary btn-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-pokemon-electric text-pokemon-electric'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'insights'
                  ? 'border-pokemon-electric text-pokemon-electric'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Predictive Insights
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'portfolio'
                  ? 'border-pokemon-electric text-pokemon-electric'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Portfolio Tracking
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="mb-8">
          <DashboardFilters
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && dashboardData && (
          <div className="space-y-8">
            <Suspense fallback={<LoadingSpinner size="lg" />}>
              <DashboardOverview
                stats={dashboardData.stats}
                insights={dashboardData.insights}
              />
            </Suspense>
            <RecentActivity
              alerts={dashboardData.recentAlerts}
              watchedProducts={dashboardData.watchedProducts}
            />
          </div>
        )}

        {activeTab === 'insights' && (
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            {isTopTier() ? (
              <PredictiveInsights
                insights={predictiveInsights}
                watchedProducts={dashboardData?.watchedProducts || []}
              />
            ) : (
              <div className="card-dark p-6 text-center text-gray-300">
                ML insights are available on the highest tier.
              </div>
            )}
          </Suspense>
        )}

        {activeTab === 'portfolio' && portfolioData && (
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <PortfolioTracking
              portfolio={portfolioData}
              user={user}
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default DashboardPage;
