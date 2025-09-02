import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { User, AuthToken, LoginCredentials, RegisterData } from '../types';
import { apiClient } from '../services/apiClient';
import { useTokenRefresh } from '../hooks/useTokenRefresh';
import { useAuthErrorListener } from '../hooks/useAuthErrorListener';

// Token storage utilities
const TOKEN_STORAGE_KEY = 'auth_token';
const REFRESH_TOKEN_STORAGE_KEY = 'refresh_token';

const tokenStorage = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
  },
  
  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  },
  
  setTokens: (accessToken: string, refreshToken: string, remember: boolean = false): void => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_STORAGE_KEY, accessToken);
    storage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  },
  
  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
};

// Auth State Interface (Read-only state)
interface AuthState {
  user: User | null;
  token: AuthToken | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  retryCount: number;
}

// Auth Actions Interface (Actions only)
interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
}

// Auth Actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: AuthToken } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_CLEAR_ERROR' }
  | { type: 'AUTH_UPDATE_USER'; payload: User }
  | { type: 'AUTH_SET_LOADING'; payload: boolean }
  | { type: 'AUTH_RETRY'; payload: number };

// Initial State
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  retryCount: 0,
};

// Auth Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'AUTH_UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };

    case 'AUTH_SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'AUTH_RETRY':
      return {
        ...state,
        retryCount: action.payload,
        error: null,
      };

    default:
      return state;
  }
}

// Create Separate Contexts for State and Actions
const AuthStateContext = createContext<AuthState | undefined>(undefined);
const AuthActionsContext = createContext<AuthActions | undefined>(undefined);

// Auth Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

// Optimized Auth Provider Component
export const OptimizedAuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Handle auth errors
  const handleAuthError = useCallback(() => {
    dispatch({ type: 'AUTH_LOGOUT' });
  }, []);

  // Define refreshToken function first
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      const currentRefreshToken = tokenStorage.getRefreshToken();
      if (!currentRefreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post('/auth/refresh', {
        refreshToken: currentRefreshToken,
      });

      const { token } = response.data;
      tokenStorage.setTokens(token.accessToken, token.refreshToken, true);
      apiClient.setAuthToken(token.accessToken, true);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: state.user!, token },
      });
    } catch (error: unknown) {
      console.error('Token refresh failed:', error);
      tokenStorage.clearTokens();
      dispatch({ type: 'AUTH_LOGOUT' });
      throw error;
    }
  }, [state.user]);

  // Handle token refresh
  const handleTokenRefresh = useCallback(async () => {
    try {
      await refreshToken();
    } catch (error) {
      console.error('Token refresh failed:', error);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, [refreshToken]);

  /**
   * Check current authentication status
   */
  const checkAuthStatus = useCallback(async (): Promise<void> => {
    const startTime = performance.now();
    
    try {
      dispatch({ type: 'AUTH_SET_LOADING', payload: true });

      // Check if we have a stored token
      if (!apiClient.isAuthenticated()) {
        dispatch({ type: 'AUTH_LOGOUT' });
        return;
      }

      // Verify token with server and get user data
      const response = await apiClient.get('/auth/me');
      const user = response.data.user;

      // Get tokens from storage
      const storedToken = tokenStorage.getToken();
      const storedRefreshToken = tokenStorage.getRefreshToken();
      
      if (!storedToken) {
        dispatch({ type: 'AUTH_LOGOUT' });
        return;
      }

      // Create token object (in real app, you'd parse the JWT)
      const token: AuthToken = {
        accessToken: storedToken,
        refreshToken: storedRefreshToken || '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        tokenType: 'Bearer',
      };

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });

      // Log performance metrics
      const duration = performance.now() - startTime;
      if (duration > 1000) {
        console.warn(`Auth status check took ${duration.toFixed(2)}ms`);
      }
    } catch (error: unknown) {
      console.error('Auth status check failed:', error);
      
      // Handle specific error cases
      if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response && error.response.status === 401) {
        // Token is invalid, clear it
        tokenStorage.clearTokens();
        apiClient.clearAuthToken();
      }
      
      dispatch({ type: 'AUTH_LOGOUT' });
    } finally {
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
    }
  }, []);

  // Use custom hooks
  useAuthErrorListener(handleAuthError);
  useTokenRefresh({
    token: state.token,
    onRefresh: handleTokenRefresh,
    refreshBufferMinutes: 5
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  /**
   * Login user
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await apiClient.post('/auth/login', credentials);
      const raw = (response?.data as any)?.data || (response?.data as any) || {};
      const user = raw.user;
      const t = raw.tokens || raw.token || {};
      const token: AuthToken = {
        accessToken: t.access_token || t.accessToken,
        refreshToken: t.refresh_token || t.refreshToken || '',
        expiresAt: new Date(Date.now() + Number(t.expires_in || 3600) * 1000).toISOString(),
        tokenType: (t.token_type || 'Bearer') as 'Bearer',
      };

      // Store tokens
      tokenStorage.setTokens(token.accessToken, token.refreshToken, credentials.rememberMe || false);
      apiClient.setAuthToken(token.accessToken, Boolean(credentials.rememberMe));

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'message' in error ? error.message as string : 'Login failed. Please try again.';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (data: RegisterData): Promise<void> => {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await apiClient.post('/auth/register', data);
      const raw = (response?.data as any)?.data || (response?.data as any) || {};
      const user = raw.user;
      const t = raw.tokens || raw.token || {};
      const token: AuthToken = {
        accessToken: t.access_token || t.accessToken,
        refreshToken: t.refresh_token || t.refreshToken || '',
        expiresAt: new Date(Date.now() + Number(t.expires_in || 3600) * 1000).toISOString(),
        tokenType: (t.token_type || 'Bearer') as 'Bearer',
      };

      // Store tokens
      tokenStorage.setTokens(token.accessToken, token.refreshToken, false);
      apiClient.setAuthToken(token.accessToken, false);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token },
      });
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'message' in error ? error.message as string : 'Registration failed. Please try again.';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Call logout endpoint to invalidate token on server
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    } finally {
      // Clear local storage
      tokenStorage.clearTokens();
      apiClient.clearAuthToken();
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, []);



  /**
   * Update user profile
   */
  const updateUser = useCallback(async (userData: Partial<User>): Promise<void> => {
    try {
      const response = await apiClient.put('/users/profile', userData);
      const updatedUser = (response?.data as any)?.data?.user || (response?.data as any)?.user;

      dispatch({
        type: 'AUTH_UPDATE_USER',
        payload: updatedUser,
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update user profile';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  }, []);

  /**
   * Clear authentication error
   */
  const clearError = useCallback((): void => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  }, []);

  // Memoize state and actions separately to prevent unnecessary re-renders
  const stateValue = useMemo(() => state, [state]);
  
  const actionsValue = useMemo(() => ({
    login,
    register,
    logout,
    refreshToken,
    updateUser,
    clearError,
    checkAuthStatus,
  }), [login, register, logout, refreshToken, updateUser, clearError, checkAuthStatus]);

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
};

// Optimized hooks for selective consumption
export const useAuthState = (): AuthState => {
  const context = useContext(AuthStateContext);
  if (context === undefined) {
    throw new Error('useAuthState must be used within an OptimizedAuthProvider');
  }
  return context;
};

export const useAuthActions = (): AuthActions => {
  const context = useContext(AuthActionsContext);
  if (context === undefined) {
    throw new Error('useAuthActions must be used within an OptimizedAuthProvider');
  }
  return context;
};

// Convenience hook that combines both (use sparingly)
export const useAuth = (): AuthState & AuthActions => {
  const state = useAuthState();
  const actions = useAuthActions();
  
  return useMemo(() => ({
    ...state,
    ...actions,
  }), [state, actions]);
};

// HOC for protected routes (optimized)
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>
): React.ComponentType<P> => {
  const WrappedComponent = React.memo((props: P) => {
    const { isAuthenticated, isLoading } = useAuthState();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="spinner w-8 h-8"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login page
      window.location.href = '/login';
      return null;
    }

    return <Component {...props} />;
  });

  WrappedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  return WrappedComponent as unknown as React.ComponentType<P>;
};

export default OptimizedAuthProvider;
