import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Eye, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { alertService, AlertStats as AlertStatsType } from '../../services/alertService';

const AlertStats: React.FC = () => {
  const [stats, setStats] = useState<AlertStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await alertService.getAlertStats();
      setStats(data);
    } catch (err) {
      console.error('Error loading alert stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background-secondary rounded-lg p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8 h-8 bg-gray-600 rounded-lg" />
              <div className="w-4 h-4 bg-gray-600 rounded" />
            </div>
            <div className="w-16 h-8 bg-gray-600 rounded mb-2" />
            <div className="w-24 h-4 bg-gray-600 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-background-secondary rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-white">Failed to load statistics</span>
          </div>
          <button
            onClick={loadStats}
            className="flex items-center space-x-2 px-3 py-1 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Alerts',
      value: stats.total.toLocaleString(),
      icon: Bell,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      description: 'All time alerts received'
    },
    {
      title: 'Unread Alerts',
      value: stats.unread.toLocaleString(),
      icon: Eye,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      description: 'Alerts awaiting your attention'
    },
    {
      title: 'Click Rate',
      value: `${stats.clickThroughRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      description: 'Alerts you acted on'
    },
    {
      title: 'Recent Alerts',
      value: stats.recentAlerts.toLocaleString(),
      icon: Clock,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      description: 'Last 7 days'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <div
            key={index}
            className="bg-background-secondary rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <Icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {card.value}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-1">
                {card.title}
              </h3>
              <p className="text-xs text-gray-500">
                {card.description}
              </p>
            </div>
          </div>
        );
      })}

      {/* Alert Type Breakdown */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="md:col-span-2 lg:col-span-4 bg-background-secondary rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-primary-400" />
            <span>Alert Types</span>
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byType).map(([type, count]) => {
              const typeInfo = alertService.getAlertTypeInfo(type as 'restock' | 'price_drop' | 'pre_order' | 'low_stock' | 'back_in_stock');
              const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
              
              return (
                <div key={type} className="text-center">
                  <div className="text-2xl mb-2">{typeInfo.icon}</div>
                  <div className="text-lg font-bold text-white mb-1">
                    {count.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-400 mb-2">
                    {typeInfo.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertStats;