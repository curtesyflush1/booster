import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  ExternalLink, 
  ShoppingCart, 
  Trash2, 
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Alert, PaginatedResponse } from '../../types';
import { alertService } from '../../services/alertService';
import LoadingSpinner from '../LoadingSpinner';

interface AlertInboxProps {
  alerts: PaginatedResponse<Alert> | null;
  loading: boolean;
  error: string | null;
  selectedAlerts: string[];
  onAlertSelect: (alertId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onAlertAction: (alertId: string, action: 'read' | 'click' | 'delete') => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

const AlertInbox: React.FC<AlertInboxProps> = ({
  alerts,
  loading,
  error,
  selectedAlerts,
  onAlertSelect,
  onSelectAll,
  onAlertAction,
  onPageChange,
  onRefresh
}) => {
  const handleAlertClick = async (alert: Alert) => {
    // Mark as clicked if not already read
    if (!alert.isRead) {
      await onAlertAction(alert.id, 'read');
    }
    
    // Track click
    await onAlertAction(alert.id, 'click');
    
    // Open product URL (support both camelCase and snake_case)
    const cartUrl = (alert.data as any).cartUrl || (alert.data as any).cart_url;
    const productUrl = (alert.data as any).productUrl || (alert.data as any).product_url;
    if (cartUrl) {
      window.open(cartUrl, '_blank');
    } else if (productUrl) {
      window.open(productUrl, '_blank');
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: Alert['priority']): string => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-blue-500';
      case 'low': return 'border-l-gray-500';
      default: return 'border-l-gray-500';
    }
  };

  const getTypeIcon = (type: Alert['type']): string => {
    switch (type) {
      case 'restock': return '📦';
      case 'price_drop': return '💰';
      case 'low_stock': return '⚠️';
      case 'pre_order': return '🎯';
      default: return '🔔';
    }
  };

  if (loading) {
    return (
      <div className="bg-background-secondary rounded-lg p-8">
        <LoadingSpinner />
        <p className="text-center text-gray-400 mt-4">Loading alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-background-secondary rounded-lg p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Error Loading Alerts</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!alerts || !alerts.data || alerts.data.length === 0) {
    return (
      <div className="bg-background-secondary rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">🔔</div>
        <h3 className="text-lg font-semibold text-white mb-2">No Alerts Yet</h3>
        <p className="text-gray-400 mb-4">
          You'll see your Pokémon TCG product alerts here when they arrive.
        </p>
        <p className="text-sm text-gray-500">
          Make sure you have active watches set up to receive alerts.
        </p>
      </div>
    );
  }

  const allSelected = alerts.data && alerts.data.length > 0 && selectedAlerts.length === alerts.data.length;
  const someSelected = selectedAlerts.length > 0 && alerts.data && selectedAlerts.length < alerts.data.length;

  return (
    <div className="space-y-4">
      {/* Select All Header */}
      <div className="bg-background-secondary rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectAll(!allSelected)}
              className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              {allSelected ? (
                <CheckCircle2 className="w-5 h-5 text-primary-400" />
              ) : someSelected ? (
                <div className="w-5 h-5 rounded-full bg-primary-400 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              ) : (
                <Circle className="w-5 h-5" />
              )}
              <span>
                {allSelected ? 'Deselect All' : 'Select All'}
              </span>
            </button>
            
            {alerts.pagination && (
              <span className="text-sm text-gray-500">
                {alerts.pagination.total} total alerts
              </span>
            )}
          </div>

          {selectedAlerts.length > 0 && (
            <div className="text-sm text-gray-400">
              {selectedAlerts.length} selected
            </div>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {alerts.data?.map((alert) => {
          const isSelected = selectedAlerts.includes(alert.id);
          const typeInfo = alertService.getAlertTypeInfo(alert.type);
          const priorityColor = getPriorityColor(alert.priority);

          return (
            <div
              key={alert.id}
              className={`bg-background-secondary rounded-lg border-l-4 ${priorityColor} transition-all duration-200 hover:bg-background-tertiary ${
                !alert.isRead ? 'ring-1 ring-primary-500/20' : ''
              }`}
            >
              <div className="p-4">
                <div className="flex items-start space-x-4">
                  {/* Selection Checkbox */}
                  <button
                    onClick={() => onAlertSelect(alert.id, !isSelected)}
                    className="mt-1 flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckCircle2 className="w-5 h-5 text-primary-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-400 hover:text-gray-300" />
                    )}
                  </button>

                  {/* Alert Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{getTypeIcon(alert.type)}</span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeInfo.color} bg-opacity-20`}>
                            {typeInfo.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(alert.createdAt)}
                          </span>
                          {!alert.isRead && (
                            <div className="w-2 h-2 bg-primary-400 rounded-full" />
                          )}
                        </div>

                        {/* Product Info */}
                        <h3 className={`text-lg font-semibold mb-1 ${
                          alert.isRead ? 'text-gray-300' : 'text-white'
                        }`}>
                          {alert.data.productName}
                        </h3>
                        
                        <p className="text-gray-400 text-sm mb-2">
                          Available at {alert.data.retailerName}
                        </p>

                        {/* Price Info */}
                        <div className="flex items-center space-x-4 mb-3">
                          {alert.data.price && (
                            <div className="flex items-center space-x-2">
                              <span className="text-lg font-bold text-green-400">
                                ${alert.data.price.toFixed(2)}
                              </span>
                              {alert.data.originalPrice && alert.data.originalPrice !== alert.data.price && (
                                <span className="text-sm text-gray-500 line-through">
                                  ${alert.data.originalPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {((alert.data as any).priceChange || (alert.data as any).price_change) && (
                            <span className={`text-sm font-medium ${
                              (((alert.data as any).priceChange?.percentChange) ?? (alert.data as any).price_change?.percent_change) < 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {((((alert.data as any).priceChange?.percentChange) ?? (alert.data as any).price_change?.percent_change) > 0) ? '+' : ''}
                              {((((alert.data as any).priceChange?.percentChange) ?? (alert.data as any).price_change?.percent_change) || 0).toFixed(1)}%
                            </span>
                          )}
                        </div>

                        {/* Availability Status */}
                        <div className="flex items-center space-x-2 mb-3">
                          {(() => {
                            const availability = (alert.data as any).availability || (alert.data as any).availability_status || '';
                            const color = availability === 'in_stock' ? 'bg-green-400'
                              : availability === 'low_stock' ? 'bg-yellow-400'
                              : availability === 'pre_order' ? 'bg-blue-400'
                              : 'bg-gray-400';
                            return (
                              <>
                                <div className={`w-2 h-2 rounded-full ${color}`} />
                                <span className="text-sm text-gray-400 capitalize">
                                  {String(availability).replace('_', ' ') || 'unknown'}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4">
                        {!alert.isRead && (
                          <button
                            onClick={() => onAlertAction(alert.id, 'read')}
                            className="p-2 text-gray-400 hover:text-white hover:bg-background-tertiary rounded-md transition-colors"
                            title="Mark as read"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => onAlertAction(alert.id, 'delete')}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-background-tertiary rounded-md transition-colors"
                          title="Delete alert"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3 mt-4">
                      <button
                        onClick={() => handleAlertClick(alert)}
                        className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                      >
                        {(((alert.data as any).cartUrl) || ((alert.data as any).cart_url)) ? (
                          <>
                            <ShoppingCart className="w-4 h-4" />
                            <span>Add to Cart</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4" />
                            <span>View Product</span>
                          </>
                        )}
                      </button>

                      {(((alert.data as any).cartUrl || (alert.data as any).cart_url) && ((alert.data as any).productUrl || (alert.data as any).product_url)) && (
                        <button
                          onClick={() => {
                            const productUrl = (alert.data as any).productUrl || (alert.data as any).product_url;
                            if (productUrl) window.open(productUrl, '_blank');
                          }}
                          className="flex items-center space-x-2 px-4 py-2 bg-background-tertiary text-gray-300 rounded-md hover:text-white hover:bg-gray-600 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>View Details</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {alerts.pagination && alerts.pagination.totalPages > 1 && (
        <div className="bg-background-secondary rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Showing {((alerts.pagination.page - 1) * alerts.pagination.limit) + 1} to{' '}
              {Math.min(alerts.pagination.page * alerts.pagination.limit, alerts.pagination.total)} of{' '}
              {alerts.pagination.total} alerts
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onPageChange(alerts.pagination.page - 1)}
                disabled={!alerts.pagination.hasPrev}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, alerts.pagination.totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  const isActive = pageNum === alerts.pagination.page;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        isActive
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-background-tertiary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => onPageChange(alerts.pagination.page + 1)}
                disabled={!alerts.pagination.hasNext}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertInbox;
