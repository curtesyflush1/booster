// Push Notification Settings Component
import React, { useState } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface PushNotificationSettingsProps {
  className?: string;
  showStats?: boolean;
  showTestButton?: boolean;
}

export const PushNotificationSettings: React.FC<PushNotificationSettingsProps> = ({
  className = '',
  showStats = true,
  showTestButton = true
}) => {
  const {
    isInitialized,
    isSubscribed,
    isLoading,
    error,
    permissionState,
    stats,
    initialize,
    subscribe,
    unsubscribe,
    requestPermission,
    sendTestNotification,
    refreshStats,
    clearError,
    canSubscribe,
    needsPermission,
    isSupported
  } = usePushNotifications();

  const [showDetails, setShowDetails] = useState(false);

  /**
   * Handle subscription toggle
   */
  const handleSubscriptionToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      if (permissionState.permission !== 'granted') {
        const permission = await requestPermission();
        if (permission !== 'granted') {
          return;
        }
      }
      await subscribe();
    }
  };

  /**
   * Handle test notification
   */
  const handleTestNotification = async () => {
    try {
      await sendTestNotification();
      // Could show a success message
    } catch (err) {
      console.error('Test notification failed:', err);
    }
  };

  /**
   * Get status color based on current state
   */
  const getStatusColor = () => {
    if (!isSupported) return 'text-gray-500';
    if (error) return 'text-red-500';
    if (isSubscribed) return 'text-green-500';
    if (permissionState.permission === 'denied') return 'text-red-500';
    return 'text-yellow-500';
  };

  /**
   * Get status text
   */
  const getStatusText = () => {
    if (!isSupported) return 'Not supported';
    if (error) return 'Error';
    if (isSubscribed) return 'Active';
    if (permissionState.permission === 'denied') return 'Blocked';
    if (permissionState.permission === 'granted') return 'Ready';
    return 'Not enabled';
  };

  if (!isSupported) {
    return (
      <div className={`p-4 bg-gray-50 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-gray-600">Push notifications are not supported in this browser</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Please use a modern browser like Chrome, Firefox, or Safari to receive push notifications.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Settings */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              isSubscribed ? 'bg-green-500' : 
              permissionState.permission === 'denied' ? 'bg-red-500' : 
              'bg-yellow-500'
            }`}></div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Push Notifications</h3>
              <p className="text-sm text-gray-600">
                Get instant alerts when your watched products become available
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {isLoading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
              <button
                onClick={clearError}
                className="text-red-500 hover:text-red-700"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Permission Request */}
        {needsPermission && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-blue-900">Enable Notifications</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Allow notifications to receive instant alerts about product availability
                </p>
              </div>
              <button
                onClick={requestPermission}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enable
              </button>
            </div>
          </div>
        )}

        {/* Subscription Toggle */}
        {permissionState.permission === 'granted' && (
          <div className="mt-4 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {isSubscribed ? 'Notifications Enabled' : 'Enable Notifications'}
              </h4>
              <p className="text-sm text-gray-600">
                {isSubscribed 
                  ? 'You will receive push notifications for your watched products'
                  : 'Subscribe to receive push notifications'
                }
              </p>
            </div>
            <button
              onClick={handleSubscriptionToggle}
              disabled={isLoading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isSubscribed ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}

        {/* Blocked State */}
        {permissionState.permission === 'denied' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-red-900">Notifications Blocked</h4>
                <p className="text-sm text-red-700 mt-1">
                  Notifications are blocked. Please enable them in your browser settings to receive alerts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isSubscribed && (
          <div className="mt-4 flex items-center space-x-3">
            {showTestButton && (
              <button
                onClick={handleTestNotification}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Test
              </button>
            )}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>
        )}
      </div>

      {/* Statistics */}
      {showStats && stats && isSubscribed && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Notification Statistics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.subscriptionCount}</div>
              <div className="text-sm text-gray-600">Active Subscriptions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.notificationsSent}</div>
              <div className="text-sm text-gray-600">Notifications Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.lastNotificationSent 
                  ? new Date(stats.lastNotificationSent).toLocaleDateString()
                  : 'Never'
                }
              </div>
              <div className="text-sm text-gray-600">Last Notification</div>
            </div>
          </div>
          <button
            onClick={refreshStats}
            className="mt-4 text-sm text-blue-600 hover:text-blue-800"
          >
            Refresh Statistics
          </button>
        </div>
      )}

      {/* Technical Details */}
      {showDetails && isSubscribed && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h5 className="text-sm font-medium text-gray-900 mb-2">Technical Details</h5>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <span className="font-medium">Permission:</span> {permissionState.permission}
            </div>
            <div>
              <span className="font-medium">Service Worker:</span> {permissionState.isServiceWorkerSupported ? 'Supported' : 'Not supported'}
            </div>
            <div>
              <span className="font-medium">Push API:</span> {permissionState.isSupported ? 'Supported' : 'Not supported'}
            </div>
            <div>
              <span className="font-medium">Initialized:</span> {isInitialized ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PushNotificationSettings;