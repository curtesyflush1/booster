import React, { useState, useEffect, useCallback } from 'react';
import { 
  Eye, Download, Upload, 
  Filter, Search, AlertCircle, CheckCircle, Clock
} from 'lucide-react';
import { Watch, PaginatedResponse } from '../../types';
import { apiClient } from '../../services/apiClient';
import LoadingSpinner from '../LoadingSpinner';
import { WatchCard } from './WatchCard';
import { WatchFilters } from './WatchFilters';

interface WatchListProps {
  onWatchSelect?: (watch: Watch) => void;
}

export const WatchList: React.FC<WatchListProps> = ({ onWatchSelect }) => {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWatches, setSelectedWatches] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    is_active: undefined as boolean | undefined,
    retailer_id: undefined as string | undefined
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    alertsToday: 0
  });

  const loadWatches = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.is_active !== undefined && { is_active: filters.is_active.toString() }),
        ...(filters.retailer_id && { retailer_id: filters.retailer_id }),
        ...(searchQuery && { search: searchQuery })
      });

      const response = await apiClient.get<PaginatedResponse<Watch>>(`/watches?${params}`);
      setWatches(response.data.data);
      setPagination(response.data.pagination);
    } catch (err: unknown) {
      const errorMessage = err && typeof err === 'object' && 'message' in err ? err.message as string : 'Failed to load watches';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, pagination.limit]);

  useEffect(() => {
    loadWatches();
    loadStats();
  }, [loadWatches]);

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/watches/stats');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load watch stats:', err);
    }
  };

  const handleWatchToggle = async (watchId: string, isActive: boolean) => {
    try {
      await apiClient.patch(`/watches/${watchId}/toggle`);
      setWatches(prev => prev.map(watch => 
        watch.id === watchId ? { ...watch, isActive } : watch
      ));
      loadStats();
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    }
  };

  const handleWatchDelete = async (watchId: string) => {
    if (!confirm('Are you sure you want to delete this watch?')) return;

    try {
      await apiClient.delete(`/watches/${watchId}`);
      setWatches(prev => prev.filter(watch => watch.id !== watchId));
      setSelectedWatches(prev => {
        const newSet = new Set(prev);
        newSet.delete(watchId);
        return newSet;
      });
      loadStats();
    } catch (err) {
      console.error('Failed to delete watch:', err);
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedWatches.size === 0) return;

    const watchIds = Array.from(selectedWatches);
    
    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${watchIds.length} watch(es)?`)) return;
    }

    try {
      const promises = watchIds.map(watchId => {
        switch (action) {
          case 'activate':
          case 'deactivate':
            return apiClient.patch(`/watches/${watchId}/toggle`);
          case 'delete':
            return apiClient.delete(`/watches/${watchId}`);
        }
      });

      await Promise.all(promises);
      
      if (action === 'delete') {
        setWatches(prev => prev.filter(watch => !selectedWatches.has(watch.id)));
      } else {
        setWatches(prev => prev.map(watch => 
          selectedWatches.has(watch.id) 
            ? { ...watch, isActive: action === 'activate' }
            : watch
        ));
      }
      
      setSelectedWatches(new Set());
      loadStats();
    } catch (err) {
      console.error(`Failed to ${action} watches:`, err);
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.get('/watches/export', {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `watches-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export watches:', err);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csv', file);

    try {
      await apiClient.post('/watches/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      loadWatches();
      loadStats();
    } catch (err) {
      console.error('Failed to import watches:', err);
    }
  };

  const toggleWatchSelection = (watchId: string) => {
    setSelectedWatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(watchId)) {
        newSet.delete(watchId);
      } else {
        newSet.add(watchId);
      }
      return newSet;
    });
  };

  const selectAllWatches = () => {
    if (selectedWatches.size === watches.length) {
      setSelectedWatches(new Set());
    } else {
      setSelectedWatches(new Set(watches.map(w => w.id)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Watch List</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Eye className="w-8 h-8 text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-gray-400">Total Watches</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.active}</div>
                <div className="text-sm text-gray-400">Active</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-gray-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.inactive}</div>
                <div className="text-sm text-gray-400">Inactive</div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-yellow-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.alertsToday}</div>
                <div className="text-sm text-gray-400">Alerts Today</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search watches by product name..."
              className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <WatchFilters
            filters={filters}
            onFiltersChange={setFilters}
          />
        )}

        {/* Bulk Actions */}
        {selectedWatches.size > 0 && (
          <div className="flex items-center gap-4 p-4 bg-gray-700 rounded-lg">
            <span className="text-white">
              {selectedWatches.size} watch(es) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('activate')}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                Activate
              </button>
              <button
                onClick={() => handleBulkAction('deactivate')}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
              >
                Deactivate
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Watch List */}
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
        ) : watches.length > 0 ? (
          <>
            {/* Select All */}
            <div className="flex items-center gap-3 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedWatches.size === watches.length && watches.length > 0}
                  onChange={selectAllWatches}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300">Select All</span>
              </label>
              <span className="text-gray-400">
                Showing {watches.length} of {pagination.total} watches
              </span>
            </div>

            <div className="grid gap-4">
              {watches.map((watch) => (
                <WatchCard
                  key={watch.id}
                  watch={watch}
                  isSelected={selectedWatches.has(watch.id)}
                  onSelect={() => toggleWatchSelection(watch.id)}
                  onToggle={handleWatchToggle}
                  onDelete={handleWatchDelete}
                  onEdit={onWatchSelect}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  onClick={() => loadWatches(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors"
                >
                  Previous
                </button>
                
                <span className="text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => loadWatches(pagination.page + 1)}
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
            <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No watches found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || Object.values(filters).some(Boolean)
                ? 'Try adjusting your search or filters'
                : 'Start watching products to get notified when they become available'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};