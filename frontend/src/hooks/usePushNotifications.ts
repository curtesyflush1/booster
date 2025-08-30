// React Hook for Push Notifications
import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService, NotificationPermissionState, PushNotificationStats } from '../services/pushNotificationService';

export interface UsePushNotificationsReturn {
  // State
  isInitialized: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  permissionState: NotificationPermissionState;
  stats: PushNotificationStats | null;

  // Actions
  initialize: () => Promise<void>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<NotificationPermission>;
  sendTestNotification: () => Promise<void>;
  refreshStats: () => Promise<void>;
  clearError: () => void;

  // Utilities
  canSubscribe: boolean;
  needsPermission: boolean;
  isSupported: boolean;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<NotificationPermissionState>({
    permission: 'default',
    isSupported: false,
    isServiceWorkerSupported: false,
    canRequestPermission: false
  });
  const [stats, setStats] = useState<PushNotificationStats | null>(null);

  /**
   * Update permission state
   */
  const updatePermissionState = useCallback(() => {
    const state = pushNotificationService.getPermissionState();
    setPermissionState(state);
  }, []);

  /**
   * Initialize push notification service
   */
  const initialize = useCallback(async () => {
    if (isInitialized) return;

    setIsLoading(true);
    setError(null);

    try {
      await pushNotificationService.initialize();
      setIsInitialized(true);
      
      // Check if already subscribed
      const subscribed = await pushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);
      
      // Update permission state
      updatePermissionState();
      
      console.log('Push notifications initialized successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize push notifications';
      setError(errorMessage);
      console.error('Push notification initialization failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, updatePermissionState]);

  /**
   * Refresh push notification statistics
   */
  const refreshStats = useCallback(async () => {
    try {
      const newStats = await pushNotificationService.getStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to refresh push notification stats:', err);
      // Don't set error for stats refresh failure
    }
  }, []);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async () => {
    if (!isInitialized) {
      await initialize();
    }

    setIsLoading(true);
    setError(null);

    try {
      await pushNotificationService.subscribe();
      setIsSubscribed(true);
      updatePermissionState();
      
      // Refresh stats after subscribing
      await refreshStats();
      
      console.log('Successfully subscribed to push notifications');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to subscribe to push notifications';
      setError(errorMessage);
      console.error('Push notification subscription failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, initialize, updatePermissionState, refreshStats]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await pushNotificationService.unsubscribe();
      setIsSubscribed(false);
      updatePermissionState();
      
      // Refresh stats after unsubscribing
      await refreshStats();
      
      console.log('Successfully unsubscribed from push notifications');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unsubscribe from push notifications';
      setError(errorMessage);
      console.error('Push notification unsubscription failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [updatePermissionState, refreshStats]);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    setIsLoading(true);
    setError(null);

    try {
      const permission = await pushNotificationService.requestPermission();
      updatePermissionState();
      return permission;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request notification permission';
      setError(errorMessage);
      console.error('Permission request failed:', err);
      return 'denied';
    } finally {
      setIsLoading(false);
    }
  }, [updatePermissionState]);

  /**
   * Send test notification
   */
  const sendTestNotification = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await pushNotificationService.sendTestNotification();
      console.log('Test notification sent successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send test notification';
      setError(errorMessage);
      console.error('Test notification failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Initialize on mount and listen for permission changes
   */
  useEffect(() => {
    // Initialize permission state immediately
    updatePermissionState();

    // Listen for permission changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updatePermissionState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for service worker updates
    const handleServiceWorkerUpdate = () => {
      console.log('Service worker update detected');
      // Could show a notification to the user
    };

    window.addEventListener('sw-update-available', handleServiceWorkerUpdate);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('sw-update-available', handleServiceWorkerUpdate);
    };
  }, [updatePermissionState]);

  /**
   * Auto-initialize if supported
   */
  useEffect(() => {
    if (permissionState.isSupported && permissionState.isServiceWorkerSupported && !isInitialized) {
      initialize().catch(console.error);
    }
  }, [permissionState.isSupported, permissionState.isServiceWorkerSupported, isInitialized, initialize]);

  /**
   * Refresh stats periodically when subscribed
   */
  useEffect(() => {
    if (!isSubscribed) return;

    // Refresh stats immediately
    refreshStats();

    // Set up periodic refresh
    const interval = setInterval(refreshStats, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [isSubscribed, refreshStats]);

  // Computed values
  const canSubscribe = permissionState.isSupported && 
                      permissionState.isServiceWorkerSupported && 
                      permissionState.permission === 'granted' && 
                      !isSubscribed;

  const needsPermission = permissionState.isSupported && 
                         permissionState.canRequestPermission;

  const isSupported = permissionState.isSupported && 
                     permissionState.isServiceWorkerSupported;

  return {
    // State
    isInitialized,
    isSubscribed,
    isLoading,
    error,
    permissionState,
    stats,

    // Actions
    initialize,
    subscribe,
    unsubscribe,
    requestPermission,
    sendTestNotification,
    refreshStats,
    clearError,

    // Utilities
    canSubscribe,
    needsPermission,
    isSupported
  };
};

export default usePushNotifications;