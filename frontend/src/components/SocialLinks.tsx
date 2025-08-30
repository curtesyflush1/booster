import React from 'react';
import { MessageCircle, Instagram, Music, Twitter, Youtube } from 'lucide-react';

interface SocialLinksProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  variant?: 'horizontal' | 'vertical';
}

/**
 * Social media links component for BoosterBeacon
 */
const SocialLinksComponent: React.FC<SocialLinksProps> = ({
  className = '',
  size = 'md',
  showLabels = false,
  variant = 'horizontal'
}) => {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const buttonSizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4'
  };

  const socialPlatforms = [
    {
      name: 'Discord',
      icon: MessageCircle,
      url: 'https://discord.gg/boosterbeacon',
      color: 'hover:text-indigo-400',
      bgColor: 'hover:bg-indigo-600',
      description: 'Join our Discord community for real-time alerts and discussions'
    },
    {
      name: 'Instagram',
      icon: Instagram,
      url: 'https://instagram.com/boosterbeacon',
      color: 'hover:text-pink-400',
      bgColor: 'hover:bg-pink-600',
      description: 'Follow us on Instagram for the latest Pokémon TCG drops and updates'
    },
    {
      name: 'TikTok',
      icon: Music,
      url: 'https://tiktok.com/@boosterbeacon',
      color: 'hover:text-purple-400',
      bgColor: 'hover:bg-purple-600',
      description: 'Watch our TikTok for quick tips and Pokémon TCG content'
    },
    {
      name: 'Twitter',
      icon: Twitter,
      url: 'https://twitter.com/boosterbeacon',
      color: 'hover:text-sky-400',
      bgColor: 'hover:bg-sky-600',
      description: 'Follow us on Twitter for instant updates and community news'
    },
    {
      name: 'YouTube',
      icon: Youtube,
      url: 'https://youtube.com/@boosterbeacon',
      color: 'hover:text-red-400',
      bgColor: 'hover:bg-red-600',
      description: 'Subscribe to our YouTube channel for tutorials and reviews'
    }
  ];

  const handleSocialClick = (platform: string, url: string) => {
    // Track social media clicks
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: (command: string, action: string, params: Record<string, unknown>) => void }).gtag) {
      (window as unknown as { gtag: (command: string, action: string, params: Record<string, unknown>) => void }).gtag('event', 'click', {
        event_category: 'social',
        event_label: platform,
        value: 1
      });
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const containerClasses = variant === 'horizontal' 
    ? 'flex items-center space-x-2' 
    : 'flex flex-col space-y-2';

  return (
    <div className={`${containerClasses} ${className}`}>
      {showLabels && variant === 'horizontal' && (
        <span className="text-sm text-gray-400 mr-2">Follow us:</span>
      )}
      
      {socialPlatforms.map((platform) => {
        const Icon = platform.icon;
        
        if (showLabels && variant === 'vertical') {
          return (
            <button
              key={platform.name}
              onClick={() => handleSocialClick(platform.name, platform.url)}
              className={`flex items-center space-x-3 ${buttonSizeClasses[size]} bg-gray-700 ${platform.bgColor} rounded-lg transition-colors group text-left w-full`}
              title={platform.description}
            >
              <Icon className={`${sizeClasses[size]} text-gray-300 group-hover:text-white flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-300 group-hover:text-white">
                  {platform.name}
                </div>
                <div className="text-xs text-gray-500 group-hover:text-gray-300 truncate">
                  @boosterbeacon
                </div>
              </div>
            </button>
          );
        }

        return (
          <button
            key={platform.name}
            onClick={() => handleSocialClick(platform.name, platform.url)}
            className={`${buttonSizeClasses[size]} text-gray-400 ${platform.color} transition-colors rounded-lg hover:bg-gray-700`}
            title={platform.description}
          >
            <Icon className={sizeClasses[size]} />
          </button>
        );
      })}
    </div>
  );
};

// Memoize SocialLinks since it's a static component that rarely changes
const SocialLinks = React.memo(SocialLinksComponent);

export default SocialLinks;