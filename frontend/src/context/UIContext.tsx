import React, { createContext, useContext, useReducer, ReactNode } from 'react';

interface UIState {
  isMobileMenuOpen: boolean;
  isUserMenuOpen: boolean;
  notifications: Notification[];
  theme: 'light' | 'dark' | 'system';
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

interface UIContextType extends UIState {
  toggleMobileMenu: () => void;
  toggleUserMenu: () => void;
  closeAllMenus: () => void;
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const initialState: UIState = {
  isMobileMenuOpen: false,
  isUserMenuOpen: false,
  notifications: [],
  theme: 'system'
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

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const toggleMobileMenu = () => dispatch({ type: 'TOGGLE_MOBILE_MENU' });
  const toggleUserMenu = () => dispatch({ type: 'TOGGLE_USER_MENU' });
  const closeAllMenus = () => dispatch({ type: 'CLOSE_ALL_MENUS' });
  
  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    const fullNotification = { ...notification, id };
    
    dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });
    
    // Auto-remove notification after duration
    const duration = notification.duration || 5000;
    setTimeout(() => {
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
    }, duration);
  };

  const removeNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    dispatch({ type: 'SET_THEME', payload: theme });
    localStorage.setItem('theme', theme);
  };

  const contextValue: UIContextType = {
    ...state,
    toggleMobileMenu,
    toggleUserMenu,
    closeAllMenus,
    addNotification,
    removeNotification,
    setTheme
  };

  return (
    <UIContext.Provider value={contextValue}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};