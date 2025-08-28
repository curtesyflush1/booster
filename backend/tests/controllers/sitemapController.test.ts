/**
 * Sitemap Controller Tests
 */

import sitemapController from '../../src/controllers/sitemapController';
import { Request, Response } from 'express';

// Mock response object
const mockResponse = () => {
  const res: Partial<Response> = {};
  res.set = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  return res as Response;
};

// Mock request object
const mockRequest = () => {
  const req: Partial<Request> = {};
  return req as Request;
};

describe('Sitemap Controller', () => {
  describe('getSitemapIndex', () => {
    it('should return sitemap index XML', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getSitemapIndex(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400'
      });
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getStaticSitemap', () => {
    it('should return static pages sitemap', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getStaticSitemap(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400'
      });
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getProductsSitemap', () => {
    it('should return products sitemap with shorter cache', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getProductsSitemap(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600'
      });
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getCategoriesSitemap', () => {
    it('should return categories sitemap', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getCategoriesSitemap(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400'
      });
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getLocationsSitemap', () => {
    it('should return locations sitemap with longer cache', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getLocationsSitemap(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=604800'
      });
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getSetsSitemap', () => {
    it('should return sets sitemap', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getSetsSitemap(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400'
      });
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getRobotsTxt', () => {
    it('should return robots.txt with proper headers', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getRobotsTxt(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=86400'
      });
      expect(res.send).toHaveBeenCalled();
    });
  });

  describe('getSitemapStats', () => {
    it('should return sitemap statistics', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await sitemapController.getSitemapStats(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalUrls: expect.any(Number),
          staticPages: expect.any(Number),
          products: expect.any(Number),
          categories: expect.any(Number),
          locations: expect.any(Number),
          sets: expect.any(Number)
        })
      });
    });
  });
});