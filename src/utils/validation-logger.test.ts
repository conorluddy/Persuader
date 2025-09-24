/**
 * Tests for Validation Logger Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { ValidationError } from '../types/errors.js';
import { 
  logValidationFailure, 
  logValidationSuccess, 
  createComparisonTable 
} from './validation-logger.js';

// Mock console.log to capture output
const mockConsoleLog = vi.spyOn(console, 'log');

describe('validation-logger', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
    // Force chalk to use colors in tests
    chalk.level = 3;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('logValidationFailure', () => {
    it('should log validation failure with raw content', () => {
      const error: ValidationError = {
        type: 'validation',
        code: 'schema_validation',
        message: 'Schema validation failed',
        timestamp: new Date(),
        retryable: true,
        issues: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['name'],
            message: 'Expected string, received number',
          } as any,
        ],
        suggestions: ['Ensure name is a string'],
        rawValue: '{"name": 123}',
        failureMode: 'type_mismatch',
        retryStrategy: 'clarify_types',
        structuredFeedback: {
          problemSummary: 'Type mismatch',
          specificIssues: ['name should be string'],
          correctionInstructions: ['Change name to string'],
        },
      };

      const rawContent = '{"name": 123}';
      logValidationFailure(error, rawContent, 1);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      
      // Check that key elements are in output
      expect(output).toContain('VALIDATION FAILURE REPORT');
      expect(output).toContain('Attempt 1 failed validation');
      expect(output).toContain('schema_validation');
      expect(output).toContain('Actual LLM Response');
      expect(output).toContain('"name": 123');
      expect(output).toContain('Validation Issues');
      expect(output).toContain('Ensure name is a string');
    });

    it('should truncate long content', () => {
      const error: ValidationError = {
        type: 'validation',
        code: 'json_parse',
        message: 'Invalid JSON',
        timestamp: new Date(),
        retryable: true,
        issues: [],
        suggestions: [],
        rawValue: 'a'.repeat(3000),
        failureMode: 'json_parse',
        retryStrategy: 'fix_json',
        structuredFeedback: {
          problemSummary: 'JSON parse error',
          specificIssues: [],
          correctionInstructions: [],
        },
      };

      const rawContent = 'a'.repeat(3000);
      logValidationFailure(error, rawContent, 1, { maxContentLength: 100 });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('(truncated)');
    });

    it('should show structural diff for JSON content', () => {
      const error: ValidationError = {
        type: 'validation',
        code: 'schema_validation',
        message: 'Schema validation failed',
        timestamp: new Date(),
        retryable: true,
        issues: [
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['name'],
            message: 'Expected string, received number',
          } as any,
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'undefined',
            path: ['age'],
            message: 'Required field missing',
          } as any,
        ],
        suggestions: [],
        rawValue: '{"name": 123}',
        failureMode: 'type_mismatch',
        retryStrategy: 'clarify_types',
        structuredFeedback: {
          problemSummary: 'Type mismatch',
          specificIssues: [],
          correctionInstructions: [],
        },
      };

      const rawContent = '{"name": 123}';
      logValidationFailure(error, rawContent, 1, { showDiff: true });

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Structural Diff');
    });
  });

  describe('logValidationSuccess', () => {
    it('should log validation success with preview', () => {
      const parsedContent = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      };

      logValidationSuccess(parsedContent, 2);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('VALIDATION SUCCESS');
      expect(output).toContain('Attempt 2 passed validation');
      expect(output).toContain('Validated Structure Preview');
      expect(output).toContain('name');
      expect(output).toContain('John Doe');
    });
  });

  describe('createComparisonTable', () => {
    it('should create a comparison table', () => {
      const expected = {
        name: 'string',
        age: 'number',
        email: 'string',
      };

      const actual = {
        name: 'John',
        age: 30,
        address: '123 Main St',
      };

      const table = createComparisonTable(expected, actual);

      expect(table).toContain('Field Comparison');
      expect(table).toContain('Expected');
      expect(table).toContain('Actual');
      expect(table).toContain('name');
      expect(table).toContain('age');
      expect(table).toContain('email');
      expect(table).toContain('address');
    });
  });
});