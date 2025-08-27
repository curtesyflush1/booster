import React from 'react';
import { Settings } from 'lucide-react';

const SettingsPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center">
        <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-3xl font-display font-bold text-white mb-4">
          Settings
        </h1>
        <p className="text-gray-400">
          Settings management will be implemented in a future task.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;