import React from 'react';
import { Eye, Plus, Heart, ExternalLink } from 'lucide-react';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  showWatchActions?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  showWatchActions = true
}) => {
  const handleAddWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement add to watch functionality
    console.log('Add watch for product:', product.id);
  };

  const handleViewDetails = () => {
    if (onSelect) {
      onSelect(product);
    }
  };

  const lowestPrice = Math.min(...product.availability.map(a => a.price));
  const inStock = product.availability.some(a => a.inStock);

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
            {product.availability.length} retailer{product.availability.length !== 1 ? 's' : ''}
            {inStock && <span className="text-green-400 ml-2">• In Stock</span>}
          </div>
        </div>
      </div>

      {showWatchActions && (
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={handleAddWatch}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Watch
          </button>
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