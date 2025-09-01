import { IUser } from '../types/database';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/**
 * Centralized helpers for plan-based prioritization.
 * Implements Premium > Pro > Free weighting using subscription_plan_id
 * with safe fallbacks when data is missing.
 */

export type PlanTier = 'premium' | 'pro' | 'free';

function getEnvNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Default weights can be overridden via env vars
const WEIGHTS = {
  premium: getEnvNumber('QUEUE_PRIORITY_WEIGHT_PREMIUM', 10),
  pro: getEnvNumber('QUEUE_PRIORITY_WEIGHT_PRO', 5),
  free: getEnvNumber('QUEUE_PRIORITY_WEIGHT_FREE', 1),
} as const;

/**
 * Determine plan tier from a user record.
 * Prefers `subscription_plan_id` and falls back to `subscription_tier`.
 */
export function inferPlanTier(user: Pick<IUser, 'subscription_plan_id' | 'subscription_tier'> | null | undefined): PlanTier {
  if (!user) return 'free';
  const planId = (user.subscription_plan_id || '').toLowerCase();
  const tier = (user.subscription_tier || '').toLowerCase();

  // Explicit env-driven matches
  const premiumId = (process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || '').toLowerCase();
  if ((premiumId && planId === premiumId) || planId.includes('premium')) {
    return 'premium';
  }

  const proId = (process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '').toLowerCase();
  if ((proId && planId === proId) || planId.includes('pro') || tier === 'pro') {
    return 'pro';
  }

  return 'free';
}

/**
 * Get numeric queue priority weight for a user ID.
 */
export async function getQueuePriorityWeightForUser(userId: string): Promise<number> {
  try {
    const user = await User.findById<IUser>(userId);
    const tier = inferPlanTier(user);
    return WEIGHTS[tier];
  } catch (error) {
    logger.warn('Failed to load user for plan weight; defaulting to free', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return WEIGHTS.free;
  }
}

export type AlertPriority = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITY_ORDER: AlertPriority[] = ['low', 'medium', 'high', 'urgent'];

/**
 * Boost an alert priority based on plan tier.
 * premium: +2 levels; pro: +1 level; free: +0
 */
export function boostAlertPriorityByPlan(user: Pick<IUser, 'subscription_plan_id' | 'subscription_tier'> | null | undefined, base: AlertPriority): AlertPriority {
  const tier = inferPlanTier(user);
  const boost = tier === 'premium' ? 2 : tier === 'pro' ? 1 : 0;
  const idx = PRIORITY_ORDER.indexOf(base);
  const newIdx = Math.min(idx + boost, PRIORITY_ORDER.length - 1);
  return PRIORITY_ORDER[newIdx];
}

