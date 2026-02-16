/**
 * Configuration Parser Tests
 * 
 * Tests for multi-format configuration file parsing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseConfigFile,
  parseConfigWithEnv,
  validateConfigFile,
  isValidConfigFile,
  detectConfigFormat,
  getParserMetrics,
  type ParseOptions
} from './parser.js';

describe('Configuration Parser', () => {
  let testDir: string;
  let cleanup: string[] = [];

  beforeEach(async () => {
    testDir = join(tmpdir(), `persuader-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    await fs.mkdir(testDir, { recursive: true });
    cleanup.push(testDir);
  });

  afterEach(async () => {
    for (const dir of cleanup) {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanup = [];
  });

  describe('parseConfigFile', () => {
    it('should parse valid JSON configuration', async () => {
      const config = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' }
      };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(true);
      expect(result.config).toEqual(config);
      expect(result.format).toBe('json');
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should parse valid YAML configuration', async () => {
      const yamlContent = `
version: "1.0"
logging:
  preset: LOCAL_DEV
  colors: true
      `;
      const configPath = join(testDir, 'config.yaml');
      await fs.writeFile(configPath, yamlContent);

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(true);
      expect(result.config?.version).toBe('1.0');
      expect(result.config?.logging?.preset).toBe('LOCAL_DEV');
      expect(result.format).toBe('yaml');
    });

    it('should parse JavaScript configuration', async () => {
      const jsContent = `
module.exports = {
  version: '1.0',
  logging: {
    preset: 'LOCAL_DEV',
    colors: process.env.NODE_ENV !== 'production'
  }
};
      `;
      const configPath = join(testDir, 'config.js');
      await fs.writeFile(configPath, jsContent);

      const result = await parseConfigFile(configPath, { allowExecution: true });

      expect(result.valid).toBe(true);
      expect(result.config?.version).toBe('1.0');
      expect(result.config?.logging?.preset).toBe('LOCAL_DEV');
      expect(result.format).toBe('js');
    });

    it('should parse TypeScript configuration', async () => {
      const tsContent = `
import type { PersuaderConfig } from './schema';

const config: PersuaderConfig = {
  version: '1.0',
  logging: {
    preset: 'LOCAL_DEV',
    colors: true
  }
};

export default config;
      `;
      const configPath = join(testDir, 'config.ts');
      await fs.writeFile(configPath, tsContent);

      const result = await parseConfigFile(configPath, { allowExecution: true });

      expect(result.valid).toBe(true);
      expect(result.config?.version).toBe('1.0');
      expect(result.format).toBe('ts');
    });

    it('should handle JSON with comments', async () => {
      const jsonWithComments = `
{
  // This is a comment
  "version": "1.0",
  "logging": {
    "preset": "LOCAL_DEV", // Another comment
    "colors": true
  }
}
      `;
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, jsonWithComments);

      const result = await parseConfigFile(configPath, { useEnhancedParsers: true });

      expect(result.valid).toBe(true);
      expect(result.config?.version).toBe('1.0');
    });

    it('should handle parsing errors gracefully', async () => {
      const invalidJson = '{ "version": "1.0", "invalid": }';
      const configPath = join(testDir, 'invalid.json');
      await fs.writeFile(configPath, invalidJson);

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(false);
      expect(result.config).toBe(null);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should validate configuration by default', async () => {
      const invalidConfig = {
        version: 123, // Invalid: should be string
        logging: { preset: 'INVALID_PRESET' }
      };
      const configPath = join(testDir, 'invalid-config.json');
      await fs.writeFile(configPath, JSON.stringify(invalidConfig));

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });

    it('should skip validation when requested', async () => {
      const invalidConfig = { version: 123 };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(invalidConfig));

      const result = await parseConfigFile(configPath, { validate: false });

      expect(result.valid).toBe(true);
      expect(result.config).toEqual(invalidConfig);
      expect(result.validationErrors).toBeUndefined();
    });

    it('should include raw content when requested', async () => {
      const config = { version: '1.0' };
      const configPath = join(testDir, 'config.json');
      const content = JSON.stringify(config, null, 2);
      await fs.writeFile(configPath, content);

      const result = await parseConfigFile(configPath, { includeRawContent: true });

      expect(result.rawContent).toBe(content);
    });

    it('should handle non-existent file', async () => {
      const configPath = join(testDir, 'non-existent.json');

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('not found'));
    });

    it('should disable JavaScript execution by default', async () => {
      const jsContent = `
module.exports = {
  version: '1.0',
  logging: { preset: 'LOCAL_DEV' }
};
      `;
      const configPath = join(testDir, 'config.js');
      await fs.writeFile(configPath, jsContent);

      const result = await parseConfigFile(configPath); // allowExecution defaults to false

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('execution disabled'));
    });
  });

  describe('parseConfigWithEnv', () => {
    it('should interpolate environment variables', async () => {
      const config = {
        version: '1.0',
        provider: {
          apiKey: '${TEST_API_KEY}',
          timeout: '${TEST_TIMEOUT:-30s}'
        }
      };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config));

      const env = {
        TEST_API_KEY: 'secret-key-123'
        // TEST_TIMEOUT not provided, should use default
      };

      const result = await parseConfigWithEnv(configPath, env);

      expect(result.valid).toBe(true);
      expect(result.config?.provider?.apiKey).toBe('secret-key-123');
      expect(result.config?.provider?.timeout).toBe('30s');
    });

    it('should handle missing environment variables', async () => {
      const config = {
        version: '1.0',
        provider: {
          apiKey: '${MISSING_API_KEY}'
        }
      };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await parseConfigWithEnv(configPath, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('MISSING_API_KEY'));
    });
  });

  describe('validateConfigFile', () => {
    it('should validate file and return detailed results', async () => {
      const config = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await validateConfigFile(configPath);

      expect(result.valid).toBe(true);
      expect(result.filePath).toBe(configPath);
      expect(result.format).toBe('json');
      expect(result.fileSize).toBeGreaterThan(0);
    });

    it('should include validation errors for invalid config', async () => {
      const config = { version: 123 };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await validateConfigFile(configPath);

      expect(result.valid).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors!.length).toBeGreaterThan(0);
    });
  });

  describe('isValidConfigFile', () => {
    it('should return true for valid configuration file', async () => {
      const config = { version: '1.0' };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config));

      const result = await isValidConfigFile(configPath);

      expect(result).toBe(true);
    });

    it('should return false for invalid configuration file', async () => {
      const configPath = join(testDir, 'invalid.json');
      await fs.writeFile(configPath, 'invalid json');

      const result = await isValidConfigFile(configPath);

      expect(result).toBe(false);
    });
  });

  describe('detectConfigFormat', () => {
    it('should detect JSON format', () => {
      expect(detectConfigFormat('config.json')).toBe('json');
      expect(detectConfigFormat('.persuader')).toBe('json');
    });

    it('should detect YAML format', () => {
      expect(detectConfigFormat('config.yaml')).toBe('yaml');
      expect(detectConfigFormat('config.yml')).toBe('yaml');
    });

    it('should detect JavaScript format', () => {
      expect(detectConfigFormat('config.js')).toBe('js');
    });

    it('should detect TypeScript format', () => {
      expect(detectConfigFormat('config.ts')).toBe('ts');
    });

    it('should return unknown for unrecognized extensions', () => {
      expect(detectConfigFormat('config.xml')).toBe('unknown');
    });
  });

  describe('getParserMetrics', () => {
    it('should return parser performance metrics', () => {
      const metrics = getParserMetrics();

      expect(metrics).toHaveProperty('totalParses');
      expect(metrics).toHaveProperty('successfulParses');
      expect(metrics).toHaveProperty('averageParseTime');
      expect(metrics).toHaveProperty('formatBreakdown');
      expect(typeof metrics.totalParses).toBe('number');
    });
  });

  describe('enhanced parser features', () => {
    it('should use enhanced parsers when requested', async () => {
      const jsonWithComments = `
{
  /* Multi-line comment */
  "version": "1.0",
  "logging": {
    "preset": "LOCAL_DEV" // Inline comment
  }
}
      `;
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, jsonWithComments);

      const result = await parseConfigFile(configPath, { useEnhancedParsers: true });

      expect(result.valid).toBe(true);
      expect(result.config?.version).toBe('1.0');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.hasComments).toBe(true);
    });

    it('should provide content analysis with enhanced parsers', async () => {
      const config = { version: '1.0', logging: { preset: 'LOCAL_DEV' } };
      const configPath = join(testDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      const result = await parseConfigFile(configPath, { useEnhancedParsers: true });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.indentationType).toBeDefined();
      expect(result.metadata?.complexity).toBeGreaterThan(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle very large files gracefully', async () => {
      const largeConfig = {
        version: '1.0',
        data: new Array(1000).fill({ key: 'value' })
      };
      const configPath = join(testDir, 'large-config.json');
      await fs.writeFile(configPath, JSON.stringify(largeConfig));

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(true);
      expect(result.parseTime).toBeGreaterThan(0);
    });

    it('should handle binary files gracefully', async () => {
      const configPath = join(testDir, 'binary.bin');
      await fs.writeFile(configPath, Buffer.from([0x00, 0x01, 0x02, 0x03]));

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('parse'));
    });

    it('should handle concurrent parsing safely', async () => {
      const configs = Array.from({ length: 5 }, (_, i) => ({
        version: '1.0',
        id: i
      }));

      const promises = configs.map(async (config, i) => {
        const configPath = join(testDir, `config-${i}.json`);
        await fs.writeFile(configPath, JSON.stringify(config));
        return parseConfigFile(configPath);
      });

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.valid).toBe(true);
        expect(result.config?.id).toBe(i);
      });
    });

    it('should provide helpful error messages for syntax errors', async () => {
      const invalidYaml = `
version: "1.0"
logging:
  preset: LOCAL_DEV
    colors: true  # Invalid indentation
      `;
      const configPath = join(testDir, 'invalid.yaml');
      await fs.writeFile(configPath, invalidYaml);

      const result = await parseConfigFile(configPath);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some(error => 
        error.includes('indentation') || error.includes('syntax')
      )).toBe(true);
    });
  });
});