import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Lightweight in-process TTL cache.
 * Zero external dependencies — suitable for single-instance deployments.
 * Swap for Redis-backed implementation if you scale to multiple instances.
 */
@Injectable()
export class AppCacheService implements OnModuleDestroy {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Evict stale entries every 2 minutes to prevent memory drift
    this.cleanupInterval = setInterval(() => this.evictExpired(), 2 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  /**
   * Delete a specific cache entry immediately (e.g., after a write).
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Delete all entries whose keys start with a given prefix.
   * Useful for namespace-level invalidation.
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }
}
