import React, { useEffect, useState } from 'react';

/**
 * PWA Update Prompt Component
 * Shows a notification when a service worker update is available
 */
const PWAUpdatePrompt: React.FC = React.memo(() => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    const handleSWUpdate = () => {
      setShowUpdatePrompt(true);
    };

    window.addEventListener('sw-update-available', handleSWUpdate);
    return () => window.removeEventListener('sw-update-available', handleSWUpdate);
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowUpdatePrompt(false);
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900">Update Available</h4>
            <p className="text-sm text-gray-500">A new version of BoosterBeacon is available.</p>
          </div>
        </div>
        <div className="mt-4 flex space-x-2">
          <button
            onClick={handleUpdate}
            className="btn btn-primary text-xs px-3 py-1"
          >
            Update Now
          </button>
          <button
            onClick={handleDismiss}
            className="btn btn-ghost text-xs px-3 py-1"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
});

PWAUpdatePrompt.displayName = 'PWAUpdatePrompt';

export default PWAUpdatePrompt;