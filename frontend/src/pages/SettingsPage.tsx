import React from 'react';
import { Settings } from 'lucide-react';
import { useSubscription } from '../context/SubscriptionContext';

const SettingsPage: React.FC = () => {
  const { isProUser } = useSubscription();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-3xl font-display font-bold text-white mb-4">
          Settings
        </h1>
        <p className="text-gray-400 mb-6">Manage your notification and account preferences.</p>
      </div>

      {/* Notification Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-dark p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Notification Channels</h2>
          <div className="space-y-3 text-gray-300">
            <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <span>Web Push</span>
              <input type="checkbox" defaultChecked className="accent-pokemon-electric" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <span>Email</span>
              <input type="checkbox" defaultChecked className="accent-pokemon-electric" />
            </label>
            {isProUser() ? (
              <>
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>SMS (Pro)</span>
                  <input type="checkbox" className="accent-pokemon-electric" />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <span>Discord (Pro)</span>
                  <input type="checkbox" className="accent-pokemon-electric" />
                </label>
              </>
            ) : (
              <div className="p-3 bg-gray-900 rounded-lg text-sm text-gray-400">
                SMS and Discord are available for Pro subscribers.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
