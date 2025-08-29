# State Management Migration Guide

## Overview

This guide provides step-by-step instructions for migrating from the current Context API implementation to the optimized version, and potential future migration to advanced state management libraries.

## Phase 1: Context API Optimization (Current Implementation)

### Step 1: Implement Optimized Contexts

#### 1.1 Replace AuthContext with OptimizedAuthContext

```typescript
// Before (App.tsx)
import { AuthProvider } from './context/AuthContext';

// After (App.tsx)
import { OptimizedAuthProvider } from './context/OptimizedAuthContext';

// Update provider in App.tsx
<OptimizedAuthProvider>
  {/* ... */}
</OptimizedAuthProvider>
```

#### 1.2 Update Component Usage

```typescript
// Before - Components consuming full context
import { useAuth } from '../context/AuthContext';

const MyComponent = () => {
  const { user, isLoading, login, logout } = useAuth();
  // Component re-renders on ANY auth state change
};

// After - Selective consumption
import { useAuthState, useAuthActions } from '../context/OptimizedAuthContext';

const MyComponent = () => {
  // Only re-renders when state changes
  const { user, isLoading } = useAuthState();
  
  // Actions don't cause re-renders
  const { login, logout } = useAuthActions();
};
```

#### 1.3 Specialized Hooks for Common Patterns

```typescript
// Create specialized hooks for common use cases
export const useCurrentUser = () => {
  const { user } = useAuthState();
  return user;
};

export const useAuthStatus = () => {
  const { isAuthenticated, isLoading } = useAuthState();
  return { isAuthenticated, isLoading };
};

export const useAuthError = () => {
  const { error } = useAuthState();
  const { clearError } = useAuthActions();
  return { error, clearError };
};
```

### Step 2: Add Performance Monitoring

#### 2.1 Integrate Performance Monitor

```typescript
// In components that consume context
import { useContextMonitoring } from '../utils/performanceMonitor';

const MyComponent = () => {
  useContextMonitoring('AuthContext', 'MyComponent');
  
  const { user } = useAuthState();
  // ... component logic
};
```

#### 2.2 Monitor High-Frequency Components

```typescript
// For components that render frequently
import { withPerformanceMonitoring } from '../utils/performanceMonitor';

const FrequentComponent = () => {
  // Component logic
};

export default withPerformanceMonitoring(FrequentComponent, 'FrequentComponent');
```

### Step 3: Gradual Migration Strategy

#### Week 1: Core Contexts
- [ ] Migrate AuthContext to OptimizedAuthContext
- [ ] Update 5-10 core components to use selective hooks
- [ ] Add performance monitoring to key components

#### Week 2: UI Context
- [ ] Migrate UIContext to OptimizedUIContext
- [ ] Update layout and navigation components
- [ ] Monitor performance improvements

#### Week 3: Subscription Context
- [ ] Optimize SubscriptionContext with same pattern
- [ ] Update subscription-related components
- [ ] Performance testing and optimization

#### Week 4: Cleanup and Documentation
- [ ] Remove old context implementations
- [ ] Update documentation
- [ ] Performance analysis and reporting

## Phase 2: Advanced State Management (Future Migration)

### When to Consider Migration

**Triggers for Advanced State Management:**
- [ ] Application exceeds 50+ components
- [ ] Team size grows beyond 5 developers
- [ ] Performance issues become measurable
- [ ] Complex state synchronization requirements
- [ ] Need for time-travel debugging

### Option A: Zustand Migration (Recommended)

#### Step 1: Install Zustand

```bash
npm install zustand
```

#### Step 2: Create Zustand Store

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiClient.post('/auth/login', credentials);
          const { user, token } = response.data;
          
          apiClient.setAuthToken(token.accessToken, credentials.rememberMe);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await apiClient.post('/auth/logout');
        } catch (error) {
          console.error('Logout failed:', error);
        } finally {
          apiClient.clearAuthToken();
          set({ user: null, isAuthenticated: false, error: null });
        }
      },

      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    { name: 'auth-store' }
  )
);
```

#### Step 3: Create Selective Hooks

```typescript
// hooks/useAuth.ts
import { useAuthStore } from '../stores/authStore';

// Selective state hooks
export const useAuthState = () => useAuthStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  isLoading: state.isLoading,
  error: state.error,
}));

export const useAuthActions = () => useAuthStore((state) => ({
  login: state.login,
  logout: state.logout,
  setUser: state.setUser,
  setLoading: state.setLoading,
  setError: state.setError,
}));

// Specialized hooks
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useAuthStatus = () => useAuthStore((state) => ({
  isAuthenticated: state.isAuthenticated,
  isLoading: state.isLoading,
}));
```

#### Step 4: Gradual Component Migration

```typescript
// Before (Context API)
import { useAuthState } from '../context/OptimizedAuthContext';

const MyComponent = () => {
  const { user, isLoading } = useAuthState();
  // ...
};

// After (Zustand)
import { useAuthState } from '../hooks/useAuth';

const MyComponent = () => {
  const { user, isLoading } = useAuthState();
  // Same interface, different implementation
};
```

### Option B: Redux Toolkit Migration (Enterprise Scale)

#### When to Choose Redux Toolkit
- [ ] Team size > 10 developers
- [ ] Complex state relationships
- [ ] Need for time-travel debugging
- [ ] Strict state mutation controls required
- [ ] Integration with existing Redux ecosystem

#### Migration Steps (High Level)

1. **Install Redux Toolkit**
   ```bash
   npm install @reduxjs/toolkit react-redux
   ```

2. **Create Store Structure**
   ```typescript
   // store/index.ts
   import { configureStore } from '@reduxjs/toolkit';
   import authSlice from './slices/authSlice';
   import uiSlice from './slices/uiSlice';

   export const store = configureStore({
     reducer: {
       auth: authSlice,
       ui: uiSlice,
     },
   });
   ```

3. **Create Slices**
   ```typescript
   // store/slices/authSlice.ts
   import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

   export const loginUser = createAsyncThunk(
     'auth/login',
     async (credentials: LoginCredentials) => {
       const response = await apiClient.post('/auth/login', credentials);
       return response.data;
     }
   );

   const authSlice = createSlice({
     name: 'auth',
     initialState: {
       user: null,
       isLoading: false,
       error: null,
     },
     reducers: {
       clearError: (state) => {
         state.error = null;
       },
     },
     extraReducers: (builder) => {
       builder
         .addCase(loginUser.pending, (state) => {
           state.isLoading = true;
         })
         .addCase(loginUser.fulfilled, (state, action) => {
           state.user = action.payload.user;
           state.isLoading = false;
         })
         .addCase(loginUser.rejected, (state, action) => {
           state.error = action.error.message;
           state.isLoading = false;
         });
     },
   });
   ```

## Performance Optimization Guidelines

### 1. Context Splitting Best Practices

```typescript
// ❌ Bad: Large monolithic context
interface AppState {
  user: User;
  ui: UIState;
  subscription: SubscriptionState;
  products: Product[];
  alerts: Alert[];
}

// ✅ Good: Split by domain
interface AuthState { user: User; isAuthenticated: boolean; }
interface UIState { theme: string; notifications: Notification[]; }
interface SubscriptionState { tier: string; usage: Usage; }
```

### 2. Memoization Strategies

```typescript
// ❌ Bad: Context value recreated on every render
const contextValue = {
  state,
  login,
  logout,
  updateUser,
};

// ✅ Good: Memoized context value
const contextValue = useMemo(() => ({
  state,
  login,
  logout,
  updateUser,
}), [state, login, logout, updateUser]);
```

### 3. Selective Consumption Patterns

```typescript
// ❌ Bad: Consuming entire context
const { user, isLoading, error, login, logout, updateUser } = useAuth();

// ✅ Good: Selective consumption
const { user } = useAuthState();
const { login } = useAuthActions();
```

## Testing Strategy

### 1. Context Testing

```typescript
// Test optimized contexts
import { renderHook } from '@testing-library/react';
import { OptimizedAuthProvider, useAuthState } from '../context/OptimizedAuthContext';

test('should provide auth state', () => {
  const wrapper = ({ children }) => (
    <OptimizedAuthProvider>{children}</OptimizedAuthProvider>
  );
  
  const { result } = renderHook(() => useAuthState(), { wrapper });
  
  expect(result.current.isAuthenticated).toBe(false);
});
```

### 2. Performance Testing

```typescript
// Test for unnecessary re-renders
import { renderHook } from '@testing-library/react';
import { performanceMonitor } from '../utils/performanceMonitor';

test('should not cause unnecessary re-renders', () => {
  const { result, rerender } = renderHook(() => useAuthState());
  
  const initialRenderCount = performanceMonitor.getReport().contextMetrics
    .find(m => m.contextName === 'AuthContext')?.renderCount || 0;
  
  rerender();
  
  const finalRenderCount = performanceMonitor.getReport().contextMetrics
    .find(m => m.contextName === 'AuthContext')?.renderCount || 0;
  
  expect(finalRenderCount - initialRenderCount).toBeLessThan(2);
});
```

## Rollback Strategy

### Emergency Rollback Plan

1. **Keep Old Implementation**: Maintain old context files during migration
2. **Feature Flags**: Use environment variables to switch between implementations
3. **Gradual Rollout**: Migrate components one by one with ability to revert
4. **Monitoring**: Set up alerts for performance regressions

```typescript
// Rollback mechanism
const useAuthImplementation = () => {
  if (import.meta.env.VITE_USE_OPTIMIZED_CONTEXT === 'true') {
    return useOptimizedAuth();
  }
  return useLegacyAuth();
};
```

## Success Metrics

### Performance Metrics to Track

- [ ] Context re-render frequency (target: <50 per minute)
- [ ] Component render times (target: <16ms for 60fps)
- [ ] Bundle size impact (target: <5% increase)
- [ ] Memory usage (target: no memory leaks)
- [ ] Developer velocity (target: maintain or improve)

### Migration Checklist

#### Phase 1 Completion Criteria
- [ ] All contexts optimized with state/action separation
- [ ] Performance monitoring implemented
- [ ] No performance regressions detected
- [ ] All tests passing
- [ ] Documentation updated

#### Phase 2 Completion Criteria (If Needed)
- [ ] Advanced state management library integrated
- [ ] All components migrated
- [ ] Performance improvements measured
- [ ] Team training completed
- [ ] Rollback plan tested

---

*Migration guide version 1.0*
*Last updated: December 2024*