import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import LoadingSpinner from '../components/LoadingSpinner';

// Constants for better maintainability
const WEBHOOK_PROCESSING_DELAY = 2000; // 2 seconds
const SUPPORT_EMAIL = 'support@boosterbeacon.com';

const PRO_FEATURES = [
    'Unlimited product watches',
    'SMS & Discord alerts',
    'Priority alert delivery',
    'Price predictions & ROI',
    'Historical data access',
    'Premium support'
];

const NEXT_STEPS = [
    'Set up unlimited product watches for your favorite Pokémon TCG items',
    'Configure SMS and Discord notifications in your settings',
    'Explore price predictions and historical data for better purchasing decisions'
];

const SubscriptionSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshSubscriptionData, state } = useSubscription();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useDocumentTitle({
        title: 'Subscription Successful',
        description: 'Your BoosterBeacon Pro subscription has been activated successfully.',
        keywords: ['subscription success', 'pokemon tcg alerts pro', 'payment successful']
    });

    useEffect(() => {
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            setError('Invalid session. Please try again.');
            setLoading(false);
            return;
        }

        // Refresh subscription data to get the latest status
        const refreshData = async () => {
            try {
                await refreshSubscriptionData();
                setLoading(false);
            } catch (err) {
                console.error('Error refreshing subscription data:', err);
                const errorMessage = err instanceof Error 
                    ? `Failed to load subscription data: ${err.message}` 
                    : 'Failed to load subscription data. Please refresh the page.';
                setError(errorMessage);
                setLoading(false);
            }
        };

        // Add a small delay to ensure Stripe webhook has processed
        const timer = setTimeout(refreshData, WEBHOOK_PROCESSING_DELAY);

        return () => clearTimeout(timer);
    }, [searchParams, refreshSubscriptionData]);

    const handleContinue = () => {
        navigate('/dashboard');
    };

    const handleViewSubscription = () => {
        navigate('/subscription');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background-primary flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="text-gray-300 mt-4">Processing your subscription...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background-primary flex items-center justify-center">
                <div className="max-w-md mx-auto text-center">
                    <div className="bg-red-900/20 border border-red-700 rounded-xl p-6">
                        <div className="text-red-400 text-4xl mb-4">⚠️</div>
                        <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
                        <p className="text-gray-300 mb-4">{error}</p>
                        <button
                            onClick={() => navigate('/subscription')}
                            className="px-4 py-2 bg-pokemon-electric text-background-primary rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                        >
                            Go to Subscription
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const isProUser = state.subscription?.tier === 'pro';

    // Component for Pro Features section
    const ProFeaturesSection = () => (
        <div className="bg-pokemon-electric/10 border border-pokemon-electric/30 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-pokemon-electric mb-4">
                You now have access to:
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                {PRO_FEATURES.map((feature, index) => (
                    <div key={index} className="flex items-center text-gray-300">
                        <span className="text-pokemon-electric mr-2">✓</span>
                        {feature}
                    </div>
                ))}
            </div>
        </div>
    );

    // Component for Next Steps section
    const NextStepsSection = () => (
        <div className="mt-8 text-left">
            <h3 className="text-lg font-semibold text-white mb-3">What's next?</h3>
            <div className="space-y-2 text-gray-300">
                {NEXT_STEPS.map((step, index) => (
                    <div key={index} className="flex items-start">
                        <span className="text-pokemon-electric mr-2 mt-1">{index + 1}.</span>
                        <span>{step}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    // Component for Trial Information
    const TrialInfoSection = () => {
        if (!state.subscription?.trialEndDate) return null;
        
        return (
            <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4 mb-6">
                <p className="text-blue-300">
                    <strong>Free Trial Active:</strong> Your trial period ends on{' '}
                    {new Date(state.subscription.trialEndDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </p>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background-primary flex items-center justify-center">
            <div className="max-w-2xl mx-auto px-4 text-center">
                <div className="bg-background-secondary rounded-2xl p-8 border border-gray-700">
                    {/* Success Icon */}
                    <div className="text-6xl mb-6">🎉</div>

                    {/* Success Message */}
                    <h1 className="text-3xl font-bold text-white mb-4">
                        {isProUser ? 'Welcome to BoosterBeacon Pro!' : 'Subscription Processing'}
                    </h1>

                    <p className="text-gray-300 text-lg mb-6">
                        {isProUser
                            ? 'Your Pro subscription has been activated successfully. You now have access to all premium features!'
                            : 'Your payment was successful. Your subscription is being activated and will be ready shortly.'
                        }
                    </p>

                    {/* Pro Features Highlight */}
                    {isProUser && <ProFeaturesSection />}

                    {/* Trial Information */}
                    <TrialInfoSection />

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={handleContinue}
                            className="px-6 py-3 bg-pokemon-electric text-background-primary rounded-lg font-medium hover:bg-yellow-400 transition-colors"
                        >
                            Start Using Pro Features
                        </button>
                        <button
                            onClick={handleViewSubscription}
                            className="px-6 py-3 bg-background-primary border border-gray-600 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
                        >
                            View Subscription Details
                        </button>
                    </div>

                    {/* Next Steps */}
                    <NextStepsSection />

                    {/* Support Information */}
                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <p className="text-sm text-gray-400">
                            Need help getting started? Contact our premium support team at{' '}
                            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-pokemon-electric hover:underline">
                                {SUPPORT_EMAIL}
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionSuccessPage;