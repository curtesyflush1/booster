import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
import { logger } from '../../utils/logger';

interface AmazonProduct {
  id?: string;
  name: string;
  price?: number;
  originalPrice?: number;
  url: string;
  imageUrl?: string;
  availability?: string;
}

export class AmazonService extends BaseRetailerService {
  constructor(config: RetailerConfig) {
    super(config);
  }

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const start = Date.now();
    try {
      const q = request.upc || request.sku || request.productId;
      const product = await this.searchOne(q!);
      if (!product) throw this.createRetailerError(`Product not found: ${q}`, 'NOT_FOUND', 404, false);
      const parsed = this.parseResponse(product, request);
      this.updateMetrics(true, Date.now() - start);
      return parsed;
    } catch (e) {
      this.updateMetrics(false, Date.now() - start);
      logger.error('Amazon availability check failed:', e);
      if (e instanceof RetailerError) throw e;
      throw this.createRetailerError('Failed to check availability', 'SERVER_ERROR', 500, true);
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
    await this.makeRequest(`/s?k=pokemon+tcg`, { render: true });
  }

  protected parseResponse(p: AmazonProduct, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
    const inStock = this.deriveInStock(p.availability);
    const status = this.determineAvailabilityStatus(inStock, p.availability);
    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price: p.price,
      originalPrice: p.originalPrice,
      availabilityStatus: status,
      productUrl: p.url,
      cartUrl: undefined,
      stockLevel: undefined,
      storeLocations: [],
      lastUpdated: new Date(),
      metadata: { name: p.name, image: p.imageUrl, retailer: 'Amazon' }
    };
  }

  private async searchList(query: string): Promise<AmazonProduct[]> {
    const res = await this.makeRequest(`/s?k=${encodeURIComponent(query)}`, { render: true });
    const $: any = cheerio.load(res.data);
    const products: AmazonProduct[] = [];
    $('div.s-result-item').each((_: any, el: any) => {
      const $el = $(el);
      const $a = $el.find('a.a-link-normal.s-no-outline').first();
      const name = ($el.find('span.a-text-normal').first().text() || '').trim();
      const href = $a.attr('href') || '';
      if (!name || !href) return;
      const priceText = $el.find('span.a-offscreen').first().text();
      const image = $el.find('img.s-image').attr('src') || '';
      products.push({
        id: href.split('/').slice(-1)[0],
        name,
        url: this.absUrl(href),
        price: this.parsePrice(priceText),
        imageUrl: image ? this.absUrl(image) : undefined
      });
    });
    const map = new Map<string, AmazonProduct>();
    for (const p of products) {
      const key = p.url.split('?')[0];
      if (!map.has(key)) map.set(key, p);
    }
    return Array.from(map.values());
  }

  private async searchOne(query: string): Promise<AmazonProduct | null> {
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

