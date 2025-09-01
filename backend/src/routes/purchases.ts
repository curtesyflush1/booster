import express from 'express';
import Joi from 'joi';
import { authenticate } from '../middleware/auth';
import { transactionService } from '../services/transactionService';
import { hashSensitiveData } from '../utils/encryption';

const router = express.Router();

const reportSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  retailerSlug: Joi.string().min(1).max(100).required(),
  pricePaid: Joi.number().min(0).required(),
  qty: Joi.number().integer().min(1).max(10).default(1),
  alertAt: Joi.date().iso().optional(),
});

router.post('/report', authenticate, async (req, res) => {
  const { error, value } = reportSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.details?.[0]?.message || 'Validation failed',
        timestamp: new Date().toISOString(),
      }
    });
  }

  const salt = process.env.TRANSACTION_HASH_SALT || 'dev-transaction-salt';
  const userIdHash = hashSensitiveData(req.user!.id, salt);

  await transactionService.recordPurchaseSuccess({
    product_id: value.productId,
    retailer_slug: value.retailerSlug,
    user_id_hash: userIdHash,
    price_paid: value.pricePaid,
    qty: value.qty,
    alert_at: value.alertAt,
  });

  return res.json({ data: { recorded: true } });
});

export default router;

