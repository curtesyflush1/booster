import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { User } from '../models/User';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.userId);
        
        if (!user) {
          return next(new Error('User not found'));
        }

        (socket as AuthenticatedSocket).userId = user.id;
        (socket as AuthenticatedSocket).user = user;
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { error: error instanceof Error ? error.message : 'Unknown error' });
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('User connected to WebSocket', { 
        userId: socket.userId, 
        socketId: socket.id 
      });

      // Track connected user
      if (socket.userId) {
        if (!this.connectedUsers.has(socket.userId)) {
          this.connectedUsers.set(socket.userId, new Set());
        }
        this.connectedUsers.get(socket.userId)!.add(socket.id);

        // Join user-specific room
        socket.join(`user:${socket.userId}`);
      }

      // Handle dashboard subscription
      socket.on('subscribe:dashboard', () => {
        if (socket.userId) {
          socket.join(`dashboard:${socket.userId}`);
          logger.debug('User subscribed to dashboard updates', { userId: socket.userId });
        }
      });

      // Handle unsubscribe from dashboard
      socket.on('unsubscribe:dashboard', () => {
        if (socket.userId) {
          socket.leave(`dashboard:${socket.userId}`);
          logger.debug('User unsubscribed from dashboard updates', { userId: socket.userId });
        }
      });

      // Handle product watch subscription
      socket.on('subscribe:product', (productId: string) => {
        if (socket.userId && productId) {
          socket.join(`product:${productId}`);
          logger.debug('User subscribed to product updates', { 
            userId: socket.userId, 
            productId 
          });
        }
      });

      // Handle product watch unsubscription
      socket.on('unsubscribe:product', (productId: string) => {
        if (socket.userId && productId) {
          socket.leave(`product:${productId}`);
          logger.debug('User unsubscribed from product updates', { 
            userId: socket.userId, 
            productId 
          });
        }
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        logger.info('User disconnected from WebSocket', { 
          userId: socket.userId, 
          socketId: socket.id, 
          reason 
        });

        // Remove from connected users tracking
        if (socket.userId) {
          const userSockets = this.connectedUsers.get(socket.userId);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              this.connectedUsers.delete(socket.userId);
            }
          }
        }
      });
    });
  }

  /**
   * Send dashboard update to a specific user
   */
  public sendDashboardUpdate(userId: string, data: any): void {
    this.io.to(`dashboard:${userId}`).emit('dashboard:update', {
      type: 'dashboard_update',
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send new alert notification to a user
   */
  public sendAlertNotification(userId: string, alert: any): void {
    this.io.to(`user:${userId}`).emit('alert:new', {
      type: 'new_alert',
      alert,
      timestamp: new Date().toISOString()
    });

    // Also send to dashboard if user is subscribed
    this.io.to(`dashboard:${userId}`).emit('dashboard:alert', {
      type: 'dashboard_alert',
      alert,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send product availability update
   */
  public sendProductUpdate(productId: string, data: any): void {
    this.io.to(`product:${productId}`).emit('product:update', {
      type: 'product_update',
      productId,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send watch status update to a user
   */
  public sendWatchUpdate(userId: string, watchData: any): void {
    this.io.to(`user:${userId}`).emit('watch:update', {
      type: 'watch_update',
      watch: watchData,
      timestamp: new Date().toISOString()
    });

    // Also send to dashboard
    this.sendDashboardUpdate(userId, {
      type: 'watch_update',
      watch: watchData
    });
  }

  /**
   * Send predictive insights update
   */
  public sendInsightsUpdate(userId: string, insights: any): void {
    this.io.to(`dashboard:${userId}`).emit('insights:update', {
      type: 'insights_update',
      insights,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send portfolio update to a user
   */
  public sendPortfolioUpdate(userId: string, portfolioData: any): void {
    this.io.to(`dashboard:${userId}`).emit('portfolio:update', {
      type: 'portfolio_update',
      portfolio: portfolioData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast system-wide announcement
   */
  public broadcastAnnouncement(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.io.emit('system:announcement', {
      type: 'system_announcement',
      message,
      level: type,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send retailer status update to all connected users
   */
  public broadcastRetailerStatus(retailerId: string, status: any): void {
    this.io.emit('retailer:status', {
      type: 'retailer_status',
      retailerId,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get connected sockets count for a user
   */
  public getUserConnectionCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Get service health information
   */
  public getHealthInfo(): {
    connectedUsers: number;
    totalConnections: number;
    rooms: string[];
  } {
    const totalConnections = Array.from(this.connectedUsers.values())
      .reduce((sum, sockets) => sum + sockets.size, 0);

    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections,
      rooms: Array.from(this.io.sockets.adapter.rooms.keys())
    };
  }

  /**
   * Gracefully shutdown WebSocket service
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket service');
    
    // Notify all connected clients
    this.broadcastAnnouncement('Server is shutting down for maintenance', 'warning');
    
    // Wait a moment for the message to be sent
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close all connections
    this.io.close();
    
    logger.info('WebSocket service shutdown complete');
  }
}

// Export singleton instance
let websocketService: WebSocketService | null = null;

export const initializeWebSocketService = (server: HTTPServer): WebSocketService => {
  if (!websocketService) {
    websocketService = new WebSocketService(server);
  }
  return websocketService;
};

export const getWebSocketService = (): WebSocketService | null => {
  return websocketService;
};