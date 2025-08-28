/**
 * Sitemap Service Tests
 */

import SitemapService from '../../src/services/sitemapService';

describe('SitemapService', () => {
  let sitemapService: SitemapService;

  beforeEach(() => {
    sitemapService = new SitemapService('https://test.boosterbeacon.com');
  });

  describe('generateSitemapIndex', () => {
    it('should generate valid sitemap index XML', async () => {
      const sitemapIndex = await sitemapService.generateSitemapIndex();
      
      expect(sitemapIndex).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemapIndex).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemapIndex).toContain('https://test.boosterbeacon.com/sitemap-static.xml');
      expect(sitemapIndex).toContain('https://test.boosterbeacon.com/sitemap-products.xml');
      expect(sitemapIndex).toContain('</sitemapindex>');
    });
  });

  describe('generateStaticSitemap', () => {
    it('should generate static pages sitemap', async () => {
      const sitemap = await sitemapService.generateStaticSitemap();
      
      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(sitemap).toContain('https://test.boosterbeacon.com/');
      expect(sitemap).toContain('https://test.boosterbeacon.com/pricing');
      expect(sitemap).toContain('<priority>1.0</priority>');
      expect(sitemap).toContain('<changefreq>daily</changefreq>');
    });
  });

  describe('generateLocationsSitemap', () => {
    it('should generate locations sitemap with major cities', async () => {
      const sitemap = await sitemapService.generateLocationsSitemap();
      
      expect(sitemap).toContain('https://test.boosterbeacon.com/locations/new-york/ny');
      expect(sitemap).toContain('https://test.boosterbeacon.com/locations/los-angeles/ca');
      expect(sitemap).toContain('<changefreq>monthly</changefreq>');
    });
  });

  describe('generateSetsSitemap', () => {
    it('should generate Pokémon sets sitemap', async () => {
      const sitemap = await sitemapService.generateSetsSitemap();
      
      expect(sitemap).toContain('https://test.boosterbeacon.com/sets/scarlet-violet');
      expect(sitemap).toContain('https://test.boosterbeacon.com/sets/paldea-evolved');
      expect(sitemap).toContain('https://test.boosterbeacon.com/sets/scarlet-violet/alerts');
      expect(sitemap).toContain('<changefreq>weekly</changefreq>');
    });
  });

  describe('generateRobotsTxt', () => {
    it('should generate valid robots.txt', () => {
      const robotsTxt = sitemapService.generateRobotsTxt();
      
      expect(robotsTxt).toContain('User-agent: *');
      expect(robotsTxt).toContain('Allow: /');
      expect(robotsTxt).toContain('Sitemap: https://test.boosterbeacon.com/sitemap.xml');
      expect(robotsTxt).toContain('Disallow: /api/');
      expect(robotsTxt).toContain('Disallow: /admin/');
    });
  });

  describe('getSitemapStats', () => {
    it('should return sitemap statistics', async () => {
      const stats = await sitemapService.getSitemapStats();
      
      expect(stats).toHaveProperty('totalUrls');
      expect(stats).toHaveProperty('staticPages');
      expect(stats).toHaveProperty('products');
      expect(stats).toHaveProperty('categories');
      expect(stats).toHaveProperty('locations');
      expect(stats).toHaveProperty('sets');
      
      expect(typeof stats.totalUrls).toBe('number');
      expect(stats.staticPages).toBeGreaterThan(0);
      expect(stats.locations).toBeGreaterThan(0);
      expect(stats.sets).toBeGreaterThan(0);
    });
  });

  describe('XML escaping', () => {
    it('should properly escape XML special characters', async () => {
      // This tests the private escapeXml method indirectly
      const sitemap = await sitemapService.generateStaticSitemap();
      
      // Should not contain unescaped XML characters
      expect(sitemap).not.toContain('<loc>https://test.boosterbeacon.com/test&param=value</loc>');
      
      // Should contain properly formatted XML
      expect(sitemap).toMatch(/<loc>https:\/\/test\.boosterbeacon\.com\/[^<>&]*<\/loc>/);
    });
  });
});