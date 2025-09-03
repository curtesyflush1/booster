import { TargetService } from '../../../src/services/retailers/TargetService';
import { RetailerConfig } from '../../../src/types/retailer';

describe('TargetService (scraping)', () => {
  const config: RetailerConfig = {
    id: 'target',
    name: 'Target',
    slug: 'target',
    type: 'scraping',
    baseUrl: 'https://www.target.com',
    rateLimit: { requestsPerMinute: 2, requestsPerHour: 60 },
    timeout: 10000,
    retryConfig: { maxRetries: 2, retryDelay: 1000 },
    isActive: true
  };

  const searchHtml = `
    <ul>
      <li data-test="list-entry-product-card">
        <a data-test="product-title" href="/p/pokemon-elite-trainer-box/79440576">Pokemon TCG Elite Trainer Box</a>
        <span data-test="current-price">$49.99</span>
        <div data-test="fulfillment-availability">Out of stock</div>
        <img src="https://target.com/image.jpg" />
      </li>
    </ul>
  `;

  const productHtml = `
    <div>
      <div data-test="fulfillment-availability">Out of stock</div>
      <div data-test="current-price">$49.99</div>
      <img src="https://target.com/image.jpg" />
    </div>
  `;

  let service: TargetService;

  beforeEach(() => {
    service = new TargetService(config);
  });

  it('searchProducts parses Target search results and filters TCG items', async () => {
    const spy = jest
      .spyOn<any, any>(service as any, 'makeRequest')
      .mockResolvedValue({ data: searchHtml, status: 200, headers: {}, config: {}, request: {} });

    const results = await service.searchProducts('pokemon tcg');
    expect(spy).toHaveBeenCalled();
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.retailerId).toBe('target');
    expect(first.productUrl).toMatch(/^https:\/\/www\.target\.com\/p\//);
    expect(first.price).toBe(49.99);
    expect(first.availabilityStatus).toBe('out_of_stock');
  });

  it('checkAvailability uses search + product page and returns parsed response', async () => {
    const reqUrlFirst = `/s?searchTerm=pokemon%20tcg`;
    const spy = jest
      .spyOn<any, any>(service as any, 'makeRequest')
      .mockImplementation((url: string) => {
        if (String(url).includes('/s?searchTerm=')) {
          return Promise.resolve({ data: searchHtml, status: 200, headers: {}, config: {}, request: {} });
        }
        // product page fetch
        return Promise.resolve({ data: productHtml, status: 200, headers: {}, config: {}, request: {} });
      });

    const res = await service.checkAvailability({ productId: 'pokemon-elite-trainer-box' });
    expect(spy).toHaveBeenCalled();
    expect(res.retailerId).toBe('target');
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
    expect(health.retailerId).toBe('target');
  });
});

