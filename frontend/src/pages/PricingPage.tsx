import React, { memo, useState, useEffect } from 'react';
import { PRICING_PLANS, PRICING_CONFIG } from '../constants/pricing';
import PricingCard from '../components/pricing/PricingCard';
import PricingHeader from '../components/pricing/PricingHeader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSubscription } from '../context/SubscriptionContext';
import { subscriptionService, SubscriptionPlan } from '../services/subscriptionService';
import LoadingSpinner from '../components/LoadingSpinner';

const PricingPage: React.FC = memo(() => {
    const { state: subscriptionState, upgradeToProPlan } = useSubscription();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState<string | null>(null);

    useDocumentTitle({
        title: 'Pricing',
        description: 'Choose the perfect plan for your Pokémon TCG collecting needs. Free tier with basic alerts or Pro with unlimited watches and advanced features.',
        keywords: ['pokemon tcg pricing', 'collector alerts pricing', 'pokemon card alerts cost', 'tcg monitoring subscription']
    });

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const plansData = await subscriptionService.getPlans();
            setPlans(plansData);
        } catch (error) {
            console.error('Error loading plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (planSlug: string) => {
        setUpgrading(planSlug);
        try {
            await upgradeToProPlan(planSlug);
        } catch (error) {
            console.error('Error upgrading:', error);
        } finally {
            setUpgrading(null);
        }
    };

    const isCurrentPlan = (planSlug: string) => {
        return subscriptionState.subscription?.tier === planSlug || 
               (planSlug === 'free' && (!subscriptionState.subscription || subscriptionState.subscription.tier === 'free'));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background-primary flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    // Combine database plans with static free plan
    const freePlan = PRICING_PLANS.find(p => p.id === 'free');
    const allPlans = freePlan ? [freePlan, ...plans] : plans;

    return (
        <div className="min-h-screen bg-background-primary py-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <PricingHeader
                    title={PRICING_CONFIG.title}
                    subtitle={PRICING_CONFIG.subtitle}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {allPlans.map((plan) => {
                        const isCurrent = isCurrentPlan(plan.slug);
                        const isUpgrading = upgrading === plan.slug;
                        
                        return (
                            <div
                                key={plan.id || plan.slug}
                                className={`relative bg-background-secondary rounded-2xl p-6 border transition-all duration-300 ${
                                    isCurrent 
                                        ? 'border-pokemon-electric shadow-lg shadow-pokemon-electric/20' 
                                        : 'border-gray-700 hover:border-gray-600'
                                } ${plan.slug === 'pro' ? 'lg:scale-105' : ''}`}
                            >
                                {plan.slug === 'pro' && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                        <span className="bg-pokemon-electric text-background-primary px-3 py-1 rounded-full text-sm font-medium">
                                            Most Popular
                                        </span>
                                    </div>
                                )}
                                
                                {isCurrent && (
                                    <div className="absolute -top-3 right-4">
                                        <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                            Current Plan
                                        </span>
                                    </div>
                                )}

                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                                    <p className="text-gray-300 mb-4">{plan.description}</p>
                                    <div className="mb-4">
                                        <span className="text-4xl font-bold text-pokemon-electric">
                                            {subscriptionService.formatPrice(plan.price || 0)}
                                        </span>
                                        <span className="text-gray-400 ml-2">
                                            {plan.billing_period === 'yearly' ? '/year' : plan.price > 0 ? '/month' : ''}
                                        </span>
                                    </div>
                                    
                                    {plan.billing_period === 'yearly' && plan.price > 0 && (
                                        <div className="text-sm text-pokemon-electric">
                                            Save 20% vs monthly billing
                                        </div>
                                    )}
                                </div>

                                <ul className="space-y-3 mb-8">
                                    {(plan.features || []).map((feature, index) => (
                                        <li key={index} className="flex items-center text-gray-300">
                                            <span className="text-pokemon-electric mr-3">✓</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <div className="mt-auto">
                                    {isCurrent ? (
                                        <button
                                            disabled
                                            className="w-full py-3 px-4 bg-gray-600 text-gray-400 rounded-lg font-medium cursor-not-allowed"
                                        >
                                            Current Plan
                                        </button>
                                    ) : plan.slug === 'free' ? (
                                        <button
                                            disabled
                                            className="w-full py-3 px-4 bg-gray-600 text-gray-400 rounded-lg font-medium cursor-not-allowed"
                                        >
                                            Downgrade Not Available
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleUpgrade(plan.slug)}
                                            disabled={isUpgrading}
                                            className="w-full py-3 px-4 bg-pokemon-electric text-background-primary rounded-lg font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
                                        >
                                            {isUpgrading ? 'Processing...' : 'Upgrade Now'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Additional Features Section */}
                <div className="mt-16 text-center">
                    <div className="bg-background-secondary rounded-2xl p-8 border border-gray-700">
                        <h3 className="text-2xl font-bold text-white mb-4">
                            All plans include
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-gray-300">
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-pokemon-electric rounded-full flex items-center justify-center mb-3">
                                    <span className="text-background-primary font-bold">⚡</span>
                                </div>
                                <span>Real-time alerts</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-pokemon-water rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold">🛒</span>
                                </div>
                                <span>Direct cart links</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-12 h-12 bg-pokemon-grass rounded-full flex items-center justify-center mb-3">
                                    <span className="text-white font-bold">🔒</span>
                                </div>
                                <span>Secure & private</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

PricingPage.displayName = 'PricingPage';

export default PricingPage;