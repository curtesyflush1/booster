/**
 * SEO Utilities for BoosterBeacon
 * Comprehensive SEO management with structured data, meta tags, and social sharing
 */

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  twitterCard?: 'summary' | 'summary_large_image';
  structuredData?: Record<string, any>;
  noIndex?: boolean;
  noFollow?: boolean;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface ProductSEO {
  name: string;
  description: string;
  image: string;
  price?: number;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  category?: string;
  sku?: string;
  gtin?: string;
}

/**
 * Default SEO configuration for BoosterBeacon
 */
export const DEFAULT_SEO: SEOConfig = {
  title: 'BoosterBeacon - Never Miss a Pokémon TCG Drop Again',
  description: 'Get instant alerts when Pokémon TCG products restock at major retailers. Real-time notifications with one-tap cart links for collectors.',
  keywords: [
    'pokemon tcg',
    'pokemon cards',
    'restock alerts',
    'collector alerts',
    'booster packs',
    'pokemon drops',
    'tcg monitoring',
    'card alerts'
  ],
  ogType: 'website',
  twitterCard: 'summary_large_image'
};

/**
 * Pokemon TCG related keywords for SEO optimization
 */
export const POKEMON_TCG_KEYWORDS = {
  products: [
    'pokemon booster packs',
    'pokemon elite trainer box',
    'pokemon collection box',
    'pokemon tin',
    'pokemon bundle',
    'pokemon starter deck',
    'pokemon theme deck',
    'pokemon premium collection'
  ],
  sets: [
    'scarlet violet',
    'paldea evolved',
    'obsidian flames',
    'paradox rift',
    'temporal forces',
    'twilight masquerade',
    'shrouded fable',
    'stellar crown'
  ],
  retailers: [
    'best buy pokemon',
    'walmart pokemon',
    'costco pokemon',
    'sams club pokemon',
    'target pokemon',
    'gamestop pokemon'
  ],
  alerts: [
    'pokemon restock alerts',
    'pokemon drop notifications',
    'pokemon availability alerts',
    'pokemon tcg tracker',
    'pokemon inventory alerts'
  ]
};

/**
 * Generate structured data for the website
 */
export const generateWebsiteStructuredData = (): Record<string, any> => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BoosterBeacon',
  description: 'Real-time Pokémon TCG restock alerts and notifications for collectors',
  url: 'https://boosterbeacon.com',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD'
  },
  author: {
    '@type': 'Organization',
    name: 'BoosterBeacon',
    url: 'https://boosterbeacon.com'
  },
  sameAs: [
    'https://discord.gg/boosterbeacon',
    'https://instagram.com/boosterbeacon',
    'https://tiktok.com/@boosterbeacon',
    'https://twitter.com/boosterbeacon'
  ]
});

/**
 * Generate structured data for a product
 */
export const generateProductStructuredData = (product: ProductSEO): Record<string, any> => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.name,
  description: product.description,
  image: product.image,
  brand: {
    '@type': 'Brand',
    name: product.brand || 'Pokémon'
  },
  category: product.category || 'Trading Card Games',
  sku: product.sku,
  gtin: product.gtin,
  offers: product.price ? {
    '@type': 'Offer',
    price: product.price,
    priceCurrency: 'USD',
    availability: `https://schema.org/${product.availability || 'InStock'}`
  } : undefined
});

/**
 * Generate breadcrumb structured data
 */
export const generateBreadcrumbStructuredData = (items: BreadcrumbItem[]): Record<string, any> => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url
  }))
});

/**
 * Generate FAQ structured data
 */
export const generateFAQStructuredData = (faqs: Array<{ question: string; answer: string }>): Record<string, any> => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer
    }
  }))
});

/**
 * Generate local business structured data
 */
export const generateLocalBusinessStructuredData = (location: {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
}): Record<string, any> => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: location.name,
  address: {
    '@type': 'PostalAddress',
    streetAddress: location.address,
    addressLocality: location.city,
    addressRegion: location.state,
    postalCode: location.zipCode,
    addressCountry: 'US'
  },
  telephone: location.phone
});

/**
 * Update document meta tags
 */
export const updateMetaTags = (config: SEOConfig): void => {
  // Update title
  document.title = config.title;

  // Update or create meta tags
  const metaTags = [
    { name: 'description', content: config.description },
    { name: 'keywords', content: config.keywords?.join(', ') || '' },
    { property: 'og:title', content: config.title },
    { property: 'og:description', content: config.description },
    { property: 'og:type', content: config.ogType || 'website' },
    { property: 'og:url', content: config.canonical || window.location.href },
    { property: 'og:image', content: config.ogImage || '/og-image.png' },
    { name: 'twitter:card', content: config.twitterCard || 'summary_large_image' },
    { name: 'twitter:title', content: config.title },
    { name: 'twitter:description', content: config.description },
    { name: 'twitter:image', content: config.ogImage || '/twitter-image.png' }
  ];

  // Add robots meta tag if needed
  if (config.noIndex || config.noFollow) {
    const robotsContent = [
      config.noIndex ? 'noindex' : 'index',
      config.noFollow ? 'nofollow' : 'follow'
    ].join(', ');
    metaTags.push({ name: 'robots', content: robotsContent });
  }

  // Add canonical link if specified
  if (config.canonical) {
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = config.canonical;
  }

  // Update meta tags
  metaTags.forEach(({ name, property, content }) => {
    if (!content) return;

    const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
    let metaTag = document.querySelector(selector) as HTMLMetaElement;
    
    if (!metaTag) {
      metaTag = document.createElement('meta');
      if (name) metaTag.name = name;
      if (property) metaTag.setAttribute('property', property);
      document.head.appendChild(metaTag);
    }
    
    metaTag.content = content;
  });
};

/**
 * Update structured data
 */
export const updateStructuredData = (data: Record<string, any>, id: string = 'structured-data'): void => {
  // Remove existing structured data with the same ID
  const existingScript = document.getElementById(id);
  if (existingScript) {
    existingScript.remove();
  }

  // Add new structured data
  const script = document.createElement('script');
  script.id = id;
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
};

/**
 * Generate sitemap URLs for static pages
 */
export const generateSitemapUrls = (): Array<{ url: string; priority: number; changefreq: string }> => [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/pricing', priority: 0.9, changefreq: 'weekly' },
  { url: '/login', priority: 0.7, changefreq: 'monthly' },
  { url: '/register', priority: 0.7, changefreq: 'monthly' },
  { url: '/products', priority: 0.8, changefreq: 'daily' },
  { url: '/about', priority: 0.6, changefreq: 'monthly' },
  { url: '/contact', priority: 0.5, changefreq: 'monthly' },
  { url: '/privacy', priority: 0.4, changefreq: 'yearly' },
  { url: '/terms', priority: 0.4, changefreq: 'yearly' }
];

/**
 * Generate location-specific keywords
 */
export const generateLocationKeywords = (city: string, state: string): string[] => [
  `pokemon tcg ${city}`,
  `pokemon cards ${city}`,
  `pokemon store ${city}`,
  `pokemon alerts ${city} ${state}`,
  `tcg collector ${city}`,
  `pokemon restock ${city}`
];

/**
 * Social media sharing URLs
 */
export const generateSocialShareUrls = (url: string, title: string, description: string) => ({
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}&hashtags=PokemonTCG,BoosterBeacon`,
  linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  discord: `https://discord.com/channels/@me?message=${encodeURIComponent(`${title} - ${url}`)}`
});