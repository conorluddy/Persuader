/**
 * Tests for Feedback Formatter
 *
 * Comprehensive tests for LLM feedback generation, progressive urgency,
 * and error-specific formatting for JSON parsing and schema validation errors.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  formatFieldCorrections,
  formatGenericErrorFeedback,
  formatJsonParseErrorFeedback,
  formatSchemaValidationErrorFeedback,
  formatSuggestionsList,
  formatValidationErrorFeedback,
  formatValidationIssues,
  generateAttemptSpecificInstructions,
  generateFinalAttemptWarning,
  generateUrgencyPrefix,
} from '../../../src/core/validation/feedback-formatter.js';
import type { ValidationError } from '../../../src/types/errors.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');
vi.mock('../../../src/core/validation/suggestion-generator.js');

// Import mocked modules
import * as suggestionGeneratorModule from '../../../src/core/validation/suggestion-generator.js';

const generateFieldCorrections = vi.mocked(suggestionGeneratorModule.generateFieldCorrections);

// Test fixtures
const createValidationError = (overrides: Partial<ValidationError> = {}): ValidationError => ({
  type: 'validation',
  code: 'schema_validation',
  message: 'Test validation error',
  issues: [],
  rawValue: undefined,
  timestamp: new Date(),
  retryable: true,
  failureMode: 'schema_validation',
  retryStrategy: 'provide_field_guidance',
  structuredFeedback: {
    problemSummary: 'Test error',
    specificIssues: [],
    correctionInstructions: [],
  },
  ...overrides,
});

const createZodIssue = (overrides: Partial<z.ZodIssue> = {}): z.ZodIssue => ({
  code: 'invalid_type',
  expected: 'string',
  received: 'number',
  message: 'Expected string, received number',
  path: ['field'],
  ...overrides,
});

describe('formatValidationErrorFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateFieldCorrections.mockReturnValue(['Fix field type']);
  });

  describe('JSON parse error formatting', () => {
    it('should format JSON parse errors with basic feedback', () => {
      const error = createValidationError({
        code: 'json_parse',
        message: 'Unexpected token } in JSON at position 15',
      });

      const result = formatValidationErrorFeedback(error, 1);

      expect(result).toContain('JSON Parsing Error');
      expect(result).toContain('Unexpected token } in JSON at position 15');
      expect(result).toContain('The response must be valid JSON');
      expect(result).not.toContain('🚨');
      expect(result).not.toContain('⚠️');
    });

    it('should format JSON parse errors with urgency on later attempts', () => {
      const error = createValidationError({
        code: 'json_parse',
        message: 'Invalid JSON format',
      });

      const result = formatValidationErrorFeedback(error, 3);

      expect(result).toContain('🚨 CRITICAL: JSON Parsing Error');
      expect(result).toContain('Your response MUST start with "{" and end with "}"');
    });
  });

  describe('schema validation error formatting', () => {
    it('should format schema validation errors with issues', () => {
      const zodIssues = [
        createZodIssue({
          path: ['name'],
          message: 'Expected string, received number',
        }),
        createZodIssue({
          code: 'too_small',
          path: ['age'],
          message: 'Number must be greater than 0',
        }),
      ];

      const error = createValidationError({
        code: 'schema_validation',
        message: 'Schema validation failed',
        issues: zodIssues,
        suggestions: ['Check field types', 'Validate input ranges'],
      });

      generateFieldCorrections.mockReturnValue(['Fix name to be string', 'Fix age to be positive']);

      const result = formatValidationErrorFeedback(error, 1);

      expect(result).toContain('Schema Validation Failed (Attempt 1)');
      expect(result).toContain('name: Expected string, received number');
      expect(result).toContain('age: Number must be greater than 0');
      expect(result).toContain('Specific Corrections Needed');
      expect(result).toContain('Fix name to be string');
      expect(result).toContain('Fix age to be positive');
      expect(result).toContain('General Suggestions');
      expect(result).toContain('Check field types');
      expect(result).toContain('Validate input ranges');
    });

    it('should format schema validation errors without corrections or suggestions', () => {
      const error = createValidationError({
        code: 'schema_validation',
        message: 'Schema validation failed',
        issues: [createZodIssue()],
      });

      generateFieldCorrections.mockReturnValue([]);

      const result = formatValidationErrorFeedback(error, 1);

      expect(result).toContain('Schema Validation Failed (Attempt 1)');
      expect(result).not.toContain('Specific Corrections Needed');
      expect(result).not.toContain('General Suggestions');
    });
  });

  describe('generic error formatting', () => {
    it('should format unknown error types with basic message', () => {
      const error = createValidationError({
        code: 'unknown_error',
        message: 'Unknown validation error occurred',
      });

      const result = formatValidationErrorFeedback(error, 1);

      expect(result).toBe('Validation Error: Unknown validation error occurred');
    });
  });
});

describe('formatJsonParseErrorFeedback', () => {
  it('should format first attempt with basic instructions', () => {
    const error = createValidationError({
      code: 'json_parse',
      message: 'Unexpected token',
    });

    const result = formatJsonParseErrorFeedback(error, 1);

    expect(result).toContain('JSON Parsing Error: Unexpected token');
    expect(result).toContain('The response must be valid JSON');
    expect(result).not.toContain('🚨');
    expect(result).not.toContain('⚠️');
  });

  it('should format second attempt with warning', () => {
    const error = createValidationError({
      code: 'json_parse',
      message: 'Invalid JSON syntax',
    });

    const result = formatJsonParseErrorFeedback(error, 2);

    expect(result).toContain('⚠️ IMPORTANT: JSON Parsing Error');
    expect(result).toContain('The response must be valid JSON');
  });

  it('should format critical attempt with strong directives', () => {
    const error = createValidationError({
      code: 'json_parse',
      message: 'JSON parse error',
    });

    const result = formatJsonParseErrorFeedback(error, 3);

    expect(result).toContain('🚨 CRITICAL: JSON Parsing Error');
    expect(result).toContain('Your response MUST start with "{" and end with "}"');
    expect(result).toContain('No explanatory text before or after the JSON object');
  });
});

describe('formatSchemaValidationErrorFeedback', () => {
  beforeEach(() => {
    generateFieldCorrections.mockReturnValue([]);
  });

  it('should format schema validation with all components', () => {
    const zodIssues = [
      createZodIssue({
        path: ['user', 'name'],
        message: 'Required field is missing',
      }),
      createZodIssue({
        path: ['user', 'age'],
        message: 'Must be a positive number',
      }),
    ];

    const error = createValidationError({
      issues: zodIssues,
      suggestions: ['Add missing fields', 'Check data types'],
    });

    generateFieldCorrections.mockReturnValue(['Add user.name as string', 'Set user.age as positive number']);

    const result = formatSchemaValidationErrorFeedback(error, 2);

    expect(result).toContain('Schema Validation Failed (Attempt 2)');
    expect(result).toContain('user.name: Required field is missing');
    expect(result).toContain('user.age: Must be a positive number');
    expect(result).toContain('Specific Corrections Needed');
    expect(result).toContain('Add user.name as string');
    expect(result).toContain('Set user.age as positive number');
    expect(result).toContain('General Suggestions');
    expect(result).toContain('Add missing fields');
    expect(result).toContain('Check data types');
  });

  it('should format final attempt with critical warning', () => {
    const error = createValidationError({
      issues: [createZodIssue()],
    });

    const result = formatSchemaValidationErrorFeedback(error, 3);

    expect(result).toContain('🚨 CRITICAL: This is your final attempt');
    expect(result).toContain('Please follow the corrections exactly');
  });

  it('should handle empty issues array', () => {
    const error = createValidationError({
      issues: [],
      suggestions: ['General suggestion'],
    });

    const result = formatSchemaValidationErrorFeedback(error, 1);

    expect(result).toContain('Schema Validation Failed (Attempt 1)');
    expect(result).toContain('General Suggestions');
    expect(result).toContain('General suggestion');
  });

  it('should handle missing issues and suggestions', () => {
    const error = createValidationError({
      issues: undefined,
      suggestions: undefined,
    });

    const result = formatSchemaValidationErrorFeedback(error, 1);

    expect(result).toContain('Schema Validation Failed (Attempt 1)');
    expect(result).not.toContain('Specific Corrections Needed');
    expect(result).not.toContain('General Suggestions');
  });
});

describe('generateUrgencyPrefix', () => {
  it('should return empty string for first attempt', () => {
    const result = generateUrgencyPrefix(1);
    expect(result).toBe('');
  });

  it('should return warning prefix for second attempt', () => {
    const result = generateUrgencyPrefix(2);
    expect(result).toBe('⚠️ IMPORTANT: ');
  });

  it('should return critical prefix for third and later attempts', () => {
    expect(generateUrgencyPrefix(3)).toBe('🚨 CRITICAL: ');
    expect(generateUrgencyPrefix(4)).toBe('🚨 CRITICAL: ');
    expect(generateUrgencyPrefix(10)).toBe('🚨 CRITICAL: ');
  });
});

describe('formatValidationIssues', () => {
  it('should format issues with field paths', () => {
    const issues = [
      createZodIssue({
        path: ['user', 'profile', 'name'],
        message: 'Name is required',
      }),
      createZodIssue({
        path: ['settings', 'theme'],
        message: 'Invalid theme value',
      }),
    ];

    const result = formatValidationIssues(issues);

    expect(result).toContain('user.profile.name: Name is required');
    expect(result).toContain('settings.theme: Invalid theme value');
  });

  it('should handle root-level issues', () => {
    const issues = [
      createZodIssue({
        path: [],
        message: 'Root validation failed',
      }),
    ];

    const result = formatValidationIssues(issues);

    expect(result).toContain('root: Root validation failed');
  });

  it('should handle empty issues array', () => {
    const result = formatValidationIssues([]);
    expect(result).toBe('');
  });

  it('should format single field issues', () => {
    const issues = [
      createZodIssue({
        path: ['email'],
        message: 'Invalid email format',
      }),
    ];

    const result = formatValidationIssues(issues);

    expect(result).toBe('  • email: Invalid email format');
  });

  it('should handle complex nested paths', () => {
    const issues = [
      createZodIssue({
        path: ['data', 'items', '0', 'attributes', 'value'],
        message: 'Value must be positive',
      }),
    ];

    const result = formatValidationIssues(issues);

    expect(result).toContain('data.items.0.attributes.value: Value must be positive');
  });
});

describe('formatFieldCorrections', () => {
  it('should format corrections with bullet points', () => {
    const corrections = [
      'Change name to a string value',
      'Set age to a positive number',
      'Add required email field',
    ];

    const result = formatFieldCorrections(corrections);

    expect(result).toContain('Specific Corrections Needed:');
    expect(result).toContain('  • Change name to a string value');
    expect(result).toContain('  • Set age to a positive number');
    expect(result).toContain('  • Add required email field');
  });

  it('should return empty string for empty corrections', () => {
    const result = formatFieldCorrections([]);
    expect(result).toBe('');
  });

  it('should handle single correction', () => {
    const corrections = ['Fix the data type'];

    const result = formatFieldCorrections(corrections);

    expect(result).toContain('Specific Corrections Needed:');
    expect(result).toContain('  • Fix the data type');
  });
});

describe('formatSuggestionsList', () => {
  it('should format suggestions with bullet points', () => {
    const suggestions = [
      'Check all field types carefully',
      'Ensure required fields are included',
      'Validate data ranges and constraints',
    ];

    const result = formatSuggestionsList(suggestions);

    expect(result).toContain('General Suggestions:');
    expect(result).toContain('  • Check all field types carefully');
    expect(result).toContain('  • Ensure required fields are included');
    expect(result).toContain('  • Validate data ranges and constraints');
  });

  it('should return empty string for empty suggestions', () => {
    const result = formatSuggestionsList([]);
    expect(result).toBe('');
  });

  it('should handle single suggestion', () => {
    const suggestions = ['Double-check the output format'];

    const result = formatSuggestionsList(suggestions);

    expect(result).toContain('General Suggestions:');
    expect(result).toContain('  • Double-check the output format');
  });
});

describe('generateAttemptSpecificInstructions', () => {
  describe('JSON parse error instructions', () => {
    it('should provide basic JSON instructions for early attempts', () => {
      const result = generateAttemptSpecificInstructions(1, 'json_parse');

      expect(result).toContain('The response must be valid JSON');
      expect(result).toContain('proper syntax with matching brackets, quotes, and commas');
    });

    it('should provide strict JSON instructions for final attempts', () => {
      const result = generateAttemptSpecificInstructions(3, 'json_parse');

      expect(result).toContain('Your response MUST start with "{" and end with "}"');
      expect(result).toContain('No explanatory text before or after the JSON object');
    });

    it('should escalate instructions for high attempt numbers', () => {
      const result = generateAttemptSpecificInstructions(5, 'json_parse');

      expect(result).toContain('Your response MUST start with "{" and end with "}"');
      expect(result).toContain('No explanatory text before or after the JSON object');
    });
  });

  describe('other error type instructions', () => {
    it('should provide generic instructions for non-JSON errors', () => {
      const result = generateAttemptSpecificInstructions(1, 'schema_validation');

      expect(result).toBe('Please follow the corrections exactly to produce valid output.');
    });

    it('should provide generic instructions for unknown error types', () => {
      const result = generateAttemptSpecificInstructions(2, 'unknown_error');

      expect(result).toBe('Please follow the corrections exactly to produce valid output.');
    });
  });
});

describe('generateFinalAttemptWarning', () => {
  it('should return warning for final attempt', () => {
    const result = generateFinalAttemptWarning(3, 3);

    expect(result).toContain('🚨 CRITICAL: This is your final attempt');
    expect(result).toContain('Please follow the corrections exactly');
  });

  it('should return warning when at max attempts', () => {
    const result = generateFinalAttemptWarning(5, 5);

    expect(result).toContain('🚨 CRITICAL: This is your final attempt');
  });

  it('should return warning when exceeding max attempts', () => {
    const result = generateFinalAttemptWarning(4, 3);

    expect(result).toContain('🚨 CRITICAL: This is your final attempt');
  });

  it('should return empty string for non-final attempts', () => {
    expect(generateFinalAttemptWarning(1, 3)).toBe('');
    expect(generateFinalAttemptWarning(2, 3)).toBe('');
    expect(generateFinalAttemptWarning(2, 5)).toBe('');
  });
});

describe('formatGenericErrorFeedback', () => {
  it('should format generic error with attempt number', () => {
    const error = createValidationError({
      message: 'Generic validation error',
    });

    const result = formatGenericErrorFeedback(error, 1);

    expect(result).toBe('Validation Error (Attempt 1): Generic validation error');
  });

  it('should format generic error with urgency prefix', () => {
    const error = createValidationError({
      message: 'Critical validation error',
    });

    const result = formatGenericErrorFeedback(error, 3);

    expect(result).toBe('🚨 CRITICAL: Validation Error (Attempt 3): Critical validation error');
  });

  it('should format generic error with warning prefix', () => {
    const error = createValidationError({
      message: 'Important validation error',
    });

    const result = formatGenericErrorFeedback(error, 2);

    expect(result).toBe('⚠️ IMPORTANT: Validation Error (Attempt 2): Important validation error');
  });
});

describe('integration scenarios', () => {
  beforeEach(() => {
    generateFieldCorrections.mockReturnValue(['Field correction example']);
  });

  it('should provide comprehensive feedback for complex schema errors', () => {
    const zodIssues = [
      createZodIssue({
        path: ['user', 'email'],
        message: 'Invalid email format',
        code: 'invalid_string',
      }),
      createZodIssue({
        path: ['user', 'age'],
        message: 'Must be at least 18',
        code: 'too_small',
      }),
      createZodIssue({
        path: ['preferences', 'theme'],
        message: 'Must be one of: light, dark',
        code: 'invalid_enum_value',
      }),
    ];

    const error = createValidationError({
      code: 'schema_validation',
      issues: zodIssues,
      suggestions: [
        'Ensure email follows format user@domain.com',
        'Check that age meets minimum requirements',
        'Select valid theme option',
      ],
    });

    generateFieldCorrections.mockReturnValue([
      'Fix user.email to valid email format',
      'Set user.age to 18 or higher',
      'Choose theme from: light, dark',
    ]);

    const result = formatValidationErrorFeedback(error, 2);

    expect(result).toContain('Schema Validation Failed (Attempt 2)');
    expect(result).toContain('user.email: Invalid email format');
    expect(result).toContain('user.age: Must be at least 18');
    expect(result).toContain('preferences.theme: Must be one of: light, dark');
    expect(result).toContain('Specific Corrections Needed');
    expect(result).toContain('Fix user.email to valid email format');
    expect(result).toContain('General Suggestions');
    expect(result).toContain('Ensure email follows format user@domain.com');
  });

  it('should escalate urgency appropriately across attempts', () => {
    const error = createValidationError({
      code: 'json_parse',
      message: 'Invalid JSON',
    });

    const attempt1 = formatValidationErrorFeedback(error, 1);
    const attempt2 = formatValidationErrorFeedback(error, 2);
    const attempt3 = formatValidationErrorFeedback(error, 3);

    expect(attempt1).not.toContain('🚨');
    expect(attempt1).not.toContain('⚠️');
    expect(attempt1).toContain('The response must be valid JSON');

    expect(attempt2).toContain('⚠️ IMPORTANT');
    expect(attempt2).not.toContain('🚨 CRITICAL');

    expect(attempt3).toContain('🚨 CRITICAL');
    expect(attempt3).toContain('Your response MUST start with "{"');
  });
});