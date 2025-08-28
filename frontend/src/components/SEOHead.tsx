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
const SEOHead: React.FC<SEOHeadProps> = ({
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

export default SEOHead;