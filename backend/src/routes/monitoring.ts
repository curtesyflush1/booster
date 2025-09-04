import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { sanitizeParameters } from '../middleware/parameterSanitization';
import { validateBody, monitoringSchemas } from '../validators';
import { 
  getMetrics,
  recordMetric,
  getAlertRules,
  createAlertRule,
  deleteAlertRule,
  getActiveAlerts,
  getAlertHistory,
  getDashboardData,
  getDropMetrics,
  getDropBudgets,
  setDropBudgets,
  getDropClassifierStatus,
  getDropClassifierFlags,
  setDropClassifierFlags,
  getDropTimeSeries,
  getDropLiveSummary
} from '../controllers/monitoringController';

const router = Router();

/**
 * Monitoring routes
 * All routes require authentication, admin routes require admin privileges
 */

// Metrics endpoints
router.get('/metrics', authenticate, getMetrics);
router.post('/metrics', authenticate, recordMetric);

// Alert rule management (admin only)
router.get('/alerts/rules', requireAdmin, getAlertRules);
router.post('/alerts/rules', requireAdmin, validateBody(monitoringSchemas.addAlertRule), createAlertRule);
router.delete('/alerts/rules/:ruleId', sanitizeParameters, requireAdmin, deleteAlertRule);

// Alert viewing (authenticated users)
router.get('/alerts/active', authenticate, getActiveAlerts);
router.get('/alerts/history', authenticate, getAlertHistory);

// Dashboard data
router.get('/dashboard', authenticate, getDashboardData);

// Drop metrics (admin)
router.get('/drop-metrics', requireAdmin, getDropMetrics);
router.get('/drop-budgets', requireAdmin, getDropBudgets);
router.put('/drop-budgets', requireAdmin, setDropBudgets);
router.get('/drop-classifier', requireAdmin, getDropClassifierStatus);
router.get('/drop-classifier/flags', requireAdmin, getDropClassifierFlags);
router.put('/drop-classifier/flags', requireAdmin, setDropClassifierFlags);
router.get('/drop-timeseries', requireAdmin, getDropTimeSeries);
router.get('/drop-live-summary', requireAdmin, getDropLiveSummary);

export default router;
