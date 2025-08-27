import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePricingCard } from './usePricingCard';
import { createMockPricingPlan } from '../test/testUtils';

const mockPlan = createMockPricingPlan();
const mockPopularPlan = createMockPricingPlan({ 
    popular: true, 
    badge: 'Most Popular' 
});

describe('usePricingCard', () => {
    it('returns correct class names for regular plan', () => {
        const { result } = renderHook(() => usePricingCard({ plan: mockPlan }));

        expect(result.current.cardClassName).toContain('card-dark');
        expect(result.current.cardClassName).not.toContain('ring-2');
        expect(result.current.ctaClassName).toContain('btn-outline');
    });

    it('returns correct class names for popular plan', () => {
        const { result } = renderHook(() => usePricingCard({ plan: mockPopularPlan }));

        expect(result.current.cardClassName).toContain('ring-2 ring-pokemon-electric');
        expect(result.current.ctaClassName).toContain('btn-pokemon-electric');
    });

    it('returns correct aria labels', () => {
        const { result } = renderHook(() => usePricingCard({ plan: mockPlan }));

        expect(result.current.priceAriaLabel).toBe('Price: $9.99 per month');
        expect(result.current.ctaAriaLabel).toBe('Get Started - Test Plan plan');
        expect(result.current.featuresAriaLabel).toBe('Test Plan plan features');
    });

    it('handles forever period correctly', () => {
        const foreverPlan = { ...mockPlan, period: 'forever' };
        const { result } = renderHook(() => usePricingCard({ plan: foreverPlan }));

        expect(result.current.priceAriaLabel).toBe('Price: $9.99');
        expect(result.current.showPeriod).toBe(false);
    });

    it('handles badge visibility correctly', () => {
        const { result: regularResult } = renderHook(() => usePricingCard({ plan: mockPlan }));
        const { result: popularResult } = renderHook(() => usePricingCard({ plan: mockPopularPlan }));

        expect(regularResult.current.showBadge).toBe(false);
        expect(popularResult.current.showBadge).toBe(true);
    });

    it('includes custom className', () => {
        const customClass = 'custom-class';
        const { result } = renderHook(() => usePricingCard({ plan: mockPlan, className: customClass }));

        expect(result.current.cardClassName).toContain(customClass);
    });

    it('handles empty className gracefully', () => {
        const { result } = renderHook(() => usePricingCard({ plan: mockPlan, className: '' }));
        
        expect(result.current.cardClassName).toContain('card-dark');
        expect(result.current.cardClassName).not.toContain('undefined');
    });

    it('handles undefined className gracefully', () => {
        const { result } = renderHook(() => usePricingCard({ plan: mockPlan }));
        
        expect(result.current.cardClassName).toContain('card-dark');
        expect(result.current.cardClassName).not.toContain('undefined');
    });

    it('memoizes computed values correctly', () => {
        const { result, rerender } = renderHook(
            ({ plan, className }) => usePricingCard({ plan, className }),
            { initialProps: { plan: mockPlan, className: 'test' } }
        );

        const firstResult = result.current;
        
        // Rerender with same props
        rerender({ plan: mockPlan, className: 'test' });
        
        // Should return same references (memoized)
        expect(result.current.cardClassName).toBe(firstResult.cardClassName);
        expect(result.current.ctaClassName).toBe(firstResult.ctaClassName);
    });

    it('handles special characters in plan data', () => {
        const specialPlan = createMockPricingPlan({
            name: 'Test & Special Plan',
            price: '$19.99',
            cta: 'Get Started Now!'
        });
        
        const { result } = renderHook(() => usePricingCard({ plan: specialPlan }));
        
        expect(result.current.priceAriaLabel).toBe('Price: $19.99 per month');
        expect(result.current.ctaAriaLabel).toBe('Get Started Now! - Test & Special Plan plan');
    });

    describe('edge cases', () => {
        it('handles missing badge when popular is true', () => {
            const planWithoutBadge = createMockPricingPlan({ popular: true });
            const { result } = renderHook(() => usePricingCard({ plan: planWithoutBadge }));
            
            expect(result.current.showBadge).toBe(false);
        });

        it('handles various period values', () => {
            const periods = ['day', 'week', 'month', 'year', 'forever'];
            
            periods.forEach(period => {
                const plan = createMockPricingPlan({ period });
                const { result } = renderHook(() => usePricingCard({ plan }));
                
                if (period === 'forever') {
                    expect(result.current.showPeriod).toBe(false);
                    expect(result.current.priceAriaLabel).not.toContain('per');
                } else {
                    expect(result.current.showPeriod).toBe(true);
                    expect(result.current.priceAriaLabel).toContain(`per ${period}`);
                }
            });
        });

        it('throws error when plan is null or undefined', () => {
            expect(() => {
                renderHook(() => usePricingCard({ plan: null as any }));
            }).toThrow('usePricingCard: plan is required');

            expect(() => {
                renderHook(() => usePricingCard({ plan: undefined as any }));
            }).toThrow('usePricingCard: plan is required');
        });
    });
});