import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  Calendar,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { alertService, AlertAnalytics as AlertAnalyticsType } from '../../services/alertService';

const AlertAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AlertAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  const loadAnalytics = useCallback(async (days: number = selectedPeriod) => {
    try {
      setLoading(true);
      setError(null);
      const data = await alertService.getAlertAnalytics(days);
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading alert analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod, loadAnalytics]);

  const handlePeriodChange = (days: number) => {
    setSelectedPeriod(days);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-background-secondary rounded-lg p-6 animate-pulse">
          <div className="w-48 h-6 bg-gray-600 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="w-16 h-8 bg-gray-600 rounded" />
                <div className="w-24 h-4 bg-gray-600 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-background-secondary rounded-lg p-6 animate-pulse">
          <div className="w-32 h-6 bg-gray-600 rounded mb-4" />
          <div className="h-64 bg-gray-600 rounded" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-background-secondary rounded-lg p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Error Loading Analytics</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => loadAnalytics()}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  const periodOptions = [
    { value: 7, label: '7 Days' },
    { value: 30, label: '30 Days' },
    { value: 90, label: '90 Days' },
    { value: 365, label: '1 Year' }
  ];

  const summaryCards = [
    {
      title: 'Total Alerts',
      value: analytics.summary.totalAlerts.toLocaleString(),
      icon: BarChart3,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Sent Alerts',
      value: analytics.summary.sentAlerts.toLocaleString(),
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Read Rate',
      value: `${analytics.summary.readRate.toFixed(1)}%`,
      icon: Eye,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Click Rate',
      value: `${analytics.summary.clickThroughRate.toFixed(1)}%`,
      icon: MousePointer,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10'
    }
  ];

  // Calculate max value for chart scaling
  const maxDailyValue = Math.max(
    ...analytics.dailyBreakdown.map(day => Math.max(day.total, day.sent, day.clicked, day.read))
  );

  return (
    <div className="space-y-6">
      {/* Header with Period Selection */}
      <div className="bg-background-secondary rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <BarChart3 className="w-6 h-6 text-primary-400" />
            <div>
              <h2 className="text-xl font-semibold text-white">Alert Analytics</h2>
              <p className="text-gray-400 text-sm">
                Engagement metrics for the last {selectedPeriod} days
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={selectedPeriod}
              onChange={(e) => handlePeriodChange(parseInt(e.target.value))}
              className="px-3 py-2 bg-background-tertiary border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          
          return (
            <div
              key={index}
              className="bg-background-secondary rounded-lg p-6 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-6 h-6 ${card.color}`} />
                </div>
                <div className="text-2xl font-bold text-white">
                  {card.value}
                </div>
              </div>
              <h3 className="text-sm font-medium text-gray-300">
                {card.title}
              </h3>
            </div>
          );
        })}
      </div>

      {/* Daily Breakdown Chart */}
      <div className="bg-background-secondary rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-primary-400" />
          <span>Daily Activity</span>
        </h3>

        {analytics.dailyBreakdown.length > 0 ? (
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-400 rounded" />
                <span className="text-gray-300">Total</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded" />
                <span className="text-gray-300">Sent</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-purple-400 rounded" />
                <span className="text-gray-300">Read</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-orange-400 rounded" />
                <span className="text-gray-300">Clicked</span>
              </div>
            </div>

            {/* Chart */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {analytics.dailyBreakdown.slice().reverse().map((day, index) => {
                const date = new Date(day.date);
                const formattedDate = date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                });

                return (
                  <div key={index} className="flex items-center space-x-4 py-2">
                    <div className="w-16 text-xs text-gray-400 flex-shrink-0">
                      {formattedDate}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      {/* Total Bar */}
                      <div className="flex items-center space-x-2">
                        <div className="w-12 text-xs text-gray-500">Total</div>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: maxDailyValue > 0 ? `${(day.total / maxDailyValue) * 100}%` : '0%'
                            }}
                          />
                        </div>
                        <div className="w-8 text-xs text-gray-400 text-right">
                          {day.total}
                        </div>
                      </div>

                      {/* Sent Bar */}
                      <div className="flex items-center space-x-2">
                        <div className="w-12 text-xs text-gray-500">Sent</div>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-400 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: maxDailyValue > 0 ? `${(day.sent / maxDailyValue) * 100}%` : '0%'
                            }}
                          />
                        </div>
                        <div className="w-8 text-xs text-gray-400 text-right">
                          {day.sent}
                        </div>
                      </div>

                      {/* Read Bar */}
                      <div className="flex items-center space-x-2">
                        <div className="w-12 text-xs text-gray-500">Read</div>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: maxDailyValue > 0 ? `${(day.read / maxDailyValue) * 100}%` : '0%'
                            }}
                          />
                        </div>
                        <div className="w-8 text-xs text-gray-400 text-right">
                          {day.read}
                        </div>
                      </div>

                      {/* Clicked Bar */}
                      <div className="flex items-center space-x-2">
                        <div className="w-12 text-xs text-gray-500">Click</div>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-orange-400 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: maxDailyValue > 0 ? `${(day.clicked / maxDailyValue) * 100}%` : '0%'
                            }}
                          />
                        </div>
                        <div className="w-8 text-xs text-gray-400 text-right">
                          {day.clicked}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No activity data available for the selected period.</p>
          </div>
        )}
      </div>

      {/* Engagement Insights */}
      <div className="bg-background-secondary rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
          <Eye className="w-5 h-5 text-primary-400" />
          <span>Engagement Insights</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Performance Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Delivery Success Rate:</span>
                  <span className="text-white">
                    {analytics.summary.totalAlerts > 0 
                      ? ((analytics.summary.sentAlerts / analytics.summary.totalAlerts) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Average Daily Alerts:</span>
                  <span className="text-white">
                    {analytics.dailyBreakdown.length > 0
                      ? (analytics.summary.totalAlerts / analytics.dailyBreakdown.length).toFixed(1)
                      : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Most Active Day:</span>
                  <span className="text-white">
                    {analytics.dailyBreakdown.length > 0
                      ? new Date(
                          analytics.dailyBreakdown.reduce((max, day) => 
                            day.total > max.total ? day : max
                          ).date
                        ).toLocaleDateString('en-US', { weekday: 'long' })
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Engagement Quality</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Read Rate:</span>
                  <span className={`font-medium ${
                    analytics.summary.readRate >= 70 ? 'text-green-400' :
                    analytics.summary.readRate >= 50 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {analytics.summary.readRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Click-through Rate:</span>
                  <span className={`font-medium ${
                    analytics.summary.clickThroughRate >= 20 ? 'text-green-400' :
                    analytics.summary.clickThroughRate >= 10 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {analytics.summary.clickThroughRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Engagement Score:</span>
                  <span className="text-white">
                    {((analytics.summary.readRate + analytics.summary.clickThroughRate) / 2).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertAnalytics;