import { Router } from 'express';
import { SchedulerController } from '../controllers/schedulerController';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';

const router = Router();
const controller = new SchedulerController();

// Protect scheduler status (admin access recommended; using authenticate for now)
router.use(authenticate, requireAdmin);

router.get('/status', controller.getStatus);

export default router;
