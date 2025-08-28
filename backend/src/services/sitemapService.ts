/**
 * Sitemap Generation Service
 * Generates XML sitemaps for SEO optimization
 */

// Note: Product and ProductCategory models will be used when database integration is complete

export interface SitemapUrl {
  url: string;
  lastmod?: string | undefined;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export interface SitemapIndex {
  sitemap: string;
  lastmod?: string;
}

/**
 * Static pages configuration for sitemap
 */
const STATIC_PAGES: SitemapUrl[] = [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/pricing', priority: 0.9, changefreq: 'weekly' },
  { url: '/pokemon-tcg-alerts', priority: 0.9, changefreq: 'weekly' },
  { url: '/login', priority: 0.7, changefreq: 'monthly' },
  { url: '/register', priority: 0.7, changefreq: 'monthly' },
  { url: '/products', priority: 0.8, changefreq: 'daily' },
  { url: '/about', priority: 0.6, changefreq: 'monthly' },
  { url: '/contact', priority: 0.5, changefreq: 'monthly' },
  { url: '/privacy', priority: 0.4, changefreq: 'yearly' },
  { url: '/terms', priority: 0.4, changefreq: 'yearly' },
  { url: '/help', priority: 0.5, changefreq: 'monthly' },
  { url: '/blog', priority: 0.7, changefreq: 'weekly' }
];

/**
 * Major US cities for location-based pages
 */
const MAJOR_CITIES = [
  { city: 'new-york', state: 'ny', priority: 0.8 },
  { city: 'los-angeles', state: 'ca', priority: 0.8 },
  { city: 'chicago', state: 'il', priority: 0.8 },
  { city: 'houston', state: 'tx', priority: 0.8 },
  { city: 'phoenix', state: 'az', priority: 0.7 },
  { city: 'philadelphia', state: 'pa', priority: 0.7 },
  { city: 'san-antonio', state: 'tx', priority: 0.7 },
  { city: 'san-diego', state: 'ca', priority: 0.7 },
  { city: 'dallas', state: 'tx', priority: 0.7 },
  { city: 'san-jose', state: 'ca', priority: 0.7 },
  { city: 'austin', state: 'tx', priority: 0.7 },
  { city: 'jacksonville', state: 'fl', priority: 0.6 },
  { city: 'fort-worth', state: 'tx', priority: 0.6 },
  { city: 'columbus', state: 'oh', priority: 0.6 },
  { city: 'charlotte', state: 'nc', priority: 0.6 },
  { city: 'san-francisco', state: 'ca', priority: 0.7 },
  { city: 'indianapolis', state: 'in', priority: 0.6 },
  { city: 'seattle', state: 'wa', priority: 0.7 },
  { city: 'denver', state: 'co', priority: 0.7 },
  { city: 'washington', state: 'dc', priority: 0.7 }
];

/**
 * Pokémon TCG sets for set-specific pages
 */
const POKEMON_SETS = [
  'scarlet-violet',
  'paldea-evolved',
  'obsidian-flames',
  'paradox-rift',
  'temporal-forces',
  'twilight-masquerade',
  'shrouded-fable',
  'stellar-crown',
  'surging-sparks',
  'prismatic-evolutions'
];

class SitemapService {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://boosterbeacon.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate main sitemap index
   */
  async generateSitemapIndex(): Promise<string> {
    const sitemaps: SitemapIndex[] = [
      { sitemap: `${this.baseUrl}/sitemap-static.xml` },
      { sitemap: `${this.baseUrl}/sitemap-products.xml` },
      { sitemap: `${this.baseUrl}/sitemap-categories.xml` },
      { sitemap: `${this.baseUrl}/sitemap-locations.xml` },
      { sitemap: `${this.baseUrl}/sitemap-sets.xml` }
    ];

    return this.generateSitemapIndexXML(sitemaps);
  }

  /**
   * Generate static pages sitemap
   */
  async generateStaticSitemap(): Promise<string> {
    const urls = STATIC_PAGES.map(page => ({
      ...page,
      url: `${this.baseUrl}${page.url}`,
      lastmod: new Date().toISOString().split('T')[0]
    }));

    return this.generateSitemapXML(urls);
  }

  /**
   * Generate products sitemap
   */
  async generateProductsSitemap(): Promise<string> {
    try {
      // Mock products data for now - in production this would query the database
      const mockProducts = [
        { id: '1', slug: 'scarlet-violet-booster-pack', updated_at: new Date() },
        { id: '2', slug: 'paldea-evolved-etb', updated_at: new Date() },
        { id: '3', slug: 'obsidian-flames-collection', updated_at: new Date() }
      ];

      const urls: SitemapUrl[] = mockProducts.map((product: any) => ({
        url: `${this.baseUrl}/products/${product.slug || product.id}`,
        lastmod: product.updated_at?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        changefreq: 'daily' as const,
        priority: 0.6
      }));

      return this.generateSitemapXML(urls);
    } catch (error) {
      console.error('Error generating products sitemap:', error);
      return this.generateSitemapXML([]);
    }
  }

  /**
   * Generate categories sitemap
   */
  async generateCategoriesSitemap(): Promise<string> {
    try {
      // Mock categories data for now - in production this would query the database
      const mockCategories = [
        { id: '1', slug: 'booster-packs', updated_at: new Date() },
        { id: '2', slug: 'elite-trainer-boxes', updated_at: new Date() },
        { id: '3', slug: 'collection-boxes', updated_at: new Date() }
      ];

      const urls: SitemapUrl[] = mockCategories.map((category: any) => ({
        url: `${this.baseUrl}/categories/${category.slug || category.id}`,
        lastmod: category.updated_at?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        changefreq: 'weekly' as const,
        priority: 0.7
      }));

      return this.generateSitemapXML(urls);
    } catch (error) {
      console.error('Error generating categories sitemap:', error);
      return this.generateSitemapXML([]);
    }
  }

  /**
   * Generate location-based pages sitemap
   */
  async generateLocationsSitemap(): Promise<string> {
    const urls: SitemapUrl[] = MAJOR_CITIES.map(location => ({
      url: `${this.baseUrl}/locations/${location.city}/${location.state}`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'monthly' as const,
      priority: location.priority
    }));

    return this.generateSitemapXML(urls);
  }

  /**
   * Generate Pokémon sets sitemap
   */
  async generateSetsSitemap(): Promise<string> {
    const urls: SitemapUrl[] = POKEMON_SETS.map(set => ({
      url: `${this.baseUrl}/sets/${set}`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'weekly' as const,
      priority: 0.7
    }));

    // Add set-specific alert pages
    const alertUrls: SitemapUrl[] = POKEMON_SETS.map(set => ({
      url: `${this.baseUrl}/sets/${set}/alerts`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'weekly' as const,
      priority: 0.6
    }));

    return this.generateSitemapXML([...urls, ...alertUrls]);
  }

  /**
   * Generate robots.txt content
   */
  generateRobotsTxt(): string {
    return `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${this.baseUrl}/sitemap.xml

# Crawl-delay for polite crawling
Crawl-delay: 1

# Disallow admin and API endpoints
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/
Disallow: /profile/
Disallow: /settings/

# Disallow search and filter URLs with parameters
Disallow: /*?*
Disallow: /search?*
Disallow: /products?*

# Allow specific parameter patterns
Allow: /products?page=*
Allow: /categories?page=*

# Block common bot traps
Disallow: /wp-admin/
Disallow: /wp-content/
Disallow: /.git/
Disallow: /node_modules/
`;
  }

  /**
   * Generate XML sitemap from URLs
   */
  private generateSitemapXML(urls: SitemapUrl[]): string {
    const urlElements = urls.map(url => {
      let urlElement = `  <url>\n    <loc>${this.escapeXml(url.url)}</loc>\n`;
      
      if (url.lastmod) {
        urlElement += `    <lastmod>${url.lastmod}</lastmod>\n`;
      }
      
      if (url.changefreq) {
        urlElement += `    <changefreq>${url.changefreq}</changefreq>\n`;
      }
      
      if (url.priority !== undefined) {
        urlElement += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
      }
      
      urlElement += '  </url>';
      return urlElement;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
  }

  /**
   * Generate XML sitemap index from sitemaps
   */
  private generateSitemapIndexXML(sitemaps: SitemapIndex[]): string {
    const sitemapElements = sitemaps.map(sitemap => {
      let sitemapElement = `  <sitemap>\n    <loc>${this.escapeXml(sitemap.sitemap)}</loc>\n`;
      
      if (sitemap.lastmod) {
        sitemapElement += `    <lastmod>${sitemap.lastmod}</lastmod>\n`;
      }
      
      sitemapElement += '  </sitemap>';
      return sitemapElement;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapElements}
</sitemapindex>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get sitemap statistics
   */
  async getSitemapStats(): Promise<{
    totalUrls: number;
    staticPages: number;
    products: number;
    categories: number;
    locations: number;
    sets: number;
  }> {
    try {
      // Mock counts for now - in production this would query the database
      const productCount = 150;
      const categoryCount = 8;

      return {
        totalUrls: STATIC_PAGES.length + productCount + categoryCount + MAJOR_CITIES.length + (POKEMON_SETS.length * 2),
        staticPages: STATIC_PAGES.length,
        products: productCount,
        categories: categoryCount,
        locations: MAJOR_CITIES.length,
        sets: POKEMON_SETS.length * 2
      };
    } catch (error) {
      console.error('Error getting sitemap stats:', error);
      return {
        totalUrls: 0,
        staticPages: STATIC_PAGES.length,
        products: 0,
        categories: 0,
        locations: MAJOR_CITIES.length,
        sets: POKEMON_SETS.length * 2
      };
    }
  }
}

export default SitemapService;