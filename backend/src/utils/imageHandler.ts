import { logger } from './logger';

export interface ImageMetadata {
  url: string;
  width?: number;
  height?: number;
  size?: number;
  format?: string;
  alt?: string;
  thumbnails?: {
    small?: string;
    medium?: string;
    large?: string;
  } | undefined;
}

export interface ProductImageData {
  primary?: ImageMetadata;
  gallery?: ImageMetadata[];
  packaging?: ImageMetadata[];
}

/**
 * Image handling utilities for product catalog
 */
export class ImageHandler {
  private static readonly ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly THUMBNAIL_SIZES = {
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 }
  };

  /**
   * Validate image URL format and accessibility
   */
  static validateImageUrl(url: string): { isValid: boolean; error?: string } {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, error: 'Image URL must use HTTP or HTTPS protocol' };
      }

      // Check file extension
      const pathname = urlObj.pathname.toLowerCase();
      const hasValidExtension = this.ALLOWED_FORMATS.some(format => 
        pathname.endsWith(`.${format}`)
      );

      if (!hasValidExtension) {
        return { 
          isValid: false, 
          error: `Image must be one of: ${this.ALLOWED_FORMATS.join(', ')}` 
        };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Generate thumbnail URLs based on base image URL
   * This is a placeholder - in production you'd integrate with image processing service
   */
  static generateThumbnailUrls(baseUrl: string): ImageMetadata['thumbnails'] {
    try {
      const url = new URL(baseUrl);
      const pathParts = url.pathname.split('.');
      const extension = pathParts.pop();
      const basePath = pathParts.join('.');

      return {
        small: `${url.origin}${basePath}_150x150.${extension}`,
        medium: `${url.origin}${basePath}_300x300.${extension}`,
        large: `${url.origin}${basePath}_600x600.${extension}`
      };
    } catch (error) {
      logger.warn('Failed to generate thumbnail URLs', { baseUrl, error });
      return {};
    }
  }

  /**
   * Extract image metadata from URL
   * In production, this would make HTTP requests to get actual image dimensions
   */
  static async extractImageMetadata(url: string): Promise<ImageMetadata> {
    const validation = this.validateImageUrl(url);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    try {
      // In production, you would:
      // 1. Make HEAD request to get content-length
      // 2. Use image processing library to get dimensions
      // 3. Generate optimized thumbnails
      
      const urlObj = new URL(url);
      const format = urlObj.pathname.split('.').pop()?.toLowerCase();
      
      const thumbnails = this.generateThumbnailUrls(url);
      return {
        url,
        format: format || 'unknown',
        thumbnails: thumbnails || undefined,
        alt: this.generateAltText(url)
      };
    } catch (error) {
      logger.error('Failed to extract image metadata', { url, error });
      throw new Error('Failed to process image metadata');
    }
  }

  /**
   * Generate alt text from image URL
   */
  static generateAltText(url: string): string {
    try {
      const urlObj = new URL(url);
      const filename = urlObj.pathname.split('/').pop() || '';
      const nameWithoutExt = filename.split('.')[0];
      
      // Convert filename to readable alt text
      return (nameWithoutExt || '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim() || 'Product image';
    } catch (error) {
      return 'Product image';
    }
  }

  /**
   * Process product images and generate metadata
   */
  static async processProductImages(imageData: {
    primary?: string;
    gallery?: string[];
    packaging?: string[];
  }): Promise<ProductImageData> {
    const result: ProductImageData = {};

    try {
      // Process primary image
      if (imageData.primary) {
        result.primary = await this.extractImageMetadata(imageData.primary);
      }

      // Process gallery images
      if (imageData.gallery && imageData.gallery.length > 0) {
        result.gallery = await Promise.all(
          imageData.gallery.map(url => this.extractImageMetadata(url))
        );
      }

      // Process packaging images
      if (imageData.packaging && imageData.packaging.length > 0) {
        result.packaging = await Promise.all(
          imageData.packaging.map(url => this.extractImageMetadata(url))
        );
      }

      return result;
    } catch (error) {
      logger.error('Failed to process product images', { imageData, error });
      throw new Error('Failed to process product images');
    }
  }

  /**
   * Validate and sanitize image URLs for storage
   */
  static sanitizeImageUrls(urls: string[]): string[] {
    return urls
      .filter(url => {
        const validation = this.validateImageUrl(url);
        if (!validation.isValid) {
          logger.warn('Invalid image URL filtered out', { url, error: validation.error });
          return false;
        }
        return true;
      })
      .map(url => url.trim());
  }

  /**
   * Get optimized image URL for specific use case
   */
  static getOptimizedImageUrl(
    imageMetadata: ImageMetadata, 
    size: 'small' | 'medium' | 'large' | 'original' = 'medium'
  ): string {
    if (size === 'original') {
      return imageMetadata.url;
    }

    return imageMetadata.thumbnails?.[size] || imageMetadata.url;
  }

  /**
   * Generate responsive image srcset
   */
  static generateSrcSet(imageMetadata: ImageMetadata): string {
    const srcSet: string[] = [];

    if (imageMetadata.thumbnails?.small) {
      srcSet.push(`${imageMetadata.thumbnails.small} 150w`);
    }
    if (imageMetadata.thumbnails?.medium) {
      srcSet.push(`${imageMetadata.thumbnails.medium} 300w`);
    }
    if (imageMetadata.thumbnails?.large) {
      srcSet.push(`${imageMetadata.thumbnails.large} 600w`);
    }
    
    // Add original as largest size
    srcSet.push(`${imageMetadata.url} 1200w`);

    return srcSet.join(', ');
  }

  /**
   * Check if image URL is accessible
   * In production, this would make actual HTTP requests
   */
  static async checkImageAccessibility(url: string): Promise<boolean> {
    try {
      const validation = this.validateImageUrl(url);
      if (!validation.isValid) {
        return false;
      }

      // In production, make HEAD request to check if image exists
      // For now, just validate URL format
      return true;
    } catch (error) {
      logger.warn('Image accessibility check failed', { url, error });
      return false;
    }
  }

  /**
   * Batch process multiple image URLs
   */
  static async batchProcessImages(urls: string[]): Promise<{
    successful: ImageMetadata[];
    failed: { url: string; error: string }[];
  }> {
    const successful: ImageMetadata[] = [];
    const failed: { url: string; error: string }[] = [];

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const metadata = await this.extractImageMetadata(url);
          successful.push(metadata);
        } catch (error) {
          failed.push({
            url,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      })
    );

    return { successful, failed };
  }
}