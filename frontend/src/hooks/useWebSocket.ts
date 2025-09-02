import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (event: string, data?: Record<string, unknown>) => void;
  subscribe: (event: string) => void;
  unsubscribe: (event: string) => void;
  connectionError: string | null;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!user || socketRef.current?.connected) {
      return;
    }

    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) {
      setConnectionError('No authentication token available');
      return;
    }

    try {
      const fallbackBase = `${window.location.protocol}//${window.location.hostname}:3000`;
      const baseUrl = import.meta.env.VITE_API_URL || fallbackBase;
      const socket = io(baseUrl, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      socketRef.current = socket;

      // Connection event handlers
      socket.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        // Subscribe to dashboard updates by default
        socket.emit('subscribe:dashboard');
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, try to reconnect
          attemptReconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setConnectionError(error.message);
        setIsConnected(false);
        attemptReconnect();
      });

      // Message handlers
      socket.on('dashboard:update', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('dashboard:alert', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('alert:new', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('insights:update', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('portfolio:update', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('product:update', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('watch:update', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('system:announcement', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      socket.on('retailer:status', (message: WebSocketMessage) => {
        setLastMessage(message);
      });

      // Ping/pong for connection health
      socket.on('pong', (data) => {
        console.log('WebSocket pong received:', data);
      });

      // Send periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 30000); // Ping every 30 seconds

      // Cleanup ping interval on disconnect
      socket.on('disconnect', () => {
        clearInterval(pingInterval);
      });

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to establish connection');
    }
  }, [user]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setConnectionError('Maximum reconnection attempts reached');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000); // Exponential backoff, max 30s
    
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttempts.current++;
      console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})`);
      connect();
    }, delay);
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    setLastMessage(null);
    setConnectionError(null);
  }, []);

  const sendMessage = useCallback((event: string, data?: Record<string, unknown>) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }, []);

  const subscribe = useCallback((event: string) => {
    sendMessage(`subscribe:${event}`);
  }, [sendMessage]);

  const unsubscribe = useCallback((event: string) => {
    sendMessage(`unsubscribe:${event}`);
  }, [sendMessage]);

  // Connect when user is available
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Handle page visibility changes to manage connection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, we can keep the connection but reduce activity
        console.log('Page hidden, maintaining WebSocket connection');
      } else {
        // Page is visible, ensure connection is active
        if (user && !socketRef.current?.connected) {
          console.log('Page visible, reconnecting WebSocket');
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, connect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe,
    connectionError
  };
};
