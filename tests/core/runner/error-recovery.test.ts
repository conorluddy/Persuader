/**
 * Tests for Error Recovery
 *
 * Comprehensive tests for error analysis, classification, and recovery strategy
 * recommendations for both provider and validation errors.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeErrorRecovery,
  classifyError,
  logErrorRecoveryAnalysis,
} from '../../../src/core/runner/error-recovery.js';
import type { ProviderAdapter, ProviderError, ValidationError } from '../../../src/types/index.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');

const createMockProvider = (overrides: Partial<ProviderAdapter> = {}): ProviderAdapter => ({
  name: 'test-provider',
  supportsSession: false,
  sendPrompt: vi.fn(),
  ...overrides,
});

const createProviderError = (overrides: Partial<ProviderError> = {}): ProviderError => ({
  type: 'provider',
  code: 'provider_call_failed',
  message: 'Provider call failed',
  provider: 'test-provider',
  timestamp: new Date(),
  retryable: true,
  ...overrides,
});

const createValidationError = (overrides: Partial<ValidationError> = {}): ValidationError => ({
  type: 'validation',
  code: 'schema_mismatch',
  message: 'Schema validation failed',
  timestamp: new Date(),
  retryable: true,
  issues: [],
  rawValue: '{"invalid": true}',
  suggestions: ['Fix the schema'],
  failureMode: 'schema_confusion',
  retryStrategy: 'add_examples',
  structuredFeedback: {
    problemSummary: 'Schema mismatch',
    specificIssues: [],
    correctionInstructions: [],
  },
  ...overrides,
});

describe('analyzeErrorRecovery', () => {
  let provider: ProviderAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createMockProvider();
  });

  describe('provider error recovery', () => {
    it('should recommend configuration change for session creation failures', () => {
      const error = createProviderError({
        code: 'session_creation_failed',
        message: 'Failed to create session',
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('configuration_change');
      expect(result.reason).toBe('Session management issue detected');
      expect(result.suggestions).toContain('Disable session usage by not providing sessionId');
      expect(result.retryable).toBe(false);
    });

    it('should recommend configuration change for unsupported sessions', () => {
      const error = createProviderError({
        code: 'session_not_supported',
        message: 'Provider does not support sessions',
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('configuration_change');
      expect(result.reason).toBe('Session management issue detected');
      expect(result.suggestions).toContain('Verify provider session support capabilities');
      expect(result.retryable).toBe(false);
    });

    it('should recommend retry for rate limiting', () => {
      const error = createProviderError({
        code: 'rate_limited',
        message: 'Rate limit exceeded',
      });

      const result = analyzeErrorRecovery(error, provider, 2);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('Transient provider issue - retry with backoff');
      expect(result.suggestions).toContain('Wait before retrying to respect rate limits');
      expect(result.retryable).toBe(true);
    });

    it('should recommend retry for provider unavailability', () => {
      const error = createProviderError({
        code: 'provider_unavailable',
        message: 'Provider service unavailable',
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('Transient provider issue - retry with backoff');
      expect(result.suggestions).toContain('Check provider status page for ongoing issues');
      expect(result.retryable).toBe(true);
    });

    it('should recommend manual intervention for authentication failures', () => {
      const error = createProviderError({
        code: 'authentication_failed',
        message: 'Invalid API key',
        retryable: false,
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('manual_intervention');
      expect(result.reason).toBe('Provider configuration or authentication issue');
      expect(result.suggestions).toContain('Verify API keys and authentication credentials');
      expect(result.retryable).toBe(false);
    });

    it('should recommend manual intervention for configuration errors', () => {
      const error = createProviderError({
        code: 'invalid_configuration',
        message: 'Invalid provider configuration',
        retryable: false,
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('manual_intervention');
      expect(result.reason).toBe('Provider configuration or authentication issue');
      expect(result.suggestions).toContain('Check provider configuration settings');
      expect(result.retryable).toBe(false);
    });

    it('should recommend retry for generic provider failures on early attempts', () => {
      const error = createProviderError({
        code: 'provider_call_failed',
        message: 'Network error',
      });

      const result = analyzeErrorRecovery(error, provider, 2);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('Transient provider communication failure');
      expect(result.suggestions).toContain('Retry with exponential backoff');
      expect(result.retryable).toBe(true);
    });

    it('should recommend manual intervention for persistent provider failures', () => {
      const error = createProviderError({
        code: 'provider_call_failed',
        message: 'Persistent network error',
      });

      const result = analyzeErrorRecovery(error, provider, 4); // High attempt number

      expect(result.strategy).toBe('manual_intervention');
      expect(result.reason).toBe('Unrecognized provider error requires investigation');
      expect(result.suggestions).toContain('Consider switching to an alternative provider');
      expect(result.retryable).toBe(false);
    });
  });

  describe('validation error recovery', () => {
    it('should recommend session reset for persistent validation failures with session support', () => {
      const sessionProvider = createMockProvider({ supportsSession: true });
      const error = createValidationError({
        code: 'validation_failed',
        message: 'Multiple validation failures',
      });

      const result = analyzeErrorRecovery(error, sessionProvider, 4);

      expect(result.strategy).toBe('session_reset');
      expect(result.reason).toBe('Multiple validation failures suggest context confusion');
      expect(result.suggestions).toContain('Reset session to clear potentially confusing context');
      expect(result.retryable).toBe(true);
    });

    it('should recommend configuration change for persistent failures without session support', () => {
      const error = createValidationError({
        code: 'validation_failed',
        message: 'Multiple validation failures',
      });

      const result = analyzeErrorRecovery(error, provider, 5);

      expect(result.strategy).toBe('configuration_change');
      expect(result.reason).toBe('Multiple validation failures without session support');
      expect(result.suggestions).toContain('Review and simplify schema definition');
      expect(result.retryable).toBe(false);
    });

    it('should recommend retry for errors with clear feedback strategies', () => {
      const error = createValidationError({
        code: 'schema_mismatch',
        retryStrategy: 'add_examples',
        suggestions: ['Add more examples', 'Clarify schema'],
      });

      const result = analyzeErrorRecovery(error, provider, 2);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('Validation error with clear feedback - retry with guidance');
      expect(result.suggestions).toEqual(['Add more examples', 'Clarify schema']);
      expect(result.retryable).toBe(true);
    });

    it('should recommend retry for demand_json_format strategy', () => {
      const error = createValidationError({
        retryStrategy: 'demand_json_format',
        suggestions: ['Ensure valid JSON format'],
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('Validation error with clear feedback - retry with guidance');
      expect(result.suggestions).toEqual(['Ensure valid JSON format']);
      expect(result.retryable).toBe(true);
    });

    it('should recommend retry for JSON parsing errors', () => {
      const error = createValidationError({
        code: 'invalid_json',
        message: 'Invalid JSON format',
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('Structural output error - retry with format clarification');
      expect(result.suggestions).toContain('Emphasize JSON format requirements in prompt');
      expect(result.retryable).toBe(true);
    });

    it('should recommend retry for schema mismatch errors', () => {
      const error = createValidationError({
        code: 'schema_mismatch',
        message: 'Schema validation failed',
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('Structural output error - retry with format clarification');
      expect(result.suggestions).toContain('Provide concrete output examples');
      expect(result.retryable).toBe(true);
    });

    it('should handle general validation errors with fallback strategy', () => {
      const error = createValidationError({
        code: 'validation_failed',
        retryStrategy: 'retry_unchanged',
      });

      const result = analyzeErrorRecovery(error, provider, 1);

      expect(result.strategy).toBe('retry');
      expect(result.reason).toBe('General validation failure - attempt retry with feedback');
      expect(result.suggestions).toContain('Review validation error details');
      expect(result.retryable).toBe(true);
    });
  });

  describe('unknown error types', () => {
    it('should handle unknown error types with manual intervention', () => {
      const unknownError = {
        type: 'unknown',
        code: 'unknown_code',
        message: 'Unknown error',
        timestamp: new Date(),
        retryable: false,
      } as any;

      const result = analyzeErrorRecovery(unknownError, provider, 1);

      expect(result.strategy).toBe('manual_intervention');
      expect(result.reason).toBe('Unknown error type requires manual analysis');
      expect(result.suggestions).toContain('Check error logs for additional context');
      expect(result.retryable).toBe(false);
    });
  });
});

describe('classifyError', () => {
  describe('provider error classification', () => {
    it('should classify rate limiting as low severity transient', () => {
      const error = createProviderError({
        code: 'rate_limited',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('low');
      expect(result.category).toBe('transient');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify provider unavailable as low severity transient', () => {
      const error = createProviderError({
        code: 'provider_unavailable',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('low');
      expect(result.category).toBe('transient');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify session failures as medium severity provider issues', () => {
      const error = createProviderError({
        code: 'session_creation_failed',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('provider');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify provider call failures as medium severity provider issues', () => {
      const error = createProviderError({
        code: 'provider_call_failed',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('provider');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify authentication failures as high severity configuration issues', () => {
      const error = createProviderError({
        code: 'authentication_failed',
        retryable: false,
      });

      const result = classifyError(error);

      expect(result.severity).toBe('high');
      expect(result.category).toBe('configuration');
      expect(result.recoverable).toBe(false);
      expect(result.userActionRequired).toBe(true);
    });

    it('should classify configuration errors as high severity configuration issues', () => {
      const error = createProviderError({
        code: 'invalid_configuration',
        retryable: false,
      });

      const result = classifyError(error);

      expect(result.severity).toBe('high');
      expect(result.category).toBe('configuration');
      expect(result.recoverable).toBe(false);
      expect(result.userActionRequired).toBe(true);
    });

    it('should use error retryable flag for unknown provider error codes', () => {
      const retryableError = createProviderError({
        code: 'unknown_provider_error',
        retryable: true,
      });

      const result = classifyError(retryableError);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('provider');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should handle non-retryable unknown provider errors', () => {
      const nonRetryableError = createProviderError({
        code: 'unknown_provider_error',
        retryable: false,
      });

      const result = classifyError(nonRetryableError);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('provider');
      expect(result.recoverable).toBe(false);
      expect(result.userActionRequired).toBe(true);
    });
  });

  describe('validation error classification', () => {
    it('should classify JSON errors as medium severity transient', () => {
      const error = createValidationError({
        code: 'invalid_json',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('transient');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify empty responses as medium severity transient', () => {
      const error = createValidationError({
        code: 'empty_response',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('transient');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify schema mismatches as medium severity provider issues', () => {
      const error = createValidationError({
        code: 'schema_mismatch',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('provider');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify general validation failures as medium severity provider issues', () => {
      const error = createValidationError({
        code: 'validation_failed',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('provider');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify context confusion as low severity transient', () => {
      const error = createValidationError({
        code: 'context_confusion',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('low');
      expect(result.category).toBe('transient');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should classify format confusion as low severity transient', () => {
      const error = createValidationError({
        code: 'format_confusion',
      });

      const result = classifyError(error);

      expect(result.severity).toBe('low');
      expect(result.category).toBe('transient');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });

    it('should use error retryable flag for unknown validation error codes', () => {
      const retryableError = createValidationError({
        code: 'unknown_validation_error',
        retryable: true,
      });

      const result = classifyError(retryableError);

      expect(result.severity).toBe('medium');
      expect(result.category).toBe('system');
      expect(result.recoverable).toBe(true);
      expect(result.userActionRequired).toBe(false);
    });
  });

  describe('unknown error types', () => {
    it('should classify unknown error types as critical system issues', () => {
      const unknownError = {
        type: 'unknown',
        code: 'unknown_code',
        message: 'Unknown error',
        timestamp: new Date(),
        retryable: false,
      } as any;

      const result = classifyError(unknownError);

      expect(result.severity).toBe('critical');
      expect(result.category).toBe('system');
      expect(result.recoverable).toBe(false);
      expect(result.userActionRequired).toBe(true);
    });
  });
});

describe('logErrorRecoveryAnalysis', () => {
  it('should log comprehensive error recovery analysis', () => {
    const error = createValidationError({
      code: 'schema_mismatch',
      message: 'Schema validation failed',
    });

    const strategy = {
      strategy: 'retry' as const,
      reason: 'Validation error with clear feedback',
      suggestions: ['Fix schema', 'Add examples'],
      retryable: true,
    };

    const classification = {
      severity: 'medium' as const,
      category: 'provider' as const,
      recoverable: true,
      userActionRequired: false,
    };

    // Should not throw
    expect(() => {
      logErrorRecoveryAnalysis(error, strategy, classification);
    }).not.toThrow();
  });

  it('should handle provider errors in logging', () => {
    const error = createProviderError({
      code: 'authentication_failed',
      message: 'Invalid API key',
    });

    const strategy = {
      strategy: 'manual_intervention' as const,
      reason: 'Authentication issue',
      suggestions: ['Check API key'],
      retryable: false,
    };

    const classification = {
      severity: 'high' as const,
      category: 'configuration' as const,
      recoverable: false,
      userActionRequired: true,
    };

    // Should not throw
    expect(() => {
      logErrorRecoveryAnalysis(error, strategy, classification);
    }).not.toThrow();
  });
});