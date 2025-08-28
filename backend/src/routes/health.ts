import { Router } from 'express';
import {
  basicHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
  systemMetrics
} from '../controllers/healthController';

const router = Router();

/**
 * Health check routes
 */

// Basic health check - lightweight endpoint for load balancers
router.get('/', basicHealthCheck);

// Detailed health check - comprehensive system status
router.get('/detailed', detailedHealthCheck);

// Kubernetes/Docker readiness probe
router.get('/ready', readinessCheck);

// Kubernetes/Docker liveness probe  
router.get('/live', livenessCheck);

// System metrics endpoint
router.get('/metrics', systemMetrics);

export default router;