import { Request, Response } from 'express';
import { CronService } from '../services/CronService';
import { logger } from '../utils/logger';

export class SchedulerController {
  getStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
      const status = CronService.getStatus();
      res.json({
        jobs: status,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get scheduler status', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: 'Failed to get scheduler status' });
    }
  };
}

