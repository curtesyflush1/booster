import React, { memo, useCallback } from 'react';
import { Crown, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PricingPlan } from '../../constants/pricing';
import { usePricingCard } from '../../hooks/usePricingCard';

// Extract badge component for reusability and better separation of concerns
const PopularBadge: React.FC<{ badge: string }> = memo(({ badge }) => (
    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
        <span className="bg-pokemon-electric text-background-primary px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 shadow-lg">
            <Crown className="w-4 h-4" aria-hidden="true" />
            <span>{badge}</span>
        </span>
    </div>
));

PopularBadge.displayName = 'PopularBadge';

interface PricingCardProps {
    plan: PricingPlan;
    className?: string;
    /** Optional callback for analytics tracking */
    onCardClick?: (planId: string) => void;
    /** Optional test ID for testing */
    testId?: string;
}

const PricingCard: React.FC<PricingCardProps> = memo(({
    plan,
    className = '',
    onCardClick,
    testId
}) => {
    const {
        cardClassName,
        ctaClassName,
        priceAriaLabel,
        ctaAriaLabel,
        featuresAriaLabel,
        showPeriod,
        showBadge,
    } = usePricingCard({ plan, className });

    // Memoize click handler to prevent unnecessary re-renders
    const handleCardClick = useCallback(() => {
        onCardClick?.(plan.id);
    }, [onCardClick, plan.id]);

    return (
        <article
            className={cardClassName}
            aria-labelledby={`plan-${plan.id}-title`}
            aria-describedby={`plan-${plan.id}-description`}
            data-testid={testId || `pricing-card-${plan.id}`}
            onClick={handleCardClick}
        >
            {/* Popular Badge */}
            {showBadge && <PopularBadge badge={plan.badge!} />}

            {/* Plan Header */}
            <div className="text-center mb-6">
                <h3
                    id={`plan-${plan.id}-title`}
                    className="text-2xl font-bold text-white mb-2"
                >
                    {plan.name}
                </h3>
                <div className="mb-2">
                    <span
                        className="text-4xl font-bold text-white"
                        aria-label={priceAriaLabel}
                    >
                        {plan.price}
                    </span>
                    {showPeriod && (
                        <span className="text-gray-400" aria-hidden="true">/{plan.period}</span>
                    )}
                </div>
                <p
                    id={`plan-${plan.id}-description`}
                    className="text-gray-400"
                >
                    {plan.description}
                </p>
            </div>

            {/* Features List */}
            <ul className="space-y-3 mb-8" role="list" aria-label={featuresAriaLabel}>
                {plan.features.map((feature, index) => (
                    <li key={`${plan.id}-feature-${index}`} className="flex items-center space-x-3">
                        <Check
                            className="w-5 h-5 text-pokemon-grass flex-shrink-0"
                            aria-hidden="true"
                        />
                        <span className="text-gray-300">{feature}</span>
                    </li>
                ))}
            </ul>

            {/* CTA Button */}
            <Link
                to={plan.href}
                className={ctaClassName}
                aria-label={ctaAriaLabel}
            >
                {plan.cta}
            </Link>
        </article>
    );
});

PricingCard.displayName = 'PricingCard';

export default PricingCard;