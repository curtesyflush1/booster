import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import OptimizedLayout from './components/OptimizedLayout';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import Footer from './components/layout/Footer';
import { Toaster } from 'react-hot-toast';

// Page Components (lazy loaded)
const HomePage = React.lazy(() => import('./pages/HomePage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const WatchesPage = React.lazy(() => import('./pages/WatchesPage'));
const AlertsPage = React.lazy(() => import('./pages/AlertsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const PricingPage = React.lazy(() => import('./pages/PricingPage'));
const SubscriptionPage = React.lazy(() => import('./pages/SubscriptionPage'));
const SubscriptionSuccessPage = React.lazy(() => import('./pages/SubscriptionSuccessPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));
const ContactPage = React.lazy(() => import('./pages/ContactPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const SiteMapPage = React.lazy(() => import('./pages/SiteMapPage'));

// SEO-optimized landing pages
const PokemonTCGAlertsPage = React.lazy(() => import('./pages/PokemonTCGAlertsPage'));
const LocationBasedPage = React.lazy(() => import('./pages/LocationBasedPage'));

// Types
interface RouteWrapperProps {
  children: React.ReactNode;
}
interface RouteWrapperProps {
  children: React.ReactNode;
}

// Protected Route Component
const ProtectedRoute: React.FC<RouteWrapperProps> = React.memo(({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
});

ProtectedRoute.displayName = 'ProtectedRoute';

// Public Route Component (redirect if authenticated)
const PublicRoute: React.FC<RouteWrapperProps> = React.memo(({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
});

PublicRoute.displayName = 'PublicRoute';


/**
 * Route Configuration Interface
 * Defines the structure for application routes
 */
interface RouteConfig {
  /** The URL path for the route */
  path: string;
  /** The React component to render for this route */
  element: React.ComponentType;
  /** Whether the route requires authentication */
  requiresAuth?: boolean;
  /** Whether the route should be wrapped with OptimizedLayout */
  requiresLayout?: boolean;
  /** Whether the route should redirect authenticated users */
  isPublicOnly?: boolean;
}

const routeConfig: RouteConfig[] = [
  // Public Routes
  { path: '/', element: HomePage },
  { path: '/pricing', element: PricingPage },
  { path: '/contact', element: ContactPage },
  { path: '/terms', element: TermsPage },
  { path: '/privacy', element: PrivacyPage },
  { path: '/sitemap', element: SiteMapPage },

  // SEO-optimized landing pages
  { path: '/pokemon-tcg-alerts', element: PokemonTCGAlertsPage },
  { path: '/locations/:city/:state', element: LocationBasedPage },

  // Auth Routes (redirect if authenticated)
  { path: '/login', element: LoginPage, isPublicOnly: true },
  { path: '/register', element: RegisterPage, isPublicOnly: true },

  // Protected Routes with Layout
  { path: '/dashboard', element: DashboardPage, requiresAuth: true, requiresLayout: true },
  { path: '/products', element: ProductsPage, requiresAuth: true, requiresLayout: true },
  { path: '/watches', element: WatchesPage, requiresAuth: true, requiresLayout: true },
  { path: '/alerts', element: AlertsPage, requiresAuth: true, requiresLayout: true },
  { path: '/profile', element: ProfilePage, requiresAuth: true, requiresLayout: true },
  { path: '/settings', element: SettingsPage, requiresAuth: true, requiresLayout: true },
  { path: '/subscription', element: SubscriptionPage, requiresAuth: true, requiresLayout: true },
  { path: '/subscription/success', element: SubscriptionSuccessPage, requiresAuth: true },
];

/**
 * Route Element Factory
 * Creates the appropriate route element based on configuration
 */
const createRouteElement = (config: RouteConfig): React.ReactElement => {
  const { element: Component, requiresAuth, requiresLayout, isPublicOnly } = config;

  let element = <Component />;

  if (requiresLayout) {
    element = <OptimizedLayout>{element}</OptimizedLayout>;
  }

  if (requiresAuth) {
    element = <ProtectedRoute>{element}</ProtectedRoute>;
  } else if (isPublicOnly) {
    element = <PublicRoute>{element}</PublicRoute>;
  }

  return element;
};

// App Routes Component
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {routeConfig.map((config) => (
        <Route
          key={config.path}
          path={config.path}
          element={createRouteElement(config)}
        />
      ))}
      {/* 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// Error Logging Service
const logError = async (error: {
  message: string;
  stack?: string;
  url: string;
  timestamp: string;
  type: 'unhandled-rejection' | 'global-error';
}) => {
  if (!import.meta.env.PROD) return;

  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error)
    });
  } catch {
    // Silently fail - don't create error loops
  }
};

// Global Error Handler Hook
const useGlobalErrorHandler = () => {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Only show user notification for non-auth errors
      if (!event.reason?.message?.includes('auth')) {
        console.warn('An unexpected error occurred. Please try again.');
      }

      logError({
        message: event.reason?.message || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        type: 'unhandled-rejection'
      });
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);

      logError({
        message: event.error?.message || 'Unknown error',
        stack: event.error?.stack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        type: 'global-error'
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
};

// Main App Component
const App: React.FC = () => {
  useGlobalErrorHandler();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SubscriptionProvider>
          <UIProvider>
            <Router>
              <div className="min-h-screen bg-background-primary">
                <Suspense fallback={<LoadingSpinner />}>
                  <AppRoutes />
                </Suspense>
                <Footer />
                <PWAUpdatePrompt />
                {/* Global toast container */}
                <Toaster position="top-right" />
              </div>
            </Router>
          </UIProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
