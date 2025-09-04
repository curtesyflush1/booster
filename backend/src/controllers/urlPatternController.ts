import { Request, Response } from 'express';
import { urlPatternService } from '../services/URLPatternService';
import { successResponse, errorResponse } from '../utils/responseHelpers';
import { logger } from '../utils/logger';

export class URLPatternController {
  static async getCandidates(req: Request, res: Response): Promise<void> {
    try {
      const { product_id, retailer, sku, upc, name, set_name } = req.query as Record<string, string>;

      if (!product_id || !retailer) {
        errorResponse(res, 400, 'product_id and retailer are required');
        return;
      }

      const candidates = await urlPatternService.generateCandidates({
        productId: product_id,
        retailerSlug: retailer,
        sku,
        upc,
        name,
        setName: set_name,
      });

      successResponse(res, { retailer, count: candidates.length, candidates });
    } catch (error) {
      logger.error('Failed to generate URL candidates', { error: error instanceof Error ? error.message : String(error) });
      errorResponse(res, 500, 'Failed to generate URL candidates');
    }
  }

  static async listCandidates(req: Request, res: Response): Promise<void> {
    try {
      const { product_id, retailer, status, limit } = req.query as Record<string, string>;
      const knex = (await import('../models/BaseModel')).BaseModel.getKnex();

      let retailerId: string | undefined;
      if (retailer) {
        // Accept slug or UUID
        const byId = await knex('retailers').select('id').where('id', retailer).first();
        if (byId) retailerId = byId.id;
        else {
          const bySlug = await knex('retailers').select('id').where('slug', retailer).first();
          if (bySlug) retailerId = bySlug.id;
        }
      }

      let q = knex('url_candidates')
        .select('id', 'product_id', 'retailer_id', 'pattern_id', 'url', 'status', 'score', 'reason', 'first_seen_at', 'last_checked_at', 'updated_at')
        .orderBy('updated_at', 'desc');

      if (product_id) q = q.where('product_id', product_id);
      if (retailerId) q = q.where('retailer_id', retailerId);
      if (status) q = q.where('status', status);
      const max = Math.min(parseInt(limit || '50', 10) || 50, 200);
      q = q.limit(max);

      const rows = await q;

      const summary = rows.reduce((acc: Record<string, number>, r: any) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {});

      successResponse(res, { count: rows.length, summary, rows });
    } catch (error) {
      logger.error('Failed to list URL candidates', { error: error instanceof Error ? error.message : String(error) });
      errorResponse(res, 500, 'Failed to list URL candidates');
    }
  }
}
