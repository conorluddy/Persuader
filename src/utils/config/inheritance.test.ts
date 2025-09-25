/**
 * Configuration Inheritance Tests
 * 
 * Tests for configuration inheritance and composition
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConfigInheritanceResolver,
  getGlobalInheritanceResolver,
  setGlobalInheritanceResolver,
  resolveEnvironmentConfig,
  resolvePipelineConfig,
  analyzeInheritanceConflicts,
  type InheritanceChain,
  type ConfigConflict,
  type BaseConfig
} from './inheritance.js';

describe('Configuration Inheritance', () => {
  let resolver: ConfigInheritanceResolver;

  beforeEach(() => {
    resolver = new ConfigInheritanceResolver();
  });

  describe('ConfigInheritanceResolver', () => {
    it('should create resolver with default options', () => {
      const newResolver = new ConfigInheritanceResolver();
      expect(newResolver).toBeInstanceOf(ConfigInheritanceResolver);
    });

    it('should register base configurations', () => {
      const baseConfig = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' as const }
      };

      resolver.registerBaseConfig('base-dev', baseConfig);
      const registered = resolver.getBaseConfig('base-dev');
      
      expect(registered).toEqual(baseConfig);
    });

    it('should resolve simple inheritance', async () => {
      const baseConfig = {
        version: '1.0',
        logging: { 
          preset: 'LOCAL_DEV' as const,
          colors: true 
        }
      };

      const childConfig = {
        version: '1.0',
        extends: 'base-dev',
        logging: { 
          timestamp: true 
        }
      };

      resolver.registerBaseConfig('base-dev', baseConfig);
      const chain = await resolver.resolveInheritance(childConfig);

      expect(chain.finalConfig.logging?.preset).toBe('LOCAL_DEV');
      expect(chain.finalConfig.logging?.colors).toBe(true);
      expect(chain.finalConfig.logging?.timestamp).toBe(true);
      expect(chain.chain).toHaveLength(2); // base + child
    });

    it('should resolve multi-level inheritance', async () => {
      const rootConfig = {
        version: '1.0',
        logging: { 
          preset: 'LOCAL_DEV' as const,
          colors: true 
        }
      };

      const middleConfig = {
        version: '1.0',
        extends: 'root',
        logging: { 
          timestamp: true 
        }
      };

      const leafConfig = {
        version: '1.0',
        extends: 'middle',
        logging: { 
          prefix: 'MyApp' 
        }
      };

      resolver.registerBaseConfig('root', rootConfig);
      resolver.registerBaseConfig('middle', middleConfig);
      
      const chain = await resolver.resolveInheritance(leafConfig);

      expect(chain.finalConfig.logging?.preset).toBe('LOCAL_DEV');
      expect(chain.finalConfig.logging?.colors).toBe(true);
      expect(chain.finalConfig.logging?.timestamp).toBe(true);
      expect(chain.finalConfig.logging?.prefix).toBe('MyApp');
      expect(chain.chain).toHaveLength(3);
    });

    it('should resolve multiple inheritance (array extends)', async () => {
      const baseLoggingConfig = {
        version: '1.0',
        logging: { 
          preset: 'LOCAL_DEV' as const,
          colors: true 
        }
      };

      const baseProviderConfig = {
        version: '1.0',
        provider: {
          name: 'openai' as const,
          timeout: '30s'
        }
      };

      const childConfig = {
        version: '1.0',
        extends: ['base-logging', 'base-provider'],
        logging: { 
          timestamp: true 
        }
      };

      resolver.registerBaseConfig('base-logging', baseLoggingConfig);
      resolver.registerBaseConfig('base-provider', baseProviderConfig);
      
      const chain = await resolver.resolveInheritance(childConfig);

      expect(chain.finalConfig.logging?.preset).toBe('LOCAL_DEV');
      expect(chain.finalConfig.logging?.colors).toBe(true);
      expect(chain.finalConfig.logging?.timestamp).toBe(true);
      expect(chain.finalConfig.provider?.name).toBe('openai');
      expect(chain.finalConfig.provider?.timeout).toBe('30s');
    });

    it('should handle inheritance conflicts', async () => {
      const config1 = {
        version: '1.0',
        logging: { 
          preset: 'LOCAL_DEV' as const,
          colors: true 
        }
      };

      const config2 = {
        version: '1.0',
        logging: { 
          preset: 'PRODUCTION' as const, // Conflict!
          timestamp: true 
        }
      };

      const childConfig = {
        version: '1.0',
        extends: ['config1', 'config2']
      };

      resolver.registerBaseConfig('config1', config1);
      resolver.registerBaseConfig('config2', config2);
      
      const chain = await resolver.resolveInheritance(childConfig);

      expect(chain.conflicts).toHaveLength(1);
      expect(chain.conflicts[0].path).toBe('logging.preset');
      expect(chain.conflicts[0].values).toEqual(['LOCAL_DEV', 'PRODUCTION']);
      // Should use last value in case of conflict
      expect(chain.finalConfig.logging?.preset).toBe('PRODUCTION');
    });

    it('should detect circular inheritance', async () => {
      const config1 = {
        version: '1.0',
        extends: 'config2'
      };

      const config2 = {
        version: '1.0',
        extends: 'config1' // Circular!
      };

      resolver.registerBaseConfig('config1', config1);
      resolver.registerBaseConfig('config2', config2);

      await expect(resolver.resolveInheritance(config1)).rejects.toThrow('Circular');
    });

    it('should handle missing base configurations', async () => {
      const childConfig = {
        version: '1.0',
        extends: 'non-existent-base'
      };

      await expect(resolver.resolveInheritance(childConfig)).rejects.toThrow('not found');
    });

    it('should preserve inheritance order', async () => {
      const config1 = { version: '1.0', value: 'first' };
      const config2 = { version: '1.0', value: 'second' };
      const config3 = { version: '1.0', value: 'third' };

      const childConfig = {
        version: '1.0',
        extends: ['config1', 'config2', 'config3']
      };

      resolver.registerBaseConfig('config1', config1);
      resolver.registerBaseConfig('config2', config2);
      resolver.registerBaseConfig('config3', config3);

      const chain = await resolver.resolveInheritance(childConfig);

      expect(chain.finalConfig.value).toBe('third'); // Last one wins
      expect(chain.chain[0].id).toBe('config1');
      expect(chain.chain[1].id).toBe('config2');
      expect(chain.chain[2].id).toBe('config3');
    });
  });

  describe('global resolver management', () => {
    it('should manage global resolver instance', () => {
      const customResolver = new ConfigInheritanceResolver();
      setGlobalInheritanceResolver(customResolver);

      const retrieved = getGlobalInheritanceResolver();
      expect(retrieved).toBe(customResolver);
    });
  });

  describe('environment configuration resolution', () => {
    it('should resolve environment-specific configuration', async () => {
      const baseConfig = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' as const },
        environments: {
          production: {
            logging: { preset: 'PRODUCTION' as const }
          }
        }
      };

      const result = await resolveEnvironmentConfig(baseConfig, 'production');

      expect(result.logging?.preset).toBe('PRODUCTION');
    });

    it('should fallback to base config for unknown environment', async () => {
      const baseConfig = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' as const }
      };

      const result = await resolveEnvironmentConfig(baseConfig, 'unknown');

      expect(result.logging?.preset).toBe('LOCAL_DEV');
    });
  });

  describe('pipeline configuration resolution', () => {
    it('should resolve pipeline-specific configuration', async () => {
      const baseConfig = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' as const },
        pipelines: {
          'data-processing': {
            logging: { preset: 'PERFORMANCE_FOCUS' as const }
          }
        }
      };

      const result = await resolvePipelineConfig(baseConfig, 'data-processing');

      expect(result.logging?.preset).toBe('PERFORMANCE_FOCUS');
    });

    it('should fallback to base config for unknown pipeline', async () => {
      const baseConfig = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' as const }
      };

      const result = await resolvePipelineConfig(baseConfig, 'unknown');

      expect(result.logging?.preset).toBe('LOCAL_DEV');
    });
  });

  describe('conflict analysis', () => {
    it('should analyze inheritance conflicts', () => {
      const configs = [
        { id: 'config1', config: { logging: { preset: 'LOCAL_DEV', colors: true } } },
        { id: 'config2', config: { logging: { preset: 'PRODUCTION', colors: false } } }
      ];

      const conflicts = analyzeInheritanceConflicts(configs as any);

      expect(conflicts).toHaveLength(2);
      
      const presetConflict = conflicts.find(c => c.path === 'logging.preset');
      expect(presetConflict?.values).toEqual(['LOCAL_DEV', 'PRODUCTION']);
      
      const colorsConflict = conflicts.find(c => c.path === 'logging.colors');
      expect(colorsConflict?.values).toEqual([true, false]);
    });

    it('should handle nested object conflicts', () => {
      const configs = [
        { 
          id: 'config1', 
          config: { 
            logging: { 
              jsonl: { enabled: true, directory: './logs1' }
            } 
          } 
        },
        { 
          id: 'config2', 
          config: { 
            logging: { 
              jsonl: { enabled: false, directory: './logs2' }
            } 
          } 
        }
      ];

      const conflicts = analyzeInheritanceConflicts(configs as any);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some(c => c.path === 'logging.jsonl.enabled')).toBe(true);
      expect(conflicts.some(c => c.path === 'logging.jsonl.directory')).toBe(true);
    });

    it('should ignore non-conflicting values', () => {
      const configs = [
        { id: 'config1', config: { version: '1.0', value: 'same' } },
        { id: 'config2', config: { version: '1.0', value: 'same' } }
      ];

      const conflicts = analyzeInheritanceConflicts(configs as any);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('advanced inheritance scenarios', () => {
    it('should handle deep nested configuration merging', async () => {
      const baseConfig = {
        version: '1.0',
        logging: {
          jsonl: {
            enabled: true,
            directory: './logs',
            maxFileSize: '10MB'
          },
          privacy: {
            level: 'standard' as const,
            customPatterns: ['secret.*']
          }
        }
      };

      const childConfig = {
        version: '1.0',
        extends: 'base',
        logging: {
          jsonl: {
            maxFiles: 5
          },
          privacy: {
            redactedFields: ['password', 'token']
          }
        }
      };

      resolver.registerBaseConfig('base', baseConfig);
      const chain = await resolver.resolveInheritance(childConfig);

      const finalConfig = chain.finalConfig;
      expect(finalConfig.logging?.jsonl?.enabled).toBe(true);
      expect(finalConfig.logging?.jsonl?.directory).toBe('./logs');
      expect(finalConfig.logging?.jsonl?.maxFileSize).toBe('10MB');
      expect(finalConfig.logging?.jsonl?.maxFiles).toBe(5);
      expect(finalConfig.logging?.privacy?.level).toBe('standard');
      expect(finalConfig.logging?.privacy?.customPatterns).toEqual(['secret.*']);
      expect(finalConfig.logging?.privacy?.redactedFields).toEqual(['password', 'token']);
    });

    it('should handle array merging strategies', async () => {
      const baseConfig = {
        version: '1.0',
        extends: ['parent1', 'parent2'] // Arrays are replaced, not merged
      };

      const childConfig = {
        version: '1.0',
        extends: 'base',
        logging: { preset: 'LOCAL_DEV' as const }
      };

      resolver.registerBaseConfig('base', baseConfig);
      const chain = await resolver.resolveInheritance(childConfig);

      // The child's extends should completely replace base's extends
      expect(chain.finalConfig.extends).toBe('base');
    });

    it('should track resolution metadata', async () => {
      const baseConfig = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' as const }
      };

      const childConfig = {
        version: '1.0',
        extends: 'base',
        logging: { colors: true }
      };

      resolver.registerBaseConfig('base', baseConfig);
      const chain = await resolver.resolveInheritance(childConfig);

      expect(chain.resolvedAt).toBeInstanceOf(Date);
      expect(chain.resolutionTimeMs).toBeGreaterThan(0);
      expect(chain.chain).toHaveLength(2);
      expect(chain.chain[0].id).toBe('base');
      expect(chain.chain[1].id).toBe('__final__');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null and undefined configurations', async () => {
      await expect(resolver.resolveInheritance(null as any)).rejects.toThrow();
      await expect(resolver.resolveInheritance(undefined as any)).rejects.toThrow();
    });

    it('should handle empty extends arrays', async () => {
      const config = {
        version: '1.0',
        extends: [], // Empty array
        logging: { preset: 'LOCAL_DEV' as const }
      };

      const chain = await resolver.resolveInheritance(config);

      expect(chain.finalConfig).toEqual(config);
      expect(chain.chain).toHaveLength(1);
    });

    it('should handle configuration without extends', async () => {
      const config = {
        version: '1.0',
        logging: { preset: 'LOCAL_DEV' as const }
      };

      const chain = await resolver.resolveInheritance(config);

      expect(chain.finalConfig).toEqual(config);
      expect(chain.chain).toHaveLength(1);
      expect(chain.conflicts).toHaveLength(0);
    });

    it('should handle very deep inheritance chains', async () => {
      // Create a chain of 10 levels
      for (let i = 0; i < 10; i++) {
        const config = {
          version: '1.0',
          extends: i > 0 ? `level-${i - 1}` : undefined,
          level: i
        };
        resolver.registerBaseConfig(`level-${i}`, config);
      }

      const chain = await resolver.resolveInheritance({ 
        version: '1.0', 
        extends: 'level-9' 
      });

      expect(chain.chain).toHaveLength(11); // 10 levels + final
      expect(chain.finalConfig.level).toBe(9);
    });

    it('should handle inheritance with malformed base configs', () => {
      resolver.registerBaseConfig('malformed', null as any);

      const childConfig = {
        version: '1.0',
        extends: 'malformed'
      };

      expect(resolver.resolveInheritance(childConfig)).rejects.toThrow();
    });
  });
});