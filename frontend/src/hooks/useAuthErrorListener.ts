import { useEffect } from 'react';

/**
 * Custom hook for listening to authentication errors
 */
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