import { GameStopService } from '../../../src/services/retailers/GameStopService';
import { RetailerConfig } from '../../../src/types/retailer';

describe('GameStopService (scraping)', () => {
  const config: RetailerConfig = {
    id: 'gamestop',
    name: 'GameStop',
    slug: 'gamestop',
    type: 'scraping',
    baseUrl: 'https://www.gamestop.com',
    rateLimit: { requestsPerMinute: 2, requestsPerHour: 60 },
    timeout: 10000,
    retryConfig: { maxRetries: 2, retryDelay: 1000 },
    isActive: true
  };

  const searchHtml = `
    <div class="product-grid-tile">
      <a class="product-name" href="/product/123456/pokemon-elite-trainer-box">Pokemon TCG Elite Trainer Box</a>
      <span class="actual-price">$49.99</span>
      <div class="availability">Sold Out</div>
      <img src="https://www.gamestop.com/image.jpg" />
    </div>
  `;

  const productHtml = `
    <div>
      <div class="availability">Sold Out</div>
      <div class="price">$49.99</div>
      <img src="https://www.gamestop.com/image.jpg" />
    </div>
  `;

  let service: GameStopService;

  beforeEach(() => {
    service = new GameStopService(config);
  });

  it('searchProducts parses GameStop search results and filters TCG items', async () => {
    const spy = jest
      .spyOn<any, any>(service as any, 'makeRequest')
      .mockResolvedValue({ data: searchHtml, status: 200, headers: {}, config: {}, request: {} });

    const results = await service.searchProducts('pokemon tcg');
    expect(spy).toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.retailerId).toBe('gamestop');
    expect(first.productUrl).toMatch(/^https:\/\/www\.gamestop\.com\/product\//);
    expect(first.price).toBe(49.99);
    expect(first.availabilityStatus).toBe('out_of_stock');
  });

  it('checkAvailability uses search + product page and returns parsed response', async () => {
    const spy = jest
      .spyOn<any, any>(service as any, 'makeRequest')
      .mockImplementation((...args: any[]) => {
        const url = args[0];
        if (String(url).includes('/search/?q=')) {
          return Promise.resolve({ data: searchHtml, status: 200, headers: {}, config: {}, request: {} });
        }
        // product page fetch
        return Promise.resolve({ data: productHtml, status: 200, headers: {}, config: {}, request: {} });
      });

    const res = await service.checkAvailability({ productId: 'pokemon-elite-trainer-box' });
    expect(spy).toHaveBeenCalled();
    expect(res.retailerId).toBe('gamestop');
    expect(res.price).toBe(49.99);
    expect(res.availabilityStatus).toBe('out_of_stock');
  });

  it('getHealthStatus succeeds when health check request works', async () => {
    const spy = jest
      .spyOn<any, any>(service as any, 'makeRequest')
      .mockResolvedValue({ data: '<html></html>', status: 200, headers: {}, config: {}, request: {} });

    const health = await service.getHealthStatus();
    expect(spy).toHaveBeenCalled();
    expect(health.isHealthy).toBe(true);
    expect(health.retailerId).toBe('gamestop');
  });
});
