import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Package, Target, Clock, Award, AlertCircle, CheckCircle } from 'lucide-react';
import { User } from '../../types';

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

interface PortfolioTrackingProps {
  portfolio: PortfolioData;
  user: User | null;
}

const PortfolioTracking: React.FC<PortfolioTrackingProps> = ({ portfolio, user }) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'holdings' | 'gaps' | 'performance'>('overview');

  const isProUser = user?.subscriptionTier === 'pro';

  return (
    <div className="space-y-6">
      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PortfolioCard
          title="Total Collection Value"
          value={`$${portfolio.totalValue.toFixed(2)}`}
          change={portfolio.valueChange}
          icon={<Package className="w-8 h-8 text-pokemon-water" />}
        />
        
        <PortfolioCard
          title="Total Items Watched"
          value={portfolio.totalItems.toString()}
          icon={<Target className="w-8 h-8 text-pokemon-electric" />}
        />
        
        <PortfolioCard
          title="Alerts Generated"
          value={portfolio.performance.alertsGenerated.toString()}
          icon={<Clock className="w-8 h-8 text-pokemon-fire" />}
        />
        
        <PortfolioCard
          title="Success Rate"
          value={`${((portfolio.performance.successfulPurchases / Math.max(1, portfolio.performance.alertsGenerated)) * 100).toFixed(1)}%`}
          icon={<Award className="w-8 h-8 text-pokemon-grass" />}
        />
      </div>

      {/* Section Navigation */}
      <div className="card-dark p-1">
        <nav className="flex space-x-1">
          {[
            { key: 'overview', label: 'Overview', icon: Package },
            { key: 'holdings', label: 'Top Holdings', icon: TrendingUp },
            { key: 'gaps', label: 'Collection Gaps', icon: Target },
            { key: 'performance', label: 'Performance', icon: Award }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeSection === key
                  ? 'bg-pokemon-electric text-black'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      {activeSection === 'overview' && (
        <PortfolioOverview portfolio={portfolio} isProUser={isProUser} />
      )}

      {activeSection === 'holdings' && (
        <TopHoldings holdings={portfolio.topHoldings} isProUser={isProUser} />
      )}

      {activeSection === 'gaps' && (
        <CollectionGaps gapAnalysis={portfolio.gapAnalysis} isProUser={isProUser} />
      )}

      {activeSection === 'performance' && (
        <PerformanceMetrics performance={portfolio.performance} isProUser={isProUser} />
      )}
    </div>
  );
};

// Portfolio Card Component
interface PortfolioCardProps {
  title: string;
  value: string;
  change?: {
    amount: number;
    percentage: number;
    period: string;
  };
  icon: React.ReactNode;
}

const PortfolioCard: React.FC<PortfolioCardProps> = ({ title, value, change, icon }) => (
  <div className="card-dark p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {change && (
          <div className="flex items-center space-x-1 mt-1">
            {change.percentage >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-400" />
            )}
            <span className={`text-xs ${change.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change.percentage >= 0 ? '+' : ''}{change.percentage.toFixed(1)}% ({change.period})
            </span>
          </div>
        )}
      </div>
      {icon}
    </div>
  </div>
);

// Portfolio Overview Section
const PortfolioOverview: React.FC<{ portfolio: PortfolioData; isProUser: boolean }> = ({ portfolio, isProUser }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Value Breakdown */}
      <div className="card-dark p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Value Breakdown</h3>
        {isProUser ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Current Market Value</span>
              <span className="text-white font-medium">${portfolio.totalValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Estimated Purchase Cost</span>
              <span className="text-white font-medium">$0.00</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Unrealized Gain/Loss</span>
              <span className="text-green-400 font-medium">+$0.00 (0%)</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">Detailed value tracking available with Pro subscription</p>
            <button className="btn btn-primary btn-sm">Upgrade to Pro</button>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="card-dark p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
        <div className="space-y-3">
          <StatRow
            label="Average Response Time"
            value={portfolio.performance.averageResponseTime}
            icon={<Clock className="w-4 h-4 text-pokemon-water" />}
          />
          <StatRow
            label="Successful Purchases"
            value={portfolio.performance.successfulPurchases.toString()}
            icon={<CheckCircle className="w-4 h-4 text-green-400" />}
          />
          <StatRow
            label="Missed Opportunities"
            value={portfolio.performance.missedOpportunities.toString()}
            icon={<AlertCircle className="w-4 h-4 text-red-400" />}
          />
        </div>
      </div>
    </div>
  </div>
);

// Top Holdings Section
const TopHoldings: React.FC<{ holdings: any[]; isProUser: boolean }> = ({ holdings, isProUser }) => (
  <div className="card-dark p-6">
    <h3 className="text-lg font-semibold text-white mb-4">Top Holdings</h3>
    {isProUser ? (
      holdings.length > 0 ? (
        <div className="space-y-4">
          {holdings.map((holding, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Product #{index + 1}</p>
                  <p className="text-sm text-gray-400">{holding.alertCount} alerts generated</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">Value: TBD</p>
                <p className="text-sm text-gray-400">ROI: TBD</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No holdings tracked yet</p>
        </div>
      )
    ) : (
      <div className="text-center py-8">
        <Package className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 mb-4">Holdings tracking available with Pro subscription</p>
        <button className="btn btn-primary btn-sm">Upgrade to Pro</button>
      </div>
    )}
  </div>
);

// Collection Gaps Section
const CollectionGaps: React.FC<{ gapAnalysis: any; isProUser: boolean }> = ({ gapAnalysis, isProUser }) => (
  <div className="space-y-6">
    {isProUser ? (
      <>
        {/* Missing Sets */}
        <div className="card-dark p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Incomplete Sets</h3>
          {gapAnalysis.missingSets?.length > 0 ? (
            <div className="space-y-4">
              {gapAnalysis.missingSets.map((set: any, index: number) => (
                <div key={index} className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{set.setName}</h4>
                    <span className="text-sm text-gray-400">{set.completionPercentage}% complete</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-pokemon-electric h-2 rounded-full"
                      style={{ width: `${set.completionPercentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400">{set.missingItems} items missing</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No incomplete sets found</p>
          )}
        </div>

        {/* Recommended Purchases */}
        <div className="card-dark p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recommended Purchases</h3>
          {gapAnalysis.recommendedPurchases?.length > 0 ? (
            <div className="space-y-3">
              {gapAnalysis.recommendedPurchases.map((rec: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Product {rec.productId.slice(0, 8)}...</p>
                    <p className="text-sm text-gray-400">{rec.reason}</p>
                  </div>
                  <span className={`badge ${rec.priority === 'high' ? 'badge-error' : 'badge-warning'}`}>
                    {rec.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No recommendations available</p>
          )}
        </div>
      </>
    ) : (
      <div className="card-dark p-6 text-center">
        <Target className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 mb-4">Collection gap analysis available with Pro subscription</p>
        <button className="btn btn-primary btn-sm">Upgrade to Pro</button>
      </div>
    )}
  </div>
);

// Performance Metrics Section
const PerformanceMetrics: React.FC<{ performance: any; isProUser: boolean }> = ({ performance, isProUser }) => (
  <div className="card-dark p-6">
    <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <MetricCard
        title="Alerts Generated"
        value={performance.alertsGenerated}
        icon={<Clock className="w-6 h-6 text-pokemon-water" />}
      />
      <MetricCard
        title="Successful Purchases"
        value={performance.successfulPurchases}
        icon={<CheckCircle className="w-6 h-6 text-green-400" />}
      />
      <MetricCard
        title="Missed Opportunities"
        value={performance.missedOpportunities}
        icon={<AlertCircle className="w-6 h-6 text-red-400" />}
      />
    </div>
  </div>
);

// Helper Components
const StatRow: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      {icon}
      <span className="text-gray-300">{label}</span>
    </div>
    <span className="text-white font-medium">{value}</span>
  </div>
);

const MetricCard: React.FC<{ title: string; value: number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-gray-800 rounded-lg p-4">
    <div className="flex items-center space-x-3 mb-2">
      {icon}
      <span className="text-sm font-medium text-gray-300">{title}</span>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

export default PortfolioTracking;