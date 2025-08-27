import React, { useState, useEffect } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { subscriptionService, SubscriptionPlan } from '../services/subscriptionService';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import LoadingSpinner from '../components/LoadingSpinner';

const SubscriptionPage: React.FC = () => {
  const { state, upgradeToProPlan, cancelSubscription, reactivateSubscription } = useSubscription();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useDocumentTitle({
    title: 'Subscription Management',
    description: 'Manage your BoosterBeacon subscription, view usage statistics, and upgrade your plan.',
    keywords: ['subscription management', 'pokemon tcg alerts subscription', 'upgrade plan', 'billing']
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
    setActionLoading(planSlug);
    try {
      await upgradeToProPlan(planSlug);
    } catch (error) {
      console.error('Error upgrading:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (immediate: boolean = false) => {
    setActionLoading('cancel');
    try {
      await cancelSubscription(!immediate);
    } catch (error) {
      console.error('Error canceling:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async () => {
    setActionLoading('reactivate');
    try {
      await reactivateSubscription();
    } catch (error) {
      console.error('Error reactivating:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading || state.loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  const currentPlan = plans.find(plan => plan.slug === state.subscription?.tier) || plans.find(plan => plan.slug === 'free');
  const isProUser = state.subscription?.tier === 'pro';

  return (
    <div className="min-h-screen bg-background-primary py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Subscription Management</h1>
          <p className="text-gray-300">Manage your plan, view usage, and billing information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Subscription Status */}
          <div className="lg:col-span-2">
            <div className="bg-background-secondary rounded-xl p-6 border border-gray-700 mb-6">
              <h2 className="text-xl font-semibold text-white mb-4">Current Plan</h2>
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-white">{currentPlan?.name || 'Free'}</h3>
                  <p className="text-gray-300">{currentPlan?.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-pokemon-electric">
                    {subscriptionService.formatPrice(currentPlan?.price || 0)}
                  </div>
                  <div className="text-sm text-gray-400">
                    {currentPlan?.billing_period === 'yearly' ? 'per year' : 'per month'}
                  </div>
                </div>
              </div>

              {state.subscription?.status && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-gray-400">Status:</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      state.subscription.status === 'active' 
                        ? 'bg-green-900 text-green-300' 
                        : 'bg-yellow-900 text-yellow-300'
                    }`}>
                      {state.subscription.status}
                    </span>
                  </div>
                  
                  {state.subscription.endDate && (
                    <div className="text-sm text-gray-400">
                      {state.subscription.cancelAtPeriodEnd 
                        ? `Cancels on ${formatDate(state.subscription.endDate)}`
                        : `Renews on ${formatDate(state.subscription.endDate)}`
                      }
                    </div>
                  )}
                  
                  {state.subscription.trialEndDate && (
                    <div className="text-sm text-pokemon-electric">
                      Trial ends on {formatDate(state.subscription.trialEndDate)}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!isProUser && (
                  <button
                    onClick={() => handleUpgrade('pro')}
                    disabled={actionLoading === 'pro'}
                    className="px-4 py-2 bg-pokemon-electric text-background-primary rounded-lg font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'pro' ? 'Processing...' : 'Upgrade to Pro'}
                  </button>
                )}
                
                {isProUser && state.subscription?.cancelAtPeriodEnd && (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading === 'reactivate'}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'reactivate' ? 'Processing...' : 'Reactivate Subscription'}
                  </button>
                )}
                
                {isProUser && !state.subscription?.cancelAtPeriodEnd && (
                  <button
                    onClick={() => handleCancel(false)}
                    disabled={actionLoading === 'cancel'}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'cancel' ? 'Processing...' : 'Cancel Subscription'}
                  </button>
                )}
              </div>
            </div>

            {/* Usage Statistics */}
            <div className="bg-background-secondary rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">Usage Statistics</h2>
              
              {state.usage && (
                <div className="space-y-4">
                  {/* Watches Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300">Product Watches</span>
                      <span className="text-white">
                        {state.usage.watches_used} {!isProUser && `/ ${state.quota?.limit || 5}`}
                      </span>
                    </div>
                    {!isProUser && (
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-pokemon-electric h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((state.usage.watches_used || 0) / (state.quota?.limit || 5)) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Alerts Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300">Alerts Sent</span>
                      <span className="text-white">
                        {state.usage.alerts_sent} {!isProUser && '/ 50'}
                      </span>
                    </div>
                    {!isProUser && (
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-pokemon-water h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((state.usage.alerts_sent || 0) / 50) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* API Calls Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-300">API Calls</span>
                      <span className="text-white">
                        {state.usage.api_calls} {!isProUser && '/ 1000'}
                      </span>
                    </div>
                    {!isProUser && (
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-pokemon-grass h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, ((state.usage.api_calls || 0) / 1000) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {state.usage.last_reset && (
                    <div className="text-sm text-gray-400 mt-4">
                      Usage resets monthly. Last reset: {formatDate(state.usage.last_reset)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Available Plans */}
          <div>
            <div className="bg-background-secondary rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">Available Plans</h2>
              
              <div className="space-y-4">
                {plans.filter(plan => plan.slug !== 'free').map((plan) => (
                  <div 
                    key={plan.id}
                    className={`p-4 rounded-lg border ${
                      state.subscription?.tier === 'pro' 
                        ? 'border-pokemon-electric bg-pokemon-electric/10' 
                        : 'border-gray-600 hover:border-gray-500'
                    } transition-colors`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-white">{plan.name}</h3>
                      <div className="text-right">
                        <div className="font-bold text-pokemon-electric">
                          {subscriptionService.formatPrice(plan.price)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {plan.billing_period === 'yearly' ? '/year' : '/month'}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-3">{plan.description}</p>
                    
                    <ul className="text-xs text-gray-400 space-y-1 mb-3">
                      {plan.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="flex items-center">
                          <span className="text-pokemon-electric mr-2">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {state.subscription?.tier !== 'pro' && (
                      <button
                        onClick={() => handleUpgrade(plan.slug)}
                        disabled={actionLoading === plan.slug}
                        className="w-full px-3 py-2 bg-pokemon-electric text-background-primary rounded font-medium text-sm hover:bg-yellow-400 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === plan.slug ? 'Processing...' : 'Upgrade Now'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Billing History */}
            {state.billingHistory.length > 0 && (
              <div className="bg-background-secondary rounded-xl p-6 border border-gray-700 mt-6">
                <h2 className="text-xl font-semibold text-white mb-4">Recent Billing</h2>
                
                <div className="space-y-3">
                  {state.billingHistory.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-b-0">
                      <div>
                        <div className="text-sm text-white capitalize">
                          {event.event_type.replace('_', ' ')}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(event.event_date)}
                        </div>
                      </div>
                      {event.amount && (
                        <div className="text-sm font-medium text-pokemon-electric">
                          {subscriptionService.formatPrice(event.amount, event.currency)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;