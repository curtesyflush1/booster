import fs from 'fs';
import path from 'path';
import { URLCandidateChecker } from '../../src/services/URLCandidateChecker';

const load = (file: string) => fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'html', file), 'utf8');

describe('Retailer signal parsing (golden fixtures)', () => {
  test('BestBuy product page: productPage + CTA + price', () => {
    const url = 'https://www.bestbuy.com/site/pokemon-booster/12345.p';
    const html = load('bestbuy_product.html');
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(true);
    expect(out.cta).toBe(true);
    expect(out.price).toBe(true);
  });

  test('Target product page: JSON-LD + price (CTA optional)', () => {
    const url = 'https://www.target.com/p/pokemon-tcg/12345678';
    const html = load('target_product_jsonld.html');
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(true);
    expect(out.jsonld).toBe(true);
    expect(out.price).toBe(true);
  });

  test('Walmart product page: CTA + price', () => {
    const url = 'https://www.walmart.com/ip/123456789';
    const html = load('walmart_product.html');
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(true);
    expect(out.cta).toBe(true);
    expect(out.price).toBe(true);
  });

  test('Search page is not a product page even with prices', () => {
    const url = 'https://www.target.com/s?searchTerm=pokemon%20tcg';
    const html = load('search_page.html');
    const out = URLCandidateChecker.evaluateHtml(url, html);
    expect(out.productPage).toBe(false);
  });
});

