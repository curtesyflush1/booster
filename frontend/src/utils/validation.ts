import { PricingPlan } from '../constants/pricing';

export const validatePricingPlan = (plan: any): plan is PricingPlan => {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.price === 'string' &&
    typeof plan.period === 'string' &&
    typeof plan.description === 'string' &&
    Array.isArray(plan.features) &&
    plan.features.every((feature: any) => typeof feature === 'string') &&
    typeof plan.cta === 'string' &&
    typeof plan.href === 'string' &&
    typeof plan.popular === 'boolean'
  );
};

export const validatePricingPlans = (plans: any[]): PricingPlan[] => {
  if (!Array.isArray(plans)) {
    throw new Error('Pricing plans must be an array');
  }

  const validPlans = plans.filter(validatePricingPlan);
  
  if (validPlans.length === 0) {
    throw new Error('No valid pricing plans found');
  }

  return validPlans;
};