/**
 * Test utilities for BoosterBeacon frontend tests
 */

import { vi } from 'vitest';
import { PricingPlan } from '../constants/pricing';

/**
 * Factory function to create mock pricing plans for testing
 */
export const createMockPricingPlan = (overrides: Partial<PricingPlan> = {}): PricingPlan => ({
    id: 'test-plan',
    name: 'Test Plan',
    price: '$9.99',
    period: 'month',
    description: 'Test description for pricing plan',
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
    cta: 'Get Started',
    href: '/register',
    popular: false,
    ...overrides
});

/**
 * Common test data for pricing plans
 */
export const TEST_PRICING_PLANS = {
    free: createMockPricingPlan({
        id: 'free',
        name: 'Free',
        price: '$0',
        period: 'forever',
        popular: false
    }),
    pro: createMockPricingPlan({
        id: 'pro',
        name: 'Pro',
        price: '$9.99',
        period: 'month',
        popular: true,
        badge: 'Most Popular'
    }),
    enterprise: createMockPricingPlan({
        id: 'enterprise',
        name: 'Enterprise',
        price: '$29.99',
        period: 'month',
        popular: false,
        features: ['Unlimited everything', 'Priority support', 'Custom integrations']
    })
};

/**
 * Mock functions for testing
 */
export const createMockFunctions = () => ({
    onCardClick: vi.fn(),
    onPlanSelect: vi.fn(),
    onFeatureClick: vi.fn()
});

/**
 * Test constants
 */
export const TEST_CONSTANTS = {
    CUSTOM_CLASS_NAME: 'custom-test-class',
    TEST_ID_PREFIX: 'test-pricing-card',
    ARIA_LABELS: {
        PRICE: 'Price:',
        FEATURES: 'plan features',
        CTA: 'plan'
    }
} as const;