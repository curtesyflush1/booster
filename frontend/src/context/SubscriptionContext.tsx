import React, { createContext, useContext, useReducer, useEffect, ReactNode, useCallback } from 'react';
import { subscriptionService, SubscriptionStatus, UsageStats, QuotaInfo, BillingEvent } from '../services/subscriptionService';
import { useAuth } from './AuthContext';

interface SubscriptionState {
  subscription: SubscriptionStatus | null;
  usage: UsageStats | null;
  quota: QuotaInfo | null;
  billingHistory: BillingEvent[];
  loading: boolean;
  error: string | null;
}

type SubscriptionAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUBSCRIPTION_DATA'; payload: { subscription: SubscriptionStatus; usage: UsageStats; quota: QuotaInfo; billingHistory: BillingEvent[] } }
  | { type: 'UPDATE_SUBSCRIPTION'; payload: Partial<SubscriptionStatus> }
  | { type: 'UPDATE_USAGE'; payload: Partial<UsageStats> }
  | { type: 'RESET_STATE' };

const initialState: SubscriptionState = {
  subscription: null,
  usage: null,
  quota: null,
  billingHistory: [],
  loading: false,
  error: null
};

function subscriptionReducer(state: SubscriptionState, action: SubscriptionAction): SubscriptionState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_SUBSCRIPTION_DATA':
      return {
        ...state,
        subscription: action.payload.subscription,
        usage: action.payload.usage,
        quota: action.payload.quota,
        billingHistory: action.payload.billingHistory,
        loading: false,
        error: null
      };
    case 'UPDATE_SUBSCRIPTION':
      return {
        ...state,
        subscription: state.subscription ? { ...state.subscription, ...action.payload } : null
      };
    case 'UPDATE_USAGE':
      return {
        ...state,
        usage: state.usage ? { ...state.usage, ...action.payload } : null
      };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

interface SubscriptionContextType {
  state: SubscriptionState;
  refreshSubscriptionData: () => Promise<void>;
  upgradeToProPlan: (planSlug: string) => Promise<void>;
  cancelSubscription: (cancelAtPeriodEnd?: boolean) => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  checkQuota: (action: 'watch' | 'alert' | 'api') => Promise<QuotaInfo>;
  isProUser: () => boolean;
  canCreateWatch: () => boolean;
  getRemainingWatches: () => number;
  getUsagePercentage: (type: 'watches' | 'alerts' | 'api') => number;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);
  const { user, isAuthenticated } = useAuth();

  const refreshSubscriptionData = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;

    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const data = await subscriptionService.getSubscriptionStatus();
      dispatch({ type: 'SET_SUBSCRIPTION_DATA', payload: data });
    } catch (error) {
      console.error('Error loading subscription data:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load subscription data' });
    }
  }, [isAuthenticated]);

  // Load subscription data when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      refreshSubscriptionData();
    } else {
      dispatch({ type: 'RESET_STATE' });
    }
  }, [isAuthenticated, user, refreshSubscriptionData]);

  const upgradeToProPlan = async (planSlug: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await subscriptionService.redirectToCheckout(planSlug);
    } catch (error) {
      console.error('Error upgrading to Pro plan:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to start upgrade process' });
    }
  };

  const cancelSubscription = async (cancelAtPeriodEnd: boolean = true): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const result = await subscriptionService.cancelSubscription(cancelAtPeriodEnd);
      
      dispatch({ 
        type: 'UPDATE_SUBSCRIPTION', 
        payload: { 
          cancelAtPeriodEnd: result.cancelAtPeriodEnd,
          ...(result.cancelAtPeriodEnd ? {} : { tier: 'free', status: 'canceled' })
        } 
      });
      
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to cancel subscription' });
    }
  };

  const reactivateSubscription = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await subscriptionService.reactivateSubscription();
      
      dispatch({ 
        type: 'UPDATE_SUBSCRIPTION', 
        payload: { cancelAtPeriodEnd: false } 
      });
      
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to reactivate subscription' });
    }
  };

  const checkQuota = async (action: 'watch' | 'alert' | 'api'): Promise<QuotaInfo> => {
    try {
      return await subscriptionService.checkQuota(action);
    } catch (error) {
      console.error('Error checking quota:', error);
      return { allowed: false };
    }
  };

  const isProUser = (): boolean => {
    return state.subscription?.tier === 'pro' && state.subscription?.status === 'active';
  };

  const canCreateWatch = (): boolean => {
    if (isProUser()) return true;
    
    const watchesUsed = state.usage?.watches_used || 0;
    const watchLimit = state.quota?.limit || 5;
    
    return watchesUsed < watchLimit;
  };

  const getRemainingWatches = (): number => {
    if (isProUser()) return Infinity;
    
    const watchesUsed = state.usage?.watches_used || 0;
    const watchLimit = state.quota?.limit || 5;
    
    return Math.max(0, watchLimit - watchesUsed);
  };

  const getUsagePercentage = (type: 'watches' | 'alerts' | 'api'): number => {
    if (isProUser()) return 0; // No limits for Pro users
    
    if (!state.usage) return 0;
    
    let used = 0;
    let limit = 0;
    
    switch (type) {
      case 'watches':
        used = state.usage.watches_used;
        limit = state.quota?.limit || 5;
        break;
      case 'alerts':
        used = state.usage.alerts_sent;
        limit = 50; // Default alert limit for free tier
        break;
      case 'api':
        used = state.usage.api_calls;
        limit = 1000; // Default API limit for free tier
        break;
    }
    
    return limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  };

  const contextValue: SubscriptionContextType = {
    state,
    refreshSubscriptionData,
    upgradeToProPlan,
    cancelSubscription,
    reactivateSubscription,
    checkQuota,
    isProUser,
    canCreateWatch,
    getRemainingWatches,
    getUsagePercentage
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};