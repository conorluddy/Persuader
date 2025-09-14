/**
 * Tests for JSON Parser
 *
 * Comprehensive tests for JSON parsing, validation, and error handling
 * with Zod schema validation and enhanced error messaging.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  parseJsonWithEnhancedErrors,
  validateJson,
  validateParsedJson,
} from '../../../src/core/validation/json-parser.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');
vi.mock('../../../src/utils/schema-analyzer.js');
vi.mock('../../../src/core/validation/error-factory.js');
vi.mock('../../../src/core/validation/suggestion-generator.js');

// Import mocked modules
import * as schemaAnalyzerModule from '../../../src/utils/schema-analyzer.js';
import * as errorFactoryModule from '../../../src/core/validation/error-factory.js';
import * as suggestionGeneratorModule from '../../../src/core/validation/suggestion-generator.js';

const extractSchemaInfo = vi.mocked(schemaAnalyzerModule.extractSchemaInfo);
const getSchemaDescription = vi.mocked(schemaAnalyzerModule.getSchemaDescription);
const createValidationError = vi.mocked(errorFactoryModule.createValidationError);
const generateSchemaDescription = vi.mocked(errorFactoryModule.generateSchemaDescription);
const generateValidationSuggestions = vi.mocked(suggestionGeneratorModule.generateValidationSuggestions);

// Test fixtures
const personSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email().optional(),
});

const arraySchema = z.array(z.string());
const primitiveSchema = z.string();
const complexSchema = z.object({
  user: z.object({
    id: z.number(),
    profile: z.object({
      username: z.string(),
      active: z.boolean(),
    }),
  }),
  tags: z.array(z.string()),
});

type PersonType = z.infer<typeof personSchema>;

const createMockValidationError = (overrides = {}) => ({
  type: 'validation' as const,
  code: 'mock_error',
  message: 'Mock validation error',
  issues: [],
  rawValue: undefined,
  timestamp: new Date(),
  retryable: true,
  failureMode: 'schema_validation',
  retryStrategy: 'provide_field_guidance',
  structuredFeedback: {
    problemSummary: 'Mock error',
    specificIssues: [],
    correctionInstructions: [],
  },
  ...overrides,
});

describe('validateJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
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

    getSchemaDescription.mockReturnValue('Test schema description');
    generateSchemaDescription.mockReturnValue('JSON object with specified fields');
    generateValidationSuggestions.mockReturnValue(['Fix the data format']);
    createValidationError.mockReturnValue(createMockValidationError());
  });

  describe('successful validation', () => {
    it('should validate correct JSON successfully', () => {
      const validInput = '{"name": "John", "age": 30}';

      const result = validateJson(personSchema, validInput);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({ name: 'John', age: 30 });
      expect(result.error).toBeUndefined();
    });

    it('should validate JSON with optional fields', () => {
      const validInput = '{"name": "Jane", "age": 25, "email": "jane@example.com"}';

      const result = validateJson(personSchema, validInput);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        name: 'Jane',
        age: 25,
        email: 'jane@example.com',
      });
    });

    it('should validate array schemas', () => {
      const validInput = '["apple", "banana", "cherry"]';

      const result = validateJson(arraySchema, validInput);

      expect(result.success).toBe(true);
      expect(result.value).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should validate primitive schemas', () => {
      const validInput = '"hello world"';

      const result = validateJson(primitiveSchema, validInput);

      expect(result.success).toBe(true);
      expect(result.value).toBe('hello world');
    });

    it('should validate complex nested schemas', () => {
      const validInput = `{
        "user": {
          "id": 123,
          "profile": {
            "username": "testuser",
            "active": true
          }
        },
        "tags": ["dev", "testing"]
      }`;

      const result = validateJson(complexSchema, validInput);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        user: {
          id: 123,
          profile: {
            username: 'testuser',
            active: true,
          },
        },
        tags: ['dev', 'testing'],
      });
    });

    it('should handle whitespace in JSON input', () => {
      const validInput = `  {
        "name": "Spaced",
        "age": 35
      }  `;

      const result = validateJson(personSchema, validInput);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({ name: 'Spaced', age: 35 });
    });
  });

  describe('JSON parsing errors', () => {
    it('should handle invalid JSON syntax', () => {
      const invalidJson = '{"name": "John", "age":}';

      validateJson(personSchema, invalidJson);

      expect(createValidationError).toHaveBeenCalledWith(
        'json_parse',
        'Invalid JSON format',
        [],
        invalidJson,
        undefined,
        expect.arrayContaining([expect.stringContaining('The output is not valid JSON')])
      );
    });

    it('should handle missing quotes in JSON', () => {
      const invalidJson = '{name: "John", age: 30}';

      validateJson(personSchema, invalidJson);

      expect(createValidationError).toHaveBeenCalledWith(
        'json_parse',
        'Invalid JSON format',
        [],
        invalidJson,
        undefined,
        expect.arrayContaining([expect.stringContaining('The output is not valid JSON')])
      );
    });

    it('should handle trailing commas', () => {
      const invalidJson = '{"name": "John", "age": 30,}';

      validateJson(personSchema, invalidJson);

      expect(createValidationError).toHaveBeenCalledWith(
        'json_parse',
        'Invalid JSON format',
        [],
        invalidJson,
        undefined,
        expect.arrayContaining([expect.stringContaining('The output is not valid JSON')])
      );
    });

    it('should handle empty input', () => {
      const emptyInput = '';

      validateJson(personSchema, emptyInput);

      expect(createValidationError).toHaveBeenCalledWith(
        'json_parse',
        'Invalid JSON format',
        [],
        emptyInput,
        undefined,
        expect.arrayContaining([expect.stringContaining('The output is not valid JSON')])
      );
    });

    it('should handle non-JSON text input', () => {
      const textInput = 'This is not JSON at all';

      validateJson(personSchema, textInput);

      expect(createValidationError).toHaveBeenCalledWith(
        'json_parse',
        'Invalid JSON format',
        [],
        textInput,
        undefined,
        expect.arrayContaining([expect.stringContaining('The output is not valid JSON')])
      );
    });
  });

  describe('schema validation errors', () => {
    it('should handle schema validation failures', () => {
      const validJson = '{"name": "John", "age": "thirty"}'; // age should be number
      createValidationError.mockReturnValue(createMockValidationError({
        code: 'schema_validation',
        message: 'Schema validation failed',
      }));

      const result = validateJson(personSchema, validJson);

      expect(result.success).toBe(false);
      expect(createValidationError).toHaveBeenCalledWith(
        'schema_validation',
        'Schema validation failed',
        expect.any(Array),
        { name: 'John', age: 'thirty' },
        'JSON object with specified fields',
        ['Fix the data format']
      );
    });

    it('should handle missing required fields', () => {
      const invalidJson = '{"name": "John"}'; // missing age
      
      const result = validateJson(personSchema, invalidJson);

      expect(result.success).toBe(false);
      expect(generateValidationSuggestions).toHaveBeenCalled();
    });

    it('should handle incorrect field types', () => {
      const invalidJson = '{"name": 123, "age": "thirty"}';
      
      const result = validateJson(personSchema, invalidJson);

      expect(result.success).toBe(false);
    });

    it('should handle extra unexpected fields gracefully', () => {
      const jsonWithExtra = '{"name": "John", "age": 30, "unexpected": "field"}';
      
      const result = validateJson(personSchema, jsonWithExtra);

      // Zod by default allows extra fields in objects
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('schema analysis and logging', () => {
    it('should extract and use schema information for logging', () => {
      const validInput = '{"name": "Test", "age": 25}';

      validateJson(personSchema, validInput);

      expect(extractSchemaInfo).toHaveBeenCalledWith(personSchema);
      expect(getSchemaDescription).toHaveBeenCalledWith(personSchema);
    });

    it('should handle schema analysis errors gracefully', () => {
      extractSchemaInfo.mockImplementation(() => {
        throw new Error('Schema analysis failed');
      });

      const validInput = '{"name": "Test", "age": 25}';

      const result = validateJson(personSchema, validInput);

      // Should still work despite schema analysis error
      expect(result.success).toBe(true);
    });

    it('should handle non-Error objects thrown during schema analysis', () => {
      extractSchemaInfo.mockImplementation(() => {
        throw 'String error';
      });

      const validInput = '{"name": "Test", "age": 25}';

      const result = validateJson(personSchema, validInput);

      // Should still work despite schema analysis error
      expect(result.success).toBe(true);
    });
  });

  describe('unexpected errors', () => {
    beforeEach(() => {
      // Extra cleanup to ensure no globals are affected
      vi.clearAllMocks();
      // Reset all mock implementations from previous tests
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
      getSchemaDescription.mockReturnValue('Test schema description');
      generateSchemaDescription.mockReturnValue('JSON object with specified fields');
      generateValidationSuggestions.mockReturnValue(['Fix the data format']);
      createValidationError.mockReturnValue(createMockValidationError());
    });

    it('should handle unexpected validation errors', () => {
      // Create a separate test schema for this test to avoid affecting others
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });
      
      // Store originals
      const originalJsonParse = JSON.parse;
      const originalSafeParse = testSchema.safeParse;
      
      try {
        // Mock JSON.parse to work normally first
        let callCount = 0;
        JSON.parse = vi.fn().mockImplementation((text: string) => {
          callCount++;
          if (callCount === 1) {
            // First call succeeds to get past the JSON parsing step
            return originalJsonParse(text);
          }
          // This shouldn't be called, but if it is, throw to trigger unexpected error
          throw new Error('Unexpected JSON.parse error');
        });

        // Mock the schema validation to throw an unexpected error
        testSchema.safeParse = vi.fn().mockImplementation(() => {
          throw new Error('Unexpected schema validation error');
        });

        const validInput = '{"name": "Test", "age": 25}';

        validateJson(testSchema, validInput);

        expect(createValidationError).toHaveBeenCalledWith(
          'unexpected_error',
          expect.stringContaining('Unexpected validation error'),
          [],
          validInput,
          undefined,
          ['Please check the input format and try again']
        );
      } finally {
        // Ensure cleanup happens regardless of test outcome
        JSON.parse = originalJsonParse;
        testSchema.safeParse = originalSafeParse;
      }
    });
  });
});

describe('parseJsonWithEnhancedErrors', () => {
  it('should parse valid JSON correctly', () => {
    const validJson = '{"test": "value", "number": 42}';

    const result = parseJsonWithEnhancedErrors(validJson);

    expect(result).toEqual({ test: 'value', number: 42 });
  });

  it('should parse arrays correctly', () => {
    const validArray = '[1, 2, 3, "four"]';

    const result = parseJsonWithEnhancedErrors(validArray);

    expect(result).toEqual([1, 2, 3, 'four']);
  });

  it('should parse primitive values', () => {
    expect(parseJsonWithEnhancedErrors('"string"')).toBe('string');
    expect(parseJsonWithEnhancedErrors('42')).toBe(42);
    expect(parseJsonWithEnhancedErrors('true')).toBe(true);
    expect(parseJsonWithEnhancedErrors('false')).toBe(false);
    expect(parseJsonWithEnhancedErrors('null')).toBe(null);
  });

  it('should throw enhanced errors for invalid JSON', () => {
    const invalidJson = '{"invalid": json}';

    expect(() => parseJsonWithEnhancedErrors(invalidJson)).toThrow();
  });

  it('should preserve error messages from JSON.parse', () => {
    const invalidJson = '{"incomplete":';

    try {
      parseJsonWithEnhancedErrors(invalidJson);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBeTruthy();
    }
  });
});

describe('validateParsedJson', () => {
  beforeEach(() => {
    generateValidationSuggestions.mockReturnValue(['Suggestion 1', 'Suggestion 2']);
    generateSchemaDescription.mockReturnValue('Test schema description');
  });

  it('should validate correct parsed data successfully', () => {
    const parsedData = { name: 'John', age: 30 };

    const result = validateParsedJson(personSchema, parsedData);

    expect(result.success).toBe(true);
    expect(result.value).toEqual(parsedData);
  });

  it('should handle validation failures with detailed errors', () => {
    const invalidData = { name: 'John', age: 'thirty' };
    createValidationError.mockReturnValue(createMockValidationError({
      code: 'schema_validation',
    }));

    const result = validateParsedJson(personSchema, invalidData);

    expect(result.success).toBe(false);
    expect(generateValidationSuggestions).toHaveBeenCalled();
    expect(createValidationError).toHaveBeenCalledWith(
      'schema_validation',
      'Schema validation failed',
      expect.any(Array),
      invalidData,
      'Test schema description',
      ['Suggestion 1', 'Suggestion 2']
    );
  });

  it('should collect all validation issues', () => {
    const invalidData = { name: 123, age: 'invalid' };
    
    validateParsedJson(personSchema, invalidData);

    const callArgs = createValidationError.mock.calls[0];
    const issues = callArgs[2]; // Third argument is issues array
    
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('should handle array validation', () => {
    const validArray = ['one', 'two', 'three'];

    const result = validateParsedJson(arraySchema, validArray);

    expect(result.success).toBe(true);
    expect(result.value).toEqual(validArray);
  });

  it('should handle primitive validation', () => {
    const validString = 'test string';

    const result = validateParsedJson(primitiveSchema, validString);

    expect(result.success).toBe(true);
    expect(result.value).toBe(validString);
  });

  it('should handle complex nested validation failures', () => {
    const invalidNestedData = {
      user: {
        id: 'not-a-number',
        profile: {
          username: 123,
          active: 'not-boolean',
        },
      },
      tags: 'not-an-array',
    };

    const result = validateParsedJson(complexSchema, invalidNestedData);

    expect(result.success).toBe(false);
    expect(generateValidationSuggestions).toHaveBeenCalled();
  });

  it('should handle null and undefined inputs', () => {
    const result1 = validateParsedJson(personSchema, null);
    const result2 = validateParsedJson(personSchema, undefined);

    expect(result1.success).toBe(false);
    expect(result2.success).toBe(false);
  });

  it('should preserve issue path information', () => {
    const invalidNestedData = {
      user: {
        id: 123,
        profile: {
          username: 'valid',
          active: 'not-boolean',
        },
      },
      tags: ['valid'],
    };

    validateParsedJson(complexSchema, invalidNestedData);

    // Verify that validation suggestions were called with the failed data
    expect(generateValidationSuggestions).toHaveBeenCalledWith(
      expect.any(Array),
      invalidNestedData
    );
  });
});

describe('integration scenarios', () => {
  it('should handle complete validation flow', () => {
    const input = '{"name": "Complete", "age": 40, "email": "test@example.com"}';

    const result = validateJson(personSchema, input);

    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      name: 'Complete',
      age: 40,
      email: 'test@example.com',
    });
  });

  it('should handle malformed JSON followed by validation error pattern', () => {
    const malformedInput = '{"name": John, "age": 30}'; // Missing quotes around John

    const result = validateJson(personSchema, malformedInput);

    expect(result.success).toBe(false);
    expect(createValidationError).toHaveBeenCalledWith(
      'json_parse',
      'Invalid JSON format',
      [],
      malformedInput,
      undefined,
      expect.any(Array)
    );
  });

  it('should provide actionable error messages', () => {
    const invalidInput = '{"name": 123, "age": "thirty"}';
    createValidationError.mockReturnValue(createMockValidationError({
      suggestions: ['Ensure name is a string', 'Ensure age is a number'],
    }));

    const result = validateJson(personSchema, invalidInput);

    expect(result.success).toBe(false);
    expect(generateValidationSuggestions).toHaveBeenCalled();
  });
});