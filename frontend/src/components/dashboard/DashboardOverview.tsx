import React from 'react';
import { Crown, Bell, Eye, TrendingUp, Activity, Target, Zap, Clock } from 'lucide-react';
import { DashboardStats } from '../../types';

interface DashboardOverviewProps {
  stats: DashboardStats;
  insights: any;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ stats, insights }) => {
  return (
    <div className="space-y-8">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Watches"
          value={stats.totalWatches}
          icon={<Eye className="w-8 h-8 text-pokemon-water" />}
          trend={stats.totalWatches > 0 ? '+12%' : undefined}
          trendUp={true}
        />

        <StatCard
          title="Unread Alerts"
          value={stats.unreadAlerts}
          icon={<Bell className="w-8 h-8 text-pokemon-electric" />}
          trend={stats.unreadAlerts > 0 ? 'New' : undefined}
          trendUp={false}
        />

        <StatCard
          title="Successful Purchases"
          value={stats.successfulPurchases}
          icon={<TrendingUp className="w-8 h-8 text-pokemon-grass" />}
          trend={stats.successfulPurchases > 0 ? '+3 this week' : undefined}
          trendUp={true}
        />

        <StatCard
          title="Click-Through Rate"
          value={`${stats.clickThroughRate?.toFixed(1) || 0}%`}
          icon={<Target className="w-8 h-8 text-pokemon-fire" />}
          trend={stats.clickThroughRate > 50 ? 'Excellent' : 'Good'}
          trendUp={stats.clickThroughRate > 50}
        />
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Metrics */}
        <div className="card-dark p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-pokemon-electric" />
            Engagement Metrics
          </h3>
          <div className="space-y-4">
            <MetricRow
              label="Total Alerts Generated"
              value={stats.totalAlerts}
              icon={<Bell className="w-4 h-4 text-pokemon-electric" />}
            />
            <MetricRow
              label="Recent Alerts (7 days)"
              value={stats.recentAlerts || 0}
              icon={<Clock className="w-4 h-4 text-pokemon-water" />}
            />
            <MetricRow
              label="Average Response Time"
              value={insights?.engagementMetrics?.averageResponseTime || '< 5 seconds'}
              icon={<Zap className="w-4 h-4 text-pokemon-electric" />}
            />
          </div>
        </div>

        {/* Alert Trends */}
        <div className="card-dark p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Alert Distribution
          </h3>
          <div className="space-y-3">
            {insights?.alertTrends && Object.entries(insights.alertTrends).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-gray-300 capitalize">{type.replace('_', ' ')}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-pokemon-electric h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, ((count as number) / stats.totalAlerts) * 100)}%`
                      }}
                    />
                  </div>
                  <span className="text-white font-medium w-8 text-right">{count as number}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performing Products */}
      {insights?.topPerformingProducts && insights.topPerformingProducts.length > 0 && (
        <div className="card-dark p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Most Watched Products
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.topPerformingProducts.slice(0, 6).map((product: any, index: number) => (
              <div key={product.product_id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-pokemon-electric font-medium">#{index + 1}</span>
                  <span className="text-xs text-gray-400">{product.alert_count} alerts</span>
                </div>
                <p className="text-white font-medium text-sm truncate">
                  Product ID: {product.product_id.slice(0, 8)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Components
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, trendUp }) => (
  <div className="card-dark p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {trend && (
          <p className={`text-xs mt-1 ${trendUp ? 'text-green-400' : 'text-yellow-400'}`}>
            {trend}
          </p>
        )}
      </div>
      {icon}
    </div>
  </div>
);

interface MetricRowProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-2">
      {icon}
      <span className="text-gray-300">{label}</span>
    </div>
    <span className="text-white font-medium">{value}</span>
  </div>
);

export default DashboardOverview;