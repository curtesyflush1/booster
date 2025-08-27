import React, { useState } from 'react';
import { Bell, Eye, Clock, ExternalLink, Filter, ChevronRight } from 'lucide-react';
import { Alert } from '../../types';

interface RecentActivityProps {
  alerts: Alert[];
  watchedProducts: any[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ alerts, watchedProducts }) => {
  const [activeTab, setActiveTab] = useState<'alerts' | 'products'>('alerts');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'restock' | 'price_drop'>('all');

  const filteredAlerts = alerts.filter(alert => {
    if (filterType === 'all') return true;
    if (filterType === 'unread') return !alert.isRead;
    return alert.type === filterType;
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'restock': return 'text-green-400';
      case 'price_drop': return 'text-blue-400';
      case 'low_stock': return 'text-yellow-400';
      case 'pre_order': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const getAlertTypeBadge = (type: string) => {
    switch (type) {
      case 'restock': return 'badge-success';
      case 'price_drop': return 'badge-info';
      case 'low_stock': return 'badge-warning';
      case 'pre_order': return 'badge-secondary';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'alerts'
                ? 'border-pokemon-electric text-pokemon-electric'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4" />
              <span>Recent Alerts</span>
              {alerts.filter(a => !a.isRead).length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                  {alerts.filter(a => !a.isRead).length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'products'
                ? 'border-pokemon-electric text-pokemon-electric'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>Watched Products</span>
            </div>
          </button>
        </nav>

        {/* Filter for Alerts */}
        {activeTab === 'alerts' && (
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
            >
              <option value="all">All Alerts</option>
              <option value="unread">Unread</option>
              <option value="restock">Restocks</option>
              <option value="price_drop">Price Drops</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="card-dark p-6">
        {activeTab === 'alerts' ? (
          <AlertsList alerts={filteredAlerts} formatTimeAgo={formatTimeAgo} getAlertTypeColor={getAlertTypeColor} getAlertTypeBadge={getAlertTypeBadge} />
        ) : (
          <WatchedProductsList products={watchedProducts} />
        )}
      </div>
    </div>
  );
};

// Alerts List Component
interface AlertsListProps {
  alerts: Alert[];
  formatTimeAgo: (dateString: string) => string;
  getAlertTypeColor: (type: string) => string;
  getAlertTypeBadge: (type: string) => string;
}

const AlertsList: React.FC<AlertsListProps> = ({ alerts, formatTimeAgo, getAlertTypeColor, getAlertTypeBadge }) => {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Recent Alerts</h3>
        <p className="text-gray-400">
          Your alerts will appear here when products you're watching become available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Recent Alerts</h3>
        <span className="text-sm text-gray-400">{alerts.length} alerts</span>
      </div>
      
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border transition-colors ${
              alert.isRead 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-gray-750 border-pokemon-electric/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h4 className="text-white font-medium">{alert.data.productName}</h4>
                  <span className={`badge ${getAlertTypeBadge(alert.type)} text-xs`}>
                    {alert.type.replace('_', ' ')}
                  </span>
                  {!alert.isRead && (
                    <div className="w-2 h-2 bg-pokemon-electric rounded-full" />
                  )}
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-400 mb-2">
                  <span>{alert.data.retailerName}</span>
                  <span>•</span>
                  <span className={getAlertTypeColor(alert.type)}>
                    ${alert.data.price.toFixed(2)}
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeAgo(alert.createdAt)}</span>
                  </span>
                </div>

                {alert.data.priceChange && (
                  <div className="text-sm">
                    <span className="text-gray-400">Price change: </span>
                    <span className={alert.data.priceChange.percentChange < 0 ? 'text-green-400' : 'text-red-400'}>
                      {alert.data.priceChange.percentChange > 0 ? '+' : ''}
                      {alert.data.priceChange.percentChange.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                {alert.data.cartUrl && (
                  <button className="btn btn-primary btn-sm">
                    Add to Cart
                  </button>
                )}
                <button className="btn btn-secondary btn-sm">
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Watched Products List Component
interface WatchedProductsListProps {
  products: any[];
}

const WatchedProductsList: React.FC<WatchedProductsListProps> = ({ products }) => {
  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <Eye className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Watched Products</h3>
        <p className="text-gray-400 mb-4">
          Start watching products to see their status and insights here.
        </p>
        <button className="btn btn-primary">Browse Products</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Watched Products</h3>
        <span className="text-sm text-gray-400">{products.length} products</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.slice(0, 6).map((item, index) => (
          <div key={index} className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-white font-medium mb-1">
                  {item.product?.name || 'Product Name'}
                </h4>
                <p className="text-sm text-gray-400 mb-2">
                  Watching since {new Date(item.watch.created_at).toLocaleDateString()}
                </p>
                
                {item.insights && (
                  <div className="flex items-center space-x-4 text-xs">
                    <span className="text-pokemon-electric">
                      Hype: {item.insights.hypeScore}/100
                    </span>
                    <span className={item.insights.selloutRisk.score > 70 ? 'text-red-400' : 'text-green-400'}>
                      Risk: {item.insights.selloutRisk.score}/100
                    </span>
                  </div>
                )}
              </div>
              
              <button className="text-gray-400 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {products.length > 6 && (
        <div className="text-center">
          <button className="btn btn-secondary btn-sm">
            View All Watched Products
          </button>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;