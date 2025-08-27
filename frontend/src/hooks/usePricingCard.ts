import { useMemo } from 'react';
import clsx from 'clsx';
import { PricingPlan } from '../constants/pricing';

interface UsePricingCardProps {
    plan: PricingPlan;
    className?: string;
}

/**
 * Custom hook for pricing card logic and computed values
 * Separates business logic from presentation for better testability
 * 
 * @param plan - The pricing plan configuration
 * @param className - Optional additional CSS classes
 * @returns Computed values and class names for the pricing card
 */
export const usePricingCard = ({ plan, className = '' }: UsePricingCardProps) => {
    // Input validation
    if (!plan) {
        throw new Error('usePricingCard: plan is required');
    }
    // Memoize computed values to prevent unnecessary recalculations
    const cardClassName = useMemo(() => clsx(
        'card-dark p-8 relative transition-all duration-300 hover:scale-105 hover:shadow-2xl',
        plan.popular && 'ring-2 ring-pokemon-electric shadow-pokemon-electric/20',
        className
    ), [plan.popular, className]);

    const ctaClassName = useMemo(() => clsx(
        'w-full btn text-center block transition-all duration-200 hover:transform hover:scale-105',
        plan.popular ? 'btn-pokemon-electric' : 'btn-outline'
    ), [plan.popular]);

    const priceAriaLabel = useMemo(() => 
        `Price: ${plan.price}${plan.period !== 'forever' ? ` per ${plan.period}` : ''}`,
        [plan.price, plan.period]
    );

    const ctaAriaLabel = useMemo(() => 
        `${plan.cta} - ${plan.name} plan`,
        [plan.cta, plan.name]
    );

    const featuresAriaLabel = useMemo(() =>
        `${plan.name} plan features`,
        [plan.name]
    );

    // Computed properties for better readability
    const showPeriod = plan.period !== 'forever';
    const showBadge = Boolean(plan.popular && plan.badge);

    return {
        cardClassName,
        ctaClassName,
        priceAriaLabel,
        ctaAriaLabel,
        featuresAriaLabel,
        showPeriod,
        showBadge,
    };
};