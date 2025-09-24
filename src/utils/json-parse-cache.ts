/**
 * JSON Parse Cache Module
 * 
 * Caches JSON parse results to avoid multiple parse attempts
 * on the same content, improving performance for validation retries.
 */

/**
 * Parse result for cached JSON
 */
export interface JsonParseResult {
  success: boolean;
  value?: unknown;
  error?: Error;
}

/**
 * Configuration for JSON parse cache
 */
export interface JsonParseCacheConfig {
  /** Maximum number of cached parses (default: 100) */
  maxCacheSize: number;
  
  /** Maximum content size to cache in bytes (default: 100KB) */
  maxContentSize: number;
  
  /** Cache TTL in milliseconds (default: 5 minutes) */
  ttlMs: number;
  
  /** Enable caching (default: true) */
  enabled: boolean;
}

interface CacheEntry {
  result: JsonParseResult;
  timestamp: number;
  contentHash: string;
  accessCount: number;
}

/**
 * LRU cache for JSON parse results
 */
export class JsonParseCache {
  private readonly config: JsonParseCacheConfig;
  private readonly cache: Map<string, CacheEntry>;
  
  constructor(config: Partial<JsonParseCacheConfig> = {}) {
    this.config = {
      maxCacheSize: config.maxCacheSize ?? 100,
      maxContentSize: config.maxContentSize ?? 100 * 1024, // 100KB
      ttlMs: config.ttlMs ?? 5 * 60 * 1000, // 5 minutes
      enabled: config.enabled ?? true,
    };
    
    this.cache = new Map();
  }
  
  /**
   * Parse JSON with caching
   * 
   * @param content - JSON string to parse
   * @returns Parse result
   */
  parse(content: string): JsonParseResult {
    if (!this.config.enabled) {
      return this.directParse(content);
    }
    
    // Check size limit
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > this.config.maxContentSize) {
      return this.directParse(content);
    }
    
    // Generate hash for content
    const hash = this.hashContent(content);
    
    // Check cache
    const cached = this.cache.get(hash);
    if (cached && this.isValid(cached)) {
      cached.accessCount++;
      return cached.result;
    }
    
    // Parse and cache
    const result = this.directParse(content);
    this.addToCache(hash, result);
    
    return result;
  }
  
  /**
   * Direct JSON parse without caching
   * 
   * @param content - JSON string to parse
   * @returns Parse result
   */
  private directParse(content: string): JsonParseResult {
    try {
      const value = JSON.parse(content);
      return { success: true, value };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error : new Error('JSON parse failed') 
      };
    }
  }
  
  /**
   * Generate a simple hash for content
   * 
   * @param content - Content to hash
   * @returns Hash string
   */
  private hashContent(content: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `json_${hash}_${content.length}`;
  }
  
  /**
   * Check if cache entry is still valid
   * 
   * @param entry - Cache entry to check
   * @returns True if valid
   */
  private isValid(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    return age < this.config.ttlMs;
  }
  
  /**
   * Add parse result to cache
   * 
   * @param hash - Content hash
   * @param result - Parse result
   */
  private addToCache(hash: string, result: JsonParseResult): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldest();
    }
    
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      contentHash: hash,
      accessCount: 1,
    };
    
    this.cache.set(hash, entry);
  }
  
  /**
   * Evict the oldest cache entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   * 
   * @returns Cache stats
   */
  getStats(): {
    size: number;
    maxSize: number;
    enabled: boolean;
    hitRate: number;
  } {
    let totalAccess = 0;
    let hits = 0;
    
    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 1) {
        hits += entry.accessCount - 1;
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      enabled: this.config.enabled,
      hitRate: totalAccess > 0 ? hits / totalAccess : 0,
    };
  }
  
  /**
   * Evict expired entries
   */
  evictExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.config.ttlMs) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
}

// Global JSON parse cache
let globalParseCache: JsonParseCache | null = null;

/**
 * Get the global JSON parse cache
 * 
 * @returns Global cache instance
 */
export function getJsonParseCache(): JsonParseCache {
  if (!globalParseCache) {
    globalParseCache = new JsonParseCache();
  }
  return globalParseCache;
}

/**
 * Parse JSON using the global cache
 * 
 * @param content - JSON string to parse
 * @returns Parse result
 */
export function parseJsonCached(content: string): JsonParseResult {
  return getJsonParseCache().parse(content);
}

/**
 * Configure the global JSON parse cache
 * 
 * @param config - Cache configuration
 */
export function configureJsonParseCache(config: Partial<JsonParseCacheConfig>): void {
  globalParseCache = new JsonParseCache(config);
}

/**
 * Clear the global JSON parse cache
 */
export function clearJsonParseCache(): void {
  getJsonParseCache().clear();
}