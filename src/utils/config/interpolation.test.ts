/**
 * Environment Variable Interpolation Tests
 * 
 * Tests for environment variable interpolation and substitution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInterpolator,
  getGlobalInterpolator,
  setGlobalInterpolator,
  interpolateConfig,
  createSecureInterpolator,
  createDevelopmentInterpolator,
  analyzeInterpolationPatterns,
  type InterpolationOptions,
  type InterpolationResult
} from './interpolation.js';

describe('Environment Variable Interpolation', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('EnvironmentInterpolator', () => {
    it('should create interpolator with default options', () => {
      const interpolator = new EnvironmentInterpolator();
      expect(interpolator).toBeInstanceOf(EnvironmentInterpolator);
    });

    it('should interpolate simple environment variables', () => {
      process.env.TEST_VAR = 'test-value';
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue('${TEST_VAR}');
      
      expect(result.value).toBe('test-value');
      expect(result.interpolated).toBe(true);
      expect(result.variables).toEqual(['TEST_VAR']);
    });

    it('should handle default values', () => {
      delete process.env.MISSING_VAR;
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue('${MISSING_VAR:-default-value}');
      
      expect(result.value).toBe('default-value');
      expect(result.interpolated).toBe(true);
      expect(result.variables).toEqual(['MISSING_VAR']);
    });

    it('should handle empty default values', () => {
      delete process.env.MISSING_VAR;
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue('${MISSING_VAR:-}');
      
      expect(result.value).toBe('');
      expect(result.interpolated).toBe(true);
    });

    it('should handle multiple variables in one string', () => {
      process.env.HOST = 'localhost';
      process.env.PORT = '3000';
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue('http://${HOST}:${PORT}/api');
      
      expect(result.value).toBe('http://localhost:3000/api');
      expect(result.interpolated).toBe(true);
      expect(result.variables).toEqual(['HOST', 'PORT']);
    });

    it('should handle nested interpolation', () => {
      process.env.ENV = 'development';
      process.env.DB_HOST_DEVELOPMENT = 'dev.db.com';
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue('${DB_HOST_${ENV}}');
      
      expect(result.value).toBe('dev.db.com');
      expect(result.interpolated).toBe(true);
      expect(result.variables).toEqual(['ENV', 'DB_HOST_DEVELOPMENT']);
    });

    it('should handle boolean values', () => {
      process.env.ENABLE_FEATURE = 'true';
      process.env.DISABLE_FEATURE = 'false';
      
      const interpolator = new EnvironmentInterpolator();
      
      const enabledResult = interpolator.interpolateValue('${ENABLE_FEATURE}');
      expect(enabledResult.value).toBe(true);
      
      const disabledResult = interpolator.interpolateValue('${DISABLE_FEATURE}');
      expect(disabledResult.value).toBe(false);
    });

    it('should handle numeric values', () => {
      process.env.MAX_CONNECTIONS = '100';
      process.env.TIMEOUT = '30.5';
      
      const interpolator = new EnvironmentInterpolator();
      
      const intResult = interpolator.interpolateValue('${MAX_CONNECTIONS}');
      expect(intResult.value).toBe(100);
      
      const floatResult = interpolator.interpolateValue('${TIMEOUT}');
      expect(floatResult.value).toBe(30.5);
    });

    it('should interpolate object configurations', () => {
      process.env.API_KEY = 'secret-key';
      process.env.BASE_URL = 'https://api.example.com';
      process.env.TIMEOUT = '5000';
      
      const config = {
        version: '1.0',
        provider: {
          apiKey: '${API_KEY}',
          baseUrl: '${BASE_URL}',
          timeout: '${TIMEOUT}',
          retries: 3
        },
        logging: {
          level: 'info'
        }
      };
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateObject(config);
      
      expect(result.config.provider.apiKey).toBe('secret-key');
      expect(result.config.provider.baseUrl).toBe('https://api.example.com');
      expect(result.config.provider.timeout).toBe(5000);
      expect(result.config.provider.retries).toBe(3); // Not interpolated
      expect(result.config.logging.level).toBe('info'); // Not interpolated
      expect(result.variables).toEqual(['API_KEY', 'BASE_URL', 'TIMEOUT']);
    });

    it('should handle array interpolation', () => {
      process.env.HOST1 = 'host1.com';
      process.env.HOST2 = 'host2.com';
      
      const config = {
        hosts: ['${HOST1}', '${HOST2}', 'static-host.com']
      };
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateObject(config);
      
      expect(result.config.hosts).toEqual(['host1.com', 'host2.com', 'static-host.com']);
      expect(result.variables).toEqual(['HOST1', 'HOST2']);
    });

    it('should handle deep nested object interpolation', () => {
      process.env.DB_PASSWORD = 'secret-password';
      process.env.LOG_LEVEL = 'debug';
      
      const config = {
        database: {
          connection: {
            password: '${DB_PASSWORD}'
          }
        },
        logging: {
          level: '${LOG_LEVEL}',
          jsonl: {
            enabled: '${ENABLE_JSONL:-true}'
          }
        }
      };
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateObject(config);
      
      expect(result.config.database.connection.password).toBe('secret-password');
      expect(result.config.logging.level).toBe('debug');
      expect(result.config.logging.jsonl.enabled).toBe(true);
      expect(result.variables).toEqual(['DB_PASSWORD', 'LOG_LEVEL', 'ENABLE_JSONL']);
    });

    it('should handle missing variables with strict mode', () => {
      delete process.env.MISSING_VAR;
      
      const interpolator = new EnvironmentInterpolator({ strict: true });
      
      expect(() => {
        interpolator.interpolateValue('${MISSING_VAR}');
      }).toThrow('Environment variable MISSING_VAR is not defined');
    });

    it('should allow missing variables in non-strict mode', () => {
      delete process.env.MISSING_VAR;
      
      const interpolator = new EnvironmentInterpolator({ strict: false });
      const result = interpolator.interpolateValue('${MISSING_VAR}');
      
      expect(result.value).toBe('${MISSING_VAR}'); // Unchanged
      expect(result.interpolated).toBe(false);
    });

    it('should respect allowed variables whitelist', () => {
      process.env.ALLOWED_VAR = 'allowed';
      process.env.BLOCKED_VAR = 'blocked';
      
      const interpolator = new EnvironmentInterpolator({
        allowedVariables: ['ALLOWED_VAR']
      });
      
      const allowedResult = interpolator.interpolateValue('${ALLOWED_VAR}');
      expect(allowedResult.value).toBe('allowed');
      
      const blockedResult = interpolator.interpolateValue('${BLOCKED_VAR}');
      expect(blockedResult.value).toBe('${BLOCKED_VAR}'); // Not interpolated
    });

    it('should respect blocked variables blacklist', () => {
      process.env.NORMAL_VAR = 'normal';
      process.env.SECRET_VAR = 'secret';
      
      const interpolator = new EnvironmentInterpolator({
        blockedVariables: ['SECRET_VAR']
      });
      
      const normalResult = interpolator.interpolateValue('${NORMAL_VAR}');
      expect(normalResult.value).toBe('normal');
      
      const secretResult = interpolator.interpolateValue('${SECRET_VAR}');
      expect(secretResult.value).toBe('${SECRET_VAR}'); // Not interpolated
    });

    it('should transform variables when transformer provided', () => {
      process.env.LOWER_VAR = 'hello world';
      
      const interpolator = new EnvironmentInterpolator({
        transformer: (value: string, varName: string) => {
          if (varName === 'LOWER_VAR') {
            return value.toUpperCase();
          }
          return value;
        }
      });
      
      const result = interpolator.interpolateValue('${LOWER_VAR}');
      expect(result.value).toBe('HELLO WORLD');
    });
  });

  describe('global interpolator management', () => {
    it('should manage global interpolator instance', () => {
      const customInterpolator = new EnvironmentInterpolator({ strict: true });
      setGlobalInterpolator(customInterpolator);
      
      const retrieved = getGlobalInterpolator();
      expect(retrieved).toBe(customInterpolator);
    });
  });

  describe('convenience functions', () => {
    it('should interpolate configuration using global interpolator', () => {
      process.env.TEST_VALUE = 'interpolated';
      
      const config = {
        value: '${TEST_VALUE}'
      };
      
      const result = interpolateConfig(config);
      expect(result.config.value).toBe('interpolated');
    });

    it('should create secure interpolator with restricted variables', () => {
      process.env.SAFE_VAR = 'safe';
      process.env.SECRET_VAR = 'secret';
      
      const interpolator = createSecureInterpolator();
      
      const safeResult = interpolator.interpolateValue('${SAFE_VAR}');
      expect(safeResult.value).toBe('safe');
      
      const secretResult = interpolator.interpolateValue('${SECRET_VAR}');
      expect(secretResult.value).toBe('${SECRET_VAR}'); // Should be blocked
    });

    it('should create development interpolator with lenient settings', () => {
      delete process.env.MISSING_VAR;
      
      const interpolator = createDevelopmentInterpolator();
      const result = interpolator.interpolateValue('${MISSING_VAR:-dev-default}');
      
      expect(result.value).toBe('dev-default');
    });
  });

  describe('pattern analysis', () => {
    it('should analyze interpolation patterns in configuration', () => {
      const config = {
        api: {
          key: '${API_KEY}',
          url: '${BASE_URL:-https://api.example.com}'
        },
        features: {
          enabled: ['${FEATURE_A:-true}', '${FEATURE_B}']
        }
      };
      
      const analysis = analyzeInterpolationPatterns(config);
      
      expect(analysis.totalPatterns).toBe(4);
      expect(analysis.withDefaults).toBe(2);
      expect(analysis.withoutDefaults).toBe(2);
      expect(analysis.variables).toEqual(['API_KEY', 'BASE_URL', 'FEATURE_A', 'FEATURE_B']);
      expect(analysis.locations).toHaveLength(4);
    });

    it('should identify potentially unsafe patterns', () => {
      const config = {
        database: {
          password: '${DB_PASSWORD}',
          secret: '${SECRET_KEY}'
        },
        public: {
          version: '${APP_VERSION}'
        }
      };
      
      const analysis = analyzeInterpolationPatterns(config);
      
      const unsafeVars = analysis.variables.filter(v => 
        v.toLowerCase().includes('password') || 
        v.toLowerCase().includes('secret')
      );
      
      expect(unsafeVars).toEqual(['DB_PASSWORD', 'SECRET_KEY']);
    });
  });

  describe('advanced interpolation scenarios', () => {
    it('should handle conditional interpolation', () => {
      process.env.NODE_ENV = 'production';
      process.env.PROD_API_URL = 'https://prod.api.com';
      process.env.DEV_API_URL = 'https://dev.api.com';
      
      const interpolator = new EnvironmentInterpolator();
      
      // Conditional based on environment
      const prodResult = interpolator.interpolateValue('${${NODE_ENV}_API_URL}');
      expect(prodResult.value).toBe('https://prod.api.com');
    });

    it('should handle complex default expressions', () => {
      delete process.env.MISSING_VAR;
      process.env.FALLBACK_VAR = 'fallback';
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue('${MISSING_VAR:-${FALLBACK_VAR}}');
      
      expect(result.value).toBe('fallback');
    });

    it('should handle escaped interpolation patterns', () => {
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue('\\${NOT_INTERPOLATED}');
      
      expect(result.value).toBe('${NOT_INTERPOLATED}');
      expect(result.interpolated).toBe(false);
    });

    it('should handle malformed interpolation patterns', () => {
      const interpolator = new EnvironmentInterpolator();
      
      // Missing closing brace
      const result1 = interpolator.interpolateValue('${MALFORMED');
      expect(result1.value).toBe('${MALFORMED');
      expect(result1.interpolated).toBe(false);
      
      // Invalid characters
      const result2 = interpolator.interpolateValue('${IN-VALID}');
      expect(result2.value).toBe('${IN-VALID}');
      expect(result2.interpolated).toBe(false);
    });

    it('should preserve non-string values that do not contain interpolation', () => {
      const config = {
        port: 3000,
        enabled: true,
        settings: null,
        list: [1, 2, 3]
      };
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateObject(config);
      
      expect(result.config.port).toBe(3000);
      expect(result.config.enabled).toBe(true);
      expect(result.config.settings).toBe(null);
      expect(result.config.list).toEqual([1, 2, 3]);
      expect(result.variables).toEqual([]);
    });

    it('should handle circular references gracefully', () => {
      const config: any = { version: '1.0' };
      config.self = config; // Circular reference
      
      const interpolator = new EnvironmentInterpolator();
      
      // Should not throw or hang
      expect(() => interpolator.interpolateObject(config)).not.toThrow();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null and undefined values', () => {
      const interpolator = new EnvironmentInterpolator();
      
      const nullResult = interpolator.interpolateValue(null as any);
      expect(nullResult.value).toBe(null);
      expect(nullResult.interpolated).toBe(false);
      
      const undefinedResult = interpolator.interpolateValue(undefined as any);
      expect(undefinedResult.value).toBe(undefined);
      expect(undefinedResult.interpolated).toBe(false);
    });

    it('should handle very long variable names', () => {
      const longVarName = 'A'.repeat(1000);
      process.env[longVarName] = 'value';
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue(`\${${longVarName}}`);
      
      expect(result.value).toBe('value');
      expect(result.variables).toEqual([longVarName]);
    });

    it('should handle many variables in single string', () => {
      // Set up many environment variables
      for (let i = 0; i < 100; i++) {
        process.env[`VAR_${i}`] = `value_${i}`;
      }
      
      let template = '';
      for (let i = 0; i < 100; i++) {
        template += `\${VAR_${i}},`;
      }
      
      const interpolator = new EnvironmentInterpolator();
      const result = interpolator.interpolateValue(template);
      
      expect(result.interpolated).toBe(true);
      expect(result.variables).toHaveLength(100);
    });

    it('should handle invalid default syntax gracefully', () => {
      const interpolator = new EnvironmentInterpolator();
      
      const result = interpolator.interpolateValue('${VAR:invalid_syntax}');
      expect(result.value).toBe('${VAR:invalid_syntax}'); // Should remain unchanged
      expect(result.interpolated).toBe(false);
    });

    it('should handle concurrent interpolation safely', () => {
      process.env.CONCURRENT_VAR = 'concurrent-value';
      
      const interpolator = new EnvironmentInterpolator();
      const promises = Array.from({ length: 100 }, (_, i) => 
        interpolator.interpolateObject({
          id: i,
          value: '${CONCURRENT_VAR}'
        })
      );
      
      return Promise.all(promises).then(results => {
        results.forEach((result, i) => {
          expect(result.config.id).toBe(i);
          expect(result.config.value).toBe('concurrent-value');
        });
      });
    });
  });
});