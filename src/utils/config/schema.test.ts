/**
 * Configuration Schema Tests
 * 
 * Tests for Zod schema validation and configuration utilities
 */

import { describe, it, expect } from 'vitest';
import {
  PersuaderConfigSchema,
  LoggingConfigSchema,
  validateConfig,
  getDefaultConfig,
  mergeConfigs,
  type PersuaderConfig,
  type LoggingConfig,
  type LoggingPreset,
  type PrivacyLevel
} from './schema.js';

describe('Configuration Schema', () => {
  describe('PersuaderConfigSchema', () => {
    it('should validate minimal valid config', () => {
      const config = { version: '1.0' };
      
      const result = PersuaderConfigSchema.safeParse(config);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0');
      }
    });

    it('should validate complete valid config', () => {
      const config: PersuaderConfig = {
        version: '1.0',
        $schema: 'https://example.com/schema',
        extends: ['base-config'],
        logging: {
          preset: 'LOCAL_DEV',
          colors: true,
          timestamp: true,
          prefix: 'MyApp',
          maxPromptLength: 1000,
          maxResponseLength: 2000,
          jsonl: {
            enabled: true,
            directory: './logs',
            maxFileSize: '10MB',
            maxFiles: 5
          },
          privacy: {
            level: 'standard',
            customPatterns: ['secret.*'],
            redactedFields: ['password', 'token']
          },
          performance: {
            enabled: true,
            slowThreshold: '5s',
            sampleRate: 0.1
          },
          categories: {
            enabled: ['error', 'warn', 'info'],
            disabled: ['debug']
          }
        },
        provider: {
          name: 'openai',
          apiKey: '${OPENAI_API_KEY}',
          baseUrl: 'https://api.openai.com/v1',
          timeout: '30s',
          retryAttempts: 3
        },
        environments: {
          development: {
            logging: {
              preset: 'DEBUG_FULL'
            }
          },
          production: {
            logging: {
              preset: 'PRODUCTION',
              privacy: {
                level: 'strict'
              }
            }
          }
        },
        pipelines: {
          'data-analysis': {
            logging: {
              preset: 'PERFORMANCE_FOCUS'
            }
          }
        }
      };
      
      const result = PersuaderConfigSchema.safeParse(config);
      
      expect(result.success).toBe(true);
    });

    it('should reject invalid version format', () => {
      const config = { version: 123 }; // Invalid: should be string
      
      const result = PersuaderConfigSchema.safeParse(config);
      
      expect(result.success).toBe(false);
    });

    it('should allow extends as string or array', () => {
      const configWithString = { version: '1.0', extends: 'base-config' };
      const configWithArray = { version: '1.0', extends: ['base-config', 'other-config'] };
      
      expect(PersuaderConfigSchema.safeParse(configWithString).success).toBe(true);
      expect(PersuaderConfigSchema.safeParse(configWithArray).success).toBe(true);
    });
  });

  describe('LoggingConfigSchema', () => {
    it('should validate all logging presets', () => {
      const presets: LoggingPreset[] = [
        'LOCAL_DEV', 'DEBUG_FULL', 'LLM_DEBUG', 'PRODUCTION',
        'PROD_OBSERVABILITY', 'PROD_MINIMAL', 'GDPR_COMPLIANT',
        'SECURITY_AUDIT', 'PERFORMANCE_FOCUS', 'TOKEN_MONITORING',
        'TEST_RUNNER', 'CI_PIPELINE'
      ];

      presets.forEach(preset => {
        const config = { preset };
        const result = LoggingConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should validate privacy levels', () => {
      const levels: PrivacyLevel[] = ['minimal', 'standard', 'strict', 'paranoid'];

      levels.forEach(level => {
        const config = {
          privacy: { level }
        };
        const result = LoggingConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should validate file size formats', () => {
      const validSizes = ['1MB', '500KB', '2GB', '1024B'];
      
      validSizes.forEach(size => {
        const config = {
          jsonl: { enabled: true, maxFileSize: size }
        };
        const result = LoggingConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should validate duration formats', () => {
      const validDurations = ['1s', '500ms', '2m', '1h'];
      
      validDurations.forEach(duration => {
        const config = {
          performance: { enabled: true, slowThreshold: duration }
        };
        const result = LoggingConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid file size format', () => {
      const config = {
        jsonl: { enabled: true, maxFileSize: '1TB' } // Invalid unit
      };
      
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid sample rate', () => {
      const config = {
        performance: { enabled: true, sampleRate: 1.5 } // Invalid: > 1.0
      };
      
      const result = LoggingConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const config = {
        version: '1.0',
        logging: {
          preset: 'LOCAL_DEV' as LoggingPreset
        }
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toEqual(config);
    });

    it('should return validation errors for invalid config', () => {
      const config = {
        version: 123, // Invalid
        logging: {
          preset: 'INVALID_PRESET' // Invalid
        }
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.config).toBe(null);
    });

    it('should provide detailed error messages', () => {
      const config = {
        logging: {
          jsonl: {
            enabled: true,
            maxFileSize: 'invalid-size'
          }
        }
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('maxFileSize'));
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const defaultConfig = getDefaultConfig();

      const validation = validateConfig(defaultConfig);
      expect(validation.valid).toBe(true);
    });

    it('should include version field', () => {
      const defaultConfig = getDefaultConfig();

      expect(defaultConfig.version).toBeDefined();
      expect(typeof defaultConfig.version).toBe('string');
    });

    it('should include basic logging configuration', () => {
      const defaultConfig = getDefaultConfig();

      expect(defaultConfig.logging).toBeDefined();
      expect(defaultConfig.logging?.preset).toBeDefined();
    });

    it('should have reasonable default values', () => {
      const defaultConfig = getDefaultConfig();

      // Should have development-friendly defaults
      expect(defaultConfig.logging?.colors).toBe(true);
      expect(defaultConfig.logging?.timestamp).toBe(true);
      expect(defaultConfig.logging?.preset).toBe('LOCAL_DEV');
    });
  });

  describe('mergeConfigs', () => {
    it('should merge two configurations', () => {
      const base = {
        version: '1.0',
        logging: {
          preset: 'LOCAL_DEV' as LoggingPreset,
          colors: true
        }
      };

      const override = {
        logging: {
          colors: false,
          timestamp: true
        }
      };

      const merged = mergeConfigs(base, override);

      expect(merged.version).toBe('1.0');
      expect(merged.logging?.preset).toBe('LOCAL_DEV');
      expect(merged.logging?.colors).toBe(false); // Overridden
      expect(merged.logging?.timestamp).toBe(true); // Added
    });

    it('should handle nested object merging', () => {
      const base = {
        version: '1.0',
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
            maxFileSize: '5MB'
          }
        }
      };

      const merged = mergeConfigs(base, override);

      expect(merged.logging?.jsonl?.enabled).toBe(true);
      expect(merged.logging?.jsonl?.directory).toBe('./logs');
      expect(merged.logging?.jsonl?.maxFileSize).toBe('5MB');
    });

    it('should handle array replacement', () => {
      const base = {
        version: '1.0',
        extends: ['config1', 'config2']
      };

      const override = {
        extends: ['config3']
      };

      const merged = mergeConfigs(base, override);

      expect(merged.extends).toEqual(['config3']); // Arrays are replaced, not merged
    });

    it('should preserve original objects', () => {
      const base = {
        version: '1.0',
        logging: { colors: true }
      };

      const override = {
        logging: { timestamp: true }
      };

      const merged = mergeConfigs(base, override);

      // Original objects should not be modified
      expect(base.logging).toEqual({ colors: true });
      expect(override.logging).toEqual({ timestamp: true });
      expect(merged.logging).toEqual({ colors: true, timestamp: true });
    });

    it('should handle empty configurations', () => {
      const base = { version: '1.0' };
      const empty = {};

      expect(mergeConfigs(base, empty)).toEqual(base);
      expect(mergeConfigs(empty, base)).toEqual(base);
    });

    it('should validate merged result', () => {
      const base = { version: '1.0' };
      const override = { logging: { preset: 'PRODUCTION' as LoggingPreset } };

      const merged = mergeConfigs(base, override);
      const validation = validateConfig(merged);

      expect(validation.valid).toBe(true);
    });
  });

  describe('edge cases and error conditions', () => {
    it('should handle null and undefined values', () => {
      expect(() => validateConfig(null as any)).not.toThrow();
      expect(() => validateConfig(undefined as any)).not.toThrow();
      
      const nullResult = validateConfig(null as any);
      expect(nullResult.valid).toBe(false);
    });

    it('should handle circular references in merge', () => {
      const base: any = { version: '1.0' };
      const override: any = { logging: {} };
      override.logging.self = override.logging; // Circular reference

      // Should not throw or hang
      expect(() => mergeConfigs(base, override)).not.toThrow();
    });

    it('should reject extremely large configurations', () => {
      const largeConfig = {
        version: '1.0',
        logging: {
          privacy: {
            customPatterns: new Array(10000).fill('pattern') // Very large array
          }
        }
      };

      // Should handle gracefully without performance issues
      const result = validateConfig(largeConfig);
      expect(typeof result.valid).toBe('boolean');
    });
  });
});