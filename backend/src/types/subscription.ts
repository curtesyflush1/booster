export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro'
}

export const SUBSCRIPTION_HIERARCHY: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.PRO]: 1
} as const;

export class SubscriptionValidator {
  static hasRequiredTier(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
    const userLevel = SUBSCRIPTION_HIERARCHY[userTier];
    const requiredLevel = SUBSCRIPTION_HIERARCHY[requiredTier];
    return userLevel >= requiredLevel;
  }

  static isValidTier(tier: string): tier is SubscriptionTier {
    return Object.values(SubscriptionTier).includes(tier as SubscriptionTier);
  }
}