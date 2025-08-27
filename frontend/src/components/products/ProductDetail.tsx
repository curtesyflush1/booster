import React, { useState, useEffect } from 'react';
import { 
  Eye, EyeOff, ShoppingCart, ExternalLink, Calendar, 
  Package, MapPin, TrendingUp, AlertCircle, Clock, Star
} from 'lucide-react';
import { Product, ProductAvailability } from '../../types';
import { apiClient } from '../../services/apiClient';
import LoadingSpinner from '../LoadingSpinner';
import { PriceHistoryChart } from './PriceHistoryChart';

interface ProductDetailProps {
  productId: string;
  onClose?: () => void;
}

interface PriceHistoryData {
  date: string;
  price: number;
  retailer: string;
  inStock: boolean;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  productId,
  onClose
}) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'availability' | 'history'>('overview');

  useEffect(() => {
    loadProduct();
    checkWatchStatus();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Product>(`/products/${productId}`);
      setProduct(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const loadPriceHistory = async () => {
    if (!product) return;
    
    try {
      setPriceHistoryLoading(true);
      const response = await apiClient.get<PriceHistoryData[]>(`/products/${productId}/price-history`);
      setPriceHistory(response.data);
    } catch (err) {
      console.error('Failed to load price history:', err);
    } finally {
      setPriceHistoryLoading(false);
    }
  };

  const checkWatchStatus = async () => {
    try {
      const response = await apiClient.get(`/watches?product_id=${productId}`);
      setIsWatched(response.data.data.length > 0);
    } catch (err) {
      // User might not be authenticated
      console.error('Failed to check watch status:', err);
    }
  };

  const handleWatchToggle = async () => {
    setWatchLoading(true);
    try {
      if (isWatched) {
        const watchesRes = await apiClient.get(`/watches?product_id=${productId}`);
        const watches = watchesRes.data.data;
        if (watches.length > 0) {
          await apiClient.delete(`/watches/${watches[0].id}`);
        }
      } else {
        await apiClient.post('/watches', {
          product_id: productId,
          retailer_ids: [],
          availability_type: 'both'
        });
      }
      setIsWatched(!isWatched);
    } catch (error) {
      console.error('Failed to toggle watch:', error);
    } finally {
      setWatchLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && !priceHistory.length) {
      loadPriceHistory();
    }
  }, [activeTab, product]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const inStockAvailability = product?.availability?.filter(a => a.inStock) || [];
  const outOfStockAvailability = product?.availability?.filter(a => !a.inStock) || [];
  const lowestPrice = inStockAvailability.reduce((min, curr) => 
    curr.price < min ? curr.price : min, 
    Infinity
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Product Not Found</h3>
        <p className="text-gray-400 mb-4">{error || 'The requested product could not be found.'}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Product Image */}
          <div className="lg:w-1/3">
            <div className="aspect-square bg-gray-700 rounded-lg overflow-hidden">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-24 h-24 text-gray-500" />
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:w-2/3 space-y-4">
            <div className="flex items-start justify-between">
              <h1 className="text-3xl font-bold text-white">{product.name}</h1>
              <button
                onClick={handleWatchToggle}
                disabled={watchLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isWatched
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                {watchLoading ? (
                  <LoadingSpinner size="sm" />
                ) : isWatched ? (
                  <>
                    <Eye className="w-4 h-4" />
                    Watching
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Watch Product
                  </>
                )}
              </button>
            </div>

            {/* Product Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {product.set && (
                <div className="flex items-center gap-2 text-gray-300">
                  <Package className="w-4 h-4" />
                  <span>Set: {product.set}</span>
                </div>
              )}
              
              {product.releaseDate && (
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="w-4 h-4" />
                  <span>Released: {formatDate(product.releaseDate)}</span>
                </div>
              )}

              {product.sku && (
                <div className="flex items-center gap-2 text-gray-300">
                  <span>SKU: {product.sku}</span>
                </div>
              )}

              {product.upc && (
                <div className="flex items-center gap-2 text-gray-300">
                  <span>UPC: {product.upc}</span>
                </div>
              )}
            </div>

            {/* Pricing Summary */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {lowestPrice !== Infinity && (
                  <div>
                    <div className="text-sm text-gray-400">Lowest Price</div>
                    <div className="text-2xl font-bold text-green-400">
                      {formatPrice(lowestPrice)}
                    </div>
                  </div>
                )}
                
                {product.msrp && (
                  <div>
                    <div className="text-sm text-gray-400">MSRP</div>
                    <div className="text-xl font-semibold text-white">
                      {formatPrice(product.msrp)}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-sm text-gray-400">Availability</div>
                  <div className={`text-xl font-semibold ${
                    inStockAvailability.length > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {inStockAvailability.length > 0 
                      ? `${inStockAvailability.length} retailer${inStockAvailability.length > 1 ? 's' : ''}`
                      : 'Out of Stock'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                <p className="text-gray-300">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg">
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: Package },
              { id: 'availability', label: 'Availability', icon: MapPin },
              { id: 'history', label: 'Price History', icon: TrendingUp }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Product Metadata */}
              {product.metadata && Object.keys(product.metadata).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Product Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(product.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-400 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'availability' && (
            <div className="space-y-6">
              {/* In Stock */}
              {inStockAvailability.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    In Stock ({inStockAvailability.length})
                  </h3>
                  <div className="grid gap-4">
                    {inStockAvailability.map((availability) => (
                      <AvailabilityCard key={availability.id} availability={availability} />
                    ))}
                  </div>
                </div>
              )}

              {/* Out of Stock */}
              {outOfStockAvailability.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-400 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Out of Stock ({outOfStockAvailability.length})
                  </h3>
                  <div className="grid gap-4">
                    {outOfStockAvailability.map((availability) => (
                      <AvailabilityCard key={availability.id} availability={availability} />
                    ))}
                  </div>
                </div>
              )}

              {product.availability?.length === 0 && (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No availability data found for this product.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Price History</h3>
              {priceHistoryLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : priceHistory.length > 0 ? (
                <PriceHistoryChart data={priceHistory} />
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No price history available for this product.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AvailabilityCard: React.FC<{ availability: ProductAvailability }> = ({ availability }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white">{availability.retailerName}</h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            availability.inStock 
              ? 'bg-green-600 text-white' 
              : 'bg-red-600 text-white'
          }`}>
            {availability.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Price:</span>
          <span className="text-white font-semibold">
            {formatPrice(availability.price)}
          </span>
        </div>

        {availability.originalPrice && availability.originalPrice !== availability.price && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Original:</span>
            <span className="text-gray-400 line-through">
              {formatPrice(availability.originalPrice)}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Last checked:</span>
          <span className="text-gray-300">{formatDate(availability.lastChecked)}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        {availability.cartUrl && availability.inStock && (
          <a
            href={availability.cartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
          </a>
        )}
        
        <a
          href={availability.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View
        </a>
      </div>

      {/* Store Locations */}
      {availability.storeLocations && availability.storeLocations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-600">
          <h5 className="text-sm font-medium text-gray-300 mb-2">Store Locations</h5>
          <div className="space-y-2">
            {availability.storeLocations.slice(0, 3).map((store, index) => (
              <div key={index} className="text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-white">{store.name}</span>
                  <span className={`px-2 py-1 text-xs rounded ${
                    store.inStock ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {store.inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                <div className="text-gray-400">
                  {store.city}, {store.state} {store.zipCode}
                </div>
              </div>
            ))}
            {availability.storeLocations.length > 3 && (
              <div className="text-sm text-gray-400">
                +{availability.storeLocations.length - 3} more locations
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};