import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceHistoryData {
  date: string;
  price: number;
  retailer: string;
  inStock: boolean;
}

interface PriceHistoryChartProps {
  data: PriceHistoryData[];
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No price history data available
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate price range for scaling
  const prices = sortedData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  // Group by retailer for different colors
  const retailers = [...new Set(sortedData.map(d => d.retailer))];
  const retailerColors = [
    'rgb(59, 130, 246)', // blue
    'rgb(16, 185, 129)', // green
    'rgb(245, 101, 101)', // red
    'rgb(251, 191, 36)', // yellow
    'rgb(139, 92, 246)', // purple
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate trend
  const firstPrice = sortedData[0]?.price || 0;
  const lastPrice = sortedData[sortedData.length - 1]?.price || 0;
  const priceChange = lastPrice - firstPrice;
  const percentChange = firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Price Trend Summary */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-white mb-1">Price Trend</h4>
            <p className="text-gray-400">Based on {sortedData.length} data points</p>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-2 text-lg font-semibold ${
              priceChange >= 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {priceChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)}
            </div>
            <div className={`text-sm ${priceChange >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Simple Chart */}
      <div className="bg-gray-700 rounded-lg p-6">
        <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-sm text-gray-400">
            <span>{formatPrice(maxPrice)}</span>
            <span>{formatPrice((maxPrice + minPrice) / 2)}</span>
            <span>{formatPrice(minPrice)}</span>
          </div>

          {/* Chart area */}
          <div className="ml-16 mr-4 h-full relative">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgb(75, 85, 99)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />

              {/* Price lines by retailer */}
              {retailers.map((retailer, retailerIndex) => {
                const retailerData = sortedData.filter(d => d.retailer === retailer);
                if (retailerData.length < 2) return null;

                const pathData = retailerData.map((point, index) => {
                  const x = (index / (retailerData.length - 1)) * 100;
                  const y = priceRange > 0 ? ((maxPrice - point.price) / priceRange) * 100 : 50;
                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ');

                return (
                  <g key={retailer}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke={retailerColors[retailerIndex % retailerColors.length]}
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Data points */}
                    {retailerData.map((point, index) => {
                      const x = (index / (retailerData.length - 1)) * 100;
                      const y = priceRange > 0 ? ((maxPrice - point.price) / priceRange) * 100 : 50;
                      return (
                        <circle
                          key={index}
                          cx={x}
                          cy={y}
                          r="1.5"
                          fill={retailerColors[retailerIndex % retailerColors.length]}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {/* X-axis labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-sm text-gray-400 mt-2">
              <span>{formatDate(sortedData[0].date)}</span>
              {sortedData.length > 2 && (
                <span>{formatDate(sortedData[Math.floor(sortedData.length / 2)].date)}</span>
              )}
              <span>{formatDate(sortedData[sortedData.length - 1].date)}</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4">
          {retailers.map((retailer, index) => (
            <div key={retailer} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: retailerColors[index % retailerColors.length] }}
              />
              <span className="text-sm text-gray-300">{retailer}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Price Points */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-4">Recent Price Points</h4>
        <div className="space-y-3">
          {sortedData.slice(-10).reverse().map((point, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: retailerColors[retailers.indexOf(point.retailer) % retailerColors.length] 
                  }}
                />
                <span className="text-white">{point.retailer}</span>
                <span className={`px-2 py-1 text-xs rounded ${
                  point.inStock ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                  {point.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
              <div className="text-right">
                <div className="text-white font-semibold">{formatPrice(point.price)}</div>
                <div className="text-sm text-gray-400">{formatDate(point.date)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};