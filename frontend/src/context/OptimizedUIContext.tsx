import React, { createContext, useContext, useReducer, ReactNode, useCallback, useMemo } from 'react';

// UI State Interface (Read-only state)
interface UIState {
  isMobileMenuOpen: boolean;
  isUserMenuOpen: boolean;
  notifications: Notification[];
  theme: 'light' | 'dark' | 'system';
}

// UI Actions Interface (Actions only)
interface UIActions {
  toggleMobileMenu: () => void;
  toggleUserMenu: () => void;
  closeAllMenus: () => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

type UIAction =
  | { type: 'TOGGLE_MOBILE_MENU' }
  | { type: 'TOGGLE_USER_MENU' }
  | { type: 'CLOSE_ALL_MENUS' }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' };

const initialState: UIState = {
  isMobileMenuOpen: false,
  isUserMenuOpen: false,
  notifications: [],
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system'
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'TOGGLE_MOBILE_MENU':
      return {
        ...state,
        isMobileMenuOpen: !state.isMobileMenuOpen,
        isUserMenuOpen: false
      };

    case 'TOGGLE_USER_MENU':
      return {
        ...state,
        isUserMenuOpen: !state.isUserMenuOpen,
        isMobileMenuOpen: false
      };

    case 'CLOSE_ALL_MENUS':
      return {
        ...state,
        isMobileMenuOpen: false,
        isUserMenuOpen: false
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload]
      };

    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };

    case 'SET_THEME':
      return {
        ...state,
        theme: action.payload
      };

    default:
      return state;
  }
}

// Create Separate Contexts for State and Actions
const UIStateContext = createContext<UIState | undefined>(undefined);
const UIActionsContext = createContext<UIActions | undefined>(undefined);

interface UIProviderProps {
  children: ReactNode;
}

export const OptimizedUIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  // Memoized action creators
  const toggleMobileMenu = useCallback(() => {
    dispatch({ type: 'TOGGLE_MOBILE_MENU' });
  }, []);

  const toggleUserMenu = useCallback(() => {
    dispatch({ type: 'TOGGLE_USER_MENU' });
  }, []);

  const closeAllMenus = useCallback(() => {
    dispatch({ type: 'CLOSE_ALL_MENUS' });
  }, []);
  
  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const fullNotification = { ...notification, id };
    
    dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });
    
    // Auto-remove notification after duration
    const duration = notification.duration || 5000;
    setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
    }, duration);
  }, []);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    dispatch({ type: 'SET_THEME', payload: theme });
    localStorage.setItem('theme', theme);
  }, []);

  // Memoize state and actions separately
  const stateValue = useMemo(() => state, [state]);
  
  const actionsValue = useMemo(() => ({
    toggleMobileMenu,
    toggleUserMenu,
    closeAllMenus,
    addNotification,
    removeNotification,
    setTheme
  }), [toggleMobileMenu, toggleUserMenu, closeAllMenus, addNotification, removeNotification, setTheme]);

  return (
    <UIStateContext.Provider value={stateValue}>
      <UIActionsContext.Provider value={actionsValue}>
        {children}
      </UIActionsContext.Provider>
    </UIStateContext.Provider>
  );
};

// Optimized hooks for selective consumption
export const useUIState = (): UIState => {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within an OptimizedUIProvider');
  }
  return context;
};

export const useUIActions = (): UIActions => {
  const context = useContext(UIActionsContext);
  if (context === undefined) {
    throw new Error('useUIActions must be used within an OptimizedUIProvider');
  }
  return context;
};

// Convenience hook that combines both (use sparingly)
export const useUI = (): UIState & UIActions => {
  const state = useUIState();
  const actions = useUIActions();
  
  return useMemo(() => ({
    ...state,
    ...actions,
  }), [state, actions]);
};

// Specialized hooks for common use cases
export const useMenuState = () => {
  const { isMobileMenuOpen, isUserMenuOpen } = useUIState();
  return useMemo(() => ({
    isMobileMenuOpen,
    isUserMenuOpen,
    hasOpenMenu: isMobileMenuOpen || isUserMenuOpen
  }), [isMobileMenuOpen, isUserMenuOpen]);
};

export const useMenuActions = () => {
  const { toggleMobileMenu, toggleUserMenu, closeAllMenus } = useUIActions();
  return useMemo(() => ({
    toggleMobileMenu,
    toggleUserMenu,
    closeAllMenus
  }), [toggleMobileMenu, toggleUserMenu, closeAllMenus]);
};

export const useNotifications = () => {
  const { notifications } = useUIState();
  const { addNotification, removeNotification } = useUIActions();
  
  return useMemo(() => ({
    notifications,
    addNotification,
    removeNotification,
    hasNotifications: notifications.length > 0
  }), [notifications, addNotification, removeNotification]);
};

export const useTheme = () => {
  const { theme } = useUIState();
  const { setTheme } = useUIActions();
  
  return useMemo(() => ({
    theme,
    setTheme,
    isDark: theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  }), [theme, setTheme]);
};

export default OptimizedUIProvider;