import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
import { logger } from '../../utils/logger';

interface BNProduct {
  id?: string;
  name: string;
  price?: number;
  originalPrice?: number;
  url: string;
  imageUrl?: string;
  availability?: string;
}

export class BarnesNobleService extends BaseRetailerService {
  constructor(config: RetailerConfig) {
    super(config);
  }

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const start = Date.now();
    try {
      const q = request.upc || request.sku || request.productId;
      const product = await this.searchOne(q!);
      if (!product) throw this.createRetailerError(`Product not found for: ${q}`, 'NOT_FOUND', 404, false);
      const parsed = this.parseResponse(product, request);
      this.updateMetrics(true, Date.now() - start);
      return parsed;
    } catch (e) {
      this.updateMetrics(false, Date.now() - start);
      logger.error('Barnes & Noble availability check failed:', e);
      if (e instanceof RetailerError) throw e;
      throw this.createRetailerError(
        `Failed to check availability: ${e instanceof Error ? e.message : 'Unknown error'}`,
        'SERVER_ERROR',
        500,
        true
      );
    }
  }

  async searchProducts(query: string): Promise<ProductAvailabilityResponse[]> {
    const start = Date.now();
    try {
      const list = await this.searchList(query);
      const filtered = list.filter(p => this.isPokemonTcgProduct(p.name));
      const out = filtered.map(p => this.parseResponse(p, { productId: p.id || p.name }));
      this.updateMetrics(true, Date.now() - start);
      return out;
    } catch (e) {
      this.updateMetrics(false, Date.now() - start);
      if (e instanceof RetailerError) throw e;
      throw this.createRetailerError('Search failed', 'SERVER_ERROR', 500, true);
    }
  }

  protected override async performHealthCheck(): Promise<void> {
    await this.makeRequest(`/s/pokemon%20tcg`, { render: true });
  }

  protected parseResponse(p: BNProduct, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
    const inStock = this.deriveInStock(p.availability);
    const availabilityStatus = this.determineAvailabilityStatus(inStock, p.availability);
    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price: p.price,
      originalPrice: p.originalPrice,
      availabilityStatus,
      productUrl: p.url,
      cartUrl: undefined,
      stockLevel: undefined,
      storeLocations: [],
      lastUpdated: new Date(),
      metadata: { name: p.name, image: p.imageUrl, retailer: 'Barnes & Noble' }
    };
  }

  private async searchList(query: string): Promise<BNProduct[]> {
    const res = await this.makeRequest(`/s/${encodeURIComponent(query)}`, { render: true });
    const $: any = cheerio.load(res.data);
    const products: BNProduct[] = [];
    // Common BN selectors
    const candidates = [
      'li.product-shelf-tile',
      'div.product-shelf-info',
      'article.product-shelf-tile'
    ].join(',');
    $(candidates).each((_: any, el: any) => {
      const $el = $(el);
      const $title = $el.find('h3 a, .product-info-title a').first();
      const name = ($title.text() || '').trim();
      const href = $title.attr('href') || '';
      if (!name || !href) return;
      const priceText = $el.find('.current, .sr-only:contains("$"), .price').first().text();
      const origText = $el.find('.old-price, s:contains("$")').first().text();
      const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || '';
      const avail = $el.find('.availability, .fulfillment').first().text();
      products.push({
        id: href.split('/').pop(),
        name,
        url: this.absUrl(href),
        price: this.parsePrice(priceText),
        originalPrice: this.parsePrice(origText),
        imageUrl: img ? this.absUrl(img) : undefined,
        availability: avail || undefined
      });
    });
    // Dedup
    const map = new Map<string, BNProduct>();
    for (const p of products) {
      const key = p.url.split('?')[0];
      if (!map.has(key)) map.set(key, p);
    }
    return Array.from(map.values());
  }

  private async searchOne(query: string): Promise<BNProduct | null> {
    const list = await this.searchList(query);
    return list[0] || null;
  }

  private deriveInStock(avail?: string): boolean {
    if (!avail) return true;
    const t = avail.toLowerCase();
    if (t.includes('out of stock') || t.includes('unavailable')) return false;
    return true;
  }

  private absUrl(href: string): string {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    return `${this.config.baseUrl.replace(/\/$/, '')}${href.startsWith('/') ? '' : '/'}${href}`;
  }
}

