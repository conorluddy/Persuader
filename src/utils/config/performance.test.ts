/**
 * Configuration Performance Tests
 * 
 * Tests for performance utilities and optimizations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getFileHash,
  hasFileChanged,
  getCachedValidation,
  setCachedValidation,
  cleanupCache,
  performanceCollector,
  optimizedMergeConfigs,
  batchConfigOperations,
  createDebouncedReloader,
  ConfigWatcher,
  getCacheStats,
  clearAllCaches,
  type ConfigPerformanceMetrics
} from './performance.js';

describe('Configuration Performance', () => {
  let testDir: string;
  let cleanup: string[] = [];

  beforeEach(async () => {
    testDir = join(tmpdir(), `persuader-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(testDir, { recursive: true });
    cleanup.push(testDir);
    
    // Clear caches before each test
    clearAllCaches();
  });

  afterEach(async () => {
    clearAllCaches();
    
    for (const dir of cleanup) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanup = [];
  });

  describe('file hash utilities', () => {
    it('should calculate file hash', async () => {
      const content = 'test content for hashing';
      const filePath = join(testDir, 'test.txt');
      await fs.writeFile(filePath, content);

      const hash = await getFileHash(filePath);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex string
    });

    it('should return empty hash for non-existent file', async () => {
      const filePath = join(testDir, 'non-existent.txt');
      
      const hash = await getFileHash(filePath);
      
      expect(hash).toBe('');
    });

    it('should detect file changes', async () => {
      const filePath = join(testDir, 'changing.txt');
      
      // Create initial file
      await fs.writeFile(filePath, 'initial content');
      const hasChanged1 = await hasFileChanged(filePath);
      expect(hasChanged1).toBe(true); // First time is always true
      
      // Check again without changing
      const hasChanged2 = await hasFileChanged(filePath);
      expect(hasChanged2).toBe(false); // No change
      
      // Modify file
      await fs.writeFile(filePath, 'modified content');
      const hasChanged3 = await hasFileChanged(filePath);
      expect(hasChanged3).toBe(true); // Changed
    });

    it('should handle same content with different timestamps', async () => {
      const filePath = join(testDir, 'same-content.txt');
      const content = 'same content';
      
      await fs.writeFile(filePath, content);
      await hasFileChanged(filePath); // Initialize cache
      
      // Rewrite same content (different timestamp, same hash)
      await fs.writeFile(filePath, content);
      const hasChanged = await hasFileChanged(filePath);
      
      expect(hasChanged).toBe(false); // Content hash is same
    });
  });

  describe('validation caching', () => {
    it('should cache and retrieve validation results', () => {
      const configHash = 'test-hash-123';
      const validationResult = { valid: true, errors: [] };
      
      // Cache result
      setCachedValidation(configHash, validationResult);
      
      // Retrieve result
      const cached = getCachedValidation(configHash);
      expect(cached).toEqual(validationResult);
    });

    it('should return null for non-existent cache entries', () => {
      const cached = getCachedValidation('non-existent-hash');
      expect(cached).toBeNull();
    });

    it('should expire old cache entries', () => {
      const configHash = 'expiring-hash';
      const validationResult = { valid: true, errors: [] };
      
      setCachedValidation(configHash, validationResult);
      
      // Mock old timestamp
      vi.useFakeTimers();
      vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes (past TTL)
      
      const cached = getCachedValidation(configHash);
      expect(cached).toBeNull();
      
      vi.useRealTimers();
    });
  });

  describe('performance collector', () => {
    beforeEach(() => {
      performanceCollector.reset();
    });

    it('should record operations', () => {
      performanceCollector.recordOperation(100, false); // 100ms, not from cache
      performanceCollector.recordOperation(50, true);   // 50ms, from cache
      
      const metrics = performanceCollector.getMetrics();
      
      expect(metrics.totalOperations).toBe(2);
      expect(metrics.averageLoadTime).toBe(75); // (100 + 50) / 2
      expect(metrics.cacheHitRate).toBe(0.5); // 1 hit out of 2 operations
    });

    it('should record file reads and validations', () => {
      performanceCollector.recordFileRead();
      performanceCollector.recordFileRead();
      performanceCollector.recordValidation();
      
      const metrics = performanceCollector.getMetrics();
      
      expect(metrics.fileReadCount).toBe(2);
      expect(metrics.validationCount).toBe(1);
    });

    it('should record errors', () => {
      performanceCollector.recordError();
      performanceCollector.recordError();
      
      const metrics = performanceCollector.getMetrics();
      
      expect(metrics.errorCount).toBe(2);
    });

    it('should reset metrics', () => {
      performanceCollector.recordOperation(100);
      performanceCollector.recordFileRead();
      performanceCollector.recordError();
      
      performanceCollector.reset();
      const metrics = performanceCollector.getMetrics();
      
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.fileReadCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
    });
  });

  describe('optimized config merging', () => {
    it('should merge configurations efficiently', () => {
      const base = {
        version: '1.0',
        logging: {
          preset: 'LOCAL_DEV',
          colors: true
        }
      };

      const override = {
        logging: {
          timestamp: true,
          colors: false // Override
        },
        provider: {
          name: 'openai'
        }
      };

      const merged = optimizedMergeConfigs(base, override);

      expect(merged.version).toBe('1.0');
      expect(merged.logging.preset).toBe('LOCAL_DEV');
      expect(merged.logging.colors).toBe(false); // Overridden
      expect(merged.logging.timestamp).toBe(true); // Added
      expect(merged.provider.name).toBe('openai'); // Added
    });

    it('should handle identical references efficiently', () => {
      const config = { version: '1.0' };
      
      const result = optimizedMergeConfigs(config, config);
      
      expect(result).toBe(config); // Should return same reference
    });

    it('should handle empty configurations', () => {
      const base = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const empty = {};
      
      expect(optimizedMergeConfigs(base, empty)).toBe(base);
      expect(optimizedMergeConfigs(empty, base)).toBe(base);
    });

    it('should handle deep object merging', () => {
      const base = {
        logging: {
          jsonl: {
            enabled: true,
            directory: './logs'
          }
        }
      };

      const override = {
        logging: {
          jsonl: {
            maxFileSize: '10MB'
          }
        }
      };

      const merged = optimizedMergeConfigs(base, override);

      expect(merged.logging.jsonl.enabled).toBe(true);
      expect(merged.logging.jsonl.directory).toBe('./logs');
      expect(merged.logging.jsonl.maxFileSize).toBe('10MB');
    });

    it('should handle array replacement (not merging)', () => {
      const base = {
        extends: ['config1', 'config2']
      };

      const override = {
        extends: ['config3', 'config4']
      };

      const merged = optimizedMergeConfigs(base, override);

      expect(merged.extends).toEqual(['config3', 'config4']); // Replaced, not merged
    });
  });

  describe('batch operations', () => {
    it('should execute operations in batches', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        () => Promise.resolve(`result-${i}`)
      );

      const results = await batchConfigOperations(operations, 3);

      expect(results).toHaveLength(10);
      expect(results).toEqual([
        'result-0', 'result-1', 'result-2', 'result-3', 'result-4',
        'result-5', 'result-6', 'result-7', 'result-8', 'result-9'
      ]);
    });

    it('should handle async operations with different completion times', async () => {
      const operations = [
        () => new Promise(resolve => setTimeout(() => resolve('fast'), 10)),
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 50)),
        () => new Promise(resolve => setTimeout(() => resolve('medium'), 30))
      ];

      const results = await batchConfigOperations(operations, 2);

      expect(results).toHaveLength(3);
      expect(results).toContain('fast');
      expect(results).toContain('slow');
      expect(results).toContain('medium');
    });

    it('should handle operation failures gracefully', async () => {
      const operations = [
        () => Promise.resolve('success'),
        () => Promise.reject(new Error('failure')),
        () => Promise.resolve('another-success')
      ];

      // Should not throw, but may not complete all operations
      await expect(batchConfigOperations(operations, 2)).rejects.toThrow();
    });
  });

  describe('debounced reloader', () => {
    it('should debounce multiple calls', async () => {
      let callCount = 0;
      const reloadFn = vi.fn(async () => {
        callCount++;
      });

      const debouncedReload = createDebouncedReloader(reloadFn, 100);

      // Call multiple times rapidly
      debouncedReload();
      debouncedReload();
      debouncedReload();

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callCount).toBe(1); // Should only be called once
    });

    it('should handle errors in debounced function', async () => {
      const errorFn = vi.fn(async () => {
        throw new Error('Test error');
      });

      const debouncedReload = createDebouncedReloader(errorFn, 50);
      
      // Should not throw
      expect(() => debouncedReload()).not.toThrow();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(errorFn).toHaveBeenCalled();
    });
  });

  describe('ConfigWatcher', () => {
    it('should create and stop watcher', async () => {
      const watcher = new ConfigWatcher();
      
      const filePath = join(testDir, 'watched.txt');
      await fs.writeFile(filePath, 'initial content');
      
      let changeCount = 0;
      await watcher.watch([filePath], () => {
        changeCount++;
      });
      
      // Should detect initial state
      expect(changeCount).toBe(0); // Initial setup doesn't trigger callback immediately
      
      watcher.stop();
    });

    it('should detect file changes', async () => {
      const watcher = new ConfigWatcher();
      const filePath = join(testDir, 'changing.txt');
      await fs.writeFile(filePath, 'initial content');
      
      let changeCount = 0;
      await watcher.watch([filePath], (changedPath) => {
        expect(changedPath).toBe(filePath);
        changeCount++;
      });
      
      // Change the file
      await fs.writeFile(filePath, 'modified content');
      
      // Wait for polling interval
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      expect(changeCount).toBeGreaterThan(0);
      
      watcher.stop();
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      // Perform some operations to generate cache data
      setCachedValidation('hash1', { valid: true });
      setCachedValidation('hash2', { valid: false });
      
      const stats = getCacheStats();
      
      expect(stats).toHaveProperty('fileHashes');
      expect(stats).toHaveProperty('validations');
      expect(stats).toHaveProperty('memoryUsage');
      expect(typeof stats.fileHashes).toBe('number');
      expect(typeof stats.validations).toBe('number');
      expect(typeof stats.memoryUsage).toBe('string');
    });

    it('should clean up expired cache entries', async () => {
      const filePath = join(testDir, 'cache-test.txt');
      await fs.writeFile(filePath, 'content');
      
      // Generate cache entries
      await hasFileChanged(filePath);
      setCachedValidation('test-hash', { valid: true });
      
      // Mock time passage
      vi.useFakeTimers();
      vi.advanceTimersByTime(35 * 60 * 1000); // 35 minutes (past TTL)
      
      cleanupCache();
      
      // Entries should be cleaned up
      const stats = getCacheStats();
      expect(stats.validations).toBe(0);
      
      vi.useRealTimers();
    });

    it('should clear all caches', async () => {
      const filePath = join(testDir, 'clear-test.txt');
      await fs.writeFile(filePath, 'content');
      
      // Generate cache data
      await hasFileChanged(filePath);
      setCachedValidation('test-hash', { valid: true });
      performanceCollector.recordOperation(100);
      
      clearAllCaches();
      
      const stats = getCacheStats();
      expect(stats.fileHashes).toBe(0);
      expect(stats.validations).toBe(0);
      
      const perfMetrics = performanceCollector.getMetrics();
      expect(perfMetrics.totalOperations).toBe(0);
    });
  });

  describe('performance edge cases', () => {
    it('should handle very large configurations efficiently', () => {
      const largeBase = {
        version: '1.0',
        data: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };

      const override = {
        newField: 'added'
      };

      const startTime = Date.now();
      const merged = optimizedMergeConfigs(largeBase, override);
      const duration = Date.now() - startTime;

      expect(merged.data).toHaveLength(10000);
      expect(merged.newField).toBe('added');
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should handle deeply nested configurations', () => {
      // Create deeply nested structure
      let deepBase: any = { version: '1.0' };
      let current = deepBase;
      for (let i = 0; i < 50; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const override = {
        topLevel: 'added'
      };

      const merged = optimizedMergeConfigs(deepBase, override);

      expect(merged.topLevel).toBe('added');
      expect(merged.version).toBe('1.0');
      
      // Navigate to deep level to verify structure preserved
      let deepCheck = merged;
      for (let i = 0; i < 50; i++) {
        expect(deepCheck.nested).toBeDefined();
        expect(deepCheck.nested.level).toBe(i);
        deepCheck = deepCheck.nested;
      }
    });

    it('should handle concurrent cache operations safely', async () => {
      const filePath = join(testDir, 'concurrent.txt');
      await fs.writeFile(filePath, 'content');
      
      const promises = Array.from({ length: 100 }, (_, i) => 
        hasFileChanged(filePath).then(() => 
          setCachedValidation(`hash-${i}`, { valid: true })
        )
      );

      await Promise.all(promises);

      const stats = getCacheStats();
      expect(stats.validations).toBe(100);
    });

    it('should handle malformed file paths gracefully', async () => {
      const invalidPaths = [
        '',
        null as any,
        undefined as any,
        '/non/existent/path',
        'relative/path'
      ];

      for (const path of invalidPaths) {
        const hash = await getFileHash(path);
        expect(hash).toBe(''); // Should return empty hash for invalid paths
      }
    });
  });
});