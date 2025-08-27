import React from 'react';
import { useSubscription } from '../../context/SubscriptionContext';

interface UpgradePromptProps {
  feature: string;
  description: string;
  className?: string;
  onClose?: () => void;
}

const UpgradePrompt: React.FC<UpgradePromptProps> = ({ 
  feature, 
  description, 
  className = '',
  onClose 
}) => {
  const { upgradeToProPlan, isProUser } = useSubscription();

  // Don't show for Pro users
  if (isProUser()) {
    return null;
  }

  const handleUpgrade = () => {
    upgradeToProPlan('pro');
  };

  return (
    <div className={`bg-gradient-to-r from-pokemon-electric/10 to-pokemon-water/10 border border-pokemon-electric/30 rounded-xl p-6 ${className}`}>
      {onClose && (
        <button
          onClick={onClose}
          className="float-right text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          ✕
        </button>
      )}
      
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-pokemon-electric rounded-full flex items-center justify-center">
            <span className="text-background-primary font-bold text-xl">⚡</span>
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">
            Unlock {feature} with Pro
          </h3>
          <p className="text-gray-300 mb-4">
            {description}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleUpgrade}
              className="px-6 py-2 bg-pokemon-electric text-background-primary rounded-lg font-medium hover:bg-yellow-400 transition-colors"
            >
              Upgrade to Pro
            </button>
            <button
              onClick={() => window.open('/pricing', '_blank')}
              className="px-6 py-2 border border-gray-600 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              View Pricing
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-300">
          <div className="flex items-center">
            <span className="text-pokemon-electric mr-2">✓</span>
            Unlimited watches
          </div>
          <div className="flex items-center">
            <span className="text-pokemon-electric mr-2">✓</span>
            SMS & Discord alerts
          </div>
          <div className="flex items-center">
            <span className="text-pokemon-electric mr-2">✓</span>
            Priority delivery
          </div>
          <div className="flex items-center">
            <span className="text-pokemon-electric mr-2">✓</span>
            Price predictions
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;