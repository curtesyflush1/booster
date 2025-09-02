import { Knex } from 'knex';
import { db as knex } from '../config/database';
import { eventBusService } from './eventBusService';
import { logger } from '../utils/logger';

export type TransactionStatus = 'attempted' | 'carted' | 'purchased' | 'failed';

export interface BaseTransactionEvent {
  product_id: string;
  retailer_slug: string;
  user_id_hash: string;
  rule_id?: string;
  qty?: number;
  msrp?: number;
  region?: string;
  session_fingerprint?: string;
  alert_at?: Date | string | null;
}

export interface AttemptEvent extends BaseTransactionEvent {
  status?: TransactionStatus; // will be set to 'attempted'
}

export interface SuccessEvent extends BaseTransactionEvent {
  price_paid: number;
  added_to_cart_at?: Date | string | null;
  purchased_at?: Date | string | null;
}

export interface FailureEvent extends BaseTransactionEvent {
  failure_reason: string;
}

export class TransactionService {
  private table = 'transactions';
  private knex: Knex;

  constructor(k: Knex = knex) {
    this.knex = k;
  }

  async recordPurchaseAttempt(event: AttemptEvent): Promise<string | null> {
    const row = {
      ...event,
      status: 'attempted' as TransactionStatus,
      qty: event.qty ?? 1,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    await this.knex(this.table).insert(row);
    await eventBusService.emit('purchase_attempt', row);
    return row.id || null;
  }

  async recordPurchaseSuccess(event: SuccessEvent): Promise<string | null> {
    const purchased_at = event.purchased_at ? new Date(event.purchased_at) : new Date();
    const alertAt = event.alert_at ? new Date(event.alert_at) : undefined;
    const lead_time_ms = alertAt ? purchased_at.getTime() - alertAt.getTime() : null;

    const row = {
      ...event,
      status: 'purchased' as TransactionStatus,
      qty: event.qty ?? 1,
      purchased_at,
      lead_time_ms,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    await this.knex(this.table).insert(row);
    await eventBusService.emit('purchase_success', row);
    return row.id || null;
  }

  async recordPurchaseFailure(event: FailureEvent): Promise<string | null> {
    const row = {
      ...event,
      status: 'failed' as TransactionStatus,
      qty: event.qty ?? 1,
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    await this.knex(this.table).insert(row);
    await eventBusService.emit('purchase_failure', row);
    return row.id || null;
  }

  async getRecentTransactions(limit: number = 50): Promise<any[]> {
    const n = Math.max(1, Math.min(200, Math.floor(limit)));
    return this.knex(this.table)
      .select(
        'id',
        'product_id',
        'retailer_slug',
        'status',
        'price_paid',
        'msrp',
        'qty',
        'alert_at',
        'added_to_cart_at',
        'purchased_at',
        'failure_reason',
        'region',
        'session_fingerprint',
        'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(n);
  }
}

export const transactionService = new TransactionService();
