/**
 * Tests for Validation Suggestion Generator
 *
 * Comprehensive tests for transforming Zod validation issues into actionable suggestions
 * that enable LLMs to self-correct and generate valid responses through retry loops.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  createStructuredSuggestions,
  generateFieldCorrections,
  generateValidationSuggestions,
} from '../../../src/core/validation/suggestion-generator.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');

describe('generateValidationSuggestions', () => {
  describe('type validation errors', () => {
    it('should generate suggestions for invalid type errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "name": Expected string, but got number. Please ensure this field contains the correct data type.'
      );
    });

    it('should extract received type from message when not provided', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['field'],
          message: 'Expected string, received boolean',
        } as z.ZodIssue,
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "field": Expected string, but got boolean. Please ensure this field contains the correct data type.'
      );
    });

    it('should handle missing received type gracefully', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          path: ['field'],
          message: 'Invalid type provided',
        } as z.ZodIssue,
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "field": Expected string, but got unknown. Please ensure this field contains the correct data type.'
      );
    });
  });

  describe('size constraint errors', () => {
    it('should generate suggestions for too_small string errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_small',
          minimum: 5,
          type: 'string',
          path: ['password'],
          message: 'String must contain at least 5 character(s)',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "password": String is too short. Minimum length is 5.'
      );
    });

    it('should generate suggestions for too_small number errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_small',
          minimum: 18,
          type: 'number',
          path: ['age'],
          message: 'Number must be greater than or equal to 18',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "age": Number is too small. Minimum value is 18.'
      );
    });

    it('should generate suggestions for too_small array errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_small',
          minimum: 3,
          type: 'array',
          path: ['items'],
          message: 'Array must contain at least 3 element(s)',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "items": Array has too few items. Minimum length is 3.'
      );
    });

    it('should generate suggestions for too_big string errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_big',
          maximum: 100,
          type: 'string',
          path: ['description'],
          message: 'String must contain at most 100 character(s)',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "description": String is too long. Maximum length is 100.'
      );
    });

    it('should generate suggestions for too_big number errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_big',
          maximum: 999,
          type: 'number',
          path: ['score'],
          message: 'Number must be less than or equal to 999',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "score": Number is too large. Maximum value is 999.'
      );
    });

    it('should generate suggestions for too_big array errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_big',
          maximum: 10,
          type: 'array',
          path: ['tags'],
          message: 'Array must contain at most 10 element(s)',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "tags": Array has too many items. Maximum length is 10.'
      );
    });
  });

  describe('enum and union validation errors', () => {
    it('should generate suggestions for invalid enum values', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_enum_value',
          options: ['red', 'green', 'blue'],
          path: ['color'],
          message: 'Invalid enum value',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain('Field "color": Must be one of: red, green, blue.');
    });

    it('should generate suggestions for invalid union types', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_union',
          path: ['value'],
          message: 'Invalid input',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "value": Value doesn\'t match any of the expected types in the union.'
      );
    });

    it('should handle invalid_value errors with options', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_value' as any,
          options: ['option1', 'option2'],
          path: ['choice'],
          message: 'Invalid choice',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain('Field "choice": Must be one of: option1, option2.');
    });
  });

  describe('object structure errors', () => {
    it('should generate suggestions for unrecognized keys', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'unrecognized_keys',
          keys: ['extraField1', 'extraField2'],
          path: [],
          message: 'Unrecognized key(s) in object',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Unexpected fields found: extraField1, extraField2. Please remove these fields or check if they\'re misspelled.'
      );
    });

    it('should handle unrecognized keys with missing keys property', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'unrecognized_keys',
          path: [],
          message: 'Unrecognized key(s) in object',
        } as z.ZodIssue,
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Unexpected fields found: unknown keys. Please remove these fields or check if they\'re misspelled.'
      );
    });
  });

  describe('string format validation errors', () => {
    it('should generate suggestions for email format errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_string',
          validation: 'email',
          path: ['email'],
          message: 'Invalid email',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain('Field "email": Must be a valid email address.');
    });

    it('should generate suggestions for URL format errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_string',
          validation: 'url',
          path: ['website'],
          message: 'Invalid url',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain('Field "website": Must be a valid URL.');
    });

    it('should generate suggestions for UUID format errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_string',
          validation: 'uuid',
          path: ['id'],
          message: 'Invalid uuid',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain('Field "id": Must be a valid UUID.');
    });

    it('should handle generic string format errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_string',
          validation: 'custom',
          path: ['field'],
          message: 'Invalid string format',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain('Field "field": String format is invalid.');
    });
  });

  describe('root level errors', () => {
    it('should handle errors at root level with proper labeling', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'string',
          path: [],
          message: 'Expected object, received string',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Field "root": Expected object, but got string. Please ensure this field contains the correct data type.'
      );
    });
  });

  describe('general suggestions', () => {
    it('should add general suggestions when specific issues are found', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain(
        'Ensure all required fields are present and have the correct data types.'
      );
      expect(result).toContain(
        'Double-check field names for typos or incorrect casing.'
      );
      expect(result).toContain(
        'Verify that the JSON structure matches the expected schema exactly.'
      );
    });

    it('should return empty array for no issues', () => {
      const result = generateValidationSuggestions([], {});

      expect(result).toEqual([]);
    });

    it('should handle null or undefined issues gracefully', () => {
      const result1 = generateValidationSuggestions(null as any, {});
      const result2 = generateValidationSuggestions(undefined as any, {});

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });
  });

  describe('fallback handling', () => {
    it('should generate fallback suggestions for unknown error codes', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'custom_error' as any,
          path: ['field'],
          message: 'Custom error occurred',
        },
      ];

      const result = generateValidationSuggestions(issues, {});

      expect(result).toContain('Field "field": Custom error occurred');
    });
  });
});

describe('generateFieldCorrections', () => {
  describe('type correction instructions', () => {
    it('should generate specific corrections for type mismatches', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ];

      const result = generateFieldCorrections(issues);

      expect(result).toContain('Field "name": Change from number to string');
    });
  });

  describe('size correction instructions', () => {
    it('should generate corrections for too_small string errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_small',
          minimum: 8,
          type: 'string',
          path: ['password'],
          message: 'String too short',
        },
      ];

      const result = generateFieldCorrections(issues);

      expect(result).toContain(
        'Field "password": Increase text length to at least 8 characters'
      );
    });

    it('should generate corrections for too_small array errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_small',
          minimum: 3,
          type: 'array',
          path: ['items'],
          message: 'Array too short',
        },
      ];

      const result = generateFieldCorrections(issues);

      expect(result).toContain(
        'Field "items": Add at least 3 items to the array'
      );
    });

    it('should generate corrections for too_small number errors', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'too_small',
          minimum: 18,
          path: ['age'],
          message: 'Number too small',
        },
      ];

      const result = generateFieldCorrections(issues);

      expect(result).toContain('Field "age": Increase value to at least 18');
    });
  });

  describe('structure correction instructions', () => {
    it('should generate corrections for unrecognized keys', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'unrecognized_keys',
          keys: ['invalid1', 'invalid2'],
          path: [],
          message: 'Unrecognized keys',
        },
      ];

      const result = generateFieldCorrections(issues);

      expect(result).toContain('Remove unexpected fields: invalid1, invalid2');
    });
  });

  describe('fallback corrections', () => {
    it('should provide generic corrections for unhandled error types', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'custom' as any,
          path: ['field'],
          message: 'Custom validation error',
        },
      ];

      const result = generateFieldCorrections(issues);

      expect(result).toContain('Field "field": Custom validation error');
    });

    it('should handle missing message gracefully', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'custom' as any,
          path: ['field'],
        } as z.ZodIssue,
      ];

      const result = generateFieldCorrections(issues);

      expect(result).toContain('Field "field": Invalid value');
    });
  });
});

describe('createStructuredSuggestions', () => {
  describe('structured suggestion creation', () => {
    it('should create structured suggestions with proper priority', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
        {
          code: 'unrecognized_keys',
          keys: ['extra'],
          path: [],
          message: 'Unrecognized keys',
        },
      ];

      const result = createStructuredSuggestions(issues);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: 'name',
        issueType: 'invalid_type',
        suggestion: 'Expected string, but got number. Please ensure this field contains the correct data type.',
        priority: 'critical',
      });
      expect(result[1]).toEqual({
        path: 'root',
        issueType: 'unrecognized_keys',
        suggestion: 'Unexpected fields found: extra. Please remove these fields or check if they\'re misspelled.',
        priority: 'high',
      });
    });

    it('should assign appropriate priorities for different error types', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          path: ['field1'],
          message: 'Type error',
        },
        {
          code: 'unrecognized_keys',
          path: ['field2'],
          message: 'Extra keys',
        },
        {
          code: 'too_small',
          path: ['field3'],
          message: 'Size error',
        },
        {
          code: 'invalid_union',
          path: ['field4'],
          message: 'Union error',
        },
        {
          code: 'custom' as any,
          path: ['field5'],
          message: 'Other error',
        },
      ];

      const result = createStructuredSuggestions(issues);

      expect(result[0].priority).toBe('critical'); // invalid_type
      expect(result[1].priority).toBe('high');     // unrecognized_keys
      expect(result[2].priority).toBe('medium');   // too_small
      expect(result[3].priority).toBe('high');     // invalid_union
      expect(result[4].priority).toBe('low');      // custom
    });

    it('should handle empty issues array', () => {
      const result = createStructuredSuggestions([]);

      expect(result).toEqual([]);
    });
  });

  describe('path formatting', () => {
    it('should format paths correctly for nested fields', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          path: ['user', 'profile', 'email'],
          message: 'Invalid email',
        },
      ];

      const result = createStructuredSuggestions(issues);

      expect(result[0].path).toBe('user.profile.email');
    });

    it('should use "root" for empty paths', () => {
      const issues: z.ZodIssue[] = [
        {
          code: 'invalid_type',
          path: [],
          message: 'Root error',
        },
      ];

      const result = createStructuredSuggestions(issues);

      expect(result[0].path).toBe('root');
    });
  });
});