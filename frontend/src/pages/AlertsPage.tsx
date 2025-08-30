import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { 
  Bell, 
  Filter, 
  CheckCircle2, 
  BarChart3,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { alertService, AlertFilters } from '../services/alertService';
import { Alert, PaginatedResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

// Lazy load heavy alert components for better code splitting
const AlertInbox = lazy(() => import('../components/alerts/AlertInbox'));
const AlertFiltersPanel = lazy(() => import('../components/alerts/AlertFiltersPanel'));
const AlertStats = lazy(() => import('../components/alerts/AlertStats'));
const AlertAnalytics = lazy(() => import('../components/alerts/AlertAnalytics'));


type ViewMode = 'inbox' | 'analytics' | 'preferences';

const AlertsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [alerts, setAlerts] = useState<PaginatedResponse<Alert> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({
    page: 1,
    limit: 20
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<string[]>([]);

  useDocumentTitle({
    title: 'Alerts',
    description: 'Manage your Pokémon TCG product alerts and notifications',
    keywords: ['pokemon alerts', 'tcg notifications', 'product alerts', 'restock alerts']
  });

  // Load alerts
  const loadAlerts = useCallback(async (newFilters?: AlertFilters) => {
    try {
      setLoading(true);
      setError(null);
      const filtersToUse = newFilters || filters;
      const result = await alertService.getAlerts(filtersToUse);
      setAlerts(result);
    } catch (err) {
      console.error('Error loading alerts:', err);
      setError('Failed to load alerts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: AlertFilters) => {
    const updatedFilters = { ...newFilters, page: 1 };
    setFilters(updatedFilters);
    loadAlerts(updatedFilters);
    setSelectedAlerts([]);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    const updatedFilters = { ...filters, page };
    setFilters(updatedFilters);
    loadAlerts(updatedFilters);
    setSelectedAlerts([]);
  };

  // Handle alert selection
  const handleAlertSelect = (alertId: string, selected: boolean) => {
    if (selected) {
      setSelectedAlerts(prev => [...prev, alertId]);
    } else {
      setSelectedAlerts(prev => prev.filter(id => id !== alertId));
    }
  };

  // Handle select all
  const handleSelectAll = (selected: boolean) => {
    if (selected && alerts) {
      setSelectedAlerts(alerts.data.map(alert => alert.id));
    } else {
      setSelectedAlerts([]);
    }
  };

  // Handle bulk mark as read
  const handleBulkMarkAsRead = async () => {
    if (selectedAlerts.length === 0) return;

    try {
      await alertService.bulkMarkAsRead(selectedAlerts);
      setSelectedAlerts([]);
      loadAlerts(); // Reload to reflect changes
    } catch (err) {
      console.error('Error marking alerts as read:', err);
      setError('Failed to mark alerts as read. Please try again.');
    }
  };

  // Handle alert action (read, click, delete)
  const handleAlertAction = async (alertId: string, action: 'read' | 'click' | 'delete') => {
    try {
      switch (action) {
        case 'read':
          await alertService.markAsRead(alertId);
          break;
        case 'click':
          await alertService.markAsClicked(alertId);
          break;
        case 'delete':
          await alertService.deleteAlert(alertId);
          break;
      }
      loadAlerts(); // Reload to reflect changes
    } catch (err) {
      console.error(`Error performing ${action} action:`, err);
      setError(`Failed to ${action} alert. Please try again.`);
    }
  };

  const renderViewModeContent = () => {
    switch (viewMode) {
      case 'inbox':
        return (
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AlertInbox
              alerts={alerts}
              loading={loading}
              error={error}
              selectedAlerts={selectedAlerts}
              onAlertSelect={handleAlertSelect}
              onSelectAll={handleSelectAll}
              onAlertAction={handleAlertAction}
              onPageChange={handlePageChange}
              onRefresh={() => loadAlerts()}
            />
          </Suspense>
        );
      case 'analytics':
        return (
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AlertAnalytics />
          </Suspense>
        );
      case 'preferences':
        return (
          <div className="bg-background-secondary rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Alert Preferences</h3>
            <p className="text-gray-400">
              Alert preferences management will be implemented as part of the settings system.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center space-x-3 mb-4 sm:mb-0">
          <Bell className="w-8 h-8 text-primary-400" />
          <div>
            <h1 className="text-3xl font-display font-bold text-white">
              Alerts
            </h1>
            <p className="text-gray-400">
              Manage your Pokémon TCG product notifications
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex space-x-1 bg-background-secondary rounded-lg p-1">
          <button
            onClick={() => setViewMode('inbox')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'inbox'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-background-tertiary'
            }`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Inbox
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'analytics'
                ? 'bg-primary-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-background-tertiary'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Analytics
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <Suspense fallback={<LoadingSpinner size="md" />}>
        <AlertStats />
      </Suspense>

      {/* Filters and Actions Bar */}
      {viewMode === 'inbox' && (
        <div className="bg-background-secondary rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Filters */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  showFilters
                    ? 'bg-primary-500 text-white'
                    : 'bg-background-tertiary text-gray-300 hover:text-white'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </button>

              <button
                onClick={() => loadAlerts()}
                className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium bg-background-tertiary text-gray-300 hover:text-white transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Bulk Actions */}
            {selectedAlerts.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">
                  {selectedAlerts.length} selected
                </span>
                <button
                  onClick={handleBulkMarkAsRead}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Read</span>
                </button>
              </div>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-background-tertiary">
              <Suspense fallback={<LoadingSpinner size="sm" />}>
                <AlertFiltersPanel
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {renderViewModeContent()}
    </div>
  );
};

export default AlertsPage;