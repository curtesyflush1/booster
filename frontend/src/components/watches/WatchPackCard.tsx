import React, { useState } from 'react';
import { 
  Package, Users, Eye, EyeOff, ExternalLink,
  Clock, TrendingUp
} from 'lucide-react';
import { WatchPack } from '../../types';
import LoadingSpinner from '../LoadingSpinner';

interface WatchPackCardProps {
  watchPack: WatchPack;
  isSubscribed: boolean;
  onSubscribe: (packId: string) => void;
  onUnsubscribe: (packId: string) => void;
}

const WatchPackCardComponent: React.FC<WatchPackCardProps> = ({
  watchPack,
  isSubscribed,
  onSubscribe,
  onUnsubscribe
}) => {
  const [loading, setLoading] = useState(false);

  const handleSubscriptionToggle = async () => {
    setLoading(true);
    try {
      if (isSubscribed) {
        await onUnsubscribe(watchPack.id);
      } else {
        await onSubscribe(watchPack.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Calculate availability stats
  const totalProducts = watchPack.products?.length || watchPack.productIds.length;
  const inStockProducts = watchPack.products?.filter(product => 
    product.availability?.some(a => a.inStock)
  ).length || 0;
  
  const availabilityPercentage = totalProducts > 0 ? (inStockProducts / totalProducts) * 100 : 0;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{watchPack.name}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{totalProducts} products</span>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{watchPack.subscriberCount} subscribers</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Status Badge */}
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            watchPack.isActive 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-600 text-gray-300'
          }`}>
            {watchPack.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Description */}
        {watchPack.description && (
          <p className="text-gray-300 text-sm mb-4 line-clamp-2">
            {watchPack.description}
          </p>
        )}

        {/* Availability Stats */}
        <div className="bg-gray-700 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Availability</span>
            <span className="text-sm font-medium text-white">
              {inStockProducts}/{totalProducts} in stock
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-600 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all ${
                availabilityPercentage > 50 ? 'bg-green-500' : 
                availabilityPercentage > 25 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${availabilityPercentage}%` }}
            />
          </div>
        </div>

        {/* Product Preview */}
        {watchPack.products && watchPack.products.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Included Products</h4>
            <div className="grid grid-cols-4 gap-2">
              {watchPack.products.slice(0, 4).map((product, index) => (
                <div key={product.id} className="relative">
                  <div className="aspect-square bg-gray-700 rounded overflow-hidden">
                    {product.thumbnailUrl || product.imageUrl ? (
                      <img
                        src={product.thumbnailUrl || product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                  </div>
                  
                  {/* Stock indicator */}
                  <div className="absolute top-1 right-1">
                    <div className={`w-2 h-2 rounded-full ${
                      product.availability?.some(a => a.inStock) 
                        ? 'bg-green-400' 
                        : 'bg-red-400'
                    }`} />
                  </div>
                  
                  {/* Show count if more products */}
                  {index === 3 && totalProducts > 4 && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded">
                      <span className="text-white text-xs font-medium">
                        +{totalProducts - 4}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Created {formatDate(watchPack.createdAt)}</span>
          </div>
          
          {watchPack.subscriberCount > 10 && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Popular</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6">
        <div className="flex gap-3">
          <button
            onClick={handleSubscriptionToggle}
            disabled={loading || !watchPack.isActive}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              isSubscribed
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } disabled:bg-gray-600 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : isSubscribed ? (
              <>
                <EyeOff className="w-4 h-4" />
                Unsubscribe
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Subscribe
              </>
            )}
          </button>

          {/* View Details Button */}
          <button
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            title="View details"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        {!watchPack.isActive && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            This watch pack is currently inactive
          </p>
        )}
      </div>
    </div>
  );
};

// Memoize WatchPackCard to prevent unnecessary re-renders when props haven't changed
export const WatchPackCard = React.memo(WatchPackCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.watchPack.id === nextProps.watchPack.id &&
    prevProps.watchPack.name === nextProps.watchPack.name &&
    prevProps.watchPack.isActive === nextProps.watchPack.isActive &&
    prevProps.watchPack.subscriberCount === nextProps.watchPack.subscriberCount &&
    prevProps.isSubscribed === nextProps.isSubscribed &&
    prevProps.onSubscribe === nextProps.onSubscribe &&
    prevProps.onUnsubscribe === nextProps.onUnsubscribe &&
    JSON.stringify(prevProps.watchPack.products) === JSON.stringify(nextProps.watchPack.products)
  );
});