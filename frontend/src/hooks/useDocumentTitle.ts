import { useEffect } from 'react';
import { SEOConfig, updateMetaTags, updateStructuredData, DEFAULT_SEO } from '../utils/seo';

interface UseDocumentTitleOptions {
  title: string;
  description?: string;
  keywords?: string[];
}

interface UseSEOOptions extends SEOConfig {
  structuredDataId?: string;
}

/**
 * Legacy hook for backward compatibility
 */
export const useDocumentTitle = ({ title, description, keywords }: UseDocumentTitleOptions) => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | BoosterBeacon`;

    // Update meta description
    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute('content', description);
    }

    // Update meta keywords
    if (keywords && keywords.length > 0) {
      let metaKeywords = document.querySelector('meta[name="keywords"]');
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.setAttribute('name', 'keywords');
        document.head.appendChild(metaKeywords);
      }
      metaKeywords.setAttribute('content', keywords.join(', '));
    }

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, keywords]);
};

/**
 * Enhanced SEO hook with comprehensive meta tag and structured data management
 */
export const useSEO = (options: Partial<UseSEOOptions>) => {
  const structuredDataString = JSON.stringify(options.structuredData);
  const keywordsString = options.keywords?.join(',');
  
  useEffect(() => {
    const config: SEOConfig = {
      ...DEFAULT_SEO,
      ...options,
      title: options.title ? `${options.title} | BoosterBeacon` : DEFAULT_SEO.title
    };

    // Store previous values for cleanup
    const previousTitle = document.title;
    const previousCanonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');

    // Update meta tags
    updateMetaTags(config);

    // Update structured data if provided
    if (config.structuredData) {
      updateStructuredData(config.structuredData, options.structuredDataId);
    }

    // Cleanup function
    return () => {
      document.title = previousTitle;
      
      // Restore canonical if it was changed
      if (previousCanonical && config.canonical) {
        const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        if (canonicalLink) {
          canonicalLink.href = previousCanonical;
        }
      }

      // Remove structured data if it was added
      if (config.structuredData && options.structuredDataId) {
        const structuredDataScript = document.getElementById(options.structuredDataId);
        if (structuredDataScript) {
          structuredDataScript.remove();
        }
      }
    };
  }, [
    options,
    options.title,
    options.description,
    keywordsString,
    options.canonical,
    options.ogImage,
    options.ogType,
    options.twitterCard,
    options.noIndex,
    options.noFollow,
    structuredDataString,
    options.structuredDataId
  ]);
};