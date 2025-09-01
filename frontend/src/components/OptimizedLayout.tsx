import React, { memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { NavigationItem, UserMenu } from './layout';
import {
  Home,
  Search,
  Eye,
  Bell,
  Menu,
  X,
  Zap,
  Crown
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}



const OptimizedLayout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const {
    isMobileMenuOpen,
    isUserMenuOpen,
    toggleMobileMenu,
    toggleUserMenu,
    closeAllMenus
  } = useUI();
  const location = useLocation();

  // Memoize navigation items to prevent recreation on every render
  const navigationItems = useMemo(() => [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Products', href: '/products', icon: Search },
    { name: 'Watches', href: '/watches', icon: Eye },
    { name: 'Alerts', href: '/alerts', icon: Bell },
  ], []);

  // Memoize subscription badge to prevent unnecessary re-renders
  const subscriptionBadge = useMemo(() => {
    if (user?.subscriptionTier !== 'pro') return null;
    
    return (
      <div className="hidden sm:flex items-center space-x-1 bg-pokemon-electric text-background-primary px-2 py-1 rounded-full text-xs font-medium">
        <Crown className="w-3 h-3" />
        <span>Pro</span>
      </div>
    );
  }, [user?.subscriptionTier]);

  // Memoize active path check
  const isActivePath = useMemo(() =>
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  const handleLogout = async () => {
    try {
      closeAllMenus(); // Close menus immediately for better UX
      await logout();
      // Navigation will be handled by auth context
    } catch (error) {
      console.error('Logout failed:', error);
      // Could add toast notification here for error feedback
    }
  };

  return (
    <div className="min-h-screen bg-background-primary">
      {/* Header */}
      <header className="bg-background-secondary border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="flex items-center space-x-2">
                <div className="w-8 h-8 gradient-pokemon rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-display font-bold text-white">
                  BoosterBeacon
                </span>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-1 ml-8">
                {navigationItems.map((item) => (
                  <NavigationItem
                    key={item.name}
                    item={item}
                    isActive={isActivePath(item.href)}
                  />
                ))}
              </nav>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Subscription Badge */}
              {subscriptionBadge}

              {/* Header Links */}
              <Link to="/pricing" className="hidden sm:block text-sm text-gray-300 hover:text-white transition-colors">Pricing</Link>
              <Link to="/contact" className="hidden sm:block text-sm text-gray-300 hover:text-white transition-colors">Contact</Link>

              {/* User Menu */}
              {user ? (
                <UserMenu
                  user={user}
                  isOpen={isUserMenuOpen}
                  onToggle={toggleUserMenu}
                  onLogout={handleLogout}
                />
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    to="/login"
                    className="text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary text-sm"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={toggleMobileMenu}
                className="md:hidden text-gray-300 hover:text-white transition-colors"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-background-secondary border-t border-gray-700">
            <nav className="px-4 py-2 space-y-1" role="navigation" aria-label="Mobile navigation">
              {navigationItems.map((item) => (
                <NavigationItem
                  key={item.name}
                  item={item}
                  isActive={isActivePath(item.href)}
                  onClick={closeAllMenus}
                />
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Click outside to close menus */}
      {(isMobileMenuOpen || isUserMenuOpen) && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={closeAllMenus}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              closeAllMenus();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}
    </div>
  );
};

export default memo(OptimizedLayout);
