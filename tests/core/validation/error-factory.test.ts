/**
 * Tests for Validation Error Factory
 *
 * Comprehensive tests for error creation, type guards, and schema description
 * generation with focus on type safety and error structure validation.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createValidationError,
  generateSchemaDescription,
  hasOptions,
  hasValidation,
  isTooBigIssue,
  isTooSmallIssue,
} from '../../../src/core/validation/error-factory.js';

describe('Type Guards', () => {
  describe('isTooSmallIssue', () => {
    it('should identify too_small issues correctly', () => {
      const tooSmallIssue: z.ZodIssue = {
        code: 'too_small',
        minimum: 5,
        type: 'string',
        inclusive: true,
        exact: false,
        message: 'String must contain at least 5 character(s)',
        path: ['field'],
      };

      expect(isTooSmallIssue(tooSmallIssue)).toBe(true);
    });

    it('should identify too_small number issues', () => {
      const tooSmallNumberIssue: z.ZodIssue = {
        code: 'too_small',
        minimum: 10,
        type: 'number',
        inclusive: true,
        exact: false,
        message: 'Number must be greater than or equal to 10',
        path: ['age'],
      };

      expect(isTooSmallIssue(tooSmallNumberIssue)).toBe(true);
    });

    it('should identify too_small array issues', () => {
      const tooSmallArrayIssue: z.ZodIssue = {
        code: 'too_small',
        minimum: 2,
        type: 'array',
        inclusive: true,
        exact: false,
        message: 'Array must contain at least 2 element(s)',
        path: ['items'],
      };

      expect(isTooSmallIssue(tooSmallArrayIssue)).toBe(true);
    });

    it('should not identify other issue types', () => {
      const otherIssue: z.ZodIssue = {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        message: 'Expected string, received number',
        path: ['field'],
      };

      expect(isTooSmallIssue(otherIssue)).toBe(false);
    });

    it('should not identify too_big issues', () => {
      const tooBigIssue: z.ZodIssue = {
        code: 'too_big',
        maximum: 100,
        type: 'string',
        inclusive: true,
        exact: false,
        message: 'String must contain at most 100 character(s)',
        path: ['field'],
      };

      expect(isTooSmallIssue(tooBigIssue)).toBe(false);
    });

    it('should handle issues without type or minimum', () => {
      const incompleteIssue: z.ZodIssue = {
        code: 'too_small',
        message: 'Too small but missing details',
        path: ['field'],
      } as any;

      expect(isTooSmallIssue(incompleteIssue)).toBe(false);
    });
  });

  describe('isTooBigIssue', () => {
    it('should identify too_big issues correctly', () => {
      const tooBigIssue: z.ZodIssue = {
        code: 'too_big',
        maximum: 50,
        type: 'string',
        inclusive: true,
        exact: false,
        message: 'String must contain at most 50 character(s)',
        path: ['field'],
      };

      expect(isTooBigIssue(tooBigIssue)).toBe(true);
    });

    it('should identify too_big number issues', () => {
      const tooBigNumberIssue: z.ZodIssue = {
        code: 'too_big',
        maximum: 100,
        type: 'number',
        inclusive: true,
        exact: false,
        message: 'Number must be less than or equal to 100',
        path: ['score'],
      };

      expect(isTooBigIssue(tooBigNumberIssue)).toBe(true);
    });

    it('should identify too_big array issues', () => {
      const tooBigArrayIssue: z.ZodIssue = {
        code: 'too_big',
        maximum: 10,
        type: 'array',
        inclusive: true,
        exact: false,
        message: 'Array must contain at most 10 element(s)',
        path: ['items'],
      };

      expect(isTooBigIssue(tooBigArrayIssue)).toBe(true);
    });

    it('should not identify other issue types', () => {
      const otherIssue: z.ZodIssue = {
        code: 'invalid_string',
        validation: 'email',
        message: 'Invalid email',
        path: ['email'],
      };

      expect(isTooBigIssue(otherIssue)).toBe(false);
    });

    it('should not identify too_small issues', () => {
      const tooSmallIssue: z.ZodIssue = {
        code: 'too_small',
        minimum: 5,
        type: 'string',
        inclusive: true,
        exact: false,
        message: 'String must contain at least 5 character(s)',
        path: ['field'],
      };

      expect(isTooBigIssue(tooSmallIssue)).toBe(false);
    });

    it('should handle issues without type or maximum', () => {
      const incompleteIssue: z.ZodIssue = {
        code: 'too_big',
        message: 'Too big but missing details',
        path: ['field'],
      } as any;

      expect(isTooBigIssue(incompleteIssue)).toBe(false);
    });
  });

  describe('hasValidation', () => {
    it('should identify string validation issues', () => {
      const emailIssue: z.ZodIssue = {
        code: 'invalid_string',
        validation: 'email',
        message: 'Invalid email',
        path: ['email'],
      };

      expect(hasValidation(emailIssue)).toBe(true);
    });

    it('should identify URL validation issues', () => {
      const urlIssue: z.ZodIssue = {
        code: 'invalid_string',
        validation: 'url',
        message: 'Invalid url',
        path: ['website'],
      };

      expect(hasValidation(urlIssue)).toBe(true);
    });

    it('should identify UUID validation issues', () => {
      const uuidIssue: z.ZodIssue = {
        code: 'invalid_string',
        validation: 'uuid',
        message: 'Invalid uuid',
        path: ['id'],
      };

      expect(hasValidation(uuidIssue)).toBe(true);
    });

    it('should not identify issues without validation', () => {
      const typeIssue: z.ZodIssue = {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        message: 'Expected string, received number',
        path: ['field'],
      };

      expect(hasValidation(typeIssue)).toBe(false);
    });

    it('should not identify issues with non-string validation', () => {
      const nonStringValidation: z.ZodIssue = {
        code: 'invalid_string',
        validation: 123,
        message: 'Invalid format',
        path: ['field'],
      } as any;

      expect(hasValidation(nonStringValidation)).toBe(false);
    });

    it('should handle issues without validation property', () => {
      const noValidation: z.ZodIssue = {
        code: 'required',
        message: 'Required',
        path: ['field'],
      };

      expect(hasValidation(noValidation)).toBe(false);
    });
  });

  describe('hasOptions', () => {
    it('should identify enum issues with options', () => {
      const enumIssue: z.ZodIssue = {
        code: 'invalid_enum_value',
        options: ['red', 'green', 'blue'],
        received: 'yellow',
        message: 'Invalid enum value. Expected red | green | blue, received yellow',
        path: ['color'],
      };

      expect(hasOptions(enumIssue)).toBe(true);
    });

    it('should identify union issues with options', () => {
      const unionIssue: z.ZodIssue = {
        code: 'invalid_union',
        unionErrors: [],
        message: 'Invalid input',
        path: ['field'],
        options: ['option1', 'option2'],
      } as any;

      expect(hasOptions(unionIssue)).toBe(true);
    });

    it('should not identify issues without options', () => {
      const typeIssue: z.ZodIssue = {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        message: 'Expected string, received number',
        path: ['field'],
      };

      expect(hasOptions(typeIssue)).toBe(false);
    });

    it('should not identify issues with non-array options', () => {
      const nonArrayOptions: z.ZodIssue = {
        code: 'invalid_enum_value',
        options: 'not-an-array',
        message: 'Invalid value',
        path: ['field'],
      } as any;

      expect(hasOptions(nonArrayOptions)).toBe(false);
    });

    it('should handle empty options array', () => {
      const emptyOptionsIssue: z.ZodIssue = {
        code: 'invalid_enum_value',
        options: [],
        received: 'value',
        message: 'Invalid enum value',
        path: ['field'],
      };

      expect(hasOptions(emptyOptionsIssue)).toBe(true);
    });
  });
});

describe('createValidationError', () => {
  it('should create a basic validation error', () => {
    const error = createValidationError(
      'test_error',
      'Test error message',
      [],
      { test: 'data' }
    );

    expect(error.type).toBe('validation');
    expect(error.code).toBe('test_error');
    expect(error.message).toBe('Test error message');
    expect(error.issues).toEqual([]);
    expect(error.rawValue).toEqual({ test: 'data' });
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.retryable).toBe(true);
    expect(error.failureMode).toBe('schema_validation');
    expect(error.retryStrategy).toBe('provide_field_guidance');
    expect(error.structuredFeedback).toEqual({
      problemSummary: 'Test error message',
      specificIssues: [],
      correctionInstructions: [],
    });
    expect(error.details).toEqual({
      issueCount: 0,
      hasJsonParseError: false,
    });
  });

  it('should create validation error with schema description', () => {
    const error = createValidationError(
      'schema_mismatch',
      'Schema validation failed',
      [],
      { invalid: 'data' },
      'Expected JSON object with name and age fields'
    );

    expect(error.schemaDescription).toBe('Expected JSON object with name and age fields');
  });

  it('should create validation error with suggestions', () => {
    const suggestions = ['Fix field types', 'Add missing required fields'];
    
    const error = createValidationError(
      'validation_failed',
      'Multiple validation issues',
      [],
      { invalid: 'data' },
      undefined,
      suggestions
    );

    expect(error.suggestions).toEqual(suggestions);
    expect(error.structuredFeedback.specificIssues).toEqual(suggestions);
    expect(error.structuredFeedback.correctionInstructions).toEqual(suggestions);
  });

  it('should create validation error with Zod issues', () => {
    const zodIssues: z.ZodIssue[] = [
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        message: 'Expected string, received number',
        path: ['name'],
      },
      {
        code: 'too_small',
        minimum: 0,
        type: 'number',
        inclusive: true,
        exact: false,
        message: 'Number must be greater than or equal to 0',
        path: ['age'],
      },
    ];

    const error = createValidationError(
      'schema_validation',
      'Multiple field errors',
      zodIssues,
      { name: 123, age: -5 }
    );

    expect(error.issues).toEqual(zodIssues);
    expect(error.details.issueCount).toBe(2);
    expect(error.details.hasJsonParseError).toBe(false);
  });

  it('should mark JSON parse errors correctly', () => {
    const error = createValidationError(
      'json_parse',
      'Invalid JSON format',
      [],
      '{"invalid": json}'
    );

    expect(error.details.hasJsonParseError).toBe(true);
  });

  it('should handle complex raw values', () => {
    const complexValue = {
      nested: {
        object: {
          with: ['arrays', 'and', 'values'],
          numbers: 42,
          booleans: true,
        },
      },
    };

    const error = createValidationError(
      'complex_error',
      'Complex validation error',
      [],
      complexValue
    );

    expect(error.rawValue).toEqual(complexValue);
  });

  it('should handle null and undefined raw values', () => {
    const nullError = createValidationError(
      'null_error',
      'Null value error',
      [],
      null
    );

    const undefinedError = createValidationError(
      'undefined_error',
      'Undefined value error',
      [],
      undefined
    );

    expect(nullError.rawValue).toBe(null);
    expect(undefinedError.rawValue).toBe(undefined);
  });

  it('should create validation error with complete metadata', () => {
    const zodIssues: z.ZodIssue[] = [
      {
        code: 'invalid_string',
        validation: 'email',
        message: 'Invalid email',
        path: ['email'],
      },
    ];

    const suggestions = ['Use a valid email format like user@example.com'];
    const schemaDescription = 'User profile with email validation';

    const error = createValidationError(
      'email_validation',
      'Email validation failed',
      zodIssues,
      { email: 'invalid-email' },
      schemaDescription,
      suggestions
    );

    expect(error.type).toBe('validation');
    expect(error.code).toBe('email_validation');
    expect(error.message).toBe('Email validation failed');
    expect(error.issues).toEqual(zodIssues);
    expect(error.rawValue).toEqual({ email: 'invalid-email' });
    expect(error.schemaDescription).toBe(schemaDescription);
    expect(error.suggestions).toEqual(suggestions);
    expect(error.retryable).toBe(true);
    expect(error.failureMode).toBe('schema_validation');
    expect(error.retryStrategy).toBe('provide_field_guidance');
    expect(error.structuredFeedback).toEqual({
      problemSummary: 'Email validation failed',
      specificIssues: suggestions,
      correctionInstructions: suggestions,
    });
    expect(error.details).toEqual({
      issueCount: 1,
      hasJsonParseError: false,
    });
    expect(error.timestamp).toBeInstanceOf(Date);
  });
});

describe('generateSchemaDescription', () => {
  it('should describe ZodObject schemas', () => {
    const objectSchema = z.object({ name: z.string() });
    
    const description = generateSchemaDescription(objectSchema);
    
    expect(description).toBe('JSON object with specified fields');
  });

  it('should describe ZodArray schemas', () => {
    const arraySchema = z.array(z.string());
    
    const description = generateSchemaDescription(arraySchema);
    
    expect(description).toBe('Array of items');
  });

  it('should describe ZodString schemas', () => {
    const stringSchema = z.string();
    
    const description = generateSchemaDescription(stringSchema);
    
    expect(description).toBe('String value');
  });

  it('should describe ZodNumber schemas', () => {
    const numberSchema = z.number();
    
    const description = generateSchemaDescription(numberSchema);
    
    expect(description).toBe('Numeric value');
  });

  it('should describe ZodBoolean schemas', () => {
    const booleanSchema = z.boolean();
    
    const description = generateSchemaDescription(booleanSchema);
    
    expect(description).toBe('Boolean value');
  });

  it('should handle unknown schema types', () => {
    const unionSchema = z.union([z.string(), z.number()]);
    
    const description = generateSchemaDescription(unionSchema);
    
    expect(description).toBe('Value matching the specified schema');
  });

  it('should handle schema introspection errors', () => {
    // Create a mock schema that throws during constructor name access
    const mockSchema = {
      get constructor() {
        throw new Error('Constructor access failed');
      },
    } as z.ZodSchema<unknown>;
    
    const description = generateSchemaDescription(mockSchema);
    
    expect(description).toBe('Value matching the specified schema');
  });

  it('should handle custom schema types gracefully', () => {
    // Create a schema with custom constructor name
    const customSchema = z.string();
    Object.defineProperty(customSchema.constructor, 'name', {
      value: 'CustomZodType',
    });
    
    const description = generateSchemaDescription(customSchema);
    
    expect(description).toBe('Value matching the specified schema');
  });

  it('should handle schemas without constructor names', () => {
    const schemaWithoutName = z.string();
    Object.defineProperty(schemaWithoutName.constructor, 'name', {
      value: '',
    });
    
    const description = generateSchemaDescription(schemaWithoutName);
    
    expect(description).toBe('Value matching the specified schema');
  });
});

describe('edge cases and error conditions', () => {
  it('should handle empty string codes', () => {
    const error = createValidationError('', 'Empty code error', [], null);
    
    expect(error.code).toBe('');
    expect(error.details.hasJsonParseError).toBe(false);
  });

  it('should handle empty message', () => {
    const error = createValidationError('test', '', [], null);
    
    expect(error.message).toBe('');
    expect(error.structuredFeedback.problemSummary).toBe('');
  });

  it('should handle very large issue arrays', () => {
    const manyIssues = Array.from({ length: 100 }, (_, i) => ({
      code: 'invalid_type' as const,
      expected: 'string',
      received: 'number',
      message: `Field ${i} is invalid`,
      path: [`field${i}`],
    }));

    const error = createValidationError(
      'many_errors',
      'Many validation errors',
      manyIssues,
      {}
    );

    expect(error.issues).toHaveLength(100);
    expect(error.details.issueCount).toBe(100);
  });

  it('should handle circular references in raw values safely', () => {
    const circularObject: any = { name: 'test' };
    circularObject.self = circularObject;

    // Should not throw when creating error with circular reference
    const error = createValidationError(
      'circular_ref',
      'Circular reference error',
      [],
      circularObject
    );

    expect(error.rawValue).toBe(circularObject);
  });

  it('should preserve all error properties when created', () => {
    const timestamp = new Date();
    
    const error = createValidationError(
      'complete_test',
      'Complete error test',
      [],
      { test: 'data' },
      'Test schema',
      ['Test suggestion']
    );

    // Check that timestamp is recent (within 1 second)
    expect(error.timestamp.getTime()).toBeGreaterThan(timestamp.getTime() - 1000);
    expect(error.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
  });
});