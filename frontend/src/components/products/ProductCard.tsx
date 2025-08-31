import React, { useEffect, useState } from 'react';
import { Eye, Plus, X, LogIn } from 'lucide-react';
import { Product, Watch } from '../../types';
import { useAuth } from '../../context/AuthContext';

import { apiClient } from '../../services/apiClient';
import { toast } from 'react-hot-toast';

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  showWatchActions?: boolean;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  showWatchActions = true
}) => {
  const { isAuthenticated } = useAuth();
  const [isAddingToWatchlist, setIsAddingToWatchlist] = useState(false);
  const [isWatchAdded, setIsWatchAdded] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);

  // Check existing watch status on mount (only if authenticated)
  useEffect(() => {
    if (!isAuthenticated) {
      setIsWatchAdded(false);
      setWatchId(null);
      return;
    }

    let mounted = true;
    const checkExistingWatch = async () => {
      try {
        const res = await apiClient.get<{ data: Watch[] }>(`/watches?product_id=${product.id}&is_active=true`);
        const existing = (res.data as any)?.data as Watch[] | undefined;
        if (mounted && existing && existing.length > 0) {
          setIsWatchAdded(true);
          setWatchId(existing[0].id);
        }
      } catch (_err) {
        // ignore (likely unauthenticated or no watch)
      }
    };
    checkExistingWatch();
    return () => { mounted = false; };
  }, [product.id, isAuthenticated]);

  const handleAddWatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      toast.error('Please log in to add products to your watchlist');
      return;
    }
    
    // Optimistic UI update - change state immediately
    const previousState = { isWatchAdded, watchId };
    setIsWatchAdded(true);
    setIsAddingToWatchlist(true);
    
    try {
      // Check if already watched first
      const existingRes = await apiClient.get<{ data: Watch[] }>(`/watches?product_id=${product.id}&is_active=true`);
      const existing = (existingRes.data as any)?.data as Watch[] | undefined;
      
      if (existing && existing.length > 0) {
        // Already watched - just update state
        setWatchId(existing[0].id);
        toast.success('Already in your watchlist');
        return;
      }

      // Create new watch
      // Note: omit retailer_ids to let backend accept default [] per schema
      const response = await apiClient.post<{ data: Watch }>('/watches', {
        product_id: product.id,
        availability_type: 'both'
      });
      const created = (response.data as any)?.data as Watch | undefined;
      if (created?.id) {
        setWatchId(created.id);
      }
      
      toast.success(`${product.name} added to watchlist!`);
    } catch (error: unknown) {
      console.error('Failed to add to watchlist:', error);
      
      // Revert optimistic update on failure
      setIsWatchAdded(previousState.isWatchAdded);
      setWatchId(previousState.watchId);
      
      // If watch already exists, mark as added
      const errorObj = error as any;
      if (errorObj?.code === 'WATCH_EXISTS' || errorObj?.statusCode === 409) {
        try {
          const res = await apiClient.get<{ data: Watch[] }>(`/watches?product_id=${product.id}&is_active=true`);
          const existing = (res.data as any)?.data as Watch[] | undefined;
          if (existing && existing.length > 0) {
            setWatchId(existing[0].id);
            setIsWatchAdded(true);
            toast.success('Already in your watchlist');
            return;
          }
        } catch {}
        toast.success('Already in your watchlist');
        setIsWatchAdded(true);
      } else if (errorObj?.code === 'MISSING_TOKEN' || errorObj?.statusCode === 401) {
        toast.error('Please log in to add products to your watchlist');
      } else {
        toast.error('Failed to add to watchlist. Please try again.');
      }
    } finally {
      setIsAddingToWatchlist(false);
    }
  };

  const handleRemoveWatch = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('Please log in to manage your watchlist');
      return;
    }

    // Optimistic UI update - change state immediately
    const previousState = { isWatchAdded, watchId };
    setIsWatchAdded(false);
    setIsAddingToWatchlist(true);
    
    try {
      let idToDelete = watchId;
      if (!idToDelete) {
        // Try active first, then inactive watches
        let existing: Watch[] | undefined;
        try {
          const res1 = await apiClient.get<{ data: Watch[] }>(`/watches?product_id=${product.id}&is_active=true`);
          existing = (res1.data as any)?.data as Watch[] | undefined;
        } catch {}
        if (!existing || existing.length === 0) {
          try {
            const res2 = await apiClient.get<{ data: Watch[] }>(`/watches?product_id=${product.id}&is_active=false`);
            existing = (res2.data as any)?.data as Watch[] | undefined;
          } catch {}
        }
        idToDelete = existing && existing[0]?.id ? existing[0].id : null;
      }

      if (!idToDelete) {
        toast.error('Unable to unwatch: missing watch identifier');
        // Revert optimistic update
        setIsWatchAdded(previousState.isWatchAdded);
        return;
      }

      await apiClient.delete(`/watches/${idToDelete}`);
      toast.success(`${product.name} removed from watchlist`);
      setWatchId(null);
    } catch (error: unknown) {
      console.error('Failed to remove from watchlist:', error);
      
      // Revert optimistic update on failure
      setIsWatchAdded(previousState.isWatchAdded);
      setWatchId(previousState.watchId);
      
      const errorObj = error as any;
      if (errorObj?.code === 'MISSING_TOKEN' || errorObj?.statusCode === 401) {
        toast.error('Please log in to manage your watchlist');
      } else if (errorObj?.statusCode === 404) {
        // If backend says not found, clear local state to unblock re-add
        setIsWatchAdded(false);
        setWatchId(null);
        toast.success('Watch was already removed');
      } else {
        toast.error('Failed to remove from watchlist. Please try again.');
      }
    } finally {
      setIsAddingToWatchlist(false);
    }
  };

  const handleViewDetails = () => {
    if (onSelect) {
      onSelect(product);
    }
  };

  const handleLoginPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.error('Please log in to add products to your watchlist');
  };

  const lowestPrice = product.availability && product.availability.length > 0 
    ? Math.min(...product.availability.map(a => a.price))
    : product.msrp;
  const inStock = product.availability ? product.availability.some(a => a.inStock) : false;

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors cursor-pointer">
      <div onClick={handleViewDetails}>
        <div className="aspect-square bg-gray-700 relative">
          <img
            src={product.thumbnailUrl || product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {!inStock && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <span className="text-white font-semibold">Out of Stock</span>
            </div>
          )}
        </div>
        
        <div className="p-4">
          <h3 className="text-white font-semibold text-sm mb-2 line-clamp-2">
            {product.name}
          </h3>
          
          <div className="flex items-center justify-between mb-3">
            <div className="text-green-400 font-bold">
              ${lowestPrice.toFixed(2)}
            </div>
            {product.msrp && lowestPrice < product.msrp && (
              <div className="text-gray-400 text-sm line-through">
                ${product.msrp.toFixed(2)}
              </div>
            )}
          </div>

          <div className="text-xs text-gray-400 mb-3">
            {product.availability ? (
              <>
                {product.availability.length} retailer{product.availability.length !== 1 ? 's' : ''}
                {inStock && <span className="text-green-400 ml-2">• In Stock</span>}
              </>
            ) : (
              <span>No availability data</span>
            )}
          </div>
        </div>
      </div>

      {showWatchActions && (
        <div className="px-4 pb-4 flex gap-2">
          {!isAuthenticated ? (
            // Show login prompt button when not authenticated
            <button
              onClick={handleLoginPrompt}
              className="flex-1 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ease-in-out transform hover:scale-105 bg-gray-600 hover:bg-gray-500"
            >
              <LogIn className="w-4 h-4" />
              Login to Watch
            </button>
          ) : isWatchAdded ? (
            <button
              onClick={handleRemoveWatch}
              disabled={isAddingToWatchlist}
              className={`flex-1 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ease-in-out transform hover:scale-105 ${
                isAddingToWatchlist ? 'bg-yellow-600 cursor-wait' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isAddingToWatchlist ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Unwatch
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleAddWatch}
              disabled={isAddingToWatchlist}
              className={`flex-1 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ease-in-out transform hover:scale-105 ${
                isAddingToWatchlist ? 'bg-yellow-600 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isAddingToWatchlist ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Watch
                </>
              )}
            </button>
          )}
          <button
            onClick={handleViewDetails}
            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// Memoize ProductCard to prevent unnecessary re-renders when props haven't changed
export const ProductCard = React.memo(ProductCardComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.msrp === nextProps.product.msrp &&
    prevProps.product.imageUrl === nextProps.product.imageUrl &&
    prevProps.product.thumbnailUrl === nextProps.product.thumbnailUrl &&
    prevProps.showWatchActions === nextProps.showWatchActions &&
    prevProps.onSelect === nextProps.onSelect &&
    JSON.stringify(prevProps.product.availability || []) === JSON.stringify(nextProps.product.availability || [])
  );
});
