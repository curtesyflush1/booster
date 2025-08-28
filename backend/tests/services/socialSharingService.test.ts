import { SocialSharingService } from '../../src/services/socialSharingService';

describe('SocialSharingService', () => {
  let socialSharingService: SocialSharingService;

  beforeEach(() => {
    socialSharingService = new SocialSharingService();
  });

  describe('generateShareLinks', () => {
    it('should generate share links for all platforms', () => {
      const shareData = {
        title: 'Pokemon TCG Restock Alert!',
        description: 'Booster packs available now at Best Buy for $4.99',
        url: 'https://example.com/product',
        price: 4.99,
        retailerName: 'Best Buy',
        productName: 'Pokemon TCG Booster Pack'
      };

      const shareLinks = socialSharingService.generateShareLinks(shareData);

      expect(Array.isArray(shareLinks)).toBe(true);
      expect(shareLinks.length).toBeGreaterThan(0);

      // Check that major platforms are included
      const platforms = shareLinks.map(link => link.platform);
      expect(platforms).toContain('twitter');
      expect(platforms).toContain('facebook');
      expect(platforms).toContain('discord');
      expect(platforms).toContain('reddit');

      // Check link structure
      shareLinks.forEach(link => {
        expect(link).toHaveProperty('platform');
        expect(link).toHaveProperty('url');
        expect(link).toHaveProperty('displayName');
        expect(typeof link.url).toBe('string');
        expect(link.url.length).toBeGreaterThan(0);
      });
    });

    it('should handle data without optional fields', () => {
      const minimalShareData = {
        title: 'Simple Alert',
        description: 'Basic description',
        url: 'https://example.com'
      };

      const shareLinks = socialSharingService.generateShareLinks(minimalShareData);

      expect(Array.isArray(shareLinks)).toBe(true);
      expect(shareLinks.length).toBeGreaterThan(0);
    });
  });

  describe('generateSocialPosts', () => {
    it('should generate posts for different platforms', () => {
      const shareData = {
        title: 'Pokemon TCG Deal Alert!',
        description: 'Great deal on Pokemon cards',
        url: 'https://example.com/deal',
        price: 3.99,
        originalPrice: 4.99,
        retailerName: 'Walmart',
        productName: 'Pokemon TCG Booster Pack'
      };

      const socialPosts = socialSharingService.generateSocialPosts(shareData);

      expect(Array.isArray(socialPosts)).toBe(true);
      expect(socialPosts.length).toBeGreaterThan(0);

      // Check that posts are generated for different platforms
      const platforms = socialPosts.map(post => post.platform);
      expect(platforms).toContain('twitter');
      expect(platforms).toContain('instagram');
      expect(platforms).toContain('facebook');

      // Check post structure
      socialPosts.forEach(post => {
        expect(post).toHaveProperty('platform');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('hashtags');
        expect(typeof post.content).toBe('string');
        expect(Array.isArray(post.hashtags)).toBe(true);
        expect(post.content.length).toBeGreaterThan(0);
      });
    });

    it('should include appropriate hashtags', () => {
      const shareData = {
        title: 'Scarlet & Violet Booster Pack Alert',
        description: 'New set available',
        url: 'https://example.com',
        productName: 'Pokemon TCG: Scarlet & Violet Booster Pack'
      };

      const socialPosts = socialSharingService.generateSocialPosts(shareData);
      
      // Check that Pokemon-related hashtags are included
      socialPosts.forEach(post => {
        expect(post.hashtags.some(tag => tag.includes('Pokemon'))).toBe(true);
      });
    });
  });

  describe('createShareableAlert', () => {
    it('should create shareable data from alert and product', () => {
      const alert = {
        price: 4.99,
        originalPrice: 5.99,
        retailerName: 'Target',
        cartUrl: 'https://target.com/cart/add',
        productUrl: 'https://target.com/product'
      };

      const product = {
        name: 'Pokemon TCG Elite Trainer Box',
        imageUrl: 'https://example.com/image.jpg'
      };

      const shareableData = socialSharingService.createShareableAlert(alert, product);

      expect(shareableData).toHaveProperty('title');
      expect(shareableData).toHaveProperty('description');
      expect(shareableData).toHaveProperty('url');
      expect(shareableData).toHaveProperty('price');
      expect(shareableData).toHaveProperty('originalPrice');
      expect(shareableData).toHaveProperty('retailerName');
      expect(shareableData).toHaveProperty('productName');

      expect(shareableData.title).toContain(product.name);
      expect(shareableData.description).toContain(alert.retailerName);
      expect(shareableData.price).toBe(alert.price);
      expect(shareableData.url).toBe(alert.cartUrl);
    });

    it('should calculate discount percentage', () => {
      const alert = {
        price: 3.99,
        originalPrice: 4.99,
        retailerName: 'Best Buy',
        productUrl: 'https://bestbuy.com/product'
      };

      const product = {
        name: 'Pokemon Booster Pack'
      };

      const shareableData = socialSharingService.createShareableAlert(alert, product);

      expect(shareableData.description).toContain('20% OFF');
    });
  });

  describe('generateOpenGraphTags', () => {
    it('should generate proper Open Graph tags', () => {
      const shareData = {
        title: 'Pokemon TCG Alert',
        description: 'New cards available',
        url: 'https://example.com/alert',
        imageUrl: 'https://example.com/image.jpg'
      };

      const ogTags = socialSharingService.generateOpenGraphTags(shareData);

      expect(ogTags).toHaveProperty('og:title');
      expect(ogTags).toHaveProperty('og:description');
      expect(ogTags).toHaveProperty('og:url');
      expect(ogTags).toHaveProperty('og:image');
      expect(ogTags).toHaveProperty('twitter:card');
      expect(ogTags).toHaveProperty('twitter:title');

      expect(ogTags['og:title']).toBe(shareData.title);
      expect(ogTags['og:description']).toBe(shareData.description);
      expect(ogTags['og:url']).toBe(shareData.url);
      expect(ogTags['og:image']).toBe(shareData.imageUrl);
    });

    it('should handle missing image URL', () => {
      const shareData = {
        title: 'Pokemon TCG Alert',
        description: 'New cards available',
        url: 'https://example.com/alert'
      };

      const ogTags = socialSharingService.generateOpenGraphTags(shareData);

      expect(ogTags).toHaveProperty('og:title');
      expect(ogTags).toHaveProperty('og:description');
      expect(ogTags).not.toHaveProperty('og:image');
      expect(ogTags).not.toHaveProperty('twitter:image');
    });
  });

  describe('trackShare', () => {
    it('should track share without errors', async () => {
      // This is a simple test since the method just logs
      await expect(
        socialSharingService.trackShare('twitter', 'alert-123', 'user-456')
      ).resolves.not.toThrow();
    });

    it('should handle missing optional parameters', async () => {
      await expect(
        socialSharingService.trackShare('facebook')
      ).resolves.not.toThrow();
    });
  });
});