/**
 * SEO Utilities Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  updateMetaTags,
  updateStructuredData,
  generateWebsiteStructuredData,
  generateProductStructuredData,
  generateBreadcrumbStructuredData,
  generateFAQStructuredData,
  generateSocialShareUrls,
  generateLocationKeywords,
  DEFAULT_SEO,
  POKEMON_TCG_KEYWORDS
} from '../seo';

// Mock DOM methods
const mockMetaTag = {
  content: '',
  name: '',
  setAttribute: vi.fn(),
  getAttribute: vi.fn()
};

const mockLinkTag = {
  href: '',
  rel: 'canonical'
};

const mockScript = {
  id: '',
  type: '',
  textContent: '',
  remove: vi.fn()
};

// Mock document methods
Object.defineProperty(document, 'title', {
  writable: true,
  value: ''
});

Object.defineProperty(document, 'querySelector', {
  writable: true,
  value: vi.fn((selector: string) => {
    if (selector.includes('meta')) return mockMetaTag;
    if (selector.includes('link')) return mockLinkTag;
    if (selector.includes('script')) return mockScript;
    return null;
  })
});

Object.defineProperty(document, 'createElement', {
  writable: true,
  value: vi.fn((tagName: string) => {
    if (tagName === 'meta') return { ...mockMetaTag };
    if (tagName === 'link') return { ...mockLinkTag };
    if (tagName === 'script') return { ...mockScript };
    return {};
  })
});

Object.defineProperty(document, 'getElementById', {
  writable: true,
  value: vi.fn(() => mockScript)
});

const mockHead = {
  appendChild: vi.fn()
};

Object.defineProperty(document, 'head', {
  writable: true,
  value: mockHead
});

describe('SEO Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.title = '';
  });

  describe('updateMetaTags', () => {
    it('should update document title', () => {
      const config = {
        title: 'Test Page',
        description: 'Test description'
      };

      updateMetaTags(config);

      expect(document.title).toBe('Test Page');
    });

    it('should handle meta tag configuration', () => {
      const config = {
        title: 'Test Page',
        description: 'Test description',
        keywords: ['test', 'seo']
      };

      // This test just ensures the function runs without error
      expect(() => updateMetaTags(config)).not.toThrow();
    });

    it('should handle canonical URL configuration', () => {
      const config = {
        title: 'Test Page',
        description: 'Test description',
        canonical: 'https://example.com/test'
      };

      // This test just ensures the function runs without error
      expect(() => updateMetaTags(config)).not.toThrow();
    });

    it('should handle robots meta tag configuration', () => {
      const config = {
        title: 'Test Page',
        description: 'Test description',
        noIndex: true,
        noFollow: true
      };

      // This test just ensures the function runs without error
      expect(() => updateMetaTags(config)).not.toThrow();
    });
  });

  describe('updateStructuredData', () => {
    it('should handle structured data creation', () => {
      const data = { '@type': 'WebSite', name: 'Test Site' };

      // This test just ensures the function runs without error
      expect(() => updateStructuredData(data, 'test-data')).not.toThrow();
    });

    it('should handle structured data updates', () => {
      const data = { '@type': 'WebSite', name: 'Test Site' };

      // This test just ensures the function runs without error
      expect(() => updateStructuredData(data, 'test-data')).not.toThrow();
    });
  });

  describe('generateWebsiteStructuredData', () => {
    it('should generate valid website structured data', () => {
      const data = generateWebsiteStructuredData();

      expect(data['@context']).toBe('https://schema.org');
      expect(data['@type']).toBe('WebApplication');
      expect(data.name).toBe('BoosterBeacon');
      expect(data.url).toBe('https://boosterbeacon.com');
      expect(data.sameAs).toBeInstanceOf(Array);
    });
  });

  describe('generateProductStructuredData', () => {
    it('should generate valid product structured data', () => {
      const product = {
        name: 'Test Product',
        description: 'Test description',
        image: 'https://example.com/image.jpg',
        price: 29.99,
        availability: 'InStock' as const,
        brand: 'Pokémon',
        sku: 'TEST123'
      };

      const data = generateProductStructuredData(product) as any;

      expect(data['@context']).toBe('https://schema.org');
      expect(data['@type']).toBe('Product');
      expect(data.name).toBe('Test Product');
      expect(data.offers.price).toBe(29.99);
      expect(data.brand.name).toBe('Pokémon');
    });

    it('should handle products without price', () => {
      const product = {
        name: 'Test Product',
        description: 'Test description',
        image: 'https://example.com/image.jpg'
      };

      const data = generateProductStructuredData(product) as any;

      expect(data.offers).toBeUndefined();
    });
  });

  describe('generateBreadcrumbStructuredData', () => {
    it('should generate valid breadcrumb structured data', () => {
      const breadcrumbs = [
        { name: 'Home', url: 'https://example.com' },
        { name: 'Products', url: 'https://example.com/products' },
        { name: 'Test Product', url: 'https://example.com/products/test' }
      ];

      const data = generateBreadcrumbStructuredData(breadcrumbs) as any;

      expect(data['@context']).toBe('https://schema.org');
      expect(data['@type']).toBe('BreadcrumbList');
      expect(data.itemListElement).toHaveLength(3);
      expect(data.itemListElement[0].position).toBe(1);
      expect(data.itemListElement[0].name).toBe('Home');
    });
  });

  describe('generateFAQStructuredData', () => {
    it('should generate valid FAQ structured data', () => {
      const faqs = [
        { question: 'What is this?', answer: 'This is a test.' },
        { question: 'How does it work?', answer: 'It works great.' }
      ];

      const data = generateFAQStructuredData(faqs) as any;

      expect(data['@context']).toBe('https://schema.org');
      expect(data['@type']).toBe('FAQPage');
      expect(data.mainEntity).toHaveLength(2);
      expect(data.mainEntity[0]['@type']).toBe('Question');
      expect(data.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
    });
  });

  describe('generateSocialShareUrls', () => {
    it('should generate social sharing URLs', () => {
      const url = 'https://example.com/test';
      const title = 'Test Title';
      const description = 'Test description';

      const shareUrls = generateSocialShareUrls(url, title, description);

      expect(shareUrls.facebook).toContain('facebook.com/sharer');
      expect(shareUrls.twitter).toContain('twitter.com/intent/tweet');
      expect(shareUrls.linkedin).toContain('linkedin.com/sharing');
      expect(shareUrls.reddit).toContain('reddit.com/submit');
      expect(shareUrls.discord).toContain('discord.com/channels');

      // Check URL encoding
      expect(shareUrls.facebook).toContain(encodeURIComponent(url));
      expect(shareUrls.twitter).toContain(encodeURIComponent(title));
    });
  });

  describe('generateLocationKeywords', () => {
    it('should generate location-specific keywords', () => {
      const keywords = generateLocationKeywords('New York', 'NY');

      expect(keywords).toContain('pokemon tcg New York');
      expect(keywords).toContain('pokemon cards New York');
      expect(keywords).toContain('pokemon alerts New York NY');
      expect(keywords.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_SEO', () => {
    it('should have required default SEO properties', () => {
      expect(DEFAULT_SEO.title).toBeDefined();
      expect(DEFAULT_SEO.description).toBeDefined();
      expect(DEFAULT_SEO.keywords).toBeInstanceOf(Array);
      expect(DEFAULT_SEO.ogType).toBe('website');
      expect(DEFAULT_SEO.twitterCard).toBe('summary_large_image');
    });
  });

  describe('POKEMON_TCG_KEYWORDS', () => {
    it('should contain relevant Pokémon TCG keywords', () => {
      expect(POKEMON_TCG_KEYWORDS.products).toContain('pokemon booster packs');
      expect(POKEMON_TCG_KEYWORDS.sets).toContain('scarlet violet');
      expect(POKEMON_TCG_KEYWORDS.retailers).toContain('best buy pokemon');
      expect(POKEMON_TCG_KEYWORDS.alerts).toContain('pokemon restock alerts');
    });
  });
});
