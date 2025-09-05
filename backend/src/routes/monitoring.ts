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
import { getPurchaseMetrics, getPrecisionAtK, getCrawlConfig, setCrawlConfig } from '../controllers/monitoringController';
import { trainDropClassifierNow, runUrlCandidateCheckBatch, runSmokeTests } from '../controllers/monitoringController';

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
router.get('/drop-metrics', authenticate, requireAdmin, getDropMetrics);
router.get('/drop-budgets', authenticate, requireAdmin, getDropBudgets);
router.put('/drop-budgets', authenticate, requireAdmin, setDropBudgets);
router.get('/drop-classifier', authenticate, requireAdmin, getDropClassifierStatus);
router.get('/drop-classifier/flags', authenticate, requireAdmin, getDropClassifierFlags);
router.put('/drop-classifier/flags', authenticate, requireAdmin, setDropClassifierFlags);
router.get('/drop-timeseries', authenticate, requireAdmin, getDropTimeSeries);
router.get('/drop-live-summary', authenticate, requireAdmin, getDropLiveSummary);
router.get('/purchase-metrics', authenticate, requireAdmin, getPurchaseMetrics);
router.get('/precision', authenticate, requireAdmin, getPrecisionAtK);
router.get('/crawl-config', authenticate, requireAdmin, getCrawlConfig);
router.put('/crawl-config', authenticate, requireAdmin, setCrawlConfig);
router.post('/drop-classifier/train', authenticate, requireAdmin, trainDropClassifierNow);
router.post('/url-candidates/check', authenticate, requireAdmin, runUrlCandidateCheckBatch);
router.post('/smoke-tests', authenticate, requireAdmin, runSmokeTests);

export default router;
