import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
import { logger } from '../../utils/logger';

interface TargetProduct {
  id?: string;
  name: string;
  price?: number;
  originalPrice?: number;
  url: string;
  imageUrl?: string;
  availability?: string;
  description?: string;
}

/**
 * Target retailer integration (scraping)
 * - Parses HTML search results and product pages
 * - Uses defensive selectors due to UI variations
 */
export class TargetService extends BaseRetailerService {
  constructor(config: RetailerConfig) {
    super(config);
  }

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const start = Date.now();
    try {
      const q = request.upc || request.sku || request.productId;
      logger.info(`Checking Target availability for: ${q}`);

      const product = await this.searchOne(q!);
      if (!product) {
        throw this.createRetailerError(`Product not found for: ${q}`, 'NOT_FOUND', 404, false);
      }

      const refined = await this.enrichFromProductPage(product);
      const parsed = this.parseResponse(refined || product, request);
      this.updateMetrics(true, Date.now() - start);
      return parsed;
    } catch (error) {
      this.updateMetrics(false, Date.now() - start);
      logger.error('Target availability check failed:', error);
      if (error instanceof RetailerError) throw error;
      throw this.createRetailerError(
        `Failed to check availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVER_ERROR',
        500,
        true
      );
    }
  }

  async searchProducts(query: string): Promise<ProductAvailabilityResponse[]> {
    const start = Date.now();
    try {
      logger.info(`Searching Target for: ${query}`);
      const results = await this.searchList(query);
      const filtered = results.filter(p => this.isPokemonTcgProduct(p.name));
      const responses = filtered.map(p => this.parseResponse(p, { productId: p.id || p.name }));
      this.updateMetrics(true, Date.now() - start);
      logger.info(`Target search complete: ${responses.length} TCG items`);
      return responses;
    } catch (error) {
      this.updateMetrics(false, Date.now() - start);
      logger.error(`Target search failed for query "${query}":`, error);
      if (error instanceof RetailerError) throw error;
      throw this.createRetailerError(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SERVER_ERROR',
        500,
        true
      );
    }
  }

  protected override async performHealthCheck(): Promise<void> {
    await this.makeRequest(`/s?searchTerm=pokemon%20tcg`, { render: true });
  }

  protected parseResponse(product: TargetProduct, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
    const inStock = this.deriveInStock(product.availability);
    const availabilityStatus = this.determineAvailabilityStatus(inStock, product.availability);

    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price: product.price,
      originalPrice: product.originalPrice,
      availabilityStatus,
      productUrl: product.url,
      cartUrl: undefined,
      stockLevel: undefined,
      storeLocations: [],
      lastUpdated: new Date(),
      metadata: {
        name: product.name,
        image: product.imageUrl,
        retailer: 'Target'
      }
    };
  }

  // --------- Internals ---------

  private async searchList(query: string): Promise<TargetProduct[]> {
    const url = `/s?searchTerm=${encodeURIComponent(query)}`;
    const res = await this.makeRequest(url, { render: true });
    const $: any = cheerio.load(res.data);

    const products: TargetProduct[] = [];

    // Common card containers on target.com
    const candidates = [
      'li[data-test="list-entry-product-card"]',
      'div[data-test="product-card"]',
      'div.h-padding-h-default' // fallback container
    ].join(',');

    $(candidates).each((_: any, el: any) => {
      const $el = $(el);
      const p = this.extractFromCard($ as any, $el as any);
      if (p && p.url && p.name) products.push(p);
    });

    // Fallback anchors
    if (products.length === 0) {
      $('a[href*="/p/"]').each((_: any, a: any) => {
        const $a = $(a);
        const name = $a.text().trim();
        const href = $a.attr('href') || '';
        if (!name || !href) return;
        products.push({ name, url: this.absUrl(href), price: this.findNearbyPrice($ as any, $a as any) });
      });
    }

    // Deduplicate by URL
    const deduped = new Map<string, TargetProduct>();
    for (const p of products) {
      const key = p.url.split('?')[0];
      if (!deduped.has(key)) deduped.set(key, p);
    }
    return Array.from(deduped.values());
  }

  private async searchOne(query: string): Promise<TargetProduct | null> {
    const list = await this.searchList(query);
    return list[0] || null;
  }

  private extractFromCard($: any, $el: any): TargetProduct | null {
    // Title
    const $title = $el.find('a[data-test="product-title"], a[data-test="product-card-title"], a[href*="/p/"]').first();
    const name = ($title.text() || '').trim();
    const href = $title.attr('href') || '';
    if (!name || !href) return null;

    // Price selectors
    const price = this.findPriceInCard($, $el);
    const orig = this.findOriginalPriceInCard($, $el);
    const img = this.findImageInCard($, $el);
    const avail = this.findAvailabilityText($, $el);

    // Target URLs include /p/<slug>/<tcin>
    const idMatch = href.match(/\/p\/[^/]+\/(\d+)/);
    const id = idMatch ? idMatch[1] : undefined;

    return {
      id,
      name,
      url: this.absUrl(href),
      price,
      originalPrice: orig,
      imageUrl: img || undefined,
      availability: avail || undefined,
    };
  }

  private findPriceInCard($: any, $el: any): number | undefined {
    const sel = [
      '[data-test="current-price"], [data-test="current-price-container"]',
      '.h-text-bs, .h-text-bs\@sm, .h-margin-t-tiny',
      'span:contains("$")'
    ].join(',');
    const text = ($el.find(sel).first().text() || '').trim();
    const price = this.parsePrice(text);
    return price > 0 ? price : undefined;
  }

  private findOriginalPriceInCard($: any, $el: any): number | undefined {
    const sel = [
      '[data-test="was-price"]',
      's:contains("$")'
    ].join(',');
    const text = ($el.find(sel).first().text() || '').trim();
    const price = this.parsePrice(text);
    return price > 0 ? price : undefined;
  }

  private findImageInCard($: any, $el: any): string | null {
    const img = $el.find('img').first();
    const src = img.attr('src') || img.attr('data-src') || '';
    return src ? this.absUrl(src) : null;
  }

  private findAvailabilityText($: any, $el: any): string | null {
    const text = ($el.find('[data-test="fulfillment-availability"], .styles__StyledFulfillment:contains("out of stock")').first().text() || '').trim();
    return text || null;
  }

  private findNearbyPrice($: any, $a: any): number | undefined {
    const $container = $a.closest('li,div,article');
    if ($container.length) {
      const text = $container.text();
      const match = text.match(/\$\s*([0-9]+(?:\.[0-9]{2})?)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (!Number.isNaN(val)) return val;
      }
    }
    return undefined;
  }

  private deriveInStock(avail?: string): boolean {
    if (!avail) return true;
    const t = avail.toLowerCase();
    if (t.includes('out of stock') || t.includes('sold out') || t.includes('unavailable')) return false;
    return true;
  }

  private absUrl(href: string): string {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    return `${this.config.baseUrl.replace(/\/$/, '')}${href.startsWith('/') ? '' : '/'}${href}`;
  }

  private async enrichFromProductPage(p: TargetProduct): Promise<TargetProduct | null> {
    try {
      const res = await this.makeRequest(p.url, { render: true });
      const $: any = cheerio.load(res.data);

      const availability = this.findAvailabilityText($, $('body')) || p.availability || undefined;
      let price = p.price;
      if (!price || price <= 0) {
        const priceText = $('body').find('[data-test="current-price"], .h-text-bs:contains("$")').first().text().trim();
        const parsed = this.parsePrice(priceText);
        if (parsed > 0) price = parsed;
      }
      let originalPrice = p.originalPrice;
      if (!originalPrice) {
        const opText = $('body').find('[data-test="was-price"], s:contains("$")').first().text().trim();
        const parsed = this.parsePrice(opText);
        if (parsed > 0) originalPrice = parsed;
      }
      let imageUrl = p.imageUrl;
      if (!imageUrl) {
        const img = $('body').find('img').first().attr('src') || $('body').find('img').first().attr('data-src') || '';
        if (img) imageUrl = this.absUrl(img);
      }
      return { ...p, availability, price, originalPrice, imageUrl };
    } catch (e) {
      return p;
    }
  }
}

