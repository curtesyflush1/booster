import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';

export class DropOutcomeService {
  private static get db() { return BaseModel.getKnex(); }

  /**
   * Record first_seen_at when we detect a strong pre-live or live signal (e.g., url_live).
   */
  static async recordFirstSeen(product_id: string, retailer_id: string, seenAt: Date = new Date()): Promise<void> {
    try {
      // Find nearest outcome in last 48h
      const twoDaysAgo = new Date(seenAt.getTime() - 48 * 60 * 60 * 1000);
      const row = await this.db('drop_outcomes')
        .select('*')
        .where({ product_id, retailer_id })
        .andWhere('drop_at', '>=', twoDaysAgo)
        .orderBy('drop_at', 'desc')
        .first();

      if (row) {
        const firstSeen = row.first_seen_at ? new Date(row.first_seen_at) : null;
        const newFirst = firstSeen ? (seenAt < firstSeen ? seenAt : firstSeen) : seenAt;
        await this.db('drop_outcomes').where({ id: row.id }).update({
          first_seen_at: newFirst,
          drop_at: row.drop_at || newFirst,
          updated_at: new Date(),
        });
      } else {
        await this.db('drop_outcomes').insert({
          id: this.db.raw('gen_random_uuid()'),
          product_id,
          retailer_id,
          drop_at: seenAt,
          first_seen_at: seenAt,
          first_instock_at: null,
          buy_window_sec: null,
          success_flag: false,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    } catch (error) {
      logger.warn('DropOutcomeService.recordFirstSeen failed', { error: error instanceof Error ? error.message : String(error), product_id, retailer_id });
    }
  }

  /**
   * Record first_instock_at when we observe an in-stock transition.
   */
  static async recordFirstInStock(product_id: string, retailer_id: string, instockAt: Date = new Date()): Promise<void> {
    try {
      // Find the most recent outcome in the last 72h to associate
      const threeDaysAgo = new Date(instockAt.getTime() - 72 * 60 * 60 * 1000);
      const row = await this.db('drop_outcomes')
        .select('*')
        .where({ product_id, retailer_id })
        .andWhere('drop_at', '>=', threeDaysAgo)
        .orderBy('drop_at', 'desc')
        .first();

      if (row) {
        const firstSeen = row.first_seen_at ? new Date(row.first_seen_at) : instockAt;
        const firstIn = row.first_instock_at ? new Date(row.first_instock_at) : instockAt;
        const newFirstIn = firstIn < instockAt ? firstIn : instockAt;
        const buyWindow = Math.max(0, Math.floor((newFirstIn.getTime() - firstSeen.getTime()) / 1000));
        await this.db('drop_outcomes').where({ id: row.id }).update({
          first_instock_at: newFirstIn,
          buy_window_sec: buyWindow,
          updated_at: new Date(),
        });
      } else {
        await this.db('drop_outcomes').insert({
          id: this.db.raw('gen_random_uuid()'),
          product_id,
          retailer_id,
          drop_at: instockAt,
          first_seen_at: null,
          first_instock_at: instockAt,
          buy_window_sec: null,
          success_flag: false,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    } catch (error) {
      logger.warn('DropOutcomeService.recordFirstInStock failed', { error: error instanceof Error ? error.message : String(error), product_id, retailer_id });
    }
  }
}

export const dropOutcomeService = DropOutcomeService;

