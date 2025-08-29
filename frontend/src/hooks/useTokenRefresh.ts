import { useEffect, useCallback } from 'react';
import { AuthToken } from '../types';

interface UseTokenRefreshOptions {
  token: AuthToken | null;
  onRefresh: () => Promise<void>;
  refreshBufferMinutes?: number;
}

/**
 * Custom hook for handling automatic token refresh
 */
export const useTokenRefresh = ({
  token,
  onRefresh,
  refreshBufferMinutes = 5
}: UseTokenRefreshOptions) => {
  const scheduleRefresh = useCallback(() => {
    if (!token) return null;
    
    const expiryTime = new Date(token.expiresAt).getTime();
    const currentTime = Date.now();
    const refreshTime = expiryTime - currentTime - (refreshBufferMinutes * 60 * 1000);
    
    if (refreshTime > 0) {
      return setTimeout(() => {
        onRefresh().catch(console.error);
      }, refreshTime);
    }
    
    return null;
  }, [token, onRefresh, refreshBufferMinutes]);

  useEffect(() => {
    const timeoutId = scheduleRefresh();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [scheduleRefresh]);

  // Return manual refresh function
  return useCallback(() => {
    onRefresh().catch(console.error);
  }, [onRefresh]);
};