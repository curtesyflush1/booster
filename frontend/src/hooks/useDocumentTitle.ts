import { useEffect } from 'react';

interface UseDocumentTitleOptions {
  title: string;
  description?: string;
  keywords?: string[];
}

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