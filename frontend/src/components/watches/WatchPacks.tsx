import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, Search, 
  CheckCircle, TrendingUp
} from 'lucide-react';
import { WatchPack, PaginatedResponse } from '../../types';
import { apiClient } from '../../services/apiClient';
import LoadingSpinner from '../LoadingSpinner';
import { WatchPackCard } from './WatchPackCard';

export const WatchPacks: React.FC = () => {
  const [watchPacks, setWatchPacks] = useState<WatchPack[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'popular' | 'all' | 'subscribed'>('popular');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });

  useEffect(() => {
    loadWatchPacks();
    loadUserSubscriptions();
  }, [activeTab, searchQuery, loadWatchPacks]);

  const loadWatchPacks = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      let endpoint = '/watches/packs';
      
      if (activeTab === 'popular') {
        endpoint = '/watches/packs/popular';
      } else if (activeTab === 'subscribed') {
        endpoint = '/watches/packs/subscriptions/detailed';
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await apiClient.get<PaginatedResponse<WatchPack> | WatchPack[]>(
        `${endpoint}?${params}`
      );

      if (Array.isArray(response.data)) {
        const watchPacksArray = response.data as WatchPack[];
        setWatchPacks(watchPacksArray);
        setPagination(prev => ({ ...prev, total: watchPacksArray.length, totalPages: 1 }));
      } else {
        const paginatedResponse = response.data as PaginatedResponse<WatchPack>;
        setWatchPacks(paginatedResponse.data);
        setPagination(paginatedResponse.pagination);
      }
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err ? err.message as string : 'Failed to load watch packs';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, pagination.limit]);

  const loadUserSubscriptions = async () => {
    try {
      const response = await apiClient.get('/watches/packs/subscriptions');
      const subscriptionIds = response.data.data.map((sub: { watch_pack_id: string }) => sub.watch_pack_id);
      setUserSubscriptions(new Set(subscriptionIds));
    } catch (err) {
      // User might not be authenticated
      console.error('Failed to load user subscriptions:', err);
    }
  };

  const handleSubscribe = async (packId: string) => {
    try {
      await apiClient.post(`/watches/packs/${packId}/subscribe`);
      setUserSubscriptions(prev => new Set([...prev, packId]));
      
      // Update subscriber count
      setWatchPacks(prev => prev.map(pack => 
        pack.id === packId 
          ? { ...pack, subscriberCount: pack.subscriberCount + 1 }
          : pack
      ));
    } catch (err) {
      console.error('Failed to subscribe to watch pack:', err);
    }
  };

  const handleUnsubscribe = async (packId: string) => {
    try {
      await apiClient.delete(`/watches/packs/${packId}/subscribe`);
      setUserSubscriptions(prev => {
        const newSet = new Set(prev);
        newSet.delete(packId);
        return newSet;
      });
      
      // Update subscriber count
      setWatchPacks(prev => prev.map(pack => 
        pack.id === packId 
          ? { ...pack, subscriberCount: Math.max(0, pack.subscriberCount - 1) }
          : pack
      ));
    } catch (err) {
      console.error('Failed to unsubscribe from watch pack:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Watch Packs</h1>
            <p className="text-gray-400">
              Subscribe to curated collections of popular Pokémon TCG products with one click
            </p>
          </div>
          <Package className="w-12 h-12 text-blue-400" />
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-700 rounded-lg p-1">
          {[
            { id: 'popular', label: 'Popular', icon: TrendingUp },
            { id: 'all', label: 'All Packs', icon: Package },
            { id: 'subscribed', label: 'My Subscriptions', icon: CheckCircle }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as 'popular' | 'all' | 'subscribed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search watch packs..."
            className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Watch Packs Grid */}
      <div>
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : watchPacks.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {watchPacks.map((pack) => (
                <WatchPackCard
                  key={pack.id}
                  watchPack={pack}
                  isSubscribed={userSubscriptions.has(pack.id)}
                  onSubscribe={handleSubscribe}
                  onUnsubscribe={handleUnsubscribe}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  onClick={() => loadWatchPacks(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors"
                >
                  Previous
                </button>
                
                <span className="text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => loadWatchPacks(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {activeTab === 'subscribed' ? 'No subscriptions yet' : 'No watch packs found'}
            </h3>
            <p className="text-gray-400">
              {activeTab === 'subscribed' 
                ? 'Subscribe to watch packs to see them here'
                : searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Check back later for new watch packs'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};