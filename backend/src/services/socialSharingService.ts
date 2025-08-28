import { logger } from '../utils/logger';

interface SocialShareData {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  hashtags?: string[];
  price?: number;
  originalPrice?: number;
  retailerName?: string;
  productName?: string;
}

interface ShareLink {
  platform: string;
  url: string;
  displayName: string;
}

interface SocialMediaPost {
  platform: string;
  content: string;
  hashtags: string[];
  imageUrl?: string;
  url?: string;
}

export class SocialSharingService {
  private readonly baseUrl: string;
  private readonly defaultHashtags = [
    '#PokemonTCG',
    '#BoosterBeacon',
    '#PokemonCards',
    '#TCGDeals',
    '#PokemonCollector'
  ];

  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || 'https://boosterbeacon.com';
  }

  /**
   * Generate share links for all supported platforms
   */
  generateShareLinks(data: SocialShareData): ShareLink[] {
    const shareLinks: ShareLink[] = [];

    // Twitter/X
    shareLinks.push({
      platform: 'twitter',
      url: this.generateTwitterLink(data),
      displayName: 'Twitter'
    });

    // Facebook
    shareLinks.push({
      platform: 'facebook',
      url: this.generateFacebookLink(data),
      displayName: 'Facebook'
    });

    // Reddit
    shareLinks.push({
      platform: 'reddit',
      url: this.generateRedditLink(data),
      displayName: 'Reddit'
    });

    // Discord (webhook format)
    shareLinks.push({
      platform: 'discord',
      url: this.generateDiscordShareableLink(data),
      displayName: 'Discord'
    });

    // Telegram
    shareLinks.push({
      platform: 'telegram',
      url: this.generateTelegramLink(data),
      displayName: 'Telegram'
    });

    // WhatsApp
    shareLinks.push({
      platform: 'whatsapp',
      url: this.generateWhatsAppLink(data),
      displayName: 'WhatsApp'
    });

    // LinkedIn
    shareLinks.push({
      platform: 'linkedin',
      url: this.generateLinkedInLink(data),
      displayName: 'LinkedIn'
    });

    return shareLinks;
  }

  /**
   * Generate optimized social media posts for different platforms
   */
  generateSocialPosts(data: SocialShareData): SocialMediaPost[] {
    const posts: SocialMediaPost[] = [];

    // Twitter post (character limit optimized)
    posts.push({
      platform: 'twitter',
      content: this.generateTwitterContent(data),
      hashtags: this.selectHashtags(data, 3), // Twitter works better with fewer hashtags
      ...(data.imageUrl && { imageUrl: data.imageUrl }),
      url: data.url
    });

    // Instagram post (hashtag heavy)
    posts.push({
      platform: 'instagram',
      content: this.generateInstagramContent(data),
      hashtags: this.selectHashtags(data, 10), // Instagram allows more hashtags
      ...(data.imageUrl && { imageUrl: data.imageUrl }),
      url: data.url
    });

    // Facebook post (longer form)
    posts.push({
      platform: 'facebook',
      content: this.generateFacebookContent(data),
      hashtags: this.selectHashtags(data, 5),
      ...(data.imageUrl && { imageUrl: data.imageUrl }),
      url: data.url
    });

    // TikTok post (short and catchy)
    posts.push({
      platform: 'tiktok',
      content: this.generateTikTokContent(data),
      hashtags: this.selectHashtags(data, 8),
      ...(data.imageUrl && { imageUrl: data.imageUrl }),
      url: data.url
    });

    return posts;
  }

  /**
   * Create shareable alert data from alert object
   */
  createShareableAlert(alert: any, product: any): SocialShareData {
    const discount = alert.originalPrice && alert.price < alert.originalPrice
      ? Math.round(((alert.originalPrice - alert.price) / alert.originalPrice) * 100)
      : null;

    return {
      title: `🚨 ${product.name} Available Now!`,
      description: discount
        ? `${discount}% OFF! Now $${alert.price.toFixed(2)} (was $${alert.originalPrice.toFixed(2)}) at ${alert.retailerName}`
        : `Available for $${alert.price.toFixed(2)} at ${alert.retailerName}`,
      url: alert.cartUrl || alert.productUrl,
      imageUrl: product.imageUrl,
      hashtags: this.generateProductHashtags(product),
      price: alert.price,
      originalPrice: alert.originalPrice,
      retailerName: alert.retailerName,
      productName: product.name
    };
  }

  /**
   * Create shareable deal data
   */
  createShareableDeal(deal: any): SocialShareData {
    const discount = Math.round(((deal.originalPrice - deal.currentPrice) / deal.originalPrice) * 100);

    return {
      title: `🔥 ${discount}% OFF ${deal.productName}!`,
      description: `Amazing deal alert! Get ${deal.productName} for just $${deal.currentPrice.toFixed(2)} (was $${deal.originalPrice.toFixed(2)}) at ${deal.retailerName}`,
      url: deal.url,
      imageUrl: deal.imageUrl,
      hashtags: [...this.defaultHashtags, '#Deal', '#Sale', `#${deal.retailerName.replace(/\s+/g, '')}`],
      price: deal.currentPrice,
      originalPrice: deal.originalPrice,
      retailerName: deal.retailerName,
      productName: deal.productName
    };
  }

  private generateTwitterLink(data: SocialShareData): string {
    const text = this.generateTwitterContent(data);
    const hashtags = this.selectHashtags(data, 3).join(',');
    
    const params = new URLSearchParams({
      text,
      hashtags,
      url: data.url
    });

    return `https://twitter.com/intent/tweet?${params.toString()}`;
  }

  private generateFacebookLink(data: SocialShareData): string {
    const params = new URLSearchParams({
      u: data.url,
      quote: `${data.title} - ${data.description}`
    });

    return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
  }

  private generateRedditLink(data: SocialShareData): string {
    const params = new URLSearchParams({
      url: data.url,
      title: `${data.title} - ${data.description}`
    });

    return `https://reddit.com/submit?${params.toString()}`;
  }

  private generateDiscordShareableLink(data: SocialShareData): string {
    // This creates a link that can be easily copied and pasted into Discord
    const message = `${data.title}\n${data.description}\n${data.url}`;
    return `data:text/plain;charset=utf-8,${encodeURIComponent(message)}`;
  }

  private generateTelegramLink(data: SocialShareData): string {
    const text = `${data.title}\n${data.description}\n${data.url}`;
    
    const params = new URLSearchParams({
      text
    });

    return `https://t.me/share/url?${params.toString()}`;
  }

  private generateWhatsAppLink(data: SocialShareData): string {
    const text = `${data.title}\n${data.description}\n${data.url}`;
    
    const params = new URLSearchParams({
      text
    });

    return `https://wa.me/?${params.toString()}`;
  }

  private generateLinkedInLink(data: SocialShareData): string {
    const params = new URLSearchParams({
      url: data.url,
      title: data.title,
      summary: data.description
    });

    return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
  }

  private generateTwitterContent(data: SocialShareData): string {
    let content = data.title;
    
    if (data.price && data.originalPrice && data.price < data.originalPrice) {
      const discount = Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100);
      content += ` ${discount}% OFF!`;
    }
    
    if (data.retailerName) {
      content += ` Available at ${data.retailerName}`;
    }

    // Keep under Twitter's character limit (280 chars, leaving room for URL and hashtags)
    if (content.length > 180) {
      content = content.substring(0, 177) + '...';
    }

    return content;
  }

  private generateInstagramContent(data: SocialShareData): string {
    let content = `${data.title}\n\n${data.description}\n\n`;
    
    if (data.price && data.originalPrice && data.price < data.originalPrice) {
      const savings = data.originalPrice - data.price;
      content += `💰 Save $${savings.toFixed(2)}!\n`;
    }
    
    content += `🔗 Link in bio or check our stories!\n\n`;
    
    return content;
  }

  private generateFacebookContent(data: SocialShareData): string {
    let content = `${data.title}\n\n${data.description}\n\n`;
    
    if (data.productName) {
      content += `Perfect for Pokémon TCG collectors looking for ${data.productName}! `;
    }
    
    content += `Don't miss out on this deal - stock is limited and these items sell out fast!\n\n`;
    content += `🔔 Want alerts like this? Follow BoosterBeacon for real-time Pokémon TCG restock notifications!`;
    
    return content;
  }

  private generateTikTokContent(data: SocialShareData): string {
    let content = `🚨 POKEMON RESTOCK ALERT! 🚨\n\n`;
    
    if (data.price && data.originalPrice && data.price < data.originalPrice) {
      const discount = Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100);
      content += `${discount}% OFF ${data.productName}!\n`;
    } else {
      content += `${data.productName} is BACK IN STOCK!\n`;
    }
    
    content += `Grab it before it's gone! 🏃‍♂️💨`;
    
    return content;
  }

  private selectHashtags(data: SocialShareData, maxCount: number): string[] {
    let hashtags = [...this.defaultHashtags];
    
    // Add retailer-specific hashtag
    if (data.retailerName) {
      hashtags.push(`#${data.retailerName.replace(/\s+/g, '')}`);
    }
    
    // Add deal-specific hashtags
    if (data.price && data.originalPrice && data.price < data.originalPrice) {
      hashtags.push('#Deal', '#Sale', '#Discount');
    } else {
      hashtags.push('#Restock', '#Available', '#InStock');
    }
    
    // Add product-specific hashtags if available
    if (data.productName) {
      const productHashtags = this.generateProductHashtags({ name: data.productName });
      hashtags.push(...productHashtags);
    }
    
    // Remove duplicates and limit count
    hashtags = [...new Set(hashtags)];
    return hashtags.slice(0, maxCount);
  }

  private generateProductHashtags(product: any): string[] {
    const hashtags: string[] = [];
    const productName = product.name?.toLowerCase() || '';
    
    // Set-specific hashtags
    if (productName.includes('scarlet') || productName.includes('violet')) {
      hashtags.push('#ScarletViolet', '#SV');
    }
    if (productName.includes('paradox rift')) {
      hashtags.push('#ParadoxRift', '#PAR');
    }
    if (productName.includes('obsidian flames')) {
      hashtags.push('#ObsidianFlames', '#OBF');
    }
    if (productName.includes('paldea evolved')) {
      hashtags.push('#PaldeaEvolved', '#PAL');
    }
    
    // Product type hashtags
    if (productName.includes('booster')) {
      hashtags.push('#BoosterPack', '#Booster');
    }
    if (productName.includes('elite trainer')) {
      hashtags.push('#EliteTrainerBox', '#ETB');
    }
    if (productName.includes('collection box')) {
      hashtags.push('#CollectionBox');
    }
    if (productName.includes('tin')) {
      hashtags.push('#Tin', '#PokemonTin');
    }
    
    return hashtags;
  }

  /**
   * Generate Open Graph meta tags for better social sharing
   */
  generateOpenGraphTags(data: SocialShareData): Record<string, string> {
    return {
      'og:title': data.title,
      'og:description': data.description,
      'og:url': data.url,
      'og:type': 'website',
      'og:site_name': 'BoosterBeacon',
      ...(data.imageUrl && { 'og:image': data.imageUrl }),
      'twitter:card': 'summary_large_image',
      'twitter:site': '@BoosterBeacon',
      'twitter:title': data.title,
      'twitter:description': data.description,
      ...(data.imageUrl && { 'twitter:image': data.imageUrl })
    };
  }

  /**
   * Track social sharing analytics
   */
  async trackShare(platform: string, alertId?: string, userId?: string): Promise<void> {
    try {
      // In a real implementation, this would save to analytics database
      logger.info('Social share tracked', {
        platform,
        alertId,
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to track social share:', error);
    }
  }
}

export const socialSharingService = new SocialSharingService();