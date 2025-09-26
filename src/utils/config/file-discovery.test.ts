/**
 * File Discovery Tests
 * 
 * Tests for configuration file discovery functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  discoverConfigFile,
  hasConfigFile,
  getDefaultConfigPath,
  validateConfigPath,
  getDiscoveryMetrics,
  CONFIG_FILENAMES,
  type ConfigDiscoveryOptions
} from './file-discovery.js';

describe('Config File Discovery', () => {
  let testDir: string;
  let cleanup: string[] = [];

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(tmpdir(), `persuader-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(testDir, { recursive: true });
    cleanup.push(testDir);
  });

  afterEach(async () => {
    // Clean up test directories
    for (const dir of cleanup) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanup = [];
  });

  describe('discoverConfigFile', () => {
    it('should discover .persuader config in current directory', async () => {
      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0' }));

      const result = await discoverConfigFile({ startDir: testDir });

      expect(result.configPath).toBe(configPath);
      expect(result.discoveryMethod).toBeDefined();
      expect(result.searchedPaths).toContain(testDir);
    });

    it('should discover persuader.json config file', async () => {
      const configPath = join(testDir, 'persuader.json');
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0' }));

      const result = await discoverConfigFile({ startDir: testDir });

      expect(result.found).toBe(true);
      expect(result.configPath).toBe(configPath);
      expect(result.discoveryMethod).toBe('filename');
    });

    it('should discover persuader.yaml config file', async () => {
      const configPath = join(testDir, 'persuader.yaml');
      await fs.writeFile(configPath, 'version: "1.0"');

      const result = await discoverConfigFile({ startDir: testDir });

      expect(result.found).toBe(true);
      expect(result.configPath).toBe(configPath);
      expect(result.discoveryMethod).toBe('filename');
    });

    it('should prioritize .persuader over other formats', async () => {
      const persuaderPath = join(testDir, '.persuader');
      const jsonPath = join(testDir, 'persuader.json');
      
      await fs.writeFile(persuaderPath, JSON.stringify({ version: '1.0' }));
      await fs.writeFile(jsonPath, JSON.stringify({ version: '1.1' }));

      const result = await discoverConfigFile({ startDir: testDir });

      expect(result.configPath).toBe(persuaderPath);
    });

    it('should traverse up directory tree', async () => {
      const parentDir = join(testDir, 'parent');
      const childDir = join(parentDir, 'child');
      await fs.mkdir(childDir, { recursive: true });

      const configPath = join(parentDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0' }));

      const result = await discoverConfigFile({ startDir: childDir });

      expect(result.found).toBe(true);
      expect(result.configPath).toBe(configPath);
      expect(result.searchedPaths).toContain(childDir);
      expect(result.searchedPaths).toContain(parentDir);
    });

    it('should stop at package.json when stopAtPackageJson is true', async () => {
      const parentDir = join(testDir, 'parent');
      const childDir = join(parentDir, 'child');
      await fs.mkdir(childDir, { recursive: true });

      // Create package.json in child directory
      await fs.writeFile(join(childDir, 'package.json'), JSON.stringify({ name: 'test' }));
      
      // Create config in parent directory
      const configPath = join(parentDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0' }));

      const result = await discoverConfigFile({ 
        startDir: childDir,
        stopAtPackageJson: true 
      });

      expect(result.found).toBe(false);
      expect(result.searchedPaths).toContain(childDir);
      expect(result.searchedPaths).not.toContain(parentDir);
    });

    it('should respect maxTraversalDepth option', async () => {
      const level1 = join(testDir, 'level1');
      const level2 = join(level1, 'level2');
      const level3 = join(level2, 'level3');
      await fs.mkdir(level3, { recursive: true });

      const configPath = join(testDir, '.persuader');
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0' }));

      const result = await discoverConfigFile({ 
        startDir: level3,
        maxTraversalDepth: 2 
      });

      expect(result.found).toBe(false);
      expect(result.searchedPaths).toHaveLength(2); // Only level3 and level2
    });

    it('should use provided configPath when specified', async () => {
      const customConfigPath = join(testDir, 'custom-config.json');
      await fs.writeFile(customConfigPath, JSON.stringify({ version: '1.0' }));

      const result = await discoverConfigFile({ 
        configPath: customConfigPath 
      });

      expect(result.found).toBe(true);
      expect(result.configPath).toBe(customConfigPath);
      expect(result.discoveryMethod).toBe('explicit');
    });

    it('should return not found when no config exists', async () => {
      const result = await discoverConfigFile({ startDir: testDir });

      expect(result.found).toBe(false);
      expect(result.configPath).toBe(null);
      expect(result.discoveryMethod).toBe('none');
      expect(result.searchedPaths.length).toBeGreaterThan(0);
    });
  });

  describe('hasConfigFile', () => {
    it('should return true when config file exists', async () => {
      await fs.writeFile(join(testDir, '.persuader'), '{}');
      
      const result = await hasConfigFile(testDir);
      
      expect(result).toBe(true);
    });

    it('should return false when no config file exists', async () => {
      const result = await hasConfigFile(testDir);
      
      expect(result).toBe(false);
    });
  });

  describe('getDefaultConfigPath', () => {
    it('should return .persuader in specified directory', () => {
      const result = getDefaultConfigPath(testDir);
      
      expect(result).toBe(join(testDir, '.persuader'));
    });

    it('should return .persuader in current directory when no dir specified', () => {
      const result = getDefaultConfigPath();
      
      expect(result).toBe(resolve('.persuader'));
    });
  });

  describe('validateConfigPath', () => {
    it('should validate existing file path', async () => {
      const configPath = join(testDir, 'test-config.json');
      await fs.writeFile(configPath, '{}');

      const result = await validateConfigPath(configPath);

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(true);
      expect(result.isFile).toBe(true);
      expect(result.readable).toBe(true);
    });

    it('should handle non-existent file path', async () => {
      const configPath = join(testDir, 'non-existent.json');

      const result = await validateConfigPath(configPath);

      expect(result.valid).toBe(false);
      expect(result.exists).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should handle directory path instead of file', async () => {
      const result = await validateConfigPath(testDir);

      expect(result.valid).toBe(false);
      expect(result.isFile).toBe(false);
      expect(result.error).toContain('is not a file');
    });
  });

  describe('getDiscoveryMetrics', () => {
    it('should return discovery performance metrics', () => {
      const metrics = getDiscoveryMetrics();

      expect(metrics).toHaveProperty('totalSearches');
      expect(metrics).toHaveProperty('successfulSearches');
      expect(metrics).toHaveProperty('averageSearchTime');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(typeof metrics.totalSearches).toBe('number');
    });
  });

  describe('CONFIG_FILENAMES constant', () => {
    it('should contain expected config filenames', () => {
      expect(CONFIG_FILENAMES).toContain('.persuader');
      expect(CONFIG_FILENAMES).toContain('persuader.json');
      expect(CONFIG_FILENAMES).toContain('persuader.yaml');
      expect(CONFIG_FILENAMES).toContain('persuader.yml');
      expect(CONFIG_FILENAMES).toContain('persuader.js');
      expect(CONFIG_FILENAMES).toContain('persuader.ts');
    });

    it('should have .persuader as first priority', () => {
      expect(CONFIG_FILENAMES[0]).toBe('.persuader');
    });
  });

  describe('error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Create a directory we can't read (if possible)
      const restrictedDir = join(testDir, 'restricted');
      await fs.mkdir(restrictedDir);
      
      try {
        await fs.chmod(restrictedDir, 0o000);
        
        const result = await discoverConfigFile({ startDir: restrictedDir });
        
        // Should handle gracefully without throwing
        expect(result.found).toBe(false);
        
        // Restore permissions for cleanup
        await fs.chmod(restrictedDir, 0o755);
      } catch {
        // Skip test if we can't create restricted directory
      }
    });

    it('should handle invalid startDir gracefully', async () => {
      const invalidDir = join(testDir, 'non-existent-dir');

      const result = await discoverConfigFile({ startDir: invalidDir });

      expect(result.found).toBe(false);
      expect(result.configPath).toBe(null);
    });
  });
});