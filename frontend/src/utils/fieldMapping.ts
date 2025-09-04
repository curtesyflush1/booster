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

// Transform backend availability rows to frontend ProductAvailability shape
export function transformBackendAvailability(list: any[] | undefined): any[] {
  if (!Array.isArray(list)) return [];
  return list.map((a: any) => {
    const status: string | undefined = a.availability_status || a.availabilityStatus;
    const stores = Array.isArray(a.store_locations)
      ? a.store_locations.map((s: any) => ({
          id: s.store_id || s.id,
          name: s.store_name || s.name,
          address: s.address,
          city: s.city,
          state: s.state,
          zipCode: s.zip_code || s.zipCode,
          phone: s.phone,
          inStock: s.in_stock ?? s.inStock ?? false,
          quantity: s.stock_level ?? s.quantity
        }))
      : a.storeLocations;
    return {
      id: a.id,
      productId: a.product_id || a.productId,
      retailerId: a.retailer_id || a.retailerId,
      retailerName: a.retailer_name || a.retailerName,
      retailerSlug: a.retailer_slug || a.retailerSlug,
      // Treat pre-order as not in stock for display purposes
      inStock: (a.in_stock ?? a.inStock ?? false) && status !== 'pre_order',
      availabilityStatus: status as any,
      price: typeof a.price === 'string' ? parseFloat(a.price) : a.price,
      originalPrice: a.original_price ?? a.originalPrice,
      url: a.product_url || a.url,
      cartUrl: a.cart_url || a.cartUrl,
      lastChecked: (a.last_checked ? new Date(a.last_checked).toISOString() : a.lastChecked) || new Date().toISOString(),
      storeLocations: stores,
      metadata: a.metadata || {}
    };
  });
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
    availability: undefined, // Enriched later via /products/by-ids
    createdAt: backendProduct.created_at,
    updatedAt: backendProduct.updated_at
  };
}

export function transformBackendProducts(backendProducts: BackendProduct[]): FrontendProduct[] {
  return backendProducts.map(transformBackendProduct);
}

export function mergeAvailabilityIntoProducts(products: FrontendProduct[], detailed: any[]): FrontendProduct[] {
  if (!Array.isArray(detailed) || detailed.length === 0) return products;
  const availMap = new Map<string, any[]>();
  for (const p of detailed) {
    const id = p.id;
    const availability = transformBackendAvailability(p.availability);
    availMap.set(id, availability);
  }
  return products.map(p => ({
    ...p,
    availability: availMap.get(p.id) ?? p.availability ?? []
  }));
}
