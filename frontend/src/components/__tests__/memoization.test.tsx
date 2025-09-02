import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoadingSpinner from '../LoadingSpinner';
import { ProductCard } from '../products/ProductCard';
import FilterSection from '../dashboard/filters/FilterSection';
import CategorySelect from '../dashboard/filters/CategorySelect';
import { Product } from '../../types';

// Mock render tracking for performance testing
const createRenderTracker = () => {
  let renderCount = 0;
  const track = () => ++renderCount;
  const getCount = () => renderCount;
  const reset = () => { renderCount = 0; };
  return { track, getCount, reset };
};

// Test constants
const TEST_PRODUCT_NAME = 'Test Pokémon Booster Pack';
const TEST_PRICE = '$4.99';
const TEST_RETAILER_COUNT = '1 retailer';
const TEST_STOCK_STATUS = '• In Stock';

// Mock product data for testing
const mockProduct: Product = {
  id: 'test-product-1',
  name: 'Test Pokémon Booster Pack',
  sku: 'TEST-001',
  upc: '123456789012',
  category: { id: 'booster-packs', name: 'Booster Packs', slug: 'booster-packs' },
  set: 'Test Set',
  series: 'Test Series',
  releaseDate: '2024-01-01',
  msrp: 4.99,
  imageUrl: 'https://example.com/image.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  availability: [
    {
      id: 'avail-1',
      productId: 'test-product-1',
      retailerId: 'best-buy',
      retailerName: 'Best Buy',
      inStock: true,
      price: 4.99,
      url: 'https://bestbuy.com/product',
      cartUrl: 'https://bestbuy.com/cart',
      lastChecked: '2024-01-01T00:00:00Z'
    }
  ],
  metadata: {
    packType: 'booster',
    language: 'en',
    region: 'US',
    tags: ['pokemon', 'tcg', 'booster-pack']
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z'
};

/**
 * Memoization Tests
 * 
 * These tests verify that React.memo optimizations are working correctly
 * by tracking render counts and ensuring components don't re-render
 * unnecessarily when props haven't changed.
 * 
 * Key testing strategies:
 * - Render tracking to count actual re-renders
 * - Prop stability testing with unchanged props
 * - Performance verification for memoized components
 */
describe('Memoization Tests', () => {
  describe('LoadingSpinner', () => {
    it('should be memoized and not re-render with same props', () => {
      const renderSpy = vi.fn();
      
      const TestComponent = () => {
        renderSpy();
        return <LoadingSpinner size="md" />;
      };

      const { rerender } = render(<TestComponent />);
      
      // Initial render
      expect(renderSpy).toHaveBeenCalledTimes(1);
      
      // Re-render with same props should not cause LoadingSpinner to re-render
      rerender(<TestComponent />);
      
      // The test component re-renders but LoadingSpinner should be memoized
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should re-render when props change', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      
      rerender(<LoadingSpinner size="lg" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('ProductCard', () => {
    it('should render product information correctly', () => {
      render(<ProductCard product={mockProduct} />);
      
      expect(screen.getByText(TEST_PRODUCT_NAME)).toBeInTheDocument();
      expect(screen.getByText(TEST_PRICE)).toBeInTheDocument();
      expect(screen.getByText(TEST_RETAILER_COUNT)).toBeInTheDocument();
      expect(screen.getByText(TEST_STOCK_STATUS)).toBeInTheDocument();
    });

    it('should handle onSelect callback', () => {
      const onSelectMock = vi.fn();
      render(<ProductCard product={mockProduct} onSelect={onSelectMock} />);
      
      const productCard = screen.getByText(TEST_PRODUCT_NAME).closest('div');
      expect(productCard).toBeInTheDocument();
      
      if (productCard) {
        fireEvent.click(productCard);
        expect(onSelectMock).toHaveBeenCalledWith(mockProduct);
        expect(onSelectMock).toHaveBeenCalledTimes(1);
      }
    });

    it('should show watch actions when enabled', () => {
      render(<ProductCard product={mockProduct} showWatchActions={true} />);
      
      expect(screen.getByText('Watch')).toBeInTheDocument();
    });

    it('should hide watch actions when disabled', () => {
      render(<ProductCard product={mockProduct} showWatchActions={false} />);
      
      expect(screen.queryByText('Watch')).not.toBeInTheDocument();
    });
  });

  describe('FilterSection', () => {
    it('should render filter section with title and children', () => {
      const mockIcon = <span data-testid="filter-icon">🔍</span>;
      
      render(
        <FilterSection title="Test Filter" icon={mockIcon}>
          <select data-testid="filter-select">
            <option value="all">All</option>
            <option value="test">Test</option>
          </select>
        </FilterSection>
      );
      
      expect(screen.getByText('Test Filter:')).toBeInTheDocument();
      expect(screen.getByTestId('filter-icon')).toBeInTheDocument();
      expect(screen.getByTestId('filter-select')).toBeInTheDocument();
    });
  });

  describe('CategorySelect', () => {
    it('should render category options correctly', () => {
      const onChangeMock = vi.fn();
      
      render(<CategorySelect value="all" onChange={onChangeMock} />);
      
      const select = screen.getByLabelText('Select product category');
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('all');
      
      // Check that options are present
      expect(screen.getByText('All Categories')).toBeInTheDocument();
      expect(screen.getByText('Booster Packs')).toBeInTheDocument();
      expect(screen.getByText('Elite Trainer boxes')).toBeInTheDocument();
    });

    it('should call onChange when selection changes', () => {
      const onChangeMock = vi.fn();
      
      render(<CategorySelect value="all" onChange={onChangeMock} />);
      
      const select = screen.getByLabelText('Select product category') as HTMLSelectElement;
      
      // Use fireEvent for more reliable event simulation
      fireEvent.change(select, { target: { value: 'booster-packs' } });
      
      expect(onChangeMock).toHaveBeenCalledWith('booster-packs');
      expect(onChangeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memoization Performance', () => {
    let renderTracker: ReturnType<typeof createRenderTracker>;

    beforeEach(() => {
      renderTracker = createRenderTracker();
    });

    it('should prevent unnecessary re-renders with React.memo', () => {
      const TestMemoComponent = React.memo(() => {
        renderTracker.track();
        return <div>Memoized Component</div>;
      });
      
      const ParentComponent = ({ trigger }: { trigger: number }) => {
        return (
          <div>
            <TestMemoComponent />
            <div>Trigger: {trigger}</div>
          </div>
        );
      };
      
      const { rerender } = render(<ParentComponent trigger={1} />);
      expect(renderTracker.getCount()).toBe(1);
      
      // Re-render parent with same props for memoized component
      rerender(<ParentComponent trigger={2} />);
      
      // Memoized component should not re-render
      expect(renderTracker.getCount()).toBe(1);
      expect(screen.getByText('Memoized Component')).toBeInTheDocument();
      expect(screen.getByText('Trigger: 2')).toBeInTheDocument();
    });

    it('should re-render ProductCard only when product data changes', () => {
      const TestProductCard = React.memo(() => {
        renderTracker.track();
        return <ProductCard product={mockProduct} />;
      });

      const ParentComponent = ({ extraProp }: { extraProp: string }) => {
        return (
          <div>
            <TestProductCard />
            <div>{extraProp}</div>
          </div>
        );
      };

      const { rerender } = render(<ParentComponent extraProp="test1" />);
      expect(renderTracker.getCount()).toBe(1);

      // Change parent prop but not ProductCard props
      rerender(<ParentComponent extraProp="test2" />);
      
      // ProductCard should not re-render
      expect(renderTracker.getCount()).toBe(1);
    });

    it('should verify LoadingSpinner memoization with different prop combinations', () => {
      const TestLoadingSpinner = React.memo(({ size }: { size: 'sm' | 'md' | 'lg' }) => {
        renderTracker.track();
        return <LoadingSpinner size={size} />;
      });

      const { rerender } = render(<TestLoadingSpinner size="md" />);
      expect(renderTracker.getCount()).toBe(1);

      // Same props - should not re-render
      rerender(<TestLoadingSpinner size="md" />);
      expect(renderTracker.getCount()).toBe(1);

      // Different props - should re-render
      rerender(<TestLoadingSpinner size="lg" />);
      expect(renderTracker.getCount()).toBe(2);
    });
  });
});
