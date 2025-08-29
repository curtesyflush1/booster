import React from 'react';
import { 
  Eye, EyeOff, Settings, Trash2, ExternalLink, 
  MapPin, DollarSign, Clock, AlertCircle, CheckCircle
} from 'lucide-react';
import { Watch } from '../../types';

interface WatchCardProps {
  watch: Watch;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: (watchId: string, isActive: boolean) => void;
  onDelete: (watchId: string) => void;
  onEdit?: (watch: Watch) => void;
}

const WatchCardComponent: React.FC<WatchCardProps> = ({
  watch,
  isSelected,
  onSelect,
  onToggle,
  onDelete,
  onEdit
}) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAvailabilityStatus = () => {
    const inStockCount = watch.product.availability?.filter(a => a.inStock).length || 0;
    const totalRetailers = watch.product.availability?.length || 0;
    
    if (inStockCount === 0) {
      return { status: 'out-of-stock', text: 'Out of Stock', color: 'text-red-400' };
    } else if (inStockCount === totalRetailers) {
      return { status: 'in-stock', text: 'In Stock', color: 'text-green-400' };
    } else {
      return { status: 'partial', text: `${inStockCount}/${totalRetailers} Available`, color: 'text-yellow-400' };
    }
  };

  const availabilityStatus = getAvailabilityStatus();
  const lowestPrice = watch.product.availability?.reduce((min, curr) => 
    curr.inStock && curr.price < min ? curr.price : min, 
    Infinity
  );

  return (
    <div className={`bg-gray-800 rounded-lg p-6 transition-all ${
      isSelected ? 'ring-2 ring-blue-500' : 'hover:bg-gray-750'
    }`}>
      <div className="flex items-start gap-4">
        {/* Selection Checkbox */}
        <label className="flex items-center mt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
        </label>

        {/* Product Image */}
        <div className="w-20 h-20 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
          {watch.product.thumbnailUrl || watch.product.imageUrl ? (
            <img
              src={watch.product.thumbnailUrl || watch.product.imageUrl}
              alt={watch.product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Eye className="w-8 h-8 text-gray-500" />
            </div>
          )}
        </div>

        {/* Watch Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-white truncate pr-4">
              {watch.product.name}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status Badge */}
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                watch.isActive 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-600 text-gray-300'
              }`}>
                {watch.isActive ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>

          {/* Product Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Availability */}
            <div className="flex items-center gap-2">
              <CheckCircle className={`w-4 h-4 ${availabilityStatus.color}`} />
              <span className={`text-sm ${availabilityStatus.color}`}>
                {availabilityStatus.text}
              </span>
            </div>

            {/* Price */}
            {lowestPrice && lowestPrice !== Infinity && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-400">
                  From {formatPrice(lowestPrice)}
                </span>
              </div>
            )}

            {/* Max Price Filter */}
            {watch.filters.maxPrice && (
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-400">
                  Max: {formatPrice(watch.filters.maxPrice)}
                </span>
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">
                {watch.filters.onlineOnly ? 'Online Only' : 'Online & Stores'}
              </span>
            </div>
          </div>

          {/* Watch Stats */}
          <div className="flex items-center gap-6 text-sm text-gray-400 mb-4">
            <div className="flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              <span>{watch.alertCount} alerts sent</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>Created {formatDate(watch.createdAt)}</span>
            </div>

            {watch.lastAlertSent && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>Last alert {formatDate(watch.lastAlertSent)}</span>
              </div>
            )}
          </div>

          {/* Retailer Filters */}
          {watch.filters.retailers && watch.filters.retailers.length > 0 && (
            <div className="mb-4">
              <span className="text-sm text-gray-400">Watching: </span>
              <span className="text-sm text-white">
                {watch.filters.retailers.join(', ')}
              </span>
            </div>
          )}

          {/* Current Availability */}
          {watch.product.availability && watch.product.availability.length > 0 && (
            <div className="bg-gray-700 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Current Availability</h4>
              <div className="space-y-2">
                {watch.product.availability.slice(0, 3).map((availability) => (
                  <div key={availability.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{availability.retailerName}</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        availability.inStock 
                          ? 'bg-green-600 text-white' 
                          : 'bg-red-600 text-white'
                      }`}>
                        {availability.inStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                    {availability.inStock && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-400 font-medium">
                          {formatPrice(availability.price)}
                        </span>
                        {availability.cartUrl && (
                          <a
                            href={availability.cartUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {watch.product.availability.length > 3 && (
                  <div className="text-sm text-gray-400">
                    +{watch.product.availability.length - 3} more retailers
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => onToggle(watch.id, !watch.isActive)}
            className={`p-2 rounded-lg transition-colors ${
              watch.isActive
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
            title={watch.isActive ? 'Pause watch' : 'Resume watch'}
          >
            {watch.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {onEdit && (
            <button
              onClick={() => onEdit(watch)}
              className="p-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              title="Edit watch settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onDelete(watch.id)}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            title="Delete watch"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Memoize WatchCard to prevent unnecessary re-renders when props haven't changed
export const WatchCard = React.memo(WatchCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.watch.id === nextProps.watch.id &&
    prevProps.watch.isActive === nextProps.watch.isActive &&
    prevProps.watch.alertCount === nextProps.watch.alertCount &&
    prevProps.watch.lastAlertSent === nextProps.watch.lastAlertSent &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onToggle === nextProps.onToggle &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onEdit === nextProps.onEdit &&
    JSON.stringify(prevProps.watch.product.availability) === JSON.stringify(nextProps.watch.product.availability) &&
    JSON.stringify(prevProps.watch.filters) === JSON.stringify(nextProps.watch.filters)
  );
});