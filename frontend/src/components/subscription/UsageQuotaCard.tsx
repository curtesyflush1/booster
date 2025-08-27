import React from 'react';
import { useSubscription } from '../../context/SubscriptionContext';

interface UsageQuotaCardProps {
  className?: string;
  showUpgradeButton?: boolean;
}

const UsageQuotaCard: React.FC<UsageQuotaCardProps> = ({ 
  className = '', 
  showUpgradeButton = true 
}) => {
  const { state, upgradeToProPlan, isProUser, getUsagePercentage, getRemainingWatches } = useSubscription();

  if (!state.usage) {
    return null;
  }

  const isPro = isProUser();
  const remainingWatches = getRemainingWatches();
  const watchUsagePercent = getUsagePercentage('watches');
  const alertUsagePercent = getUsagePercentage('alerts');

  return (
    <div className={`bg-background-secondary rounded-xl p-6 border border-gray-700 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Usage & Limits</h3>
        {isPro && (
          <span className="px-2 py-1 bg-pokemon-electric text-background-primary rounded text-xs font-medium">
            PRO
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Watches Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-300">Product Watches</span>
            <span className="text-sm text-white">
              {state.usage.watches_used} {!isPro && `/ ${state.quota?.limit || 5}`}
            </span>
          </div>
          
          {!isPro && (
            <>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    watchUsagePercent >= 90 ? 'bg-red-500' : 
                    watchUsagePercent >= 70 ? 'bg-yellow-500' : 'bg-pokemon-electric'
                  }`}
                  style={{ width: `${Math.min(100, watchUsagePercent)}%` }}
                />
              </div>
              <div className="text-xs text-gray-400">
                {remainingWatches} remaining
              </div>
            </>
          )}
          
          {isPro && (
            <div className="text-xs text-pokemon-electric">Unlimited</div>
          )}
        </div>

        {/* Alerts Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-300">Alerts This Month</span>
            <span className="text-sm text-white">
              {state.usage.alerts_sent} {!isPro && '/ 50'}
            </span>
          </div>
          
          {!isPro && (
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  alertUsagePercent >= 90 ? 'bg-red-500' : 
                  alertUsagePercent >= 70 ? 'bg-yellow-500' : 'bg-pokemon-water'
                }`}
                style={{ width: `${Math.min(100, alertUsagePercent)}%` }}
              />
            </div>
          )}
          
          {isPro && (
            <div className="text-xs text-pokemon-electric">Unlimited</div>
          )}
        </div>

        {/* Upgrade Prompt for Free Users */}
        {!isPro && showUpgradeButton && (
          <div className="pt-4 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-3">
              Upgrade to Pro for unlimited watches and premium features
            </div>
            <button
              onClick={() => upgradeToProPlan('pro')}
              className="w-full px-3 py-2 bg-pokemon-electric text-background-primary rounded-lg text-sm font-medium hover:bg-yellow-400 transition-colors"
            >
              Upgrade to Pro
            </button>
          </div>
        )}

        {/* Pro Features Highlight */}
        {isPro && (
          <div className="pt-4 border-t border-gray-700">
            <div className="text-xs text-pokemon-electric mb-2">Pro Features Active:</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
              <div className="flex items-center">
                <span className="text-pokemon-electric mr-1">✓</span>
                Unlimited watches
              </div>
              <div className="flex items-center">
                <span className="text-pokemon-electric mr-1">✓</span>
                SMS alerts
              </div>
              <div className="flex items-center">
                <span className="text-pokemon-electric mr-1">✓</span>
                Priority delivery
              </div>
              <div className="flex items-center">
                <span className="text-pokemon-electric mr-1">✓</span>
                Price predictions
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsageQuotaCard;