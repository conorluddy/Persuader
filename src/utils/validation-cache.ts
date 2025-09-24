/**
 * Validation Cache Module
 * 
 * Memory-safe cache for validation failures to prevent memory leaks
 * in debug mode. Implements a circular buffer with size limits.
 */

import type { ValidationError } from '../types/errors.js';

export interface ValidationFailureEntry {
  readonly error: ValidationError;
  readonly content: string;
  readonly attemptNumber: number;
  readonly timestamp: Date;
}

/**
 * Configuration for validation cache
 */
export interface ValidationCacheConfig {
  /** Maximum number of validation failures to cache (default: 100) */
  readonly maxEntries: number;
  
  /** Maximum size of content to cache per entry in bytes (default: 10KB) */
  readonly maxContentSize: number;
  
  /** Enable cache (default: true in debug mode) */
  readonly enabled: boolean;
}

/**
 * Memory-safe circular buffer for validation failures
 */
export class ValidationFailureCache {
  private readonly config: ValidationCacheConfig;
  private readonly cache: Map<string, ValidationFailureEntry>;
  private readonly accessOrder: string[];
  
  constructor(config: Partial<ValidationCacheConfig> = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 100,
      maxContentSize: config.maxContentSize ?? 10 * 1024, // 10KB
      enabled: config.enabled ?? (process.env.NODE_ENV === 'development'),
    };
    
    this.cache = new Map();
    this.accessOrder = [];
  }
  
  /**
   * Add a validation failure to the cache
   * 
   * @param error - The validation error
   * @param content - The content that failed validation
   * @param attemptNumber - The attempt number
   * @returns The cache key for this entry
   */
  add(error: ValidationError, content: string, attemptNumber: number): string | null {
    if (!this.config.enabled) {
      return null;
    }
    
    // Generate unique key
    const key = this.generateKey(error, attemptNumber);
    
    // Truncate content if too large
    const truncatedContent = this.truncateContent(content);
    
    // Create entry
    const entry: ValidationFailureEntry = {
      error,
      content: truncatedContent,
      attemptNumber,
      timestamp: new Date(),
    };
    
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }
    
    // Add to cache
    this.cache.set(key, entry);
    this.accessOrder.push(key);
    
    return key;
  }
  
  /**
   * Get a validation failure from the cache
   * 
   * @param key - The cache key
   * @returns The cached entry or undefined
   */
  get(key: string): ValidationFailureEntry | undefined {
    return this.cache.get(key);
  }
  
  /**
   * Get all cached validation failures
   * 
   * @returns Array of all cached entries
   */
  getAll(): ValidationFailureEntry[] {
    return Array.from(this.cache.values());
  }
  
  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
  }
  
  /**
   * Get cache statistics
   * 
   * @returns Cache statistics object
   */
  getStats(): {
    size: number;
    maxEntries: number;
    enabled: boolean;
    oldestEntry?: Date | undefined;
    newestEntry?: Date | undefined;
  } {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    const stats: {
      size: number;
      maxEntries: number;
      enabled: boolean;
      oldestEntry?: Date | undefined;
      newestEntry?: Date | undefined;
    } = {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      enabled: this.config.enabled,
    };
    
    if (timestamps.length > 0) {
      stats.oldestEntry = new Date(Math.min(...timestamps.map(t => t.getTime())));
      stats.newestEntry = new Date(Math.max(...timestamps.map(t => t.getTime())));
    }
    
    return stats;
  }
  
  /**
   * Generate a unique key for a validation failure
   */
  private generateKey(error: ValidationError, attemptNumber: number): string {
    return `${error.code}_${attemptNumber}_${Date.now()}`;
  }
  
  /**
   * Truncate content if it exceeds max size
   */
  private truncateContent(content: string): string {
    const bytes = Buffer.byteLength(content, 'utf8');
    
    if (bytes <= this.config.maxContentSize) {
      return content;
    }
    
    // Truncate to fit within size limit
    let truncated = content;
    while (Buffer.byteLength(truncated, 'utf8') > this.config.maxContentSize) {
      truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
    }
    
    return `${truncated}... [truncated from ${bytes} bytes]`;
  }
  
  /**
   * Evict the oldest entry from the cache
   */
  private evictOldest(): void {
    if (this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
}

// Global instance for the application
let globalCache: ValidationFailureCache | null = null;

/**
 * Get the global validation failure cache
 * 
 * @returns The global cache instance
 */
export function getValidationCache(): ValidationFailureCache {
  if (!globalCache) {
    globalCache = new ValidationFailureCache();
  }
  return globalCache;
}

/**
 * Configure the global validation cache
 * 
 * @param config - Configuration options
 */
export function configureValidationCache(config: Partial<ValidationCacheConfig>): void {
  globalCache = new ValidationFailureCache(config);
}

/**
 * Clear the global validation cache
 */
export function clearValidationCache(): void {
  getValidationCache().clear();
}