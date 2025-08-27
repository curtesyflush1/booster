import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Target, Zap, DollarSign, Clock, BarChart3 } from 'lucide-react';
import { MLPrediction } from '../../types';

interface PredictiveInsightsProps {
  insights: MLPrediction[];
  watchedProducts: any[];
}

const PredictiveInsights: React.FC<PredictiveInsightsProps> = ({ insights, watchedProducts }) => {
  const [sortBy, setSortBy] = useState<'hype' | 'roi' | 'sellout'>('hype');
  const [filterBy, setFilterBy] = useState<'all' | 'high_confidence' | 'urgent'>('all');

  const filteredInsights = insights
    .filter(insight => {
      switch (filterBy) {
        case 'high_confidence':
          return insight.priceForcast.confidence > 0.7;
        case 'urgent':
          return insight.selloutRisk.score > 70;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'hype':
          return b.hypeScore - a.hypeScore;
        case 'roi':
          return b.roiEstimate.longTerm - a.roiEstimate.longTerm;
        case 'sellout':
          return b.selloutRisk.score - a.selloutRisk.score;
        default:
          return 0;
      }
    });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="hype">Hype Score</option>
              <option value="roi">ROI Potential</option>
              <option value="sellout">Sellout Risk</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Filter</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Products</option>
              <option value="high_confidence">High Confidence</option>
              <option value="urgent">Urgent Action</option>
            </select>
          </div>
        </div>
        
        <div className="text-sm text-gray-400">
          Showing {filteredInsights.length} of {insights.length} products
        </div>
      </div>

      {/* Insights Grid */}
      {filteredInsights.length === 0 ? (
        <div className="card-dark p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Insights Available</h3>
          <p className="text-gray-400">
            {filterBy === 'all' 
              ? 'Start watching products to see predictive insights.'
              : 'No products match the current filter criteria.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredInsights.map((insight) => (
            <InsightCard key={insight.productId} insight={insight} />
          ))}
        </div>
      )}

      {/* Summary Statistics */}
      {insights.length > 0 && (
        <div className="card-dark p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Portfolio Insights Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryMetric
              title="Average Hype Score"
              value={Math.round(insights.reduce((sum, i) => sum + i.hypeScore, 0) / insights.length)}
              icon={<Zap className="w-5 h-5 text-pokemon-electric" />}
              suffix="/100"
            />
            <SummaryMetric
              title="High ROI Products"
              value={insights.filter(i => i.roiEstimate.longTerm > 30).length}
              icon={<TrendingUp className="w-5 h-5 text-green-400" />}
              suffix={` of ${insights.length}`}
            />
            <SummaryMetric
              title="Urgent Actions"
              value={insights.filter(i => i.selloutRisk.score > 70).length}
              icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
              suffix=" products"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Individual Insight Card Component
interface InsightCardProps {
  insight: MLPrediction;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight }) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getROIColor = (roi: number) => {
    if (roi >= 30) return 'text-green-400';
    if (roi >= 10) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="card-dark p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold text-white truncate">
            {insight.productName}
          </h4>
          <p className="text-sm text-gray-400">
            Updated {new Date(insight.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center space-x-1">
          <Zap className="w-4 h-4 text-pokemon-electric" />
          <span className="text-pokemon-electric font-bold">{insight.hypeScore}</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Price Forecast */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-gray-300">Price Forecast</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Next Week:</span>
              <span className="text-white">${insight.priceForcast.nextWeek.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Next Month:</span>
              <span className="text-white">${insight.priceForcast.nextMonth.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Confidence:</span>
              <span className={getConfidenceColor(insight.priceForcast.confidence)}>
                {(insight.priceForcast.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Sellout Risk */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-gray-300">Sellout Risk</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Risk Score:</span>
              <span className={getRiskColor(insight.selloutRisk.score)}>
                {insight.selloutRisk.score}/100
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Timeframe:</span>
              <span className="text-white text-xs">{insight.selloutRisk.timeframe}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Confidence:</span>
              <span className={getConfidenceColor(insight.selloutRisk.confidence)}>
                {(insight.selloutRisk.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ROI Estimates */}
      <div className="bg-gray-800 rounded-lg p-3 mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <Target className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-300">ROI Estimates</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">3 Months:</span>
              <span className={getROIColor(insight.roiEstimate.shortTerm)}>
                {insight.roiEstimate.shortTerm > 0 ? '+' : ''}{insight.roiEstimate.shortTerm.toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">1 Year:</span>
              <span className={getROIColor(insight.roiEstimate.longTerm)}>
                {insight.roiEstimate.longTerm > 0 ? '+' : ''}{insight.roiEstimate.longTerm.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500">Confidence:</span>
          <span className={getConfidenceColor(insight.roiEstimate.confidence)}>
            {(insight.roiEstimate.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Action Recommendations */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {insight.selloutRisk.score > 70 && (
            <span className="badge badge-error text-xs">Urgent</span>
          )}
          {insight.roiEstimate.longTerm > 30 && (
            <span className="badge badge-success text-xs">High ROI</span>
          )}
          {insight.hypeScore > 80 && (
            <span className="badge badge-warning text-xs">Trending</span>
          )}
        </div>
        <button className="btn btn-primary btn-sm">
          View Product
        </button>
      </div>
    </div>
  );
};

// Summary Metric Component
interface SummaryMetricProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  suffix?: string;
}

const SummaryMetric: React.FC<SummaryMetricProps> = ({ title, value, icon, suffix }) => (
  <div className="flex items-center space-x-3">
    {icon}
    <div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xl font-bold text-white">
        {value}{suffix}
      </p>
    </div>
  </div>
);

export default PredictiveInsights;