# SEO System Guide

## Overview

BoosterBeacon's SEO system provides comprehensive search engine optimization and marketing features designed to improve visibility for Pokémon TCG collectors and drive organic traffic growth.

## Features

### 1. SEO Utilities (`frontend/src/utils/seo.ts`)

#### Meta Tag Management
- Dynamic title, description, and keywords
- Open Graph tags for social media sharing
- Twitter Card optimization
- Canonical URL management
- Robots meta tags for crawling control

#### Structured Data Generation
- **Website Schema**: WebApplication markup for the main site
- **Product Schema**: Individual Pokémon TCG product markup
- **Breadcrumb Schema**: Navigation breadcrumbs
- **FAQ Schema**: Frequently asked questions
- **Local Business Schema**: Store location data

#### Social Sharing Integration
- Pre-configured sharing URLs for major platforms
- Facebook, Twitter, LinkedIn, Reddit, and Discord support
- Analytics tracking for social media engagement

### 2. SEO Components

#### SEOHead Component
```tsx
import SEOHead from '../components/SEOHead';

<SEOHead 
  title="Pokémon TCG Alerts"
  description="Get instant alerts for Pokémon card restocks"
  keywords={['pokemon tcg', 'alerts', 'restock']}
  canonical="/pokemon-tcg-alerts"
  structuredData={websiteSchema}
/>
```

#### SocialShare Component
```tsx
import SocialShare from '../components/SocialShare';

<SocialShare
  url="https://boosterbeacon.com/deals"
  title="Amazing Pokémon TCG Deal!"
  description="Don't miss this incredible price drop"
  showLabels={true}
  size="lg"
/>
```

### 3. SEO-Optimized Landing Pages

#### Pokémon TCG Alerts Page
- **URL**: `/pokemon-tcg-alerts`
- **Target Keywords**: "pokemon tcg alerts", "pokemon card alerts", "pokemon restock alerts"
- **Features**: FAQ section with structured data, social sharing, feature highlights

#### Location-Based Pages
- **URL Pattern**: `/locations/{city}/{state}`
- **Target**: Local SEO for major US cities
- **Features**: Store-specific information, local business structured data, coverage areas

### 4. Sitemap System

#### Backend Implementation
The sitemap system generates comprehensive XML sitemaps for search engines:

```typescript
// Generate sitemap index
GET /sitemap.xml

// Specialized sitemaps
GET /sitemap-static.xml      // Static pages (12 pages)
GET /sitemap-products.xml    // Products (150+ products)
GET /sitemap-categories.xml  // Categories (8 categories)
GET /sitemap-locations.xml   // Locations (20 major cities)
GET /sitemap-sets.xml        // Pokémon sets (20 sets + alert pages)
```

#### Sitemap Features
- **Automatic Generation**: Dynamic sitemap creation based on database content
- **Proper Caching**: Optimized cache headers (24 hours for static, 1 hour for products)
- **Search Engine Pinging**: Automatic notification to Google and Bing
- **Statistics Tracking**: Admin dashboard for sitemap analytics

### 5. Robots.txt Configuration

```
User-agent: *
Allow: /

# Sitemaps
Sitemap: https://boosterbeacon.com/sitemap.xml

# Crawl-delay for polite crawling
Crawl-delay: 1

# Disallow admin and API endpoints
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/
```

## SEO Strategy

### Primary Keywords
- "pokemon tcg alerts"
- "pokemon card alerts" 
- "pokemon restock alerts"
- "pokemon tcg notifications"
- "pokemon card tracker"

### Location-Based SEO
- Major US cities (New York, Los Angeles, Chicago, etc.)
- Local store targeting (Best Buy, Walmart, Target, etc.)
- ZIP code and radius-based coverage

### Pokémon TCG Specific
- Set-specific pages (Scarlet Violet, Paldea Evolved, etc.)
- Product category pages (Booster Packs, Elite Trainer Boxes, etc.)
- Retailer-specific landing pages

## Implementation Guide

### Adding SEO to New Pages

1. **Import SEO Components**:
```tsx
import SEOHead from '../components/SEOHead';
import { generateProductStructuredData } from '../utils/seo';
```

2. **Configure SEO Data**:
```tsx
const seoConfig = {
  title: 'Your Page Title',
  description: 'Your page description',
  keywords: ['keyword1', 'keyword2'],
  canonical: '/your-page-url',
  ogImage: '/images/your-og-image.png'
};
```

3. **Add Structured Data** (if applicable):
```tsx
const structuredData = generateProductStructuredData({
  name: 'Product Name',
  description: 'Product description',
  image: 'https://example.com/image.jpg',
  price: 29.99,
  availability: 'InStock'
});
```

4. **Render SEO Components**:
```tsx
return (
  <>
    <SEOHead {...seoConfig} structuredData={structuredData} />
    {/* Your page content */}
  </>
);
```

### Adding Social Sharing

```tsx
import SocialShare from '../components/SocialShare';

<SocialShare
  url={window.location.href}
  title="Share this amazing deal!"
  description="Don't miss out on this Pokémon TCG opportunity"
  showLabels={true}
/>
```

## Performance Considerations

### Meta Tag Management
- Efficient meta tag updates without DOM thrashing
- Proper cleanup on component unmount
- Minimal re-renders with dependency optimization

### Sitemap Generation
- Cached sitemap generation to reduce server load
- Efficient database queries with proper indexing
- Rate limiting for sitemap requests

### Structured Data
- Lazy loading of structured data scripts
- Minimal JSON-LD payload sizes
- Proper script cleanup and management

## Analytics and Monitoring

### SEO Metrics to Track
- Organic search traffic growth
- Keyword ranking improvements
- Click-through rates from search results
- Social media engagement from sharing

### Tools Integration
- Google Search Console for search performance
- Google Analytics for traffic analysis
- Social media analytics for sharing metrics

## Best Practices

### Content Optimization
- Unique, descriptive page titles
- Compelling meta descriptions under 160 characters
- Proper heading hierarchy (H1, H2, H3)
- Alt text for all images

### Technical SEO
- Fast loading times with optimized assets
- Mobile-responsive design
- Proper URL structure with hyphens
- HTTPS everywhere

### Local SEO
- Consistent NAP (Name, Address, Phone) information
- Local business schema markup
- Location-specific content and keywords

## Troubleshooting

### Common Issues
1. **Meta tags not updating**: Check component re-rendering and dependencies
2. **Structured data errors**: Validate JSON-LD with Google's testing tool
3. **Sitemap not accessible**: Verify server configuration and caching
4. **Social sharing not working**: Check URL encoding and platform requirements

### Testing Tools
- Google Search Console for sitemap and indexing issues
- Google Rich Results Test for structured data validation
- Facebook Sharing Debugger for Open Graph testing
- Twitter Card Validator for Twitter sharing

## Future Enhancements

### Planned Features
- Automated keyword research and optimization
- A/B testing for meta descriptions and titles
- Advanced local SEO with store inventory integration
- International SEO with multi-language support
- Enhanced social media integration with automatic posting

### Performance Improvements
- Edge caching for sitemaps and meta data
- Preloading of critical SEO resources
- Advanced structured data with product reviews and ratings