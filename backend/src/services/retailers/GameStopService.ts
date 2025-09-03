import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
import { logger } from '../../utils/logger';

interface GameStopProduct {
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
 * GameStop retailer integration (scraping)
 * - Uses HTML search results and product pages
 * - Defensive parsing with multiple selectors to handle theme variations
 */
export class GameStopService extends BaseRetailerService {
  constructor(config: RetailerConfig) {
    super(config);
  }

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const startTime = Date.now();
    try {
      const q = request.upc || request.sku || request.productId;
      logger.info(`Checking GameStop availability for: ${q}`);

      const product = await this.searchOne(q!);
      if (!product) {
        throw this.createRetailerError(`Product not found for: ${q}`, 'NOT_FOUND', 404, false);
      }

      // Optionally refine from product page for availability hints
      const refined = await this.enrichFromProductPage(product);
      const parsed = this.parseResponse(refined || product, request);

      this.updateMetrics(true, Date.now() - startTime);
      return parsed;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`GameStop availability check failed:`, error);
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
    const startTime = Date.now();
    try {
      logger.info(`Searching GameStop for: ${query}`);
      const results = await this.searchList(query);
      const filtered = results.filter(p => this.isPokemonTcgProduct(p.name));
      const responses = filtered.map(p => this.parseResponse(p, { productId: p.id || p.name }));
      this.updateMetrics(true, Date.now() - startTime);
      logger.info(`GameStop search complete: ${responses.length} TCG items`);
      return responses;
    } catch (error) {
      this.updateMetrics(false, Date.now() - startTime);
      logger.error(`GameStop search failed for query "${query}":`, error);
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
    // Light search request; render=true to bypass CF when a browser/unlocker is configured
    await this.makeRequest(`/search/?q=pokemon%20tcg`, { render: true });
  }

  protected parseResponse(product: GameStopProduct, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
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
      cartUrl: this.buildCartUrl(product.url, this.config.id),
      stockLevel: undefined,
      storeLocations: [],
      lastUpdated: new Date(),
      metadata: {
        name: product.name,
        image: product.imageUrl,
        retailer: 'GameStop'
      }
    };
  }

  // --------- Internals ---------

  private async searchList(query: string): Promise<GameStopProduct[]> {
    const url = `/search/?q=${encodeURIComponent(query)}`;
    const res = await this.makeRequest(url, { render: true });
    const $: any = cheerio.load(res.data);

    const products: GameStopProduct[] = [];

    // Try multiple card containers common on GameStop
    const candidates = [
      'div.product-grid-tile',
      'div.product-grid-item',
      'div.product-tile',
      'div.ProductCard',
      'li.grid-tile',
      'article[class*="product"]'
    ].join(',');

    $(candidates).each((_: any, el: any) => {
      const $el = $(el);
      const product = this.extractFromCard($ as any, $el as any);
      if (product && product.url && product.name) {
        products.push(product);
      }
    });

    // Fallback: scan anchors that look like product links
    if (products.length === 0) {
      $('a[href*="/product/"], a[href*="/products/"]').each((_: any, a: any) => {
        const $a = $(a);
        const name = $a.text().trim();
        const href = $a.attr('href') || '';
        if (!name || !href) return;
        const product: GameStopProduct = {
          name,
          url: this.absUrl(href),
          price: this.findNearbyPrice($ as any, $a as any)
        };
        products.push(product);
      });
    }

    // Basic de-dupe by URL
    const deduped = new Map<string, GameStopProduct>();
    for (const p of products) {
      const key = p.url.split('?')[0];
      if (!deduped.has(key)) deduped.set(key, p);
    }
    return Array.from(deduped.values());
  }

  private async searchOne(query: string): Promise<GameStopProduct | null> {
    const list = await this.searchList(query);
    return list[0] || null;
  }

  private extractFromCard($: any, $el: any): GameStopProduct | null {
    // Title selectors
    const titleSel = [
      'a.product-name',
      'a.product-title',
      'a.ProductCard__Title',
      '.product-name a',
      '.ProductCard a',
      'a[href*="/product/"]'
    ].join(',');
    const $title = $el.find(titleSel).first();
    const name = ($title.text() || '').trim();
    const href = $title.attr('href') || '';

    if (!name || !href) return null;

    const price = this.findPriceInCard($, $el);
    const orig = this.findOriginalPriceInCard($, $el);
    const img = this.findImageInCard($, $el);
    const availText = this.findAvailabilityText($, $el);

    // Try to extract a simple id token from URL if present
    const idMatch = href.match(/\/(?:product|products)\/(\d+)[^/]*$/i) || href.match(/sku=(\d+)/i);
    const id = idMatch ? idMatch[1] : undefined;

    return {
      id,
      name,
      url: this.absUrl(href),
      price,
      originalPrice: orig,
      imageUrl: img || undefined,
      availability: availText || undefined,
    };
  }

  private findPriceInCard($: any, $el: any): number | undefined {
    const sel = [
      '.actual-price',
      '.product-price',
      '.price',
      '[data-qa="price"], [data-qa="product-price"]',
      'span:contains("$")'
    ].join(',');
    const text = ($el.find(sel).first().text() || '').trim();
    const price = this.parsePrice(text);
    return price > 0 ? price : undefined;
  }

  private findOriginalPriceInCard($: any, $el: any): number | undefined {
    const sel = [
      '.strike-price',
      '.was-price',
      '.original-price',
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
    const sel = [
      '.availability',
      '[data-qa="availability"]',
      '.pickup-availability',
      '.shipping-availability'
    ].join(',');
    const text = ($el.find(sel).first().text() || '').trim();
    return text || null;
  }

  private findNearbyPrice($: any, $a: any): number | undefined {
    // Walk up a bit and search for price-like text
    const $container = $a.closest('div,li,article');
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
    if (!avail) return true; // default to true if unknown
    const t = avail.toLowerCase();
    if (t.includes('out of stock') || t.includes('sold out') || t.includes('unavailable')) return false;
    return true;
  }

  private absUrl(href: string): string {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    return `${this.config.baseUrl.replace(/\/$/, '')}${href.startsWith('/') ? '' : '/'}${href}`;
  }

  private async enrichFromProductPage(p: GameStopProduct): Promise<GameStopProduct | null> {
    try {
      const res = await this.makeRequest(p.url, { render: true });
      const $: any = cheerio.load(res.data);

      // Try to pick explicit availability or price if missing
      const availability = this.findAvailabilityText($, $('body')) || p.availability || undefined;
      let price = p.price;
      if (!price || price <= 0) {
        const priceText = $('body').find('.price, .actual-price, [data-qa="price"]').first().text().trim();
        const parsed = this.parsePrice(priceText);
        if (parsed > 0) price = parsed;
      }
      let originalPrice = p.originalPrice;
      if (!originalPrice) {
        const opText = $('body').find('.strike-price, .original-price, s:contains("$")').first().text().trim();
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
      // Non-fatal; return original
      return p;
    }
  }
}
