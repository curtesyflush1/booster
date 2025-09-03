import * as cheerio from 'cheerio';
import { RetailerConfig, ProductAvailabilityRequest, ProductAvailabilityResponse, RetailerError } from '../../types/retailer';
import { BaseRetailerService } from './BaseRetailerService';
import { logger } from '../../utils/logger';

interface ScheinProduct {
  id?: string;
  name: string;
  price?: number;
  originalPrice?: number;
  url: string;
  imageUrl?: string;
  availability?: string;
  description?: string;
  shippingText?: string;
  shippingDateIso?: string;
}

export class HenryScheinService extends BaseRetailerService {
  constructor(config: RetailerConfig) {
    super(config);
  }

  async checkAvailability(request: ProductAvailabilityRequest): Promise<ProductAvailabilityResponse> {
    const start = Date.now();
    try {
      const q = request.upc || request.sku || request.productId;
      logger.info(`Checking Henry Schein availability for: ${q}`);
      const product = await this.searchOne(q!);
      if (!product) throw this.createRetailerError(`Product not found: ${q}`, 'NOT_FOUND', 404, false);
      const refined = await this.enrichFromProductPage(product);
      const parsed = this.parseResponse(refined || product, request);
      this.updateMetrics(true, Date.now() - start);
      return parsed;
    } catch (error) {
      this.updateMetrics(false, Date.now() - start);
      logger.error(`Henry Schein availability check failed:`, error);
      if (error instanceof RetailerError) throw error;
      throw this.createRetailerError('Failed to check availability', 'SERVER_ERROR', 500, true);
    }
  }

  async searchProducts(query: string): Promise<ProductAvailabilityResponse[]> {
    const start = Date.now();
    try {
      const results = await this.searchList(query);
      const filtered = results.filter(p => this.isPokemonTcgProduct(p.name));
      const responses = filtered.map(p => this.parseResponse(p, { productId: p.id || p.name }));
      this.updateMetrics(true, Date.now() - start);
      return responses;
    } catch (error) {
      this.updateMetrics(false, Date.now() - start);
      logger.error(`Henry Schein search failed for ${query}:`, error);
      if (error instanceof RetailerError) throw error;
      throw this.createRetailerError('Search failed', 'SERVER_ERROR', 500, true);
    }
  }

  protected override async performHealthCheck(): Promise<void> {
    // US site often under /us-en/; search route varies, try basic site root
    await this.makeRequest(`/us-en/search?q=pokemon`, { render: true });
  }

  protected parseResponse(product: ScheinProduct, request: ProductAvailabilityRequest): ProductAvailabilityResponse {
    const hasShip = !!product.shippingDateIso || /arrives|get it by|get it on|delivery|delivers|ships|estimated/i.test(product.shippingText || '');
    const inStock = hasShip ? true : this.deriveInStock(product.availability);
    const status = this.determineAvailabilityStatus(inStock, product.availability);
    return {
      productId: request.productId,
      retailerId: this.config.id,
      inStock,
      price: product.price,
      originalPrice: product.originalPrice,
      availabilityStatus: status,
      productUrl: product.url,
      cartUrl: this.buildCartUrl(product.url, this.config.id),
      stockLevel: undefined,
      storeLocations: [],
      lastUpdated: new Date(),
      metadata: {
        name: product.name,
        image: product.imageUrl,
        retailer: 'Henry Schein',
        shippingText: product.shippingText,
        shippingDateIso: product.shippingDateIso
      }
    };
  }

  // -------- Internals --------
  private async searchList(query: string): Promise<ScheinProduct[]> {
    const url = `/us-en/search?q=${encodeURIComponent(query)}`;
    const res = await this.makeRequest(url, { render: true });
    const $: any = cheerio.load(res.data);

    const products: ScheinProduct[] = [];
    const candidates = [
      'div.product-tile',
      'div.card.product',
      'li.product',
      'div.search-result-item'
    ].join(',');

    $(candidates).each((_: any, el: any) => {
      const $el = $(el);
      const p = this.extractFromCard($ as any, $el as any);
      if (p && p.url && p.name) products.push(p);
    });

    if (products.length === 0) {
      $('a[href*="/product/"]').each((_: any, a: any) => {
        const $a = $(a);
        const name = $a.text().trim();
        const href = $a.attr('href') || '';
        if (!name || !href) return;
        products.push({ name, url: this.absUrl(href), price: this.findNearbyPrice($ as any, $a as any) });
      });
    }

    const deduped = new Map<string, ScheinProduct>();
    for (const p of products) {
      const key = p.url.split('?')[0];
      if (!deduped.has(key)) deduped.set(key, p);
    }
    return Array.from(deduped.values());
  }

  private async searchOne(query: string): Promise<ScheinProduct | null> {
    const list = await this.searchList(query);
    return list[0] || null;
  }

  private extractFromCard($: any, $el: any): ScheinProduct | null {
    const $title = $el.find('a.product-link, a[href*="/product/"]').first();
    const name = ($title.text() || '').trim();
    const href = $title.attr('href') || '';
    if (!name || !href) return null;

    const price = this.findPriceInCard($, $el);
    const orig = this.findOriginalPriceInCard($, $el);
    const img = this.findImageInCard($, $el);
    const avail = this.findAvailabilityText($, $el);
    const shipInfo = this.findShippingInfoInElement($ as any, $el as any);

    const idMatch = href.match(/\/product\/(\d+|[A-Za-z0-9_-]+)/);
    const id = idMatch ? idMatch[1] : undefined;

    return {
      id,
      name,
      url: this.absUrl(href),
      price,
      originalPrice: orig,
      imageUrl: img || undefined,
      availability: avail || undefined,
      shippingText: shipInfo.text,
      shippingDateIso: shipInfo.dateIso
    };
  }

  private findPriceInCard($: any, $el: any): number | undefined {
    const sel = [
      '.price, .current-price, .product-price',
      'span:contains("$")'
    ].join(',');
    const text = ($el.find(sel).first().text() || '').trim();
    const price = this.parsePrice(text);
    return price > 0 ? price : undefined;
  }

  private findOriginalPriceInCard($: any, $el: any): number | undefined {
    const sel = [
      '.was-price, s:contains("$")'
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
    const text = ($el.find('.availability, .stock-status').first().text() || '').trim();
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
    if (t.includes('out of stock') || t.includes('unavailable')) return false;
    return true;
  }

  private absUrl(href: string): string {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    return `${this.config.baseUrl.replace(/\/$/, '')}${href.startsWith('/') ? '' : '/'}${href}`;
  }

  private async enrichFromProductPage(p: ScheinProduct): Promise<ScheinProduct | null> {
    try {
      if (p.shippingText || p.shippingDateIso) return p;
      const res = await this.makeRequest(p.url, { render: true });
      const $: any = cheerio.load(res.data);
      const shipInfo = this.findShippingInfoInElement($ as any, $('body') as any);
      let price = p.price;
      if (!price || price <= 0) {
        const priceText = $('body').find('.price, .current-price, span:contains("$")').first().text().trim();
        const parsed = this.parsePrice(priceText);
        if (parsed > 0) price = parsed;
      }
      let originalPrice = p.originalPrice;
      if (!originalPrice) {
        const opText = $('body').find('.was-price, s:contains("$")').first().text().trim();
        const parsed = this.parsePrice(opText);
        if (parsed > 0) originalPrice = parsed;
      }
      let imageUrl = p.imageUrl;
      if (!imageUrl) {
        const img = $('body').find('img').first().attr('src') || $('body').find('img').first().attr('data-src') || '';
        if (img) imageUrl = this.absUrl(img);
      }
      return { ...p, price, originalPrice, imageUrl, shippingText: shipInfo.text || p.shippingText, shippingDateIso: shipInfo.dateIso || p.shippingDateIso };
    } catch (e) {
      return p;
    }
  }
}

