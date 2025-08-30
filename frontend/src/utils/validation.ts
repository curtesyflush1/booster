import { PricingPlan } from '../constants/pricing';

export const validatePricingPlan = (plan: unknown): plan is PricingPlan => {
  if (typeof plan !== 'object' || plan === null) {
    return false;
  }
  
  const planObj = plan as Record<string, unknown>;
  
  return (
    typeof planObj.id === 'string' &&
    typeof planObj.name === 'string' &&
    typeof planObj.price === 'string' &&
    typeof planObj.period === 'string' &&
    typeof planObj.description === 'string' &&
    Array.isArray(planObj.features) &&
    planObj.features.every((feature: unknown) => typeof feature === 'string') &&
    typeof planObj.cta === 'string' &&
    typeof planObj.href === 'string' &&
    typeof planObj.popular === 'boolean'
  );
};

export const validatePricingPlans = (plans: unknown[]): PricingPlan[] => {
  if (!Array.isArray(plans)) {
    throw new Error('Pricing plans must be an array');
  }

  const validPlans = plans.filter(validatePricingPlan);
  
  if (validPlans.length === 0) {
    throw new Error('No valid pricing plans found');
  }

  return validPlans;
};