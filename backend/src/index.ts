import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { generalRateLimit } from './middleware/rateLimiter';
import { initializeWebSocketService } from './services/websocketService';
import { DataCollectionService } from './services/dataCollectionService';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import watchRoutes from './routes/watches';
import retailerRoutes from './routes/retailers';
import notificationRoutes from './routes/notifications';
import emailRoutes from './routes/emailRoutes';
import dashboardRoutes from './routes/dashboard';
import alertRoutes from './routes/alerts';
import subscriptionRoutes from './routes/subscription';
import mlRoutes from './routes/mlRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for WebSocket support
const server = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Apply general rate limiting to all routes
app.use(generalRateLimit);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.get('/api/v1/status', (_req: Request, res: Response) => {
  res.json({
    message: 'BoosterBeacon API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// User management routes
app.use('/api/users', userRoutes);

// Product catalog routes
app.use('/api/products', productRoutes);

// Watch management routes
app.use('/api/watches', watchRoutes);

// Retailer integration routes
app.use('/api/retailers', retailerRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Email management routes
app.use('/api/email', emailRoutes);

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// Alert management routes
app.use('/api/alerts', alertRoutes);

// Subscription and billing routes
app.use('/api/subscription', subscriptionRoutes);

// Machine learning and prediction routes
app.use('/api/ml', mlRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      timestamp: new Date().toISOString()
    }
  });
});

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Initialize WebSocket service
  const websocketService = initializeWebSocketService(server);
  
  // Initialize ML data collection service
  DataCollectionService.scheduleDataCollection();
  
  server.listen(PORT, () => {
    logger.info(`BoosterBeacon API server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info('WebSocket service initialized');
    logger.info('ML data collection service scheduled');
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    logger.info('Shutting down gracefully');
    
    // Shutdown WebSocket service first
    await websocketService.shutdown();
    
    // Close HTTP server
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

export default app;