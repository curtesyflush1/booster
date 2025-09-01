import { Knex } from 'knex';
import { db as knex } from '../config/database';
import { eventBusService } from './eventBusService';
import { logger } from '../utils/logger';

export interface BillingEventRecord {
  stripe_customer_id: string;
  subscription_id?: string | null;
  event_type: string;
  amount_cents?: number | null;
  currency?: string | null;
  status?: string | null;
  invoice_id?: string | null;
  occurred_at?: Date | string;
  raw_event?: any;
}

export class BillingEventService {
  private table = 'billing_events';
  private knex: Knex;

  constructor(k: Knex = knex) {
    this.knex = k;
  }

  async recordAndEmit(event: BillingEventRecord): Promise<void> {
    const row = {
      ...event,
      occurred_at: event.occurred_at ? new Date(event.occurred_at) : new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    } as any;
    await this.knex(this.table).insert(row);
    await eventBusService.emit('billing_event', row);
  }
}

export const billingEventService = new BillingEventService();

