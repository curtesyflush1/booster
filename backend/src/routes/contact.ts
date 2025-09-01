import express from 'express';
import Joi from 'joi';
import { createRateLimit } from '../middleware/rateLimiter';
import { EmailService } from '../services/notifications/emailService';
import { logger } from '../utils/logger';

const router = express.Router();

const contactSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().required(),
  subject: Joi.string().min(3).max(150).required(),
  message: Joi.string().min(10).max(5000).required(),
});

const rl = createRateLimit({ windowMs: 60_000, maxRequests: 10, message: 'Too many requests' });

router.post('/', rl, async (req, res) => {
  try {
    const { error, value } = contactSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details?.[0]?.message || 'Validation failed',
          timestamp: new Date().toISOString(),
        }
      });
    }

    const result = await EmailService.sendContactEmail(value);
    if (!result.success) {
      return res.status(500).json({
        error: {
          code: 'EMAIL_SEND_FAILED',
          message: result.error || 'Failed to send message',
          timestamp: new Date().toISOString(),
        }
      });
    }

    return res.status(200).json({ data: { ok: true } });
  } catch (err) {
    logger.error('Contact form send failed', { error: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send message',
        timestamp: new Date().toISOString(),
      }
    });
  }
});

export default router;

