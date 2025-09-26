/**
 * Configuration Performance Optimizations
 * 
 * Performance utilities and optimizations for the configuration system
 */

import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import type { PersuaderConfig } from './schema.js';

/**
 * File hash cache for detecting changes
 */
const fileHashCache = new Map<string, { hash: string; timestamp: number; }>();

/**
 * Configuration validation cache
 */
const validationCache = new Map<string, { result: any; hash: string; timestamp: number; }>();

/**
 * Cache TTL in milliseconds (30 minutes)
 */
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Calculate file hash for change detection
 */
export async function getFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Check if file has changed since last check
 */
export async function hasFileChanged(filePath: string): Promise<boolean> {
  const cached = fileHashCache.get(filePath);
  const currentHash = await getFileHash(filePath);
  
  if (!cached) {
    fileHashCache.set(filePath, { hash: currentHash, timestamp: Date.now() });
    return true;
  }
  
  if (cached.hash !== currentHash) {
    fileHashCache.set(filePath, { hash: currentHash, timestamp: Date.now() });
    return true;
  }
  
  return false;
}

/**
 * Get cached validation result if available and fresh
 */
export function getCachedValidation(configHash: string): any | null {
  const cached = validationCache.get(configHash);
  
  if (!cached) return null;
  
  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    validationCache.delete(configHash);
    return null;
  }
  
  return cached.result;
}

/**
 * Cache validation result
 */
export function setCachedValidation(configHash: string, result: any): void {
  validationCache.set(configHash, {
    result,
    hash: configHash,
    timestamp: Date.now()
  });
}

/**
 * Clear expired cache entries
 */
export function cleanupCache(): void {
  const now = Date.now();
  
  for (const [key, value] of fileHashCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      fileHashCache.delete(key);
    }
  }
  
  for (const [key, value] of validationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      validationCache.delete(key);
    }
  }
}

/**
 * Performance metrics tracking
 */
export interface ConfigPerformanceMetrics {
  totalOperations: number;
  averageLoadTime: number;
  cacheHitRate: number;
  fileReadCount: number;
  validationCount: number;
  errorCount: number;
  lastReset: number;
}

/**
 * Performance metrics collector
 */
class PerformanceCollector {
  private metrics: ConfigPerformanceMetrics = {
    totalOperations: 0,
    averageLoadTime: 0,
    cacheHitRate: 0,
    fileReadCount: 0,
    validationCount: 0,
    errorCount: 0,
    lastReset: Date.now()
  };
  
  private totalLoadTime = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  recordOperation(duration: number, fromCache: boolean = false): void {
    this.metrics.totalOperations++;
    this.totalLoadTime += duration;
    this.metrics.averageLoadTime = this.totalLoadTime / this.metrics.totalOperations;
    
    if (fromCache) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    
    const totalCacheAttempts = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = totalCacheAttempts > 0 ? this.cacheHits / totalCacheAttempts : 0;
  }

  recordFileRead(): void {
    this.metrics.fileReadCount++;
  }

  recordValidation(): void {
    this.metrics.validationCount++;
  }

  recordError(): void {
    this.metrics.errorCount++;
  }

  getMetrics(): ConfigPerformanceMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalOperations: 0,
      averageLoadTime: 0,
      cacheHitRate: 0,
      fileReadCount: 0,
      validationCount: 0,
      errorCount: 0,
      lastReset: Date.now()
    };
    this.totalLoadTime = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

/**
 * Global performance collector instance
 */
export const performanceCollector = new PerformanceCollector();

/**
 * Optimized configuration merger with structural sharing
 */
export function optimizedMergeConfigs(base: PersuaderConfig, override: PersuaderConfig): PersuaderConfig {
  // Quick reference check
  if (base === override) return base;
  
  // If override is empty, return base
  const overrideKeys = Object.keys(override);
  if (overrideKeys.length === 0) return base;
  
  // If base is empty, return override
  const baseKeys = Object.keys(base);
  if (baseKeys.length === 0) return override;
  
  // Only merge what's actually different
  const result: PersuaderConfig = { ...base };
  
  for (const key of overrideKeys) {
    const overrideValue = override[key as keyof PersuaderConfig];
    const baseValue = base[key as keyof PersuaderConfig];
    
    if (overrideValue !== baseValue) {
      if (typeof overrideValue === 'object' && overrideValue !== null && 
          typeof baseValue === 'object' && baseValue !== null && 
          !Array.isArray(overrideValue)) {
        // Deep merge for objects
        (result as any)[key] = optimizedMergeConfigs(
          baseValue as PersuaderConfig, 
          overrideValue as PersuaderConfig
        );
      } else {
        // Direct assignment for primitives and arrays
        (result as any)[key] = overrideValue;
      }
    }
  }
  
  return result;
}

/**
 * Batch configuration operations
 */
export async function batchConfigOperations<T>(
  operations: Array<() => Promise<T>>,
  concurrency: number = 3
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const operation of operations) {
    const promise = operation().then(result => {
      results.push(result);
    });
    
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

/**
 * Debounced configuration reloader
 */
export function createDebouncedReloader(
  reloadFn: () => Promise<void>,
  delay: number = 250
): () => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      reloadFn().catch(error => {
        console.error('Debounced reload failed:', error);
      });
    }, delay);
  };
}

/**
 * Memory-efficient configuration watcher
 */
export class ConfigWatcher {
  private watchers = new Map<string, () => void>();
  private isWatching = false;

  async watch(filePaths: string[], callback: (changedPath: string) => void): Promise<void> {
    if (this.isWatching) return;
    
    this.isWatching = true;
    
    // Simple polling watcher (for compatibility)
    const checkForChanges = async () => {
      for (const filePath of filePaths) {
        if (await hasFileChanged(filePath)) {
          callback(filePath);
        }
      }
    };
    
    const debouncedCheck = createDebouncedReloader(checkForChanges);
    const intervalId = setInterval(debouncedCheck, 1000);
    
    this.watchers.set('main', () => {
      clearInterval(intervalId);
      this.isWatching = false;
    });
  }

  stop(): void {
    for (const cleanup of this.watchers.values()) {
      cleanup();
    }
    this.watchers.clear();
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  fileHashes: number;
  validations: number;
  memoryUsage: string;
} {
  const stats = {
    fileHashes: fileHashCache.size,
    validations: validationCache.size,
    memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
  };
  
  return stats;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  fileHashCache.clear();
  validationCache.clear();
  performanceCollector.reset();
}

// Periodic cleanup (every 10 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 10 * 60 * 1000);
}