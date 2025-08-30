import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { User } from '../types';

interface AuthStatusResult {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  checkAuthStatus: () => Promise<void>;
}

/**
 * Custom hook for checking authentication status
 */
export const useAuthStatus = (): AuthStatusResult => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuthStatus = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if we have a stored token
      if (!apiClient.isAuthenticated()) {
        setUser(null);
        return;
      }

      // Verify token with server and get user data
      const response = await apiClient.get('/auth/me');
      const userData = response.data.user;

      setUser(userData);
    } catch (error: unknown) {
      console.error('Auth status check failed:', error);
      const errorMessage = error && typeof error === 'object' && 'message' in error ? error.message as string : 'Authentication check failed';
      setError(errorMessage);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return {
    user,
    isLoading,
    error,
    checkAuthStatus
  };
};