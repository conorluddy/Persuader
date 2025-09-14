/**
 * Tests for Field Analyzer
 *
 * Comprehensive tests for field-level validation error analysis,
 * extracting specific field information and error patterns.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractFieldErrors } from '../../../src/core/validation/field-analyzer.js';
import type { ValidationError } from '../../../src/types/errors.js';

// Test fixtures
const createValidationError = (overrides: Partial<ValidationError> = {}): ValidationError => ({
  type: 'validation' as const,
  code: 'schema_mismatch',
  message: 'Schema validation failed',
  timestamp: new Date(),
  retryable: true,
  issues: [],
  rawValue: '{"invalid": true}',
  suggestions: ['Fix the schema'],
  failureMode: 'schema_validation',
  retryStrategy: 'provide_field_guidance',
  structuredFeedback: {
    problemSummary: 'Schema mismatch',
    specificIssues: [],
    correctionInstructions: [],
  },
  ...overrides,
});

describe('extractFieldErrors', () => {
  describe('basic field error extraction', () => {
    it('should extract simple field errors with paths', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'invalid_type',
            path: ['name'],
            message: 'Expected string, received number',
            expected: 'string',
            received: 'number',
          } as z.ZodIssue,
          {
            code: 'invalid_type', 
            path: ['age'],
            message: 'Expected number, received string',
            expected: 'number',
            received: 'string',
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: 'name',
        expected: 'string',
        received: 'number',
        message: 'Expected string, received number',
      });
      expect(result[1]).toEqual({
        path: 'age',
        expected: 'number', 
        received: 'string',
        message: 'Expected number, received string',
      });
    });

    it('should handle nested field paths', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'invalid_type',
            path: ['user', 'profile', 'email'],
            message: 'Expected string, received undefined',
            expected: 'string',
            received: 'undefined',
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'user.profile.email',
        expected: 'string',
        received: 'undefined', 
        message: 'Expected string, received undefined',
      });
    });

    it('should handle root level errors', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'invalid_type',
            path: [],
            message: 'Expected object, received string',
            expected: 'object',
            received: 'string',
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'root',
        expected: 'object',
        received: 'string',
        message: 'Expected object, received string',
      });
    });
  });

  describe('error message parsing', () => {
    it('should extract received type from error message when not directly available', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'invalid_type',
            path: ['field'],
            message: 'Expected string, received boolean',
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'field',
        expected: 'valid value',
        received: 'boolean',
        message: 'Expected string, received boolean',
      });
    });

    it('should fall back to "invalid value" when no received type can be determined', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'custom',
            path: ['field'],
            message: 'Custom validation failed',
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'field',
        expected: 'valid value',
        received: 'invalid value',
        message: 'Custom validation failed',
      });
    });

    it('should prefer direct received property over message parsing', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'invalid_type',
            path: ['field'],
            message: 'Expected string, received number',
            expected: 'string',
            received: 'boolean', // This should be preferred over 'number' from message
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'field',
        expected: 'string',
        received: 'boolean',
        message: 'Expected string, received number',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty issues array', () => {
      const error = createValidationError({
        issues: [],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(0);
    });

    it('should handle undefined issues array', () => {
      const error = createValidationError({
        issues: undefined as any,
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(0);
    });

    it('should handle complex error codes', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'too_small',
            path: ['items'],
            message: 'Array must contain at least 1 element',
            minimum: 1,
            type: 'array',
          } as z.ZodIssue,
          {
            code: 'invalid_string',
            path: ['email'],
            message: 'Invalid email format',
            validation: 'email',
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: 'items',
        expected: 'valid value',
        received: 'invalid value',
        message: 'Array must contain at least 1 element',
      });
      expect(result[1]).toEqual({
        path: 'email',
        expected: 'valid value',
        received: 'invalid value',
        message: 'Invalid email format',
      });
    });

    it('should handle numeric and array paths', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'invalid_type',
            path: ['users', 0, 'name'],
            message: 'Expected string, received number',
            expected: 'string',
            received: 'number',
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        path: 'users.0.name',
        expected: 'string',
        received: 'number',
        message: 'Expected string, received number',
      });
    });
  });

  describe('multiple error scenarios', () => {
    it('should handle mixed error types for comprehensive analysis', () => {
      const error = createValidationError({
        issues: [
          {
            code: 'invalid_type',
            path: ['name'],
            message: 'Expected string, received null',
            expected: 'string',
            received: 'null',
          } as z.ZodIssue,
          {
            code: 'too_small',
            path: ['age'],
            message: 'Number must be greater than 0',
            minimum: 0,
            type: 'number',
          } as z.ZodIssue,
          {
            code: 'unrecognized_keys',
            path: [],
            message: 'Unrecognized key(s) in object: "extra"',
            keys: ['extra'],
          } as z.ZodIssue,
        ],
      });

      const result = extractFieldErrors(error);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        path: 'name',
        expected: 'string',
        received: 'null',
        message: 'Expected string, received null',
      });
      expect(result[1]).toEqual({
        path: 'age',
        expected: 'valid value',
        received: 'invalid value',
        message: 'Number must be greater than 0',
      });
      expect(result[2]).toEqual({
        path: 'root',
        expected: 'valid value',
        received: 'invalid value',
        message: 'Unrecognized key(s) in object: "extra"',
      });
    });
  });
});