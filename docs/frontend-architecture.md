# Frontend Architecture

## Overview

BoosterBeacon's frontend implements a modern React architecture with component composition patterns, custom hooks, and optimized performance strategies. The system emphasizes reusability, maintainability, and excellent user experience through thoughtful architectural decisions.

## Architecture Principles

### 1. Component Composition
- **Atomic Design**: Components are built using atomic design principles
- **Single Responsibility**: Each component has a focused, single purpose
- **Composition over Inheritance**: Favor composition patterns for flexibility
- **Reusability**: Components are designed for maximum reusability

### 2. Custom Hooks Pattern
- **Separation of Concerns**: Business logic separated from UI components
- **Reusability**: Hooks can be shared across multiple components
- **Testability**: Hooks can be tested independently
- **State Management**: Centralized state logic in custom hooks

### 3. Performance Optimization
- **Code Splitting**: Lazy loading of components and routes
- **Memoization**: Strategic use of React.memo and useMemo
- **Bundle Optimization**: Optimized webpack configuration
- **Caching**: Intelligent caching strategies for API data

## Component Architecture

### Dashboard Filter System

The dashboard implements a sophisticated filter system using component composition:

#### FilterSection Component
```typescript
interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, icon, children }) => (
  <div className="flex items-center space-x-2">
    {icon}
    <span className="text-sm font-medium text-gray-300">{title}:</span>
    {children}
  </div>
);
```

#### Specialized Filter Components
```typescript
// TimeRangeSelect Component
const TIME_RANGE_OPTIONS = [
  { value: '1d', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
] as const;

const TimeRangeSelect: React.FC<TimeRangeSelectProps> = ({ 
  value, 
  onChange, 
  className = "bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select time range"
  >
    {TIME_RANGE_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// CategorySelect Component
const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'booster-packs', label: 'Booster Packs' },
  { value: 'elite-trainer-boxes', label: 'Elite Trainer Boxes' },
  { value: 'collection-boxes', label: 'Collection Boxes' },
  { value: 'tins', label: 'Tins' },
  { value: 'theme-decks', label: 'Theme Decks' },
] as const;

const CategorySelect: React.FC<CategorySelectProps> = ({ 
  value, 
  onChange, 
  className = "bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select product category"
  >
    {CATEGORY_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

// RetailerSelect Component
const RETAILER_OPTIONS = [
  { value: 'all', label: 'All Retailers' },
  { value: 'best-buy', label: 'Best Buy' },
  { value: 'walmart', label: 'Walmart' },
  { value: 'costco', label: 'Costco' },
  { value: 'sams-club', label: "Sam's Club" },
] as const;

const RetailerSelect: React.FC<RetailerSelectProps> = ({ 
  value, 
  onChange, 
  className = "bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-1 text-sm"
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select retailer"
  >
    {RETAILER_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);
```

#### Composed Dashboard Filters
```typescript
const DashboardFilters: React.FC<DashboardFiltersProps> = ({ filters, onFilterChange }) => {
  const handleFilterChange = (key: string, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  const handleReset = () => {
    onFilterChange(DEFAULT_FILTERS);
  };

  return (
    <div className="card-dark p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium text-gray-300">Filters:</h3>
          
          <FilterSection title="Time Range" icon={<Calendar className="w-4 h-4 text-gray-400" />}>
            <TimeRangeSelect 
              value={filters.timeRange} 
              onChange={(value) => handleFilterChange('timeRange', value)} 
            />
          </FilterSection>

          <FilterSection title="Category" icon={<Package className="w-4 h-4 text-gray-400" />}>
            <CategorySelect 
              value={filters.productCategory} 
              onChange={(value) => handleFilterChange('productCategory', value)} 
            />
          </FilterSection>

          <FilterSection title="Retailer" icon={<Store className="w-4 h-4 text-gray-400" />}>
            <RetailerSelect 
              value={filters.retailer} 
              onChange={(value) => handleFilterChange('retailer', value)} 
            />
          </FilterSection>
        </div>

        <ResetFiltersButton onReset={handleReset} />
      </div>
    </div>
  );
};
```

## Custom Hooks Architecture

### Authentication Hooks

The authentication system is split into focused, reusable custom hooks:

#### useAuthStatus Hook
```typescript
interface AuthStatusResult {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  checkAuthStatus: () => Promise<void>;
}

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
    } catch (error: any) {
      console.error('Auth status check failed:', error);
      setError(error.message || 'Authentication check failed');
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
```

#### useTokenRefresh Hook
```typescript
interface UseTokenRefreshOptions {
  token: AuthToken | null;
  onRefresh: () => Promise<void>;
  refreshBufferMinutes?: number;
}

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
```

#### useAuthErrorListener Hook
```typescript
export const useAuthErrorListener = (onAuthError: () => void) => {
  useEffect(() => {
    const handleAuthError = () => {
      onAuthError();
    };

    window.addEventListener('auth-error', handleAuthError);
    
    return () => {
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, [onAuthError]);
};
```

### Composed Authentication Context

These hooks are composed in the main AuthContext:

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const { user, isLoading, error, checkAuthStatus } = useAuthStatus();
  
  const handleAuthError = useCallback(() => {
    logout();
  }, []);

  useAuthErrorListener(handleAuthError);
  
  const manualRefresh = useTokenRefresh({
    token: tokens?.accessToken || null,
    onRefresh: refreshToken,
    refreshBufferMinutes: 5
  });

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      const { user: userData, tokens: tokenData } = response.data;
      
      setTokens(tokenData);
      apiClient.setAuthToken(tokenData.accessToken);
      
      await checkAuthStatus();
    } catch (error) {
      throw error;
    }
  };

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (tokens?.accessToken) {
        await apiClient.post('/auth/logout', {
          refresh_token: tokens.refreshToken
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setTokens(null);
      apiClient.clearAuthToken();
      await checkAuthStatus();
    }
  }, [tokens, checkAuthStatus]);

  const refreshToken = async (): Promise<void> => {
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await apiClient.post('/auth/refresh', {
        refresh_token: tokens.refreshToken
      });
      
      const newTokens = response.data.tokens;
      setTokens(newTokens);
      apiClient.setAuthToken(newTokens.accessToken);
    } catch (error) {
      await logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    tokens,
    isLoading,
    error,
    login,
    logout,
    refreshToken: manualRefresh,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
```

## Performance Optimization Strategies

### 1. Component Memoization

Strategic use of React.memo for expensive components:

```typescript
// Memoize filter components to prevent unnecessary re-renders
export const TimeRangeSelect = React.memo<TimeRangeSelectProps>(({ 
  value, 
  onChange, 
  className 
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select time range"
  >
    {TIME_RANGE_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
));

// Memoize complex dashboard components
export const DashboardFilters = React.memo<DashboardFiltersProps>(({ 
  filters, 
  onFilterChange 
}) => {
  // Component implementation
});
```

### 2. Callback Optimization

Use useCallback for event handlers to prevent child re-renders:

```typescript
const DashboardFilters: React.FC<DashboardFiltersProps> = ({ filters, onFilterChange }) => {
  const handleFilterChange = useCallback((key: string, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFilterChange]);

  const handleReset = useCallback(() => {
    onFilterChange(DEFAULT_FILTERS);
  }, [onFilterChange]);

  // Rest of component
};
```

### 3. State Optimization

Minimize state updates and use appropriate state structure:

```typescript
// Good: Single state object for related data
const [filters, setFilters] = useState({
  timeRange: '7d',
  productCategory: 'all',
  retailer: 'all'
});

// Avoid: Multiple separate state variables
// const [timeRange, setTimeRange] = useState('7d');
// const [productCategory, setProductCategory] = useState('all');
// const [retailer, setRetailer] = useState('all');
```

### 4. Lazy Loading

Implement code splitting for route-level components:

```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductSearch = lazy(() => import('./pages/ProductSearch'));
const AlertManagement = lazy(() => import('./pages/AlertManagement'));

const App: React.FC = () => (
  <Router>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<ProductSearch />} />
        <Route path="/alerts" element={<AlertManagement />} />
      </Routes>
    </Suspense>
  </Router>
);
```

## State Management Patterns

### 1. Context + useReducer Pattern

For complex state management:

```typescript
interface AppState {
  user: User | null;
  filters: FilterState;
  alerts: Alert[];
  loading: boolean;
  error: string | null;
}

type AppAction = 
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'UPDATE_FILTERS'; payload: Partial<FilterState> }
  | { type: 'SET_ALERTS'; payload: Alert[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'UPDATE_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_ALERTS':
      return { ...state, alerts: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const value = {
    ...state,
    dispatch
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
```

### 2. Custom Hook State Management

Encapsulate complex state logic in custom hooks:

```typescript
export const useProductSearch = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);

  const searchProducts = useCallback(async (searchTerm: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/products/search', {
        params: { q: searchTerm, ...filters }
      });
      setProducts(response.data.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    products,
    loading,
    error,
    filters,
    searchProducts,
    updateFilters
  };
};
```

## Error Boundary Implementation

Comprehensive error handling with error boundaries:

```typescript
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ComponentType<ErrorBoundaryProps> },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to monitoring service
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // Send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // reportError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={() => this.setState({ hasError: false, error: null, errorInfo: null })}
        />
      );
    }

    return this.props.children;
  }
}

const DefaultErrorFallback: React.FC<ErrorBoundaryProps> = ({ error, resetError }) => (
  <div className="error-boundary">
    <h2>Something went wrong</h2>
    <p>{error?.message}</p>
    <button onClick={resetError}>Try again</button>
  </div>
);
```

## Testing Strategies

### 1. Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeRangeSelect } from '../TimeRangeSelect';

describe('TimeRangeSelect', () => {
  it('should render all time range options', () => {
    const mockOnChange = jest.fn();
    
    render(
      <TimeRangeSelect 
        value="7d" 
        onChange={mockOnChange} 
      />
    );

    expect(screen.getByText('Last 24 Hours')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Last 90 Days')).toBeInTheDocument();
  });

  it('should call onChange when selection changes', () => {
    const mockOnChange = jest.fn();
    
    render(
      <TimeRangeSelect 
        value="7d" 
        onChange={mockOnChange} 
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '30d' }
    });

    expect(mockOnChange).toHaveBeenCalledWith('30d');
  });
});
```

### 2. Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuthStatus } from '../useAuthStatus';
import { apiClient } from '../../services/apiClient';

jest.mock('../../services/apiClient');

describe('useAuthStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should check auth status on mount', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    
    (apiClient.isAuthenticated as jest.Mock).mockReturnValue(true);
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { user: mockUser }
    });

    const { result } = renderHook(() => useAuthStatus());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.error).toBeNull();
  });

  it('should handle authentication errors', async () => {
    (apiClient.isAuthenticated as jest.Mock).mockReturnValue(true);
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Auth failed'));

    const { result } = renderHook(() => useAuthStatus());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe('Auth failed');
  });
});
```

## Accessibility Features

### 1. Semantic HTML

```typescript
const FilterSection: React.FC<FilterSectionProps> = ({ title, icon, children }) => (
  <div className="flex items-center space-x-2" role="group" aria-labelledby={`filter-${title.toLowerCase()}`}>
    {icon}
    <span id={`filter-${title.toLowerCase()}`} className="text-sm font-medium text-gray-300">
      {title}:
    </span>
    {children}
  </div>
);
```

### 2. ARIA Labels

```typescript
const TimeRangeSelect: React.FC<TimeRangeSelectProps> = ({ value, onChange, className }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
    aria-label="Select time range for filtering data"
    aria-describedby="time-range-help"
  >
    {TIME_RANGE_OPTIONS.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);
```

### 3. Keyboard Navigation

```typescript
const ResetFiltersButton: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <button
    onClick={onReset}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onReset();
      }
    }}
    className="btn-secondary"
    aria-label="Reset all filters to default values"
  >
    Reset Filters
  </button>
);
```

## Best Practices

### 1. Component Design
- Keep components small and focused
- Use composition over inheritance
- Implement proper TypeScript interfaces
- Follow consistent naming conventions
- Include comprehensive prop validation

### 2. State Management
- Minimize state complexity
- Use appropriate state location (local vs global)
- Implement proper state updates
- Avoid unnecessary re-renders
- Use reducers for complex state logic

### 3. Performance
- Implement proper memoization
- Use lazy loading for routes
- Optimize bundle size
- Monitor performance metrics
- Implement proper error boundaries

### 4. Testing
- Test component behavior, not implementation
- Use proper mocking strategies
- Test accessibility features
- Implement integration tests
- Monitor test coverage

## Related Documentation

- [Enhanced Logging System](enhanced-logging.md) - Frontend error logging
- [Type Safety System](type-safety.md) - TypeScript patterns and utilities
- [Caching System](caching-system.md) - Frontend caching strategies
- [Testing Strategy](testing-strategy.md) - Comprehensive testing approach
- [User Guide](user-guide.md) - End-user documentation

## Conclusion

The BoosterBeacon frontend architecture provides a solid foundation for building scalable, maintainable, and performant React applications. Through component composition, custom hooks, and performance optimization strategies, the system delivers excellent user experience while maintaining code quality and developer productivity.

Key benefits include:
- **Maintainability**: Clean component composition and separation of concerns
- **Reusability**: Modular components and custom hooks
- **Performance**: Optimized rendering and bundle size
- **Type Safety**: Comprehensive TypeScript integration
- **Testability**: Well-structured components and hooks for easy testing
- **Accessibility**: Built-in accessibility features and semantic HTML