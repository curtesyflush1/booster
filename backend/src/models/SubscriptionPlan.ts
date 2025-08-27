import { BaseModel } from './BaseModel';
import { logger } from '../utils/logger';
import { IValidationError } from '../types/database';

export interface ISubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  billing_period: 'monthly' | 'yearly';
  stripe_price_id?: string;
  features: string[];
  limits: {
    max_watches: number | null;
    max_alerts_per_day: number | null;
    api_rate_limit: number | null;
  };
  is_active: boolean;
  trial_days: number;
  created_at: Date;
  updated_at: Date;
}

export interface ISubscriptionPlanInput {
  name: string;
  slug: string;
  description?: string;
  price: number;
  billing_period: 'monthly' | 'yearly';
  stripe_price_id?: string;
  features?: string[];
  limits?: {
    max_watches?: number | null;
    max_alerts_per_day?: number | null;
    api_rate_limit?: number | null;
  };
  is_active?: boolean;
  trial_days?: number;
}

export class SubscriptionPlan extends BaseModel<ISubscriptionPlan> {
  protected static override tableName = 'subscription_plans';

  /**
   * Validation rules for subscription plan data
   */
  override validate(data: Partial<ISubscriptionPlan>): IValidationError[] {
    const errors: IValidationError[] = [];

    if (data.name !== undefined) {
      const nameError = BaseModel.validateRequired(data.name, 'name');
      if (nameError) {
        errors.push(nameError);
      } else {
        const lengthError = BaseModel.validateLength(data.name, 'name', 1, 100);
        if (lengthError) errors.push(lengthError);
      }
    }

    if (data.slug !== undefined) {
      const slugError = BaseModel.validateRequired(data.slug, 'slug');
      if (slugError) {
        errors.push(slugError);
      } else {
        if (!/^[a-z0-9-]+$/.test(data.slug)) {
          errors.push({
            field: 'slug',
            message: 'Plan slug must contain only lowercase letters, numbers, and hyphens',
            value: data.slug
          });
        }
        const lengthError = BaseModel.validateLength(data.slug, 'slug', 1, 50);
        if (lengthError) errors.push(lengthError);
      }
    }

    if (data.price !== undefined) {
      const priceError = BaseModel.validateNumeric(data.price, 'price', 0);
      if (priceError) errors.push(priceError);
    }

    if (data.billing_period !== undefined) {
      const periodError = BaseModel.validateEnum(data.billing_period, 'billing_period', ['monthly', 'yearly']);
      if (periodError) errors.push(periodError);
    }

    if (data.trial_days !== undefined) {
      const trialError = BaseModel.validateNumeric(data.trial_days, 'trial_days', 0);
      if (trialError) errors.push(trialError);
    }

    return errors;
  }

  /**
   * Sanitize subscription plan data
   */
  sanitize(data: Partial<ISubscriptionPlan>): Partial<ISubscriptionPlan> {
    const sanitized: Partial<ISubscriptionPlan> = {};

    if (data.name !== undefined) {
      sanitized.name = data.name.trim();
    }

    if (data.slug !== undefined) {
      sanitized.slug = data.slug.toLowerCase().trim();
    }

    if (data.description !== undefined) {
      const trimmed = data.description?.trim();
      sanitized.description = trimmed || undefined;
    }

    if (data.price !== undefined) {
      sanitized.price = Math.round(data.price * 100) / 100; // Round to 2 decimal places
    }

    if (data.billing_period !== undefined) {
      sanitized.billing_period = data.billing_period;
    }

    if (data.stripe_price_id !== undefined) {
      const trimmed = data.stripe_price_id?.trim();
      sanitized.stripe_price_id = trimmed || undefined;
    }

    if (data.features !== undefined) {
      sanitized.features = Array.isArray(data.features) ? data.features : [];
    }

    if (data.limits !== undefined) {
      sanitized.limits = {
        max_watches: data.limits?.max_watches || null,
        max_alerts_per_day: data.limits?.max_alerts_per_day || null,
        api_rate_limit: data.limits?.api_rate_limit || null
      };
    }

    if (data.is_active !== undefined) {
      sanitized.is_active = Boolean(data.is_active);
    }

    if (data.trial_days !== undefined) {
      sanitized.trial_days = Math.max(0, Math.floor(data.trial_days));
    }

    return sanitized;
  }

  /**
   * Get all active subscription plans
   */
  static async getActivePlans(): Promise<ISubscriptionPlan[]> {
    try {
      const plans = await this.db(this.tableName)
        .where('is_active', true)
        .orderBy('price', 'asc');

      return plans.map(plan => ({
        ...plan,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
        limits: typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
      }));
    } catch (error) {
      logger.error('Error fetching active subscription plans:', error);
      throw error;
    }
  }

  /**
   * Get plan by slug
   */
  static async findBySlug(slug: string): Promise<ISubscriptionPlan | null> {
    try {
      const plan = await this.db(this.tableName)
        .where({ slug, is_active: true })
        .first();

      if (!plan) {
        return null;
      }

      return {
        ...plan,
        features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
        limits: typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
      };
    } catch (error) {
      logger.error('Error fetching plan by slug:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription plan
   */
  static async create(planData: ISubscriptionPlanInput): Promise<ISubscriptionPlan> {
    try {
      const plan = new SubscriptionPlan();
      const sanitized = plan.sanitize(planData as Partial<ISubscriptionPlan>);
      const errors = plan.validate(sanitized);

      if (errors.length > 0) {
        const errorMessages = errors.map(err => `${err.field}: ${err.message}`).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      // Check for duplicate slug
      const existing = await this.findBySlug(sanitized.slug!);
      if (existing) {
        throw new Error('A plan with this slug already exists');
      }

      const [created] = await this.db(this.tableName)
        .insert({
          ...sanitized,
          features: JSON.stringify(sanitized.features || []),
          limits: JSON.stringify(sanitized.limits || {
            max_watches: null,
            max_alerts_per_day: null,
            api_rate_limit: null
          }),
          is_active: sanitized.is_active !== undefined ? sanitized.is_active : true,
          trial_days: sanitized.trial_days || 0
        })
        .returning('*');

      return {
        ...created,
        features: JSON.parse(created.features),
        limits: JSON.parse(created.limits)
      };
    } catch (error) {
      logger.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Update subscription plan
   */
  static async updateById(id: string, updateData: Partial<ISubscriptionPlanInput>): Promise<ISubscriptionPlan | null> {
    try {
      const plan = new SubscriptionPlan();
      const sanitized = plan.sanitize(updateData as Partial<ISubscriptionPlan>);
      const errors = plan.validate(sanitized);

      if (errors.length > 0) {
        const errorMessages = errors.map(err => `${err.field}: ${err.message}`).join(', ');
        throw new Error(`Validation failed: ${errorMessages}`);
      }

      // Check for duplicate slug if slug is being updated
      if (sanitized.slug) {
        const existing = await this.findBySlug(sanitized.slug);
        if (existing && existing.id !== id) {
          throw new Error('A plan with this slug already exists');
        }
      }

      const updatePayload: any = { ...sanitized };
      if (sanitized.features) {
        updatePayload.features = JSON.stringify(sanitized.features);
      }
      if (sanitized.limits) {
        updatePayload.limits = JSON.stringify(sanitized.limits);
      }

      const [updated] = await this.db(this.tableName)
        .where('id', id)
        .update({
          ...updatePayload,
          updated_at: this.db.fn.now()
        })
        .returning('*');

      if (!updated) {
        return null;
      }

      return {
        ...updated,
        features: JSON.parse(updated.features),
        limits: JSON.parse(updated.limits)
      };
    } catch (error) {
      logger.error('Error updating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Deactivate a subscription plan
   */
  static async deactivate(id: string): Promise<boolean> {
    try {
      const result = await this.db(this.tableName)
        .where('id', id)
        .update({
          is_active: false,
          updated_at: this.db.fn.now()
        });

      return result > 0;
    } catch (error) {
      logger.error('Error deactivating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Get plan limits for quota checking
   */
  static async getPlanLimits(planSlug: string): Promise<ISubscriptionPlan['limits'] | null> {
    try {
      const plan = await this.findBySlug(planSlug);
      return plan?.limits || null;
    } catch (error) {
      logger.error('Error fetching plan limits:', error);
      throw error;
    }
  }
}