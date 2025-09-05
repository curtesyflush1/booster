import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { dropSignalService } from './dropSignalService';

export type CandidateInput = {
  productId: string;
  retailerSlug: string; // e.g., 'best-buy', 'walmart', 'target', 'costco', 'sams-club'
  sku?: string | null;
  upc?: string | null;
  name?: string | null;
  setName?: string | null;
};

export type UrlCandidate = {
  url: string;
  score: number; // 0-1
  reason: string;
  patternId?: string;
};

const slugify = (s?: string | null) => (s || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  .slice(0, 120);

const abs = (base: string, path: string) => `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export class URLPatternService {
  static async generateCandidates(input: CandidateInput): Promise<UrlCandidate[]> {
    const { retailerSlug } = input;
    switch (retailerSlug) {
      case 'best-buy': return this.forBestBuy(input);
      case 'walmart': return this.forWalmart(input);
      case 'target': return this.forTarget(input);
      case 'costco': return this.forCostco(input);
      case 'sams-club': return this.forSamsClub(input);
      default:
        return [];
    }
  }

  private static async track(productId: string, retailerSlug: string, url: string, patternId: string, score: number, reason: string) {
    try {
      // Map retailer slug to DB id
      const knex = BaseModel.getKnex();
      const row = await knex('retailers').select('id').where({ slug: retailerSlug }).first();
      if (!row) return;
      await dropSignalService.recordUrlCandidate({
        product_id: productId,
        retailer_id: row.id,
        url,
        pattern_id: patternId,
        score,
        reason,
      });
    } catch (e) {
      logger.warn('Failed to persist URL candidate', { url, retailerSlug, error: e instanceof Error ? e.message : String(e) });
    }
  }

  private static async forBestBuy(input: CandidateInput): Promise<UrlCandidate[]> {
    const out: UrlCandidate[] = [];
    let slug = slugify(`${input.name || ''} ${input.setName || ''}`);
    if (!slug) slug = 'product'; // ensure valid canonical path segment

    if (input.sku) {
      // Primary product patterns
      out.push({ url: `https://www.bestbuy.com/site/${slug}/${input.sku}.p`, score: 0.92, reason: 'sku-path', patternId: 'bb:sku' });
      out.push({ url: `https://www.bestbuy.com/site/${slug}/${input.sku}.p?skuId=${input.sku}`, score: 0.9, reason: 'sku-path+query', patternId: 'bb:sku' });
      // Search by SKU
      out.push({ url: `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(input.sku)}`, score: 0.6, reason: 'search-sku', patternId: 'bb:search' });
      // API (optional)
      out.push({ url: `https://api.bestbuy.com/v1/products/${encodeURIComponent(input.sku)}.json`, score: 0.5, reason: 'api-sku', patternId: 'bb:api' });
    }
    if (input.upc) {
      out.push({ url: `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(input.upc)}`, score: 0.55, reason: 'search-upc', patternId: 'bb:search' });
    }
    if (slug) {
      const q = slug.replace(/-/g, '+');
      out.push({ url: `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`, score: 0.48, reason: 'search-slug', patternId: 'bb:search' });
    }

    await Promise.all(out.map(c => this.track(input.productId, 'best-buy', c.url, c.patternId || 'bb', c.score, c.reason)));
    return out;
  }

  private static async forWalmart(input: CandidateInput): Promise<UrlCandidate[]> {
    const out: UrlCandidate[] = [];
    const slug = slugify(`${input.name || ''} ${input.setName || ''}`);
    if (input.upc) {
      out.push({ url: `https://www.walmart.com/search?q=${encodeURIComponent(input.upc)}`, score: 0.57, reason: 'search-upc', patternId: 'wm:search' });
    }
    if (slug) {
      const q = slug.replace(/-/g, '+');
      out.push({ url: `https://www.walmart.com/search?q=${encodeURIComponent(q)}`, score: 0.47, reason: 'search-slug', patternId: 'wm:search' });
      const base = slug.split('-').slice(0, 5).join('+');
      if (base) out.push({ url: `https://www.walmart.com/search?q=${encodeURIComponent(base)}`, score: 0.43, reason: 'search-short', patternId: 'wm:search' });
    }
    await Promise.all(out.map(c => this.track(input.productId, 'walmart', c.url, c.patternId || 'wm', c.score, c.reason)));
    return out;
  }

  private static async forTarget(input: CandidateInput): Promise<UrlCandidate[]> {
    const out: UrlCandidate[] = [];
    const slug = slugify(`${input.name || ''} ${input.setName || ''}`);
    if (input.upc) {
      out.push({ url: `https://www.target.com/s?searchTerm=${encodeURIComponent(input.upc)}`, score: 0.62, reason: 'search-upc', patternId: 'tg:search' });
    }
    if (slug) {
      const q = slug.replace(/-/g, '+');
      out.push({ url: `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`, score: 0.52, reason: 'search-slug', patternId: 'tg:search' });
      const base = slug.split('-').filter(w => !['pokemon','tcg','trading','card','game'].includes(w)).join('+');
      if (base) out.push({ url: `https://www.target.com/s?searchTerm=${encodeURIComponent(base)}`, score: 0.46, reason: 'search-variant', patternId: 'tg:search' });
    }
    await Promise.all(out.map(c => this.track(input.productId, 'target', c.url, c.patternId || 'tg', c.score, c.reason)));
    return out;
  }

  private static async forCostco(input: CandidateInput): Promise<UrlCandidate[]> {
    const out: UrlCandidate[] = [];
    const slug = slugify(`${input.name || ''} ${input.setName || ''}`);
    if (slug) {
      out.push({ url: `https://www.costco.com/CatalogSearch?dept=All&keyword=${encodeURIComponent(slug.replace(/-/g, '+'))}` , score: 0.4, reason: 'search-slug', patternId: 'cs:search' });
    }
    await Promise.all(out.map(c => this.track(input.productId, 'costco', c.url, c.patternId || 'cs', c.score, c.reason)));
    return out;
  }

  private static async forSamsClub(input: CandidateInput): Promise<UrlCandidate[]> {
    const out: UrlCandidate[] = [];
    const slug = slugify(`${input.name || ''} ${input.setName || ''}`);
    if (slug) {
      out.push({ url: `https://www.samsclub.com/s/${encodeURIComponent(slug.replace(/-/g, '+'))}` , score: 0.4, reason: 'search-slug', patternId: 'sc:search' });
    }
    await Promise.all(out.map(c => this.track(input.productId, 'sams-club', c.url, c.patternId || 'sc', c.score, c.reason)));
    return out;
  }
}

export const urlPatternService = URLPatternService;
