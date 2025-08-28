import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { logger, loggerWithContext } from './utils/logger';
import { correlationIdMiddleware } from './middleware/correlationId';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { generalRateLimit } from './middleware/rateLimiter';
import { initializeWebSocketService } from './services/websocketService';
import { DataCollectionService } from './services/dataCollectionService';
import { AdminSystemService } from './services/adminSystemService';
import { backupService } from './services/backupService';
import { monitoringService } from './services/monitoringService';

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
import adminRoutes from './routes/admin';
import discordRoutes from './routes/discord';
import webhookRoutes from './routes/webhooks';
import csvRoutes from './routes/csv';
import socialRoutes from './routes/social';
import communityRoutes from './routes/community';
import priceComparisonRoutes from './routes/priceComparisonRoutes';
import sitemapRoutes from './routes/sitemapRoutes';
import healthRoutes from './routes/health';
import monitoringRoutes from './routes/monitoring';

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

// Correlation ID middleware (must be before request logging)
app.use(correlationIdMiddleware);

// Request logging
app.use(requestLogger);

// Apply general rate limiting to all routes
app.use(generalRateLimit);

// Health check routes
app.use('/health', healthRoutes);

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

// Admin management routes
app.use('/api/admin', adminRoutes);

// Discord bot integration routes
app.use('/api/discord', discordRoutes);

// Webhook system routes
app.use('/api/webhooks', webhookRoutes);

// CSV import/export routes
app.use('/api/csv', csvRoutes);

// Social sharing routes
app.use('/api/social', socialRoutes);

// Community features routes
app.use('/api/community', communityRoutes);

// Price comparison routes
app.use('/api/price-comparison', priceComparisonRoutes);

// SEO and sitemap routes
app.use('/', sitemapRoutes);

// Monitoring and metrics routes
app.use('/api/monitoring', monitoringRoutes);

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
  
  // Start system monitoring
  AdminSystemService.startSystemMonitoring();
  
  // Schedule automatic backups
  backupService.scheduleAutomaticBackups();
  
  // Initialize monitoring service
  monitoringService.on('alert', (alert) => {
    loggerWithContext.warn('System alert fired', {
      alertId: alert.id,
      ruleName: alert.ruleName,
      severity: alert.severity,
      value: alert.value,
      threshold: alert.threshold
    });
  });
  
  monitoringService.on('alertResolved', (alert) => {
    loggerWithContext.info('System alert resolved', {
      alertId: alert.id,
      ruleName: alert.ruleName,
      duration: alert.endsAt ? alert.endsAt.getTime() - alert.startsAt.getTime() : 0
    });
  });
  
  server.listen(PORT, () => {
    loggerWithContext.info(`BoosterBeacon API server running on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0'
    });
    loggerWithContext.info('WebSocket service initialized');
    loggerWithContext.info('ML data collection service scheduled');
    loggerWithContext.info('System monitoring started');
    loggerWithContext.info('Automatic backup service scheduled');
    loggerWithContext.info('Monitoring and alerting service initialized');
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    loggerWithContext.info('Shutting down gracefully');
    
    // Shutdown WebSocket service first
    await websocketService.shutdown();
    
    // Close HTTP server
    server.close(() => {
      loggerWithContext.info('Process terminated');
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

export default app;