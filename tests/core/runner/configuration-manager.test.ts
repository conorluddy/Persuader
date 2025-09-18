/**
 * Tests for Configuration Manager
 *
 * Comprehensive tests for configuration validation, normalization, and processing
 * including default value application and error handling.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  processConfiguration,
  processRunnerConfiguration,
  validateAndNormalizeOptions,
  validateProviderAdapter,
  validateRunnerOptions,
} from '../../../src/core/runner/configuration-manager.js';
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_RETRIES,
  DEFAULT_TEMPERATURE,
} from '../../../src/shared/constants/index.js';
import type { Options, ProviderAdapter } from '../../../src/types/index.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');
vi.mock('../../../src/utils/example-generator.js');
vi.mock('../../../src/utils/schema-analyzer.js');

// Import mocked modules
import * as exampleGeneratorModule from '../../../src/utils/example-generator.js';
import * as schemaAnalyzerModule from '../../../src/utils/schema-analyzer.js';

const validateExample = vi.mocked(exampleGeneratorModule.validateExample);
const extractSchemaInfo = vi.mocked(schemaAnalyzerModule.extractSchemaInfo);

// Test fixtures
const testSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email().optional(),
});

type TestOutput = z.infer<typeof testSchema>;

const createMockOptions = (overrides: Partial<Options<TestOutput>> = {}): Options<TestOutput> => ({
  schema: testSchema,
  input: 'test input',
  ...overrides,
});

const createMockProvider = (overrides: Partial<ProviderAdapter> = {}): ProviderAdapter => ({
  name: 'test-provider',
  supportsSession: false,
  sendPrompt: vi.fn(),
  ...overrides,
});

describe('validateAndNormalizeOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    validateExample.mockReturnValue({ valid: true, errors: [] });
    extractSchemaInfo.mockReturnValue({
      name: 'TestSchema',
      type: 'object',
      description: 'Test schema',
      fieldCount: 3,
      requiredFields: ['name', 'age'],
      optionalFields: ['email'],
      nestedObjects: [],
      arrayFields: [],
      enumFields: [],
      complexity: 'simple',
      shape: {},
    });
  });

  describe('successful validation and normalization', () => {
    it('should validate and normalize minimal options', () => {
      const options = createMockOptions();

      const result = validateAndNormalizeOptions(options);

      expect(result).toEqual({
        schema: testSchema,
        input: 'test input',
      });
    });

    it('should include all optional fields when provided', () => {
      const options = createMockOptions({
        context: 'Test context',
        lens: 'Test lens',
        sessionId: 'session-123',
        output: 'output.json',
        retries: 3,
        model: 'custom-model',
        exampleOutput: { name: 'John', age: 25 },
        logLevel: 'debug',
        providerOptions: { customOption: true },
      });

      const result = validateAndNormalizeOptions(options);

      expect(result).toEqual({
        schema: testSchema,
        input: 'test input',
        context: 'Test context',
        lens: 'Test lens',
        sessionId: 'session-123',
        output: 'output.json',
        retries: 3,
        model: 'custom-model',
        exampleOutput: { name: 'John', age: 25 },
        logLevel: 'debug',
        providerOptions: { customOption: true },
      });
    });

    it('should exclude undefined optional fields', () => {
      const options = createMockOptions({
        context: 'Test context',
        lens: undefined,
        retries: 0, // Include zero value
        model: undefined,
      });

      const result = validateAndNormalizeOptions(options);

      expect(result).toEqual({
        schema: testSchema,
        input: 'test input',
        context: 'Test context',
        retries: 0,
      });
    });
  });

  describe('validation failures', () => {
    it('should throw error for invalid basic options', () => {
      const options = { schema: undefined, input: undefined } as any;

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        /Configuration validation failed.*Options configuration error.*schema property is required.*input property is required.*This is a configuration issue with your options object, not a Zod schema validation failure/
      );
    });

    it('should throw error for invalid example output', () => {
      validateExample.mockReturnValue({
        valid: false,
        errors: ['Name must be a string', 'Age must be a number'],
      });

      const options = createMockOptions({
        exampleOutput: { name: 123, age: 'invalid' } as any,
      });

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        'Invalid exampleOutput provided: Name must be a string. Age must be a number'
      );
    });

    it('should clearly distinguish configuration errors from schema validation errors', () => {
      const options = {
        schema: testSchema,
        input: 'test input',
        model: 123, // Invalid type
        providerOptions: 'invalid' // Invalid type
      } as any;

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        /Configuration validation failed.*Options configuration error.*model must be a string.*providerOptions must be an object.*This is a configuration issue with your options object, not a Zod schema validation failure/
      );
    });
  });

  describe('schema information logging', () => {
    it('should extract and log schema information', () => {
      const options = createMockOptions();

      validateAndNormalizeOptions(options);

      expect(extractSchemaInfo).toHaveBeenCalledWith(testSchema);
    });

    it('should handle schema extraction errors gracefully', () => {
      extractSchemaInfo.mockImplementation(() => {
        throw new Error('Schema extraction failed');
      });

      const options = createMockOptions();

      // Should not throw, but handle error gracefully
      expect(() => validateAndNormalizeOptions(options)).not.toThrow();
    });
  });
});

describe('processRunnerConfiguration', () => {
  it('should apply default values correctly', () => {
    const normalizedOptions = {
      schema: testSchema,
      input: 'test input',
    };

    const result = processRunnerConfiguration(normalizedOptions);

    expect(result).toEqual({
      schema: testSchema,
      input: 'test input',
      retries: DEFAULT_RETRIES,
      model: DEFAULT_MODEL,
      providerOptions: {
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
      },
    });
  });

  it('should preserve provided values over defaults', () => {
    const normalizedOptions = {
      schema: testSchema,
      input: 'test input',
      retries: 5,
      model: 'custom-model',
      providerOptions: { customOption: 'value' },
    };

    const result = processRunnerConfiguration(normalizedOptions);

    expect(result).toEqual({
      schema: testSchema,
      input: 'test input',
      retries: 5,
      model: 'custom-model',
      providerOptions: {
        maxTokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        customOption: 'value',
      },
    });
  });

  it('should include optional fields when provided', () => {
    const normalizedOptions = {
      schema: testSchema,
      input: 'test input',
      context: 'Test context',
      lens: 'Test lens',
      sessionId: 'session-123',
      output: 'output.json',
      exampleOutput: { name: 'John', age: 25 },
      logLevel: 'info' as const,
    };

    const result = processRunnerConfiguration(normalizedOptions);

    expect(result.context).toBe('Test context');
    expect(result.lens).toBe('Test lens');
    expect(result.sessionId).toBe('session-123');
    expect(result.output).toBe('output.json');
    expect(result.exampleOutput).toEqual({ name: 'John', age: 25 });
    expect(result.logLevel).toBe('info');
  });

  it('should merge provider options with defaults', () => {
    const normalizedOptions = {
      schema: testSchema,
      input: 'test input',
      providerOptions: {
        temperature: 0.9,
        customParam: 'custom',
      },
    };

    const result = processRunnerConfiguration(normalizedOptions);

    expect(result.providerOptions).toEqual({
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: 0.9, // Overridden
      customParam: 'custom', // Added
    });
  });
});

describe('processConfiguration', () => {
  it('should combine validation and processing steps', () => {
    const options = createMockOptions({
      retries: 3,
      model: 'test-model',
    });

    const result = processConfiguration(options);

    expect(result.schema).toBe(testSchema);
    expect(result.input).toBe('test input');
    expect(result.retries).toBe(3);
    expect(result.model).toBe('test-model');
    expect(result.providerOptions.maxTokens).toBe(DEFAULT_MAX_TOKENS);
  });
});

describe('validateRunnerOptions', () => {
  describe('valid options', () => {
    it('should validate minimal valid options', () => {
      const options = createMockOptions();

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate complete valid options', () => {
      const options = createMockOptions({
        context: 'Test context',
        lens: 'Test lens',
        retries: 3,
        model: 'test-model',
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('invalid options', () => {
    it('should detect missing schema', () => {
      const options = { input: 'test input' } as any;

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: schema property is required. Please provide a valid Zod schema object.');
    });

    it('should detect missing input', () => {
      const options = { schema: testSchema } as any;

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: input property is required. Please provide input data to be processed by the LLM.');
    });

    it('should detect negative retries', () => {
      const options = createMockOptions({ retries: -1 });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: retries must be non-negative. Use 0 for no retries, or a positive number like 3.');
    });

    it('should detect excessive retries', () => {
      const options = createMockOptions({ retries: 15 });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration warning: retries should not exceed 10 for reasonable execution time. Consider using a lower value like 3-5.');
    });

    it('should detect invalid model type', () => {
      const options = createMockOptions({ model: 123 as any });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: model must be a string. Example: model: "claude-3-5-sonnet-20241022"');
    });

    it('should detect invalid context type', () => {
      const options = createMockOptions({ context: 123 as any });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: context must be a string. Example: context: "You are an expert data analyst"');
    });

    it('should detect invalid lens type', () => {
      const options = createMockOptions({ lens: 123 as any });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: lens must be a string. Example: lens: "Focus on accuracy and detail"');
    });

    it('should accumulate multiple errors', () => {
      const options = {
        retries: -1,
        model: 123,
        context: [],
      } as any;

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(5); // schema, input, retries, model, context
      expect(result.errors.some(error => error.includes('Options configuration error'))).toBe(true);
    });

    it('should detect invalid options object', () => {
      const options = null as any;

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration is invalid: Must be a valid object. Please provide an options object with schema and input properties.');
    });

    it('should detect invalid schema object', () => {
      const options = createMockOptions({ schema: { notAZodSchema: true } as any });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: schema must be a valid Zod schema object. Ensure you are importing and using a Zod schema (e.g., z.object({...})).');
    });

    it('should validate providerOptions structure', () => {
      const options = createMockOptions({
        providerOptions: {
          maxTokens: 1000,
          temperature: 0.7,
        },
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid providerOptions', () => {
      const options = createMockOptions({
        providerOptions: 'not an object' as any,
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: providerOptions must be an object. Example: providerOptions: { maxTokens: 1000, temperature: 0.7 }');
    });

    it('should detect invalid maxTokens in providerOptions', () => {
      const options = createMockOptions({
        providerOptions: {
          maxTokens: 'invalid' as any,
        },
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: providerOptions.maxTokens must be a number. Example: maxTokens: 1000');
    });

    it('should detect invalid temperature in providerOptions', () => {
      const options = createMockOptions({
        providerOptions: {
          temperature: 'invalid' as any,
        },
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: providerOptions.temperature must be a number between 0 and 1. Example: temperature: 0.7');
    });

    it('should warn about extreme temperature values', () => {
      const options = createMockOptions({
        providerOptions: {
          temperature: 5.0,
        },
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration warning: providerOptions.temperature should typically be between 0 and 1. Higher values increase randomness.');
    });

    it('should validate string retries type', () => {
      const options = createMockOptions({
        retries: 'invalid' as any,
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: retries must be a number. Example: retries: 5');
    });

    it('should validate sessionId type', () => {
      const options = createMockOptions({
        sessionId: 123 as any,
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: sessionId must be a string. Example: sessionId: "analysis-session-1"');
    });

    it('should validate output type', () => {
      const options = createMockOptions({
        output: 123 as any,
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: output must be a string file path. Example: output: "./results.json"');
    });

    it('should validate logLevel values', () => {
      const options = createMockOptions({
        logLevel: 'invalid' as any,
      });

      const result = validateRunnerOptions(options);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration error: logLevel must be one of: none, error, warn, info, debug, prompts. Example: logLevel: "info"');
    });

    it('should accept valid logLevel values', () => {
      const validLogLevels = ['none', 'error', 'warn', 'info', 'debug', 'prompts'];
      
      for (const logLevel of validLogLevels) {
        const options = createMockOptions({
          logLevel: logLevel as any,
        });

        const result = validateRunnerOptions(options);

        expect(result.valid).toBe(true);
      }
    });
  });
});

describe('validateProviderAdapter', () => {
  describe('valid providers', () => {
    it('should validate basic provider', () => {
      const provider = createMockProvider();

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate session-supporting provider', () => {
      const provider = createMockProvider({
        supportsSession: true,
        createSession: vi.fn(),
      });

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('invalid providers', () => {
    it('should detect missing name', () => {
      const provider = createMockProvider({ name: '' });

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider must have a valid name');
    });

    it('should detect invalid name type', () => {
      const provider = createMockProvider({ name: 123 as any });

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider must have a valid name');
    });

    it('should detect missing sendPrompt method', () => {
      const provider = createMockProvider({ sendPrompt: undefined as any });

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider must implement sendPrompt method');
    });

    it('should detect invalid sendPrompt type', () => {
      const provider = createMockProvider({ sendPrompt: 'not a function' as any });

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider must implement sendPrompt method');
    });

    it('should detect missing supportsSession property', () => {
      const provider = createMockProvider({ supportsSession: undefined as any });

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider must specify supportsSession boolean');
    });

    it('should detect missing createSession for session-supporting provider', () => {
      const provider = createMockProvider({
        supportsSession: true,
        createSession: undefined,
      });

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Provider that supports sessions must implement createSession method'
      );
    });

    it('should accumulate multiple provider errors', () => {
      const provider = {
        name: '',
        supportsSession: 'invalid',
        sendPrompt: null,
      } as any;

      const result = validateProviderAdapter(provider);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });
  });
});

describe('edge cases and error handling', () => {
  it('should handle zero retries as valid', () => {
    const options = createMockOptions({ retries: 0 });

    const result = validateRunnerOptions(options);

    expect(result.valid).toBe(true);
  });

  it('should handle empty string values appropriately', () => {
    const options = createMockOptions({
      context: '',
      lens: '',
      model: '',
    });

    const result = validateRunnerOptions(options);

    expect(result.valid).toBe(true); // Empty strings are valid strings
  });

  it('should preserve readonly properties in processed configuration', () => {
    const normalizedOptions = {
      schema: testSchema,
      input: 'test input',
    };

    const result = processRunnerConfiguration(normalizedOptions);

    // Ensure the result maintains readonly properties
    expect(() => {
      (result as any).schema = 'modified';
    }).not.toThrow(); // TypeScript prevents this, but runtime doesn't
  });

  it('should handle complex provider options merging', () => {
    const normalizedOptions = {
      schema: testSchema,
      input: 'test input',
      providerOptions: {
        maxTokens: 500, // Override default
        temperature: 0.5, // Override default
        nested: {
          option: 'value',
        },
        array: [1, 2, 3],
      },
    };

    const result = processRunnerConfiguration(normalizedOptions);

    expect(result.providerOptions).toEqual({
      maxTokens: 500,
      temperature: 0.5,
      nested: {
        option: 'value',
      },
      array: [1, 2, 3],
    });
  });
});