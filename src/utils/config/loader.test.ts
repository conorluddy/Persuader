/**
 * Configuration Loader Tests
 * 
 * Tests for high-level configuration loading with caching and performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadConfig,
  loadEnvironmentConfig,
  loadPipelineConfig,
  clearConfigCache,
  getConfigCacheStats,
  getEnhancedConfigCacheStats,
  preloadConfig,
  watchConfigFile,
  getConfigPerformanceMetrics,
  resetConfigPerformanceMetrics,
  type LoadConfigOptions
} from './loader.js';

describe('Configuration Loader', () => {
  let testDir: string;
  let cleanup: string[] = [];

  beforeEach(async () => {
    testDir = join(tmpdir(), `persuader-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(testDir, { recursive: true });
    cleanup.push(testDir);
    
    // Clear cache and reset metrics before each test
    clearConfigCache();
    resetConfigPerformanceMetrics();
  });

  afterEach(async () => {
    clearConfigCache();
    
    for (const dir of cleanup) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanup = [];
  });

  describe('loadConfig', () => {
    it('should load basic configuration file', async () => {
      const config = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' }
      };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await loadConfig({ startDir: testDir });

      expect(result.config).toEqual(config);
      expect(result.discovery.found).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(result.loadTimeMs).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return default config when no file found', async () => {
      const result = await loadConfig({ 
        startDir: testDir, 
        mergeWithDefaults: true 
      });

      expect(result.config).toBeDefined();
      expect(result.config?.version).toBeDefined();
      expect(result.discovery.found).toBe(false);
      expect(result.fromCache).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should use cache on subsequent loads', async () => {
      const config = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      // First load
      const result1 = await loadConfig({ startDir: testDir, cache: true });
      expect(result1.fromCache).toBe(false);

      // Second load should use cache
      const result2 = await loadConfig({ startDir: testDir, cache: true });
      expect(result2.fromCache).toBe(true);
      expect(result2.config).toEqual(config);
    });

    it('should bypass cache when forceReload is true', async () => {
      const config = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      // Load and cache
      await loadConfig({ startDir: testDir, cache: true });

      // Force reload should bypass cache
      const result = await loadConfig({ 
        startDir: testDir, 
        cache: true, 
        forceReload: true 
      });
      expect(result.fromCache).toBe(false);
    });

    it('should handle configuration inheritance', async () => {
      // Create base configuration
      const baseConfig = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV', colors: true }
      };
      await fs.writeFile(join(testDir, 'base.json'), JSON.stringify(baseConfig));

      // Create extending configuration
      const mainConfig = {
        version: '1.0',
        extends: 'base',
        logging: { timestamp: true }
      };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(mainConfig));

      const result = await loadConfig({ 
        startDir: testDir, 
        enableInheritance: true 
      });

      expect(result.config?.logging?.preset).toBe('LOCAL_DEV');
      expect(result.config?.logging?.colors).toBe(true);
      expect(result.config?.logging?.timestamp).toBe(true);
    });

    it('should handle environment variable interpolation', async () => {
      const config = {
        version: '1.0',
        provider: {
          apiKey: '${TEST_API_KEY}',
          timeout: '${TEST_TIMEOUT:-30s}'
        }
      };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      // Set environment variables
      process.env.TEST_API_KEY = 'secret-key-123';

      const result = await loadConfig({ 
        startDir: testDir, 
        enableInterpolation: true 
      });

      expect(result.config?.provider?.apiKey).toBe('secret-key-123');
      expect(result.config?.provider?.timeout).toBe('30s');

      // Cleanup
      delete process.env.TEST_API_KEY;
    });

    it('should detect and reload changed files', async () => {
      const config1 = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const config2 = { version: '1.0', logging: { preset: 'PRODUCTION' } };
      const configPath = join(testDir, '.persuader');

      // Create initial config
      await fs.writeFile(configPath, JSON.stringify(config1));
      const result1 = await loadConfig({ startDir: testDir, cache: true });
      expect(result1.config?.logging?.preset).toBe('LOCAL_DEV');

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update config file
      await fs.writeFile(configPath, JSON.stringify(config2));
      const result2 = await loadConfig({ startDir: testDir, cache: true });
      expect(result2.config?.logging?.preset).toBe('PRODUCTION');
      expect(result2.fromCache).toBe(false); // Should detect change and reload
    });

    it('should handle parsing errors gracefully', async () => {
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, '{ invalid json }');

      const result = await loadConfig({ startDir: testDir });

      expect(result.config).toBe(null);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should apply environment-specific configuration', async () => {
      const config = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' },
        environments: {
          production: {
            logging: { preset: 'PRODUCTION' }
          }
        }
      };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await loadConfig({ 
        startDir: testDir, 
        environment: 'production' 
      });

      expect(result.config?.logging?.preset).toBe('PRODUCTION');
      expect(result.environment).toBe('production');
    });

    it('should apply pipeline-specific configuration', async () => {
      const config = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' },
        pipelines: {
          'data-processing': {
            logging: { preset: 'PERFORMANCE_FOCUS' }
          }
        }
      };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await loadConfig({ 
        startDir: testDir, 
        pipeline: 'data-processing' 
      });

      expect(result.config?.logging?.preset).toBe('PERFORMANCE_FOCUS');
      expect(result.pipeline).toBe('data-processing');
    });
  });

  describe('loadEnvironmentConfig', () => {
    it('should load environment-specific configuration', async () => {
      const config = {
        version: '1.0',
        environments: {
          development: {
            logging: { preset: 'DEBUG_FULL' }
          }
        }
      };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await loadEnvironmentConfig('development', { startDir: testDir });

      expect(result.environment).toBe('development');
      expect(result.config).toBeDefined();
    });
  });

  describe('loadPipelineConfig', () => {
    it('should load pipeline-specific configuration', async () => {
      const config = {
        version: '1.0',
        pipelines: {
          'test-pipeline': {
            logging: { preset: 'TEST_RUNNER' }
          }
        }
      };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await loadPipelineConfig('test-pipeline', { startDir: testDir });

      expect(result.pipeline).toBe('test-pipeline');
      expect(result.config).toBeDefined();
    });
  });

  describe('cache management', () => {
    it('should track cache statistics', async () => {
      const config = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      // Load once (miss)
      await loadConfig({ startDir: testDir, cache: true });
      
      // Load again (hit)
      await loadConfig({ startDir: testDir, cache: true });

      const stats = getConfigCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it('should provide enhanced cache statistics', () => {
      const enhancedStats = getEnhancedConfigCacheStats();

      expect(enhancedStats).toHaveProperty('cache');
      expect(enhancedStats).toHaveProperty('performance');
      expect(enhancedStats).toHaveProperty('system');
      expect(enhancedStats).toHaveProperty('analysis');
      expect(enhancedStats.analysis).toHaveProperty('efficiency');
      expect(enhancedStats.analysis).toHaveProperty('recommendedCacheSize');
    });

    it('should evict least recently used entries when cache is full', async () => {
      // Create many config files to test LRU eviction
      const configs = Array.from({ length: 60 }, (_, i) => ({
        version: '1.0',
        id: i,
        logging: { preset: 'LOCAL_DEV' }
      }));

      for (let i = 0; i < configs.length; i++) {
        const configPath = join(testDir, `config-${i}.json`);
        await fs.writeFile(configPath, JSON.stringify(configs[i]));
        await loadConfig({ configPath, cache: true });
      }

      const stats = getConfigCacheStats();
      expect(stats.size).toBeLessThanOrEqual(50); // Should not exceed max cache size
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should clear cache completely', async () => {
      const config = { version: '1.0' };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      await loadConfig({ startDir: testDir, cache: true });
      expect(getConfigCacheStats().size).toBe(1);

      clearConfigCache();
      expect(getConfigCacheStats().size).toBe(0);
      expect(getConfigCacheStats().hits).toBe(0);
      expect(getConfigCacheStats().misses).toBe(0);
    });
  });

  describe('preloadConfig', () => {
    it('should preload single configuration', async () => {
      const config = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await preloadConfig({ startDir: testDir });

      expect(result.loaded).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.totalTime).toBeGreaterThan(0);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].success).toBe(true);
    });

    it('should preload multiple configurations in batch', async () => {
      const configs = [
        { version: '1.0', id: 1 },
        { version: '1.0', id: 2 },
        { version: '1.0', id: 3 }
      ];

      const configPaths = [];
      for (let i = 0; i < configs.length; i++) {
        const configPath = join(testDir, `config-${i}.json`);
        await fs.writeFile(configPath, JSON.stringify(configs[i]));
        configPaths.push(configPath);
      }

      const result = await preloadConfig(configPaths);

      expect(result.loaded).toBe(3);
      expect(result.errors).toBe(0);
      expect(result.details).toHaveLength(3);
      expect(result.averageTime).toBeGreaterThan(0);
    });

    it('should track cache hits during preload', async () => {
      const config = { version: '1.0' };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      // Preload twice
      await preloadConfig({ startDir: testDir });
      const result = await preloadConfig({ startDir: testDir });

      expect(result.fromCache).toBe(1);
      expect(result.details[0].fromCache).toBe(true);
    });
  });

  describe('watchConfigFile', () => {
    it('should watch for file changes', async () => {
      const config1 = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const config2 = { version: '1.0', logging: { preset: 'PRODUCTION' } };
      const configPath = join(testDir, '.persuader');
      
      await fs.writeFile(configPath, JSON.stringify(config1));

      let changeCount = 0;
      let lastConfig: any = null;
      
      const stopWatching = await watchConfigFile(
        configPath,
        (config) => {
          changeCount++;
          lastConfig = config;
        }
      );

      // Initial load should trigger callback
      expect(changeCount).toBe(1);
      expect(lastConfig?.logging?.preset).toBe('LOCAL_DEV');

      // Change the file
      await fs.writeFile(configPath, JSON.stringify(config2));
      
      // Wait for change detection
      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(changeCount).toBe(2);
      expect(lastConfig?.logging?.preset).toBe('PRODUCTION');

      stopWatching();
    });

    it('should watch with auto-discovery', async () => {
      const config = { version: '1.0' };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      let callbackCalled = false;
      const stopWatching = await watchConfigFile(
        (config) => {
          callbackCalled = true;
          expect(config?.version).toBe('1.0');
        },
        { startDir: testDir }
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(callbackCalled).toBe(true);

      stopWatching();
    });
  });

  describe('performance metrics', () => {
    it('should track performance metrics', async () => {
      const config = { version: '1.0' };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      await loadConfig({ startDir: testDir });
      
      const metrics = getConfigPerformanceMetrics();
      expect(metrics.totalOperations).toBeGreaterThan(0);
      expect(metrics.fileReadCount).toBeGreaterThan(0);
      expect(metrics.validationCount).toBeGreaterThan(0);
    });

    it('should reset performance metrics', () => {
      resetConfigPerformanceMetrics();
      
      const metrics = getConfigPerformanceMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.fileReadCount).toBe(0);
      expect(metrics.validationCount).toBe(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle concurrent loads safely', async () => {
      const config = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      const promises = Array.from({ length: 10 }, () => 
        loadConfig({ startDir: testDir, cache: true })
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.config?.version).toBe('1.0');
        expect(result.errors).toHaveLength(0);
      });

      const stats = getConfigCacheStats();
      expect(stats.size).toBe(1); // Should only cache once
      expect(stats.hits + stats.misses).toBe(10);
    });

    it('should handle malformed configuration files', async () => {
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, 'not valid json or yaml');

      const result = await loadConfig({ startDir: testDir });

      expect(result.config).toBe(null);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.fromCache).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      const config = { version: '1.0' };
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify(config));

      try {
        // Try to make file unreadable
        await fs.chmod(configPath, 0o000);
        
        const result = await loadConfig({ startDir: testDir });
        
        // Should handle gracefully
        expect(result.config).toBe(null);
        expect(result.errors.length).toBeGreaterThan(0);
        
        // Restore permissions for cleanup
        await fs.chmod(configPath, 0o644);
      } catch {
        // Skip test if chmod fails (e.g., on Windows)
      }
    });
  });
});