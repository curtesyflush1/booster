// Utility to transform backend snake_case fields to frontend camelCase fields

export interface BackendProduct {
  id: string;
  name: string;
  sku: string;
  upc: string;
  category_id: string;
  set_name: string;
  series: string;
  release_date: string;
  msrp: string | number;
  image_url: string;
  thumbnail_url?: string;
  description?: string;
  metadata: any;
  is_active: boolean;
  popularity_score: number;
  created_at: string;
  updated_at: string;
}

export interface FrontendProduct {
  id: string;
  name: string;
  sku: string;
  upc: string;
  category: any; // Will be transformed separately
  set: string;
  series: string;
  releaseDate: string;
  msrp: number;
  imageUrl: string;
  thumbnailUrl: string; // Make required to match Product interface
  description?: string;
  metadata: any;
  availability?: any[];
  createdAt: string;
  updatedAt: string;
}

export function transformBackendProduct(backendProduct: BackendProduct): FrontendProduct {
  return {
    id: backendProduct.id,
    name: backendProduct.name,
    sku: backendProduct.sku,
    upc: backendProduct.upc,
    category: { id: backendProduct.category_id }, // Basic category info
    set: backendProduct.set_name,
    series: backendProduct.series,
    releaseDate: backendProduct.release_date,
    msrp: typeof backendProduct.msrp === 'string' ? parseFloat(backendProduct.msrp) : backendProduct.msrp,
    imageUrl: backendProduct.image_url,
    thumbnailUrl: backendProduct.thumbnail_url || backendProduct.image_url, // Fallback to image_url if thumbnail_url is not available
    description: backendProduct.description,
    metadata: backendProduct.metadata,
    availability: undefined, // Not provided by search endpoint
    createdAt: backendProduct.created_at,
    updatedAt: backendProduct.updated_at
  };
}

export function transformBackendProducts(backendProducts: BackendProduct[]): FrontendProduct[] {
  return backendProducts.map(transformBackendProduct);
}
