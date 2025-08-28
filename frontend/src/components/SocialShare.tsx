import React from 'react';
import { Share2, Facebook, Twitter, Linkedin, MessageCircle } from 'lucide-react';
import { generateSocialShareUrls } from '../utils/seo';

interface SocialShareProps {
    url?: string;
    title: string;
    description: string;
    className?: string;
    showLabels?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * Social sharing component with support for major platforms
 */
const SocialShare: React.FC<SocialShareProps> = ({
    url = window.location.href,
    title,
    description,
    className = '',
    showLabels = false,
    size = 'md'
}) => {
    const shareUrls = generateSocialShareUrls(url, title, description);

    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-10 h-10'
    };

    const buttonSizeClasses = {
        sm: 'p-2',
        md: 'p-3',
        lg: 'p-4'
    };

    const socialPlatforms = [
        {
            name: 'Facebook',
            icon: Facebook,
            url: shareUrls.facebook,
            color: 'hover:bg-blue-600',
            label: 'Share on Facebook'
        },
        {
            name: 'Twitter',
            icon: Twitter,
            url: shareUrls.twitter,
            color: 'hover:bg-sky-500',
            label: 'Share on Twitter'
        },
        {
            name: 'LinkedIn',
            icon: Linkedin,
            url: shareUrls.linkedin,
            color: 'hover:bg-blue-700',
            label: 'Share on LinkedIn'
        },
        {
            name: 'Discord',
            icon: MessageCircle,
            url: shareUrls.discord,
            color: 'hover:bg-indigo-600',
            label: 'Share on Discord'
        }
    ];

    const handleShare = (platform: string, shareUrl: string) => {
        // Track sharing event
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'share', {
                method: platform,
                content_type: 'article',
                item_id: url
            });
        }

        // Open share window
        window.open(
            shareUrl,
            `share-${platform}`,
            'width=600,height=400,scrollbars=yes,resizable=yes'
        );
    };

    const handleNativeShare = async () => {
        if ('share' in navigator && navigator.share) {
            try {
                await navigator.share({
                    title,
                    text: description,
                    url
                });
            } catch (error) {
                console.log('Native sharing cancelled or failed');
            }
        }
    };

    return (
        <div className={`flex items-center space-x-2 ${className}`}>
            {showLabels && (
                <span className="text-sm text-gray-400 mr-2">Share:</span>
            )}

            {/* Native Web Share API (mobile) */}
            {'share' in navigator && (
                <button
                    onClick={handleNativeShare}
                    className={`${buttonSizeClasses[size]} bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors`}
                    title="Share"
                >
                    <Share2 className={`${sizeClasses[size]} text-gray-300`} />
                </button>
            )}

            {/* Social platform buttons */}
            {socialPlatforms.map((platform) => {
                const Icon = platform.icon;
                return (
                    <button
                        key={platform.name}
                        onClick={() => handleShare(platform.name.toLowerCase(), platform.url)}
                        className={`${buttonSizeClasses[size]} bg-gray-700 ${platform.color} rounded-lg transition-colors group`}
                        title={platform.label}
                    >
                        <Icon className={`${sizeClasses[size]} text-gray-300 group-hover:text-white`} />
                    </button>
                );
            })}
        </div>
    );
};

export default SocialShare;