import React, { useState } from 'react';
import { Eye, Package } from 'lucide-react';
import { Watch } from '../types';
import { WatchList } from '../components/watches/WatchList';
import { WatchPacks } from '../components/watches/WatchPacks';

const WatchesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'watches' | 'packs'>('watches');

  const handleWatchSelect = (_watch: Watch) => {
    // TODO: Open watch edit modal
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Tabs */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              Watch Management
            </h1>
            <p className="text-gray-400">
              Manage your product watches and subscribe to curated watch packs
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('watches')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'watches'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            My Watches
          </button>
          
          <button
            onClick={() => setActiveTab('packs')}
            className={`flex items-center gap-2 px-6 py-3 rounded-md font-medium transition-colors ${
              activeTab === 'packs'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Package className="w-4 h-4" />
            Watch Packs
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'watches' ? (
        <WatchList onWatchSelect={handleWatchSelect} />
      ) : (
        <WatchPacks />
      )}
    </div>
  );
};

export default WatchesPage;