// Centralized cache management with TTL and invalidation strategies
import { ExtensionSettings, User, STORAGE_KEYS } from '../../shared/types';
import { getStorageData, setStorageData, log } from '../../shared/utils';

interface CacheEntry<T> {
    data: T;
    expiry: number;
    lastAccessed: number;
}

export class CacheManager {
    private cache = new Map<string, CacheEntry<any>>();
    private readonly DEFAULT_TTL = 60000; // 1 minute
    private readonly MAX_CACHE_SIZE = 50;
    private cleanupInterval?: number;
    
    // Performance tracking
    private hits = 0;
    private misses = 0;

    constructor() {
        this.startCleanupTimer();
    }

    /**
     * Get cached settings with automatic refresh
     */
    public async getCachedSettings(): Promise<ExtensionSettings | null> {
        return this.getCachedData(
            STORAGE_KEYS.SETTINGS,
            () => getStorageData<ExtensionSettings>(STORAGE_KEYS.SETTINGS)
        );
    }

    /**
     * Get cached user with automatic refresh
     */
    public async getCachedUser(): Promise<User | null> {
        return this.getCachedData(
            STORAGE_KEYS.USER,
            () => getStorageData<User>(STORAGE_KEYS.USER)
        );
    }

    /**
     * Get auth token (not cached for security)
     */
    public async getAuthToken(): Promise<string | null> {
        return getStorageData<string>(STORAGE_KEYS.AUTH_TOKEN);
    }

    /**
     * Update settings and invalidate cache
     */
    public async updateSettings(updates: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
        const currentSettings = await this.getCachedSettings();
        
        // Ensure we have valid current settings with defaults
        const baseSettings: ExtensionSettings = currentSettings || {
            isEnabled: true,
            autoFillEnabled: true,
            notificationsEnabled: true,
            quickActionsEnabled: true,
            retailerSettings: {
                bestbuy: { enabled: true, autoLogin: false, autoFill: true },
                walmart: { enabled: true, autoLogin: false, autoFill: true },
                costco: { enabled: true, autoLogin: false, autoFill: true },
                samsclub: { enabled: true, autoLogin: false, autoFill: true }
            }
        };
        
        const updatedSettings: ExtensionSettings = { ...baseSettings, ...updates };

        await setStorageData(STORAGE_KEYS.SETTINGS, updatedSettings);
        this.setCachedData(STORAGE_KEYS.SETTINGS, updatedSettings);

        log('info', 'Settings updated and cached');
        return updatedSettings;
    }

    /**
     * Generic cached data getter with automatic refresh
     */
    private async getCachedData<T>(
        key: string,
        fetcher: () => Promise<T | null>,
        ttl: number = this.DEFAULT_TTL
    ): Promise<T | null> {
        const cached = this.cache.get(key);
        const now = Date.now();

        // Return cached data if valid
        if (cached && now < cached.expiry) {
            cached.lastAccessed = now;
            this.hits++;
            return cached.data;
        }

        // Cache miss - fetch fresh data
        this.misses++;
        
        try {
            const data = await fetcher();
            if (data) {
                this.setCachedData(key, data, ttl);
            }
            return data;
        } catch (error) {
            log('error', `Failed to fetch data for key: ${key}`, error);
            // Return stale data if available as fallback
            if (cached?.data) {
                log('warn', `Using stale data for key: ${key} due to fetch error`);
                return cached.data;
            }
            return null;
        }
    }

    /**
     * Set cached data with TTL
     */
    private setCachedData<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
        const now = Date.now();

        // Implement LRU eviction if cache is full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.evictLeastRecentlyUsed();
        }

        this.cache.set(key, {
            data,
            expiry: now + ttl,
            lastAccessed: now
        });
    }

    /**
     * Invalidate specific cache entry
     */
    public invalidateCache(key: string): void {
        this.cache.delete(key);
        log('info', `Cache invalidated for key: ${key}`);
    }

    /**
     * Clear all cache entries
     */
    public clearCache(): void {
        this.cache.clear();
        log('info', 'All cache entries cleared');
    }

    /**
     * Get cache statistics for monitoring
     */
    public getCacheStats(): {
        size: number;
        hitRate: number;
        hits: number;
        misses: number;
        entries: Array<{ key: string; expiry: number; lastAccessed: number }>;
    } {
        const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
            key,
            expiry: entry.expiry,
            lastAccessed: entry.lastAccessed
        }));

        const totalRequests = this.hits + this.misses;
        const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

        return {
            size: this.cache.size,
            hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
            hits: this.hits,
            misses: this.misses,
            entries
        };
    }

    /**
     * Start automatic cleanup timer
     */
    private startCleanupTimer(): void {
        this.cleanupInterval = window.setInterval(() => {
            this.cleanupExpiredEntries();
        }, 60000); // Cleanup every minute
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupExpiredEntries(): void {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            log('info', `Cleaned up ${cleanedCount} expired cache entries`);
        }
    }

    /**
     * Evict least recently used entry
     */
    private evictLeastRecentlyUsed(): void {
        let oldestKey = '';
        let oldestTime = Date.now();

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            log('info', `Evicted LRU cache entry: ${oldestKey}`);
        }
    }

    /**
     * Reset performance counters
     */
    public resetStats(): void {
        this.hits = 0;
        this.misses = 0;
        log('info', 'Cache performance counters reset');
    }

    /**
     * Cleanup resources
     */
    public destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clearCache();
        this.resetStats();
    }
}