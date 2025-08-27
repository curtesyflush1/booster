import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { DashboardStats, Alert, MLPrediction } from '../types';
import DashboardOverview from '../components/dashboard/DashboardOverview';
import PredictiveInsights from '../components/dashboard/PredictiveInsights';
import PortfolioTracking from '../components/dashboard/PortfolioTracking';
import RecentActivity from '../components/dashboard/RecentActivity';
import DashboardFilters from '../components/dashboard/DashboardFilters';
import { useWebSocket } from '../hooks/useWebSocket';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';

interface DashboardData {
  stats: DashboardStats;
  recentAlerts: Alert[];
  watchedProducts: any[];
  insights: any;
}

interface PortfolioData {
  totalValue: number;
  totalItems: number;
  valueChange: {
    amount: number;
    percentage: number;
    period: string;
  };
  topHoldings: any[];
  gapAnalysis: any;
  performance: any;
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
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

  // Load initial dashboard data
  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardResponse, portfolioResponse, insightsResponse] = await Promise.all([
        apiClient.get('/api/dashboard'),
        apiClient.get('/api/dashboard/portfolio'),
        apiClient.get('/api/dashboard/insights')
      ]);

      setDashboardData(dashboardResponse.data.dashboard);
      setPortfolioData(portfolioResponse.data.portfolio);
      setPredictiveInsights(insightsResponse.data.insights);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'dashboard_update':
        // Update dashboard stats
        if (dashboardData) {
          setDashboardData(prev => prev ? { ...prev, ...message.data } : null);
        }
        break;
      
      case 'new_alert':
        // Add new alert to recent alerts
        if (dashboardData) {
          setDashboardData(prev => prev ? {
            ...prev,
            recentAlerts: [message.alert, ...prev.recentAlerts.slice(0, 9)]
          } : null);
        }
        break;
      
      case 'insights_update':
        // Update predictive insights
        setPredictiveInsights(message.insights);
        break;
      
      case 'portfolio_update':
        // Update portfolio data
        setPortfolioData(message.portfolio);
        break;
    }
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const refreshData = () => {
    loadDashboardData();
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
            <DashboardOverview
              stats={dashboardData.stats}
              insights={dashboardData.insights}
            />
            <RecentActivity
              alerts={dashboardData.recentAlerts}
              watchedProducts={dashboardData.watchedProducts}
            />
          </div>
        )}

        {activeTab === 'insights' && (
          <PredictiveInsights
            insights={predictiveInsights}
            watchedProducts={dashboardData?.watchedProducts || []}
          />
        )}

        {activeTab === 'portfolio' && portfolioData && (
          <PortfolioTracking
            portfolio={portfolioData}
            user={user}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default DashboardPage;