/**
 * Comprehensive Onboarding Flow Component
 * Guides new users through BoosterBeacon setup
 */

import React, { useState } from 'react';
import { CheckCircle, ArrowRight, ArrowLeft, Star, Bell, Search, Zap } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<OnboardingStepProps>;
  required: boolean;
  completed: boolean;
}

interface OnboardingStepProps {
  onNext: () => void;
  onPrev: () => void;
  onComplete: (data?: Record<string, unknown>) => void;
  isFirst: boolean;
  isLast: boolean;
}



const OnboardingFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'welcome',
      title: 'Welcome to BoosterBeacon!',
      description: 'Let\'s get you set up to never miss a Pokémon drop again',
      component: WelcomeStep,
      required: true,
      completed: false
    },
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Help us personalize your experience',
      component: ProfileStep,
      required: true,
      completed: false
    },
    {
      id: 'notifications',
      title: 'Notification Preferences',
      description: 'Choose how you want to receive alerts',
      component: NotificationStep,
      required: true,
      completed: false
    },
    {
      id: 'interests',
      title: 'Your Collecting Interests',
      description: 'Tell us what you\'re looking for',
      component: InterestsStep,
      required: false,
      completed: false
    },
    {
      id: 'first-watch',
      title: 'Set Up Your First Watch',
      description: 'Start monitoring your first product',
      component: FirstWatchStep,
      required: false,
      completed: false
    },
    {
      id: 'complete',
      title: 'You\'re All Set!',
      description: 'Welcome to the BoosterBeacon community',
      component: CompleteStep,
      required: true,
      completed: false
    }
  ]);



  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepComplete = (_data?: Record<string, unknown>) => {
    // Update step completion
    setSteps(prev => prev.map((step, index) => 
      index === currentStep ? { ...step, completed: true } : step
    ));

    // Auto-advance to next step
    handleNext();
  };



  const CurrentStepComponent = steps[currentStep]?.component;

  if (!CurrentStepComponent) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Progress Bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Getting Started</h1>
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`flex items-center ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {step.completed ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 ${
                    index === currentStep 
                      ? 'border-blue-600 bg-blue-600' 
                      : index < currentStep 
                        ? 'border-blue-600 bg-blue-600' 
                        : 'border-gray-300'
                  }`}>
                    {index === currentStep && (
                      <div className="w-1 h-1 bg-white rounded-full mx-auto mt-1.5" />
                    )}
                  </div>
                )}
                <span className="ml-2 text-sm font-medium hidden sm:block">
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <CurrentStepComponent
          onNext={handleNext}
          onPrev={handlePrev}
          onComplete={handleStepComplete}
          isFirst={currentStep === 0}
          isLast={currentStep === steps.length - 1}
        />
      </div>
    </div>
  );
};

// Welcome Step Component
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
      <div className="mb-8">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap className="w-10 h-10 text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to BoosterBeacon!
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          The ultimate alerting service for Pokémon TCG collectors. 
          Never miss a drop again with our real-time monitoring and instant notifications.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="text-center">
          <Bell className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900">Instant Alerts</h3>
          <p className="text-sm text-gray-600">
            Get notified within 5 seconds of product availability
          </p>
        </div>
        <div className="text-center">
          <Search className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900">Multi-Retailer</h3>
          <p className="text-sm text-gray-600">
            Monitor Best Buy, Walmart, Costco, and Sam's Club
          </p>
        </div>
        <div className="text-center">
          <Star className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900">Smart Features</h3>
          <p className="text-sm text-gray-600">
            ML predictions, price tracking, and automated checkout
          </p>
        </div>
      </div>

      <button
        onClick={() => onComplete()}
        className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center mx-auto"
      >
        Let's Get Started
        <ArrowRight className="w-5 h-5 ml-2" />
      </button>
    </div>
  );
};

// Profile Step Component
const ProfileStep: React.FC<OnboardingStepProps> = ({ onComplete, onPrev }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    location: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(formData);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Profile</h2>
      <p className="text-gray-600 mb-8">
        Help us personalize your BoosterBeacon experience
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name *
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your first name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name *
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your last name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location (Optional)
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="City, State (helps with local store alerts)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Timezone
          </label>
          <select
            value={formData.timezone}
            onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="America/Anchorage">Alaska Time</option>
            <option value="Pacific/Honolulu">Hawaii Time</option>
          </select>
        </div>

        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={onPrev}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
};

// Notification Step Component
const NotificationStep: React.FC<OnboardingStepProps> = ({ onComplete, onPrev }) => {
  const [preferences, setPreferences] = useState({
    notificationChannels: ['web_push'],
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00'
    },
    alertFilters: {
      maxPrice: 100,
      retailers: ['bestbuy', 'walmart']
    }
  });

  const handleChannelToggle = (channel: string) => {
    setPreferences(prev => ({
      ...prev,
      notificationChannels: prev.notificationChannels.includes(channel)
        ? prev.notificationChannels.filter(c => c !== channel)
        : [...prev.notificationChannels, channel]
    }));
  };

  const handleRetailerToggle = (retailer: string) => {
    setPreferences(prev => ({
      ...prev,
      alertFilters: {
        ...prev.alertFilters,
        retailers: prev.alertFilters.retailers.includes(retailer)
          ? prev.alertFilters.retailers.filter(r => r !== retailer)
          : [...prev.alertFilters.retailers, retailer]
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(preferences);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Notification Preferences</h2>
      <p className="text-gray-600 mb-8">
        Choose how and when you want to receive alerts
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Notification Channels */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Channels</h3>
          <div className="space-y-3">
            {[
              { id: 'web_push', name: 'Web Push Notifications', description: 'Browser notifications (recommended)', free: true },
              { id: 'email', name: 'Email Alerts', description: 'Email notifications to your inbox', free: true },
              { id: 'sms', name: 'SMS Alerts', description: 'Text message notifications', free: false },
              { id: 'discord', name: 'Discord Integration', description: 'Alerts in your Discord server', free: false }
            ].map(channel => (
              <label key={channel.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={preferences.notificationChannels.includes(channel.id)}
                  onChange={() => handleChannelToggle(channel.id)}
                  disabled={!channel.free}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900">{channel.name}</span>
                    {!channel.free && (
                      <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Pro</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{channel.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Quiet Hours */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiet Hours</h3>
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={preferences.quietHours.enabled}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                quietHours: { ...prev.quietHours, enabled: e.target.checked }
              }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-gray-900">Enable quiet hours (no alerts during these times)</span>
          </label>
          
          {preferences.quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={preferences.quietHours.startTime}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, startTime: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={preferences.quietHours.endTime}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, endTime: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Retailers */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Preferred Retailers</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'bestbuy', name: 'Best Buy', description: 'Official API integration' },
              { id: 'walmart', name: 'Walmart', description: 'Affiliate feed integration' },
              { id: 'costco', name: 'Costco', description: 'Availability monitoring' },
              { id: 'samsclub', name: 'Sam\'s Club', description: 'Member pricing alerts' }
            ].map(retailer => (
              <label key={retailer.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={preferences.alertFilters.retailers.includes(retailer.id)}
                  onChange={() => handleRetailerToggle(retailer.id)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="font-medium text-gray-900">{retailer.name}</div>
                  <p className="text-xs text-gray-600">{retailer.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Max Price */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Threshold</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum price for alerts: ${preferences.alertFilters.maxPrice}
            </label>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={preferences.alertFilters.maxPrice}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                alertFilters: { ...prev.alertFilters, maxPrice: parseInt(e.target.value) }
              }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>$10</span>
              <span>$500+</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={onPrev}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
};

// Interests Step Component
const InterestsStep: React.FC<OnboardingStepProps> = ({ onComplete, onPrev }) => {
  const [interests, setInterests] = useState({
    sets: [] as string[],
    productTypes: [] as string[],
    priceRange: 'under-50'
  });

  const handleSetToggle = (set: string) => {
    setInterests(prev => ({
      ...prev,
      sets: prev.sets.includes(set)
        ? prev.sets.filter(s => s !== set)
        : [...prev.sets, set]
    }));
  };

  const handleProductTypeToggle = (type: string) => {
    setInterests(prev => ({
      ...prev,
      productTypes: prev.productTypes.includes(type)
        ? prev.productTypes.filter(t => t !== type)
        : [...prev.productTypes, type]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete(interests);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Collecting Interests</h2>
      <p className="text-gray-600 mb-8">
        Tell us what you're looking for so we can provide better recommendations
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Pokemon Sets */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pokémon Sets of Interest</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'Scarlet & Violet Base',
              'Paldea Evolved',
              'Obsidian Flames',
              'Paradox Rift',
              'Paldean Fates',
              'Temporal Forces',
              'Twilight Masquerade',
              'Shrouded Fable',
              'Stellar Crown'
            ].map(set => (
              <label key={set} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={interests.sets.includes(set)}
                  onChange={() => handleSetToggle(set)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-900">{set}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Product Types */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Types</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              'Booster Packs',
              'Booster Boxes',
              'Elite Trainer Boxes',
              'Battle Decks',
              'Collection Boxes',
              'Tin Collections',
              'Premium Collections',
              'Special Sets',
              'Promo Cards'
            ].map(type => (
              <label key={type} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={interests.productTypes.includes(type)}
                  onChange={() => handleProductTypeToggle(type)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-900">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Typical Price Range</h3>
          <div className="space-y-2">
            {[
              { id: 'under-25', label: 'Under $25', description: 'Booster packs, small items' },
              { id: 'under-50', label: '$25 - $50', description: 'ETBs, battle decks' },
              { id: 'under-100', label: '$50 - $100', description: 'Collection boxes, premium items' },
              { id: 'under-200', label: '$100 - $200', description: 'Booster boxes, large collections' },
              { id: 'over-200', label: '$200+', description: 'Premium collections, cases' }
            ].map(range => (
              <label key={range.id} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="priceRange"
                  value={range.id}
                  checked={interests.priceRange === range.id}
                  onChange={(e) => setInterests(prev => ({ ...prev, priceRange: e.target.value }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div className="ml-3">
                  <div className="font-medium text-gray-900">{range.label}</div>
                  <p className="text-sm text-gray-600">{range.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={onPrev}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
};

// First Watch Step Component
const FirstWatchStep: React.FC<OnboardingStepProps> = ({ onComplete, onPrev }) => {
  const [watchType, setWatchType] = useState<'product' | 'pack'>('pack');
  const [selectedPack, setSelectedPack] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({
      watchPackId: watchType === 'pack' ? selectedPack : undefined
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your First Watch</h2>
      <p className="text-gray-600 mb-8">
        Start monitoring products right away with our recommended Watch Packs
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Watch Type Selection */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Approach</h3>
          <div className="space-y-3">
            <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 border-blue-200 bg-blue-50">
              <input
                type="radio"
                name="watchType"
                value="pack"
                checked={watchType === 'pack'}
                onChange={(e) => setWatchType(e.target.value as 'product' | 'pack')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="font-medium text-gray-900">Watch Pack (Recommended)</div>
                <p className="text-sm text-gray-600">
                  Monitor curated collections of popular products that are automatically updated
                </p>
              </div>
            </label>
            <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="watchType"
                value="product"
                checked={watchType === 'product'}
                onChange={(e) => setWatchType(e.target.value as 'product' | 'pack')}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3">
                <div className="font-medium text-gray-900">Individual Product</div>
                <p className="text-sm text-gray-600">
                  Search for and monitor specific products manually
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Watch Pack Selection */}
        {watchType === 'pack' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Popular Watch Packs</h3>
            <div className="space-y-3">
              {[
                {
                  id: 'latest-sets',
                  name: 'Latest Pokémon Sets',
                  description: 'Current and upcoming TCG releases',
                  products: '25+ products'
                },
                {
                  id: 'elite-trainer-boxes',
                  name: 'Elite Trainer Boxes',
                  description: 'All ETB releases across sets',
                  products: '15+ products'
                },
                {
                  id: 'booster-boxes',
                  name: 'Booster Boxes',
                  description: 'Full booster box monitoring',
                  products: '20+ products'
                },
                {
                  id: 'special-collections',
                  name: 'Special Collections',
                  description: 'Limited edition and special releases',
                  products: '30+ products'
                }
              ].map(pack => (
                <label key={pack.id} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="watchPack"
                    value={pack.id}
                    checked={selectedPack === pack.id}
                    onChange={(e) => setSelectedPack(e.target.value)}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{pack.name}</div>
                      <span className="text-sm text-gray-500">{pack.products}</span>
                    </div>
                    <p className="text-sm text-gray-600">{pack.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Individual Product Search */}
        {watchType === 'product' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search for Products</h3>
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                You can search for specific products after completing onboarding
              </p>
              <button
                type="button"
                onClick={() => onComplete({})}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Skip for now and search later
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={onPrev}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </button>
          <button
            type="submit"
            disabled={watchType === 'pack' && !selectedPack}
            className="bg-blue-600 text-white px-8 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </form>
    </div>
  );
};

// Complete Step Component
const CompleteStep: React.FC<OnboardingStepProps> = ({ onComplete }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          You're All Set!
        </h2>
        <p className="text-lg text-gray-600 mb-8">
          Welcome to the BoosterBeacon community! You'll start receiving alerts as soon as products become available.
        </p>
      </div>

      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">What happens next?</h3>
        <div className="space-y-3 text-left">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <span className="text-gray-700">We'll start monitoring your selected products immediately</span>
          </div>
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <span className="text-gray-700">You'll receive alerts within 5 seconds of availability</span>
          </div>
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <span className="text-gray-700">Install our browser extension for automated checkout</span>
          </div>
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <span className="text-gray-700">Add our PWA to your phone for mobile alerts</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => onComplete()}
          className="w-full bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </button>
        
        <div className="flex space-x-4">
          <button className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Install Extension
          </button>
          <button className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            View User Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
