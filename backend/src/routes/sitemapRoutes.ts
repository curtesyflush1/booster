/**
 * Sitemap Routes
 * Routes for serving sitemaps and robots.txt
 */

import { Router } from 'express';
import sitemapController from '../controllers/sitemapController';
import { requireAdmin } from '../middleware/adminAuth';

const router = Router();

// Public sitemap routes
router.get('/sitemap.xml', sitemapController.getSitemapIndex);
router.get('/sitemap-static.xml', sitemapController.getStaticSitemap);
router.get('/sitemap-products.xml', sitemapController.getProductsSitemap);
router.get('/sitemap-categories.xml', sitemapController.getCategoriesSitemap);
router.get('/sitemap-locations.xml', sitemapController.getLocationsSitemap);
router.get('/sitemap-sets.xml', sitemapController.getSetsSitemap);
router.get('/robots.txt', sitemapController.getRobotsTxt);

// Admin sitemap management routes
router.get('/admin/sitemap/stats', requireAdmin, sitemapController.getSitemapStats);
router.post('/admin/sitemap/ping', requireAdmin, sitemapController.pingSitemaps);

export default router;