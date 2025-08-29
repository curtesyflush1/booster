import React from 'react';
import { useSEO } from '../hooks/useDocumentTitle';
import { 
  SEOConfig, 
  generateWebsiteStructuredData, 
  generateProductStructuredData,
  generateBreadcrumbStructuredData,
  generateFAQStructuredData,
  ProductSEO,
  BreadcrumbItem
} from '../utils/seo';

interface SEOHeadProps extends Partial<SEOConfig> {
  product?: ProductSEO;
  breadcrumbs?: BreadcrumbItem[];
  faqs?: Array<{ question: string; answer: string }>;
  structuredDataId?: string;
}

/**
 * SEOHead component for managing page-level SEO
 * Handles meta tags, structured data, and social sharing optimization
 */
const SEOHeadComponent: React.FC<SEOHeadProps> = ({
  product,
  breadcrumbs,
  faqs,
  structuredDataId = 'page-structured-data',
  ...seoConfig
}) => {
  // Generate structured data based on page type
  const generateStructuredData = () => {
    const baseData = generateWebsiteStructuredData();
    
    if (product) {
      return generateProductStructuredData(product);
    }
    
    if (breadcrumbs) {
      return generateBreadcrumbStructuredData(breadcrumbs);
    }
    
    if (faqs) {
      return generateFAQStructuredData(faqs);
    }
    
    return baseData;
  };

  // Use the SEO hook with generated structured data
  useSEO({
    ...seoConfig,
    structuredData: generateStructuredData(),
    structuredDataId
  });

  return null; // This component doesn't render anything
};

// Memoize SEOHead to prevent unnecessary re-renders when SEO config hasn't changed
const SEOHead = React.memo(SEOHeadComponent, (prevProps, nextProps) => {
  // Custom comparison function for SEO props
  return (
    JSON.stringify(prevProps.product) === JSON.stringify(nextProps.product) &&
    JSON.stringify(prevProps.breadcrumbs) === JSON.stringify(nextProps.breadcrumbs) &&
    JSON.stringify(prevProps.faqs) === JSON.stringify(nextProps.faqs) &&
    prevProps.structuredDataId === nextProps.structuredDataId &&
    prevProps.title === nextProps.title &&
    prevProps.description === nextProps.description &&
    prevProps.keywords === nextProps.keywords &&
    prevProps.image === nextProps.image &&
    prevProps.url === nextProps.url
  );
});

export default SEOHead;