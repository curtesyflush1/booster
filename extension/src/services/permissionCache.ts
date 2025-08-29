// Permission caching to reduce Chrome API calls
import { RetailerId } from '../shared/types';

interface CacheEntry {
  value: boolean;
  timestamp: number;
  ttl: number;
}

export class PermissionCache {
  private cache = new Map<RetailerId, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(retailerId: RetailerId, hasPermission: boolean, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(retailerId, {
      value: hasPermission,
      timestamp: Date.now(),
      ttl
    });
  }

  get(retailerId: RetailerId): boolean | null {
    const entry = this.cache.get(retailerId);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(retailerId);
      return null;
    }

    return entry.value;
  }

  invalidate(retailerId: RetailerId): void {
    this.cache.delete(retailerId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  // Invalidate cache when permissions change
  onPermissionChange(retailerId: RetailerId, hasPermission: boolean): void {
    this.set(retailerId, hasPermission, this.DEFAULT_TTL);
  }
}

// Enhanced permission checker with caching
export class CachedPermissionChecker {
  private cache = new PermissionCache();

  async hasPermission(retailerId: RetailerId): Promise<boolean> {
    // Check cache first
    const cached = this.cache.get(retailerId);
    if (cached !== null) {
      return cached;
    }

    // Fallback to actual check
    const hasPermission = await this.checkPermissionFromChrome(retailerId);
    this.cache.set(retailerId, hasPermission);
    return hasPermission;
  }

  private async checkPermissionFromChrome(retailerId: RetailerId): Promise<boolean> {
    // Implementation would go here
    return false; // placeholder
  }

  // Call this when permissions are granted/revoked
  onPermissionChanged(retailerId: RetailerId, hasPermission: boolean): void {
    this.cache.onPermissionChange(retailerId, hasPermission);
  }
}