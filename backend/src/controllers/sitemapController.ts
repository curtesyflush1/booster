/**
 * Sitemap Controller
 * Handles sitemap generation and serving for SEO
 */

import { Request, Response } from 'express';
import SitemapService from '../services/sitemapService';
import { logger } from '../utils/logger';
import { CACHE_CONTROL } from '../constants';

class SitemapController {
  private sitemapService: SitemapService;

  constructor() {
    this.sitemapService = new SitemapService(process.env.BASE_URL || 'https://boosterbeacon.com');
  }

  /**
   * Serve main sitemap index
   */
  async getSitemapIndex(req: Request, res: Response): Promise<void> {
    try {
      const sitemap = await this.sitemapService.generateSitemapIndex();
      
      res.set({
        'Content-Type': 'application/xml',
        'Cache-Control': `public, max-age=${CACHE_CONTROL.SITEMAP_DEFAULT}` // Cache for 24 hours
      });
      
      res.send(sitemap);
      
      logger.info('Sitemap index served successfully');
    } catch (error) {
      logger.error('Error serving sitemap index:', error);
      res.status(500).json({ error: 'Failed to generate sitemap index' });
    }
  }

  /**
   * Serve static pages sitemap
   */
  async getStaticSitemap(req: Request, res: Response): Promise<void> {
    try {
      const sitemap = await this.sitemapService.generateStaticSitemap();
      
      res.set({
        'Content-Type': 'application/xml',
        'Cache-Control': `public, max-age=${CACHE_CONTROL.SITEMAP_MAIN}`
      });
      
      res.send(sitemap);
      
      logger.info('Static sitemap served successfully');
    } catch (error) {
      logger.error('Error serving static sitemap:', error);
      res.status(500).json({ error: 'Failed to generate static sitemap' });
    }
  }

  /**
   * Serve products sitemap
   */
  async getProductsSitemap(req: Request, res: Response): Promise<void> {
    try {
      const sitemap = await this.sitemapService.generateProductsSitemap();
      
      res.set({
        'Content-Type': 'application/xml',
        'Cache-Control': `public, max-age=${CACHE_CONTROL.SITEMAP_PRODUCTS}` // Cache for 1 hour (products change more frequently)
      });
      
      res.send(sitemap);
      
      logger.info('Products sitemap served successfully');
    } catch (error) {
      logger.error('Error serving products sitemap:', error);
      res.status(500).json({ error: 'Failed to generate products sitemap' });
    }
  }

  /**
   * Serve categories sitemap
   */
  async getCategoriesSitemap(req: Request, res: Response): Promise<void> {
    try {
      const sitemap = await this.sitemapService.generateCategoriesSitemap();
      
      res.set({
        'Content-Type': 'application/xml',
        'Cache-Control': `public, max-age=${CACHE_CONTROL.SITEMAP_CATEGORIES}`
      });
      
      res.send(sitemap);
      
      logger.info('Categories sitemap served successfully');
    } catch (error) {
      logger.error('Error serving categories sitemap:', error);
      res.status(500).json({ error: 'Failed to generate categories sitemap' });
    }
  }

  /**
   * Serve locations sitemap
   */
  async getLocationsSitemap(req: Request, res: Response): Promise<void> {
    try {
      const sitemap = await this.sitemapService.generateLocationsSitemap();
      
      res.set({
        'Content-Type': 'application/xml',
        'Cache-Control': `public, max-age=${CACHE_CONTROL.SITEMAP_LOCATIONS}` // Cache for 1 week (locations change rarely)
      });
      
      res.send(sitemap);
      
      logger.info('Locations sitemap served successfully');
    } catch (error) {
      logger.error('Error serving locations sitemap:', error);
      res.status(500).json({ error: 'Failed to generate locations sitemap' });
    }
  }

  /**
   * Serve sets sitemap
   */
  async getSetsSitemap(req: Request, res: Response): Promise<void> {
    try {
      const sitemap = await this.sitemapService.generateSetsSitemap();
      
      res.set({
        'Content-Type': 'application/xml',
        'Cache-Control': `public, max-age=${CACHE_CONTROL.SITEMAP_PAGES}`
      });
      
      res.send(sitemap);
      
      logger.info('Sets sitemap served successfully');
    } catch (error) {
      logger.error('Error serving sets sitemap:', error);
      res.status(500).json({ error: 'Failed to generate sets sitemap' });
    }
  }

  /**
   * Serve robots.txt
   */
  async getRobotsTxt(req: Request, res: Response): Promise<void> {
    try {
      const robotsTxt = this.sitemapService.generateRobotsTxt();
      
      res.set({
        'Content-Type': 'text/plain',
        'Cache-Control': `public, max-age=${CACHE_CONTROL.ROBOTS_TXT}`
      });
      
      res.send(robotsTxt);
      
      logger.info('Robots.txt served successfully');
    } catch (error) {
      logger.error('Error serving robots.txt:', error);
      res.status(500).send('User-agent: *\nDisallow: /');
    }
  }

  /**
   * Get sitemap statistics (admin endpoint)
   */
  async getSitemapStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.sitemapService.getSitemapStats();
      
      res.json({
        success: true,
        data: stats
      });
      
      logger.info('Sitemap stats retrieved successfully');
    } catch (error) {
      logger.error('Error getting sitemap stats:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get sitemap statistics' 
      });
    }
  }

  /**
   * Ping search engines about sitemap updates (admin endpoint)
   */
  async pingSitemaps(req: Request, res: Response): Promise<void> {
    try {
      const baseUrl = process.env.BASE_URL || 'https://boosterbeacon.com';
      const sitemapUrl = `${baseUrl}/sitemap.xml`;
      
      // Ping Google
      const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      
      // Ping Bing
      const bingPingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
      
      const pingResults = await Promise.allSettled([
        fetch(googlePingUrl),
        fetch(bingPingUrl)
      ]);
      
      const results = {
        google: pingResults[0].status === 'fulfilled' ? 'success' : 'failed',
        bing: pingResults[1].status === 'fulfilled' ? 'success' : 'failed'
      };
      
      res.json({
        success: true,
        message: 'Sitemap ping completed',
        results
      });
      
      logger.info('Sitemap ping completed:', results);
    } catch (error) {
      logger.error('Error pinging sitemaps:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to ping search engines' 
      });
    }
  }
}

export default new SitemapController();