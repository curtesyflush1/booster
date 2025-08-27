import React, { useState } from 'react';
import { Camera, Package } from 'lucide-react';
import { Product } from '../types';
import { ProductSearch } from '../components/products/ProductSearch';
import { ProductDetail } from '../components/products/ProductDetail';
import { BarcodeScanner } from '../components/products/BarcodeScanner';

const ProductsPage: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'detail'>('search');

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('detail');
  };

  const handleProductFound = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('detail');
  };

  const handleBackToSearch = () => {
    setSelectedProduct(null);
    setActiveTab('search');
  };

  // Check if device supports camera for barcode scanning
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            {activeTab === 'detail' && selectedProduct ? selectedProduct.name : 'Product Catalog'}
          </h1>
          <p className="text-gray-400">
            {activeTab === 'detail' 
              ? 'View product details, availability, and price history'
              : 'Search and discover Pokémon TCG products'
            }
          </p>
        </div>

        <div className="flex items-center gap-4">
          {activeTab === 'detail' && (
            <button
              onClick={handleBackToSearch}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Package className="w-4 h-4" />
              Back to Search
            </button>
          )}

          {isMobile && hasCamera && activeTab === 'search' && (
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
              Scan Barcode
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'search' ? (
        <ProductSearch 
          onProductSelect={handleProductSelect}
          showWatchActions={true}
        />
      ) : selectedProduct ? (
        <ProductDetail 
          productId={selectedProduct.id}
          onClose={handleBackToSearch}
        />
      ) : null}

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onProductFound={handleProductFound}
      />
    </div>
  );
};

export default ProductsPage;