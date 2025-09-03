import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
import { logger } from '../../utils/logger';

interface WGProduct {
  id?: string;
  name: string;
  price?: number;
  originalPrice?: number;
  url: string;
  imageUrl?: string;
  availability?: string;
  shippingText?: string;
  shippingDateIso?: string;
}

export class WalgreensService extends BaseRetailerService {
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
      logger.error('Walgreens availability check failed:', e);
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
    // Use search page for a more stable health check
    await this.makeRequest(`/search/results.jsp?Ntt=pokemon%20tcg`, { render: true });
  }

  protected parseResponse(p: WGProduct, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
    const hasShip = !!p.shippingDateIso || /arrives|get it by|get it on|delivery|delivers|ships/i.test(p.shippingText || '');
    const inStock = hasShip ? true : this.deriveInStock(p.availability);
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
      metadata: { name: p.name, image: p.imageUrl, retailer: 'Walgreens', shippingText: p.shippingText, shippingDateIso: p.shippingDateIso }
    };
  }

  private async searchList(query: string): Promise<WGProduct[]> {
    const res = await this.makeRequest(`/search/results.jsp?Ntt=${encodeURIComponent(query)}`, { render: true });
    const $: any = cheerio.load(res.data);
    const products: WGProduct[] = [];
    $('div.product__card').each((_: any, el: any) => {
      const $el = $(el);
      const $a = $el.find('a.product__name').first();
      const name = ($a.text() || '').trim();
      const href = $a.attr('href') || '';
      if (!name || !href) return;
      const priceText = $el.find('.product__price, .product__sale-price').first().text();
      const img = $el.find('img').first().attr('src') || '';
      const avail = $el.find('.availability, .fulfillment').first().text();
      const shipInfo = this.findShippingInfoInElement($ as any, $el as any);
      products.push({
        id: href.split('/').pop(),
        name,
        url: this.absUrl(href),
        price: this.parsePrice(priceText),
        imageUrl: img ? this.absUrl(img) : undefined,
        availability: avail || undefined,
        shippingText: shipInfo.text,
        shippingDateIso: shipInfo.dateIso
      });
    });
    const map = new Map<string, WGProduct>();
    for (const p of products) {
      const key = p.url.split('?')[0];
      if (!map.has(key)) map.set(key, p);
    }
    return Array.from(map.values());
  }

  private async searchOne(query: string): Promise<WGProduct | null> {
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
