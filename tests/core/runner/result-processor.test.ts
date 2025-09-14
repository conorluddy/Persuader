/**
 * Tests for Result Processor
 *
 * Comprehensive tests for result processing, formatting, and metadata collection
 * including success/error handling and statistics extraction.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  formatResultMetadata,
  getExecutionStats,
  processResult,
} from '../../../src/core/runner/result-processor.js';
import type { ExecutionResult } from '../../../src/core/runner/execution-engine.js';
import type { ProviderAdapter, ValidationError, ProviderError } from '../../../src/types/index.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');

// Test fixtures
const testSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type TestOutput = z.infer<typeof testSchema>;

const createMockProvider = (overrides: Partial<ProviderAdapter> = {}): ProviderAdapter => ({
  name: 'test-provider',
  supportsSession: false,
  sendPrompt: vi.fn(),
  ...overrides,
});

const createSuccessfulExecutionResult = (
  overrides: Partial<ExecutionResult<TestOutput>> = {}
): ExecutionResult<TestOutput> => ({
  success: true,
  value: { name: 'John', age: 30 },
  attempts: 2,
  ...overrides,
});

const createFailedExecutionResult = (
  overrides: Partial<ExecutionResult<TestOutput>> = {}
): ExecutionResult<TestOutput> => ({
  success: false,
  attempts: 3,
  error: {
    type: 'validation',
    code: 'schema_mismatch',
    message: 'Schema validation failed',
    timestamp: new Date(),
    retryable: false,
    issues: [],
    rawValue: '{"invalid": true}',
    suggestions: ['Fix the schema'],
    failureMode: 'schema_confusion',
    retryStrategy: 'session_reset',
    structuredFeedback: {
      problemSummary: 'Schema mismatch',
      specificIssues: [],
      correctionInstructions: [],
    },
  },
  ...overrides,
});

describe('processResult', () => {
  let mockProvider: ProviderAdapter;
  let startTime: number;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = createMockProvider();
    startTime = Date.now() - 1500; // 1.5 seconds ago
  });

  describe('successful result processing', () => {
    it('should process successful execution result with session', () => {
      const executionResult = createSuccessfulExecutionResult();
      const sessionId = 'session-123';

      const result = processResult(
        executionResult,
        sessionId,
        startTime,
        mockProvider
      );

      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ name: 'John', age: 30 });
      expect(result.attempts).toBe(2);
      expect(result.sessionId).toBe('session-123');
      expect(result.error).toBeUndefined();

      // Check metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionTimeMs).toBeGreaterThan(0);
      expect(result.metadata.startedAt).toBeInstanceOf(Date);
      expect(result.metadata.completedAt).toBeInstanceOf(Date);
      expect(result.metadata.provider).toBe('test-provider');
    });

    it('should process successful execution result without session', () => {
      const executionResult = createSuccessfulExecutionResult();

      const result = processResult(
        executionResult,
        undefined,
        startTime,
        mockProvider
      );

      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ name: 'John', age: 30 });
      expect(result.sessionId).toBeUndefined();
    });

    it('should handle successful result with undefined value correctly', () => {
      const executionResult = createSuccessfulExecutionResult({
        value: undefined,
      });

      const result = processResult(
        executionResult,
        undefined,
        startTime,
        mockProvider
      );

      // Should be treated as failure when value is undefined
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.value).toBeUndefined();
    });

    it('should handle successful result with single attempt', () => {
      const executionResult = createSuccessfulExecutionResult({
        attempts: 1,
      });

      const result = processResult(
        executionResult,
        undefined,
        startTime,
        mockProvider
      );

      expect(result.ok).toBe(true);
      expect(result.attempts).toBe(1);
    });
  });

  describe('failed result processing', () => {
    it('should process failed execution result with validation error', () => {
      const executionResult = createFailedExecutionResult();
      const sessionId = 'failed-session';

      const result = processResult(
        executionResult,
        sessionId,
        startTime,
        mockProvider
      );

      expect(result.ok).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.attempts).toBe(3);
      expect(result.sessionId).toBe('failed-session');
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('validation');
      expect(result.error?.code).toBe('schema_mismatch');
    });

    it('should process failed execution result with provider error', () => {
      const providerError: ProviderError = {
        type: 'provider',
        code: 'provider_call_failed',
        message: 'Provider call failed',
        provider: 'test-provider',
        timestamp: new Date(),
        retryable: true,
        details: {},
      };

      const executionResult = createFailedExecutionResult({
        error: providerError,
      });

      const result = processResult(
        executionResult,
        undefined,
        startTime,
        mockProvider
      );

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('provider_call_failed');
    });

    it('should handle failed result without error object', () => {
      const executionResult = createFailedExecutionResult({
        error: undefined,
      });

      const result = processResult(
        executionResult,
        undefined,
        startTime,
        mockProvider
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('validation');
      expect(result.error?.code).toBe('unknown_error');
      expect(result.error?.message).toBe('Unknown error occurred during processing');
      expect(result.error?.retryable).toBe(false);
      expect(result.error?.suggestions).toContain('Please try again or contact support');
    });

    it('should process failed result without session', () => {
      const executionResult = createFailedExecutionResult();

      const result = processResult(
        executionResult,
        undefined,
        startTime,
        mockProvider
      );

      expect(result.ok).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });
  });

  describe('metadata creation', () => {
    it('should create accurate execution metadata', () => {
      const executionResult = createSuccessfulExecutionResult();
      const testStartTime = Date.now() - 2000; // 2 seconds ago

      const result = processResult(
        executionResult,
        undefined,
        testStartTime,
        mockProvider
      );

      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(1500);
      expect(result.metadata.startedAt.getTime()).toBe(testStartTime);
      expect(result.metadata.completedAt.getTime()).toBeGreaterThan(testStartTime);
      expect(result.metadata.provider).toBe('test-provider');
    });

    it('should handle very short execution times', () => {
      const executionResult = createSuccessfulExecutionResult();
      const recentStartTime = Date.now(); // Start right now

      const result = processResult(
        executionResult,
        undefined,
        recentStartTime,
        mockProvider
      );

      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.executionTimeMs).toBeLessThan(100); // Should be very fast
    });

    it('should include provider information correctly', () => {
      const customProvider = createMockProvider({
        name: 'custom-llm-provider',
      });

      const executionResult = createSuccessfulExecutionResult();

      const result = processResult(
        executionResult,
        undefined,
        startTime,
        customProvider
      );

      expect(result.metadata.provider).toBe('custom-llm-provider');
    });
  });
});

describe('getExecutionStats', () => {
  const mockMetadata = {
    executionTimeMs: 1500,
    startedAt: new Date(),
    completedAt: new Date(),
    provider: 'test-provider',
    model: 'test-model',
  };

  it('should extract stats from successful result', () => {
    const result = {
      ok: true,
      value: { name: 'John', age: 30 },
      attempts: 2,
      metadata: mockMetadata,
      sessionId: 'session-123',
    };

    const stats = getExecutionStats(result);

    expect(stats.successful).toBe(true);
    expect(stats.attempts).toBe(2);
    expect(stats.executionTime).toBe(1500);
    expect(stats.provider).toBe('test-provider');
    expect(stats.model).toBe('test-model');
    expect(stats.errorType).toBeUndefined();
    expect(stats.hasSession).toBe(true);
  });

  it('should extract stats from failed result', () => {
    const result = {
      ok: false,
      error: {
        type: 'validation' as const,
        code: 'schema_mismatch',
        message: 'Validation failed',
      } as ValidationError,
      attempts: 3,
      metadata: mockMetadata,
    };

    const stats = getExecutionStats(result);

    expect(stats.successful).toBe(false);
    expect(stats.attempts).toBe(3);
    expect(stats.executionTime).toBe(1500);
    expect(stats.provider).toBe('test-provider');
    expect(stats.model).toBe('test-model');
    expect(stats.errorType).toBe('validation');
    expect(stats.hasSession).toBe(false);
  });

  it('should handle result without model in metadata', () => {
    const metadataWithoutModel = {
      executionTimeMs: 1000,
      startedAt: new Date(),
      completedAt: new Date(),
      provider: 'provider-no-model',
    };

    const result = {
      ok: true,
      value: { data: 'test' },
      attempts: 1,
      metadata: metadataWithoutModel,
    };

    const stats = getExecutionStats(result);

    expect(stats.model).toBeUndefined();
    expect(stats.provider).toBe('provider-no-model');
  });

  it('should handle provider error stats', () => {
    const result = {
      ok: false,
      error: {
        type: 'provider' as const,
        code: 'rate_limited',
        message: 'Rate limit exceeded',
      } as ProviderError,
      attempts: 1,
      metadata: mockMetadata,
    };

    const stats = getExecutionStats(result);

    expect(stats.successful).toBe(false);
    expect(stats.errorType).toBe('provider');
  });
});

describe('formatResultMetadata', () => {
  const mockMetadata = {
    executionTimeMs: 1234,
    startedAt: new Date(),
    completedAt: new Date(),
    provider: 'format-provider',
  };

  it('should format successful result metadata', () => {
    const result = {
      ok: true,
      value: { name: 'Test' },
      attempts: 2,
      metadata: mockMetadata,
    };

    const formatted = formatResultMetadata(result);

    expect(formatted.duration).toBe('1234ms');
    expect(formatted.attempts).toBe(2);
    expect(formatted.provider).toBe('format-provider');
    expect(formatted.status).toBe('success');
    expect(formatted.errorSummary).toBeUndefined();
  });

  it('should format failed result metadata with error summary', () => {
    const result = {
      ok: false,
      error: {
        type: 'validation' as const,
        code: 'schema_mismatch',
        message: 'Schema validation failed',
      } as ValidationError,
      attempts: 3,
      metadata: mockMetadata,
    };

    const formatted = formatResultMetadata(result);

    expect(formatted.duration).toBe('1234ms');
    expect(formatted.attempts).toBe(3);
    expect(formatted.provider).toBe('format-provider');
    expect(formatted.status).toBe('error');
    expect(formatted.errorSummary).toBe('validation:schema_mismatch - Schema validation failed');
  });

  it('should format provider error summary', () => {
    const result = {
      ok: false,
      error: {
        type: 'provider' as const,
        code: 'authentication_failed',
        message: 'Invalid API key',
      } as ProviderError,
      attempts: 1,
      metadata: mockMetadata,
    };

    const formatted = formatResultMetadata(result);

    expect(formatted.status).toBe('error');
    expect(formatted.errorSummary).toBe('provider:authentication_failed - Invalid API key');
  });

  it('should handle very short execution times', () => {
    const fastMetadata = { ...mockMetadata, executionTimeMs: 42 };
    const result = {
      ok: true,
      value: { fast: true },
      attempts: 1,
      metadata: fastMetadata,
    };

    const formatted = formatResultMetadata(result);

    expect(formatted.duration).toBe('42ms');
  });

  it('should handle very long execution times', () => {
    const slowMetadata = { ...mockMetadata, executionTimeMs: 45000 };
    const result = {
      ok: true,
      value: { slow: true },
      attempts: 5,
      metadata: slowMetadata,
    };

    const formatted = formatResultMetadata(result);

    expect(formatted.duration).toBe('45000ms');
  });

  it('should handle zero execution time', () => {
    const zeroMetadata = { ...mockMetadata, executionTimeMs: 0 };
    const result = {
      ok: true,
      value: { instant: true },
      attempts: 1,
      metadata: zeroMetadata,
    };

    const formatted = formatResultMetadata(result);

    expect(formatted.duration).toBe('0ms');
  });
});

describe('edge cases and error conditions', () => {
  const mockProvider = createMockProvider();
  const startTime = Date.now() - 1000;

  it('should handle null/undefined execution results gracefully', () => {
    const malformedResult = {
      success: false,
      attempts: 0,
    } as any;

    const result = processResult(
      malformedResult,
      undefined,
      startTime,
      mockProvider
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle negative execution times', () => {
    const futureStartTime = Date.now() + 1000; // Start time in the future
    const executionResult = createSuccessfulExecutionResult();

    const result = processResult(
      executionResult,
      undefined,
      futureStartTime,
      mockProvider
    );

    // Should still work, just with unusual timing
    expect(result.metadata.executionTimeMs).toBeDefined();
  });

  it('should preserve all error details in fallback error', () => {
    const executionResult = {
      success: false,
      attempts: 1,
      error: undefined,
    };

    const result = processResult(
      executionResult,
      undefined,
      startTime,
      mockProvider
    );

    const fallbackError = result.error as ValidationError;
    expect(fallbackError.type).toBe('validation');
    expect(fallbackError.code).toBe('unknown_error');
    expect(fallbackError.retryable).toBe(false);
    expect(fallbackError.issues).toEqual([]);
    expect(fallbackError.suggestions).toContain('Please try again or contact support');
    expect(fallbackError.structuredFeedback).toBeDefined();
    expect(fallbackError.structuredFeedback.problemSummary).toBe(
      'Unknown error occurred during processing'
    );
  });
});