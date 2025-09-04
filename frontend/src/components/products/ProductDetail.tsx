import React, { useState, useEffect, useCallback } from 'react';
import { 
  Eye, EyeOff, ShoppingCart, ExternalLink, Calendar, 
  Package, MapPin, TrendingUp, AlertCircle, Clock, Star
} from 'lucide-react';
import { Product, ProductAvailability } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/apiClient';
import LoadingSpinner from '../LoadingSpinner';
import { PriceHistoryChart } from './PriceHistoryChart';
import { toast } from 'react-hot-toast';

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
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'availability' | 'history'>('overview');

  const normalizeProduct = (raw: any): Product => {
    const p = raw || {};
    const availability = Array.isArray(p.availability) ? p.availability.map((a: any) => {
      const status = (a.availability_status || a.availabilityStatus) as string | undefined;
      const stores = Array.isArray(a.store_locations)
        ? a.store_locations.map((s: any) => ({
            id: s.store_id || s.id,
            name: s.store_name || s.name,
            address: s.address,
            city: s.city,
            state: s.state,
            zipCode: s.zip_code || s.zipCode,
            phone: s.phone,
            inStock: s.in_stock ?? s.inStock ?? false,
            quantity: s.stock_level ?? s.quantity
          }))
        : a.storeLocations;
      const meta = (a.metadata || {}) as Record<string, unknown>;
      return {
        id: a.id,
        productId: a.product_id || a.productId || p.id,
        retailerId: a.retailer_id || a.retailerId,
        retailerName: a.retailer_name || a.retailerName,
        retailerSlug: a.retailer_slug || a.retailerSlug,
        inStock: (a.in_stock ?? a.inStock ?? false) && status !== 'pre_order',
        availabilityStatus: status as any,
        price: a.price ?? 0,
        originalPrice: a.original_price ?? a.originalPrice,
        url: a.product_url || a.url,
        cartUrl: a.cart_url || a.cartUrl,
        lastChecked: (a.last_checked ? new Date(a.last_checked).toISOString() : a.lastChecked) || new Date().toISOString(),
        storeLocations: stores,
        metadata: meta
      } as ProductAvailability;
    }) : [];
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      upc: p.upc,
      category: (p.category as any) || (p.category_id ? { id: p.category_id, name: '', slug: '' } as any : undefined),
      set: p.set || p.set_name,
      series: p.series,
      releaseDate: (p.releaseDate || p.release_date) ? new Date(p.releaseDate || p.release_date).toISOString() : undefined as any,
      msrp: p.msrp,
      imageUrl: p.imageUrl || p.image_url,
      thumbnailUrl: p.thumbnailUrl || p.image_url,
      description: p.description,
      metadata: p.metadata || {},
      availability,
      createdAt: (p.created_at || p.createdAt || new Date()).toString(),
      updatedAt: (p.updated_at || p.updatedAt || new Date()).toString()
    } as unknown as Product;
  };

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/products/${productId}`);
      // Backend responses are wrapped in { data: { product } }
      const p = (response.data as any)?.data?.product || (response.data as any)?.product || response.data;
      setProduct(normalizeProduct(p));
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err ? err.message as string : 'Failed to load product';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const loadPriceHistory = useCallback(async () => {
    if (!product) return;
    
    try {
      setPriceHistoryLoading(true);
      const response = await apiClient.get<any>(`/products/${productId}/price-history`);
      // Backend responses are wrapped in { data: { priceHistory } }
      const list = (response.data as any)?.data?.priceHistory || (response.data as any)?.priceHistory || response.data || [];
      const mapped = (list as any[]).map((r: any) => ({
        date: (r.date || r.recorded_at || r.created_at) ? new Date(r.date || r.recorded_at || r.created_at).toISOString() : new Date().toISOString(),
        price: Number(r.price || 0),
        retailer: r.retailer || r.retailer_name || 'Retailer',
        inStock: r.inStock ?? r.in_stock ?? true
      })) as PriceHistoryData[];
      setPriceHistory(mapped);
    } catch (err) {
      console.error('Failed to load price history:', err);
    } finally {
      setPriceHistoryLoading(false);
    }
  }, [product, productId]);

  const checkWatchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setIsWatched(false);
      return;
    }

    try {
      const response = await apiClient.get(`/watches?product_id=${productId}&is_active=true`);
      setIsWatched((response.data as any)?.data?.length > 0);
    } catch (err) {
      // User might not be authenticated
      console.error('Failed to check watch status:', err);
      setIsWatched(false);
    }
  }, [productId, isAuthenticated]);

  useEffect(() => {
    loadProduct();
    checkWatchStatus();
  }, [productId, loadProduct, checkWatchStatus]);

  const handleWatchToggle = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to manage your watchlist');
      return;
    }

    setWatchLoading(true);
    try {
      if (isWatched) {
        // Try to find an active watch first, then inactive
        let watches: any[] = [];
        try {
          const res1 = await apiClient.get(`/watches?product_id=${productId}&is_active=true`);
          watches = (res1.data as any)?.data || [];
        } catch {}
        if (!watches || watches.length === 0) {
          try {
            const res2 = await apiClient.get(`/watches?product_id=${productId}&is_active=false`);
            watches = (res2.data as any)?.data || [];
          } catch {}
        }
        if (watches && watches.length > 0) {
          await apiClient.delete(`/watches/${watches[0].id}`);
          toast.success(`${product?.name || 'Product'} removed from watchlist`);
        }
      } else {
        await apiClient.post('/watches', {
          product_id: productId,
          availability_type: 'both'
        });
        toast.success(`${product?.name || 'Product'} added to watchlist!`);
      }
      setIsWatched(!isWatched);
    } catch (error: unknown) {
      console.error('Failed to toggle watch:', error);
      const errorObj = error as any;
      
      if (errorObj?.code === 'MISSING_TOKEN' || errorObj?.statusCode === 401) {
        toast.error('Please log in to manage your watchlist');
      } else if (errorObj?.code === 'WATCH_EXISTS' || errorObj?.statusCode === 409) {
        // Refresh status and set watched
        try {
          const response = await apiClient.get(`/watches?product_id=${productId}&is_active=true`);
          const exists = (response.data as any)?.data?.length > 0;
          setIsWatched(exists);
          if (exists) toast.success('Already in your watchlist');
        } catch {}
      } else if (errorObj?.code === 'WATCH_LIMIT_REACHED' || (errorObj?.statusCode === 403 && /watch limit/i.test(errorObj?.message || ''))) {
        const msg = errorObj?.message || 'Watch limit reached for your plan.';
        toast.custom((t) => (
          <div className="bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg border border-gray-700">
            <div className="text-sm mb-2">{msg}</div>
            <div className="flex justify-end">
              <a
                href="/pricing"
                onClick={() => toast.dismiss(t.id)}
                className="px-3 py-1 bg-pokemon-electric text-background-primary rounded font-medium text-sm hover:bg-yellow-400"
              >
                Upgrade
              </a>
            </div>
          </div>
        ), { id: 'watch-limit', duration: 5000 });
      } else {
        toast.error('Failed to update watchlist. Please try again.');
      }
    } finally {
      setWatchLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && !priceHistory.length) {
      loadPriceHistory();
    }
  }, [activeTab, product, loadPriceHistory, priceHistory.length]);

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
  const anyInStock = product?.availability?.some(a => a.inStock) === true;
  // Collect shipping cues across retailers
  const shippingEntries = (product?.availability || [])
    .map(a => ((a as any).metadata || {}))
    .filter((m: any) => m && (m.shippingDateIso || m.shippingText)) as Array<{ shippingDateIso?: string; shippingText?: string }>;
  let headerShipLabel: string | undefined;
  if (shippingEntries.length > 0) {
    const dated = shippingEntries
      .map(m => ({
        d: m.shippingDateIso ? new Date(m.shippingDateIso) : undefined,
        t: m.shippingText
      }));
    const withDate = dated.filter(x => x.d && !isNaN(x.d.getTime()));
    if (withDate.length > 0) {
      withDate.sort((a, b) => (a.d!.getTime() - b.d!.getTime()));
      const d0 = withDate[0].d!;
      headerShipLabel = `Ships by ${d0.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      const firstText = dated.find(x => x.t)?.t;
      headerShipLabel = firstText;
    }
  }
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
                  <div className={`text-xl font-semibold ${anyInStock ? 'text-green-400' : 'text-red-400'}`}>
                    {anyInStock
                      ? `${inStockAvailability.length} retailer${inStockAvailability.length > 1 ? 's' : ''}`
                      : 'Out of Stock'}
                  </div>
                </div>
              </div>
              {headerShipLabel && (
                <div className="mt-3 text-sm text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{headerShipLabel}</span>
                </div>
              )}
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

  // Derive status label and color
  const status = (availability as any).availabilityStatus as string | undefined;
  const statusLabel = (() => {
    if (status === 'pre_order') return 'Pre-Order';
    if (status === 'low_stock') return 'Low Stock';
    if (status === 'in_stock') return 'In Stock';
    if (status === 'discontinued') return 'Discontinued';
    return availability.inStock ? 'In Stock' : 'Out of Stock';
  })();
  const statusClass = (() => {
    if (status === 'pre_order') return 'bg-blue-600 text-white';
    if (status === 'low_stock') return 'bg-yellow-600 text-white';
    if (status === 'in_stock' || availability.inStock) return 'bg-green-600 text-white';
    if (status === 'discontinued') return 'bg-gray-500 text-white';
    return 'bg-red-600 text-white';
  })();

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white">{availability.retailerName}</h4>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClass}`}>
            {statusLabel}
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
        {/* Robust View link: prefer absolute retailer URL, else fall back to retailer/site search */}
        {(() => {
          const rawUrl = availability.url || '';
          const productName = (availability.metadata?.name as string | undefined)
            || (availability.metadata?.productName as string | undefined)
            || undefined;
          const isAbsolute = /^https?:\/\//i.test(rawUrl);
          // Normalize slug variants
          const rawSlug = ((availability as any).retailerSlug || availability.retailerName || '').toString().toLowerCase();
          const slug = rawSlug
            .replace(/\s+/g, '-')
            .replace(/_/g, '-')
            .replace(/&/g, 'and');
          const searchBases: Record<string, string> = {
            'bestbuy': 'https://www.bestbuy.com/site/searchpage.jsp?st=',
            'best-buy': 'https://www.bestbuy.com/site/searchpage.jsp?st=',
            'walmart': 'https://www.walmart.com/search?q=',
            'costco': 'https://www.costco.com/CatalogSearch?keyword=',
            'samsclub': 'https://www.samsclub.com/s/',
            'sams-club': 'https://www.samsclub.com/s/',
            'gamestop': 'https://www.gamestop.com/search/?q=',
            'target': 'https://www.target.com/s?searchTerm=',
            'barnesandnoble': 'https://www.barnesandnoble.com/s/',
            'barnes-noble': 'https://www.barnesandnoble.com/s/',
            'amazon': 'https://www.amazon.com/s?k=',
            'walgreens': 'https://www.walgreens.com/search/results.jsp?Ntt=',
            'macys': 'https://www.macys.com/shop/featured/'
          };
          const searchBase = searchBases[slug];
          // If not absolute or clearly relative to our app, build a safer search link
          const needsFallback = !isAbsolute || rawUrl.startsWith('/') || /\bboosterbeacon\b/i.test(rawUrl);
          const fallback = searchBase && productName
            ? `${searchBase}${encodeURIComponent(productName as string)}`
            : productName
              ? `https://www.google.com/search?q=${encodeURIComponent(productName as string)}`
              : '#';
          const viewHref = needsFallback ? fallback : rawUrl;
          return (
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View
            </a>
          );
        })()}
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
