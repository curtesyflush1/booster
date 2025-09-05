import { HttpFetcherService } from './HttpFetcherService';
import { logger } from '../utils/logger';
import { redisService } from './redisService';

type DiffResult = { slug: string; added: string[]; removed: string[]; totalNow: number };

/**
 * Lightweight sitemap/search diff for retailers which do not expose stable APIs.
 * - Stores last seen set in Redis keys per slug
 * - Computes delta against current fetch
 * - Emits log for now; future: persist to discovery tables and seed url_candidates
 */
export class RetailerDiscoveryDiffService {
  static async runForSlugs(slugs: Array<'walmart'|'costco'|'sams-club'>): Promise<DiffResult[]> {
    const fetcher = new HttpFetcherService(process.env.HTTP_FETCH_PROVIDER as any);
    const outs: DiffResult[] = [];
    for (const slug of slugs) {
      try {
        const urlsNow = await this.fetchCurrentUrls(slug, fetcher);
        const key = `retailer:snapshot:${slug}`;
        const prevJson = await redisService.get(key);
        const prev = prevJson ? (JSON.parse(prevJson) as string[]) : [];
        const nowSet = new Set(urlsNow);
        const prevSet = new Set(prev);
        const added = urlsNow.filter(u => !prevSet.has(u));
        const removed = prev.filter(u => !nowSet.has(u));
        await redisService.set(key, JSON.stringify(urlsNow), 0);
        outs.push({ slug, added, removed, totalNow: urlsNow.length });
        if (added.length || removed.length) {
          logger.info(`[DiscoveryDiff] ${slug}: added=${added.length} removed=${removed.length} total=${urlsNow.length}`);
        }
      } catch (e) {
        logger.warn(`[DiscoveryDiff] failed for ${slug}`, { error: e instanceof Error ? e.message : String(e) });
      }
    }
    return outs;
  }

  private static async fetchCurrentUrls(slug: 'walmart'|'costco'|'sams-club', fetcher: HttpFetcherService): Promise<string[]> {
    switch (slug) {
      case 'walmart':
        // Best effort: home sitemap index is large; use search for high-signal terms to emulate discovery
        return await this.searchUrls('https://www.walmart.com/search?q=pokemon+tcg', fetcher, /\/ip\//i);
      case 'costco':
        return await this.searchUrls('https://www.costco.com/CatalogSearch?dept=All&keyword=pokemon%20tcg', fetcher, /product\./i);
      case 'sams-club':
        return await this.searchUrls('https://www.samsclub.com/s/pokemon%20tcg', fetcher, /\/p\//i);
    }
  }

  private static async searchUrls(searchUrl: string, fetcher: HttpFetcherService, pattern: RegExp): Promise<string[]> {
    try {
      const res = await fetcher.get(searchUrl, { render: true, timeout: 18000 });
      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const hrefs = Array.from(html.matchAll(/href\s*=\s*"([^"]+)"/gi)).map(m => m[1]);
      const abs = (u: string) => u.startsWith('http') ? u : new URL(u, searchUrl).toString();
      const urls = hrefs.filter(h => pattern.test(h)).map(abs);
      const uniq = Array.from(new Set(urls)).slice(0, 500);
      return uniq;
    } catch {
      return [];
    }
  }
}

export const retailerDiscoveryDiffService = RetailerDiscoveryDiffService;

