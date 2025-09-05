import * as cheerio from 'cheerio';
import { BaseModel } from '../models/BaseModel';
import { logger } from '../utils/logger';
import { HttpFetcherService } from './HttpFetcherService';
import { redisService } from './redisService';
import { UrlCandidateMetricsService } from './urlCandidateMetricsService';
import { dropSignalService } from './dropSignalService';

type CandidateRow = {
  id: string;
  product_id: string;
  retailer_id: string;
  url: string;
  status: 'unknown' | 'valid' | 'invalid' | 'live';
  score: number | null;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export class URLCandidateChecker {
  private static get db() { return BaseModel.getKnex(); }
  private static retailerSlugCache: Map<string, string> | null = null;

  private static async getRetailerSlug(retailerId: string): Promise<string | null> {
    if (!this.retailerSlugCache) {
      const rows: Array<{ id: string; slug: string }> = await this.db('retailers').select('id','slug');
      this.retailerSlugCache = new Map(rows.map(r => [r.id, r.slug] as const));
    }
    return this.retailerSlugCache.get(retailerId) || null;
  }

  private static async getBudgetForSlug(slug: string): Promise<number> {
    try {
      const key = `config:url_candidate:qpm:${slug}`;
      const val = await redisService.get(key);
      if (val) {
        const parsed = Number(val);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      // Temporary burst override for hot windows
      const burstKey = `config:url_candidate:qpm_burst:${slug}`;
      const burst = await redisService.get(burstKey);
      if (burst) {
        const parsed = Number(burst);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    const envKey = `URL_CANDIDATE_QPM_${slug.toUpperCase().replace(/[^A-Z0-9]/g,'_')}`;
    const specific = Number(process.env[envKey] || 0);
    const def = Number(process.env.URL_CANDIDATE_QPM_DEFAULT || 6);
    return specific > 0 ? specific : def > 0 ? def : 6;
  }

  private static async checkAndConsumeBudget(slug: string): Promise<boolean> {
    try {
      const qpm = await this.getBudgetForSlug(slug);
      const key = `candqpm:${slug}`;
      const { isLimited } = await redisService.rateLimit(key, 60, qpm);
      return !isLimited;
    } catch {
      return true; // fail-open on budget
    }
  }

  static async checkBatch(limit: number = 25): Promise<{ checked: number; liveFound: number }> {
    try {
      const rows: CandidateRow[] = await this.db('url_candidates')
        .select('id', 'product_id', 'retailer_id', 'url', 'status', 'score')
        .whereIn('status', ['unknown', 'valid'])
        .orderBy('updated_at', 'asc')
        .limit(limit);

      if (!rows.length) return { checked: 0, liveFound: 0 };

      const fetcher = new HttpFetcherService(process.env.HTTP_FETCH_PROVIDER as any);
      const timeoutMs = Number(process.env.URL_CANDIDATE_TIMEOUT_MS || 8000);
      let live = 0;
      for (const c of rows) {
        let newStatus: CandidateRow['status'] = c.status;
        let newScore = c.score ?? 0.5;
        let reason = '';
        let ok = false;
        try {
          // Per-retailer QPM budget
          const slug0 = await this.getRetailerSlug(c.retailer_id);
          if (slug0) {
            const allowed = await this.checkAndConsumeBudget(slug0);
            if (!allowed) {
              // Skip quietly when budget exceeded
              continue;
            }
          }

          // Record request
          const slug = slug0 || await this.getRetailerSlug(c.retailer_id);
          if (slug) { await UrlCandidateMetricsService.record(slug, 'requests'); }

          // Per-retailer render/session behavior
          const slug = slug0 || await this.getRetailerSlug(c.retailer_id);
          // Resolve render/session config: prefer redis override, else env
          let renderBehavior = this.getRenderBehaviorForSlug(slug || undefined);
          let useSession = this.getSessionReuseForSlug(slug || undefined);
          if (slug) {
            try {
              const rb = await redisService.get(`config:url_candidate:render_behavior:${slug}`);
              const rbv = (rb || '').toLowerCase();
              if (rbv === 'always' || rbv === 'on_block' || rbv === 'never') renderBehavior = rbv as any;
            } catch {}
            try {
              const sr = await redisService.get(`config:url_candidate:session_reuse:${slug}`);
              const srl = (sr || '').toLowerCase();
              if (srl === 'false' || srl === '0' || srl === 'no') useSession = false;
              else if (srl === 'true' || srl === '1' || srl === 'yes') useSession = true;
            } catch {}
          }

          let res = await fetcher.get(c.url, { timeout: timeoutMs, render: renderBehavior === 'always', useSession });
          // If blocked or proxied errors detected, optionally retry with render=true
          const bodyStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
          const blocked = /incapsula|captcha|access denied|request unsuccessful|bot|forbidden|proxy authentication/i.test(bodyStr) || [403, 407, 429].includes(Number(res.status));
          const renderOnBlock = renderBehavior === 'on_block' && (String(process.env.URL_CANDIDATE_RENDER_ON_BLOCK || 'true').toLowerCase() !== 'false');
          const forceRender = renderBehavior === 'always' || (String(process.env.URL_CANDIDATE_FORCE_RENDER || 'false').toLowerCase() === 'true');
          if (slug) { await UrlCandidateMetricsService.record(slug, blocked ? 'blocked' : 'requests'); }
          if (forceRender && !blocked) {
            try {
              // Already rendered in initial call if 'always'; this branch is for global force flag
              res = await fetcher.get(c.url, { timeout: Math.max(timeoutMs, 12000), render: true, useSession });
            } catch {}
          } else if (blocked && renderOnBlock) {
            try {
              res = await fetcher.get(c.url, { timeout: Math.max(timeoutMs, 12000), render: true, useSession });
            } catch (e) {
              // keep original res
            }
          }
          const { data, status, headers } = res;
          const statusCode = Number(status || 0);
          if (statusCode >= 200 && statusCode < 300) {
            ok = true;
            const html = typeof data === 'string' ? data : JSON.stringify(data);
            const evalOut = this.evaluateHtml(c.url, html);
            const productPage = evalOut.productPage;
            // Tightened gating: product page + price + CTA by default; retailer-specific overrides can relax
            const allow = this.isLiveAllowedByRetailer(slug || undefined, evalOut);
            if (allow) {
              newStatus = 'live';
              newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) + 0.25);
              reason = this.buildReason('live', evalOut);
              live++;
              // Persist outcomes and emit drop signal
              try {
                const { DropOutcomeService } = await import('./DropOutcomeService');
                await DropOutcomeService.recordFirstSeen(c.product_id, c.retailer_id, new Date());
              } catch {}
              if (slug) { await UrlCandidateMetricsService.record(slug, 'live'); }
              // Emit drop signal
              await dropSignalService.publishSignal({
                product_id: c.product_id,
                retailer_id: c.retailer_id,
                signal_type: 'url_live',
                signal_value: c.url,
                confidence: 85,
                source: 'url-candidate-checker'
              });
            } else {
              newStatus = 'valid';
              newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) + 0.05);
              reason = this.buildReason('valid', evalOut);
              if (slug) { await UrlCandidateMetricsService.record(slug, 'valid'); }
            }
          } else if (statusCode === 404 || statusCode === 410) {
            newStatus = 'invalid';
            newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) - 0.3);
            reason = `http_${statusCode}`;
            if (slug) { await UrlCandidateMetricsService.record(slug, 'invalid'); }
          } else if (statusCode === 403 || statusCode === 429) {
            // transient/forbidden; keep unknown but penalize a bit
            newStatus = 'unknown';
            newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) - 0.05);
            reason = `http_${statusCode}`;
          } else {
            newStatus = 'unknown';
            newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) - 0.05);
            reason = `http_${statusCode}`;
          }
        } catch (e: any) {
          const msg = (e?.response?.status ? `http_${e.response.status}` : (e?.code || e?.message || 'error')) as string;
          reason = String(msg);
          const slug = await this.getRetailerSlug(c.retailer_id);
          if (slug) { await UrlCandidateMetricsService.record(slug, 'errors'); }
          if (/404|410/.test(reason)) {
            newStatus = 'invalid';
            newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) - 0.3);
          } else if (/403|429|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(reason)) {
            newStatus = 'unknown';
            newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) - 0.05);
          } else {
            newStatus = 'unknown';
            newScore = clamp01((Number.isFinite(newScore) ? newScore : 0.5) - 0.02);
          }
        }

        await this.db('url_candidates')
          .where({ id: c.id })
          .update({
            status: newStatus,
            score: newScore,
            reason,
            last_checked_at: new Date(),
            updated_at: new Date(),
          });

        // Gentle pacing to respect rate limits
        await new Promise(r => setTimeout(r, Number(process.env.URL_CANDIDATE_DELAY_MS || 250)));
      }

      return { checked: rows.length, liveFound: live };
    } catch (error) {
      logger.error('URLCandidateChecker.checkBatch failed', { error: error instanceof Error ? error.message : String(error) });
      return { checked: 0, liveFound: 0 };
    }
  }

  // Public helper to support unit tests and consistent reason taxonomy
  public static evaluateHtml(url: string, html: string): { productPage: boolean; cta: boolean; price: boolean; jsonld: boolean; productSignals: string[] } {
    const $ = cheerio.load(html);
    const text = $('body').text().toLowerCase();
    const title = ($('title').text() || '').toLowerCase();

    // CTA / availability heuristics
    const cta = /(add to cart|buy now|ship it|pickup|add to basket)/i.test(text);
    const inStockText = /(in stock|available|ready to ship)/i.test(text) && !/(out of stock|sold out|unavailable)/i.test(text);
    const price = /\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?/.test(text);

    // JSON-LD Product detection with basic field expectations
    let jsonld = false;
    try {
      $('script[type="application/ld+json"]').each((_, el) => {
        const t = ($(el).text() || '').trim();
        if (!t) return;
        try {
          const j = JSON.parse(t);
          const arr = Array.isArray(j) ? j : [j];
          for (const obj of arr) {
            const type = (obj['@type'] || obj['type'] || '').toString().toLowerCase();
            if (type.includes('product')) {
              // Look for expected price/offer fields
              const offers = obj.offers || obj.offer || {};
              const hasPrice = !!(offers.price || offers.lowPrice || offers.highPrice || obj.price || obj.sku || obj.gtin12 || obj.gtin13);
              if (hasPrice) { jsonld = true; break; }
            }
          }
        } catch {}
      });
    } catch {}

    const productSignals: string[] = [];
    if (cta) productSignals.push('cta');
    if (inStockText) productSignals.push('in_stock_text');
    if (price) productSignals.push('price_seen');
    if (jsonld) productSignals.push('jsonld_product');

    // Product page check using URL and structure
    const productPage = this.isLikelyProductPage(url, html);
    return { productPage, cta: (cta || inStockText), price, jsonld, productSignals };
  }

  private static isLikelyProductPage(url: string, html: string): boolean {
    try {
      const u = new URL(url);
      const host = u.hostname;
      const path = u.pathname;
      // Target: product pages contain /p/<slug>/<tcin>
      if (/target\.com$/.test(host)) return /\/p\//.test(path);
      // BestBuy: /site/<slug>/<sku>.p
      if (/bestbuy\.com$/.test(host)) return /\/site\//.test(path) && /\.p$/.test(path);
      // Walmart: /ip/<item-id>
      if (/walmart\.com$/.test(host)) return /\/ip\//.test(path);
      // Costco: /<slug>.product.<id>.html (varies)
      if (/costco\.com$/.test(host)) return /product\./i.test(path);
      // Sam's Club: /p/<slug>/<id>
      if (/samsclub\.com$/.test(host)) return /\/p\//.test(path);
      // Fallback: presence of JSON-LD Product in page
      const $ = cheerio.load(html);
      const productSchema = $('script[type="application/ld+json"]').filter((_, el) => /Product/i.test($(el).text())).length > 0;
      return productSchema;
    } catch {
      return false;
    }
  }

  private static buildReason(prefix: 'live' | 'valid', evalOut: { productPage: boolean; cta: boolean; price: boolean; jsonld: boolean; productSignals: string[] }): string {
    const bits = [
      `pg=${evalOut.productPage ? 1 : 0}`,
      `cta=${evalOut.cta ? 1 : 0}`,
      `price=${evalOut.price ? 1 : 0}`,
      `jsonld=${evalOut.jsonld ? 1 : 0}`
    ];
    return `${prefix}:${bits.join(',')}`;
  }

  private static isLiveAllowedByRetailer(slug: string | undefined, evalOut: { productPage: boolean; cta: boolean; price: boolean; jsonld: boolean }): boolean {
    // Default: require product page + CTA + price together
    const defaultAllow = evalOut.productPage && evalOut.cta && evalOut.price;
    if (!slug) return defaultAllow;
    switch (slug) {
      case 'target':
        // Target: product page + JSON-LD Product + price (CTA often dynamic)
        return evalOut.productPage && evalOut.jsonld && evalOut.price;
      case 'best-buy':
        // BestBuy: enforce /site/ pages + CTA + price
        return defaultAllow;
      case 'walmart':
      case 'costco':
      case 'sams-club':
        return defaultAllow;
      default:
        return defaultAllow;
    }
  }

  private static getRenderBehaviorForSlug(slug?: string): 'always' | 'on_block' | 'never' {
    if (!slug) return 'on_block';
    // Redis-configurable override
    const key = `config:url_candidate:render_behavior:${slug}`;
    // Note: synchronous redis not available; we read env first and let controller write env-like into redis
    // For now, prefer env; controller will set env variables on process where applicable
    const envKey = `URL_CANDIDATE_RENDER_BEHAVIOR_${slug.toUpperCase().replace(/[^A-Z0-9]/g,'_')}`;
    const rawEnv = (process.env[envKey] || '').toLowerCase();
    if (rawEnv === 'always' || rawEnv === 'on_block' || rawEnv === 'never') return rawEnv as any;
    // Non-blocking attempt to read redis value
    try {
      const v = (redisService as any)?.get ? undefined : undefined; // placeholder to avoid TS unused import warnings
    } catch {}
    return 'on_block';
  }

  private static getSessionReuseForSlug(slug?: string): boolean {
    if (!slug) return true;
    const envKey = `URL_CANDIDATE_SESSION_REUSE_${slug.toUpperCase().replace(/[^A-Z0-9]/g,'_')}`;
    const raw = (process.env[envKey] || '').toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'no') return false;
    if (raw === 'true' || raw === '1' || raw === 'yes') return true;
    return true;
  }
}

export const urlCandidateChecker = URLCandidateChecker;
