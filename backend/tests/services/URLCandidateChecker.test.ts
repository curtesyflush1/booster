import { URLCandidateChecker } from '../../src/services/URLCandidateChecker';

describe('URLCandidateChecker.evaluateHtml gating', () => {
  const wrapHtml = (title: string, body: string, jsonld?: any) => {
    const json = jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : '';
    return `<!doctype html><html><head><title>${title}</title>${json}</head><body>${body}</body></html>`;
  };

  it('requires product page + price + CTA by default', () => {
    const url = 'https://www.bestbuy.com/site/awesome-item/12345.p';
    const html = wrapHtml(
      'Awesome Item',
      'Limited! Add to Cart now only $29.99'
    );
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(true);
    expect(out.cta).toBe(true);
    expect(out.price).toBe(true);
  });

  it('does not allow live when missing CTA (default)', () => {
    const url = 'https://www.bestbuy.com/site/awesome-item/12345.p';
    const html = wrapHtml(
      'Awesome Item',
      'Great price $29.99 but no button text here'
    );
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(true);
    expect(out.price).toBe(true);
    expect(out.cta).toBe(false);
  });

  it('accepts Target with JSON-LD Product + price even if CTA dynamic', () => {
    const url = 'https://www.target.com/p/some-item/12345678';
    const jsonld = { '@type': 'Product', sku: '12345678', offers: { price: '19.99' } };
    const html = wrapHtml('Some Item', 'Ships soon', jsonld);
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(true);
    expect(out.jsonld).toBe(true);
    expect(out.price).toBe(true);
  });

  it('does not treat search pages as product pages', () => {
    const url = 'https://www.target.com/s?searchTerm=pokemon';
    const html = wrapHtml('Search - Target', 'Add to cart $29.99');
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(false);
  });
});

