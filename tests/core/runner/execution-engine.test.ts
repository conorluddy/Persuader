/**
 * Tests for Execution Engine
 *
 * Comprehensive tests for the core execution logic including prompt building,
 * provider calls, validation, and retry mechanisms.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { executeWithRetry } from '../../../src/core/runner/execution-engine.js';
import type { ProcessedConfiguration } from '../../../src/core/runner/configuration-manager.js';
import type { ProviderAdapter, ProviderResponse, ValidationError } from '../../../src/types/index.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');
vi.mock('../../../src/core/prompt.js');
vi.mock('../../../src/core/retry.js');
vi.mock('../../../src/core/validation.js');

// Import mocked modules for type safety
import * as promptModule from '../../../src/core/prompt.js';
import * as retryModule from '../../../src/core/retry.js';
import * as validationModule from '../../../src/core/validation.js';

const buildPrompt = vi.mocked(promptModule.buildPrompt);
const combinePromptParts = vi.mocked(promptModule.combinePromptParts);
const augmentPromptWithErrors = vi.mocked(promptModule.augmentPromptWithErrors);
const retryWithFeedback = vi.mocked(retryModule.retryWithFeedback);
const validateJson = vi.mocked(validationModule.validateJson);
const formatValidationErrorFeedback = vi.mocked(validationModule.formatValidationErrorFeedback);

// Test fixtures
const testSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type TestOutput = z.infer<typeof testSchema>;

const createMockConfig = (overrides: Partial<ProcessedConfiguration<TestOutput>> = {}): ProcessedConfiguration<TestOutput> => ({
  schema: testSchema,
  input: 'test input',
  retries: 2,
  model: 'test-model',
  providerOptions: {
    maxTokens: 1000,
    temperature: 0.7,
  },
  ...overrides,
});

const createMockProvider = (overrides: Partial<ProviderAdapter> = {}): ProviderAdapter => ({
  name: 'test-provider',
  supportsSession: false,
  sendPrompt: vi.fn(),
  ...overrides,
});

const createMockProviderResponse = (overrides: Partial<ProviderResponse> = {}): ProviderResponse => ({
  content: '{"name": "John", "age": 25}',
  tokenUsage: {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
  },
  ...overrides,
});

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    buildPrompt.mockReturnValue({
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt',
      instructions: 'Instructions',
    });
    
    combinePromptParts.mockReturnValue('Combined prompt');
    
    validateJson.mockReturnValue({
      success: true,
      value: { name: 'John', age: 25 },
    });
    
    formatValidationErrorFeedback.mockReturnValue('Error feedback');
    augmentPromptWithErrors.mockReturnValue({
      systemPrompt: 'System prompt with errors',
      userPrompt: 'User prompt with errors',
      instructions: 'Instructions with errors',
    });
  });

  describe('successful execution', () => {
    it('should execute successfully on first attempt', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: true,
          value: result.value,
          attempts: 1,
        };
      });

      const result = await executeWithRetry(config, provider);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({ name: 'John', age: 25 });
      expect(result.attempts).toBe(1);
      expect(provider.sendPrompt).toHaveBeenCalledOnce();
      expect(buildPrompt).toHaveBeenCalledWith({
        schema: testSchema,
        input: 'test input',
      });
    });

    it('should execute with context and lens', async () => {
      const config = createMockConfig({
        context: 'Test context',
        lens: 'Test lens',
        exampleOutput: { name: 'Example', age: 30 },
      });
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: true,
          value: result.value,
          attempts: 1,
        };
      });

      await executeWithRetry(config, provider);

      expect(buildPrompt).toHaveBeenCalledWith({
        schema: testSchema,
        input: 'test input',
        context: 'Test context',
        lens: 'Test lens',
        exampleOutput: { name: 'Example', age: 30 },
      });
    });

    it('should pass provider options correctly', async () => {
      const config = createMockConfig({
        model: 'custom-model',
        providerOptions: {
          maxTokens: 2000,
          temperature: 0.3,
          customOption: 'test',
        },
      });
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: true,
          value: result.value,
          attempts: 1,
        };
      });

      await executeWithRetry(config, provider, 'session-123');

      expect(provider.sendPrompt).toHaveBeenCalledWith(
        'session-123',
        'Combined prompt',
        {
          maxTokens: 2000,
          temperature: 0.3,
          customOption: 'test',
          model: 'custom-model',
        }
      );
    });
  });

  describe('retry mechanisms', () => {
    it('should retry on validation failure with feedback', async () => {
      const config = createMockConfig({ retries: 2 });
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      const validationError: ValidationError = {
        type: 'validation',
        code: 'schema_mismatch',
        message: 'Schema mismatch',
        timestamp: new Date(),
        retryable: true,
        issues: [],
        rawValue: '{"invalid": true}',
        suggestions: ['Fix the schema'],
        failureMode: 'schema_confusion',
        retryStrategy: 'demand_json_format',
        structuredFeedback: {
          problemSummary: 'Schema mismatch',
          specificIssues: [],
          correctionInstructions: [],
        },
      };

      retryWithFeedback.mockImplementation(async ({ operation }) => {
        // Simulate: first attempt fails, second succeeds
        await operation(1); // First attempt - fails validation
        const secondResult = await operation(2, validationError); // Second attempt - succeeds
        return {
          success: true,
          value: secondResult.value,
          attempts: 2,
        };
      });

      // First attempt fails validation, second succeeds
      validateJson
        .mockReturnValueOnce({
          success: false,
          error: validationError,
        })
        .mockReturnValueOnce({
          success: true,
          value: { name: 'John', age: 25 },
        });

      const result = await executeWithRetry(config, provider);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(formatValidationErrorFeedback).toHaveBeenCalledWith(validationError, 2);
      expect(augmentPromptWithErrors).toHaveBeenCalledWith(
        expect.any(Object),
        'Error feedback'
      );
    });

    it('should build progressive prompts on retry attempts', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);

      const validationError: ValidationError = {
        type: 'validation',
        code: 'invalid_json',
        message: 'Invalid JSON',
        timestamp: new Date(),
        retryable: true,
        issues: [],
        rawValue: 'invalid json',
        suggestions: [],
        failureMode: 'format_confusion',
        retryStrategy: 'demand_json_format',
        structuredFeedback: {
          problemSummary: 'Invalid JSON',
          specificIssues: [],
          correctionInstructions: [],
        },
      };

      retryWithFeedback.mockImplementation(async ({ operation }) => {
        await operation(2, validationError);
        return {
          success: true,
          value: { name: 'John', age: 25 },
          attempts: 2,
        };
      });

      await executeWithRetry(config, provider);

      // Should call buildPrompt twice: once for initial, once for retry
      expect(buildPrompt).toHaveBeenCalledTimes(2);
      
      // Second call should include attemptNumber
      expect(buildPrompt).toHaveBeenNthCalledWith(2, {
        schema: testSchema,
        input: 'test input',
        attemptNumber: 2,
      });
    });
  });

  describe('provider error handling', () => {
    it('should handle provider call failures', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const providerError = new Error('Network error');
      
      provider.sendPrompt = vi.fn().mockRejectedValue(providerError);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: false,
          error: result.error,
          attempts: 1,
        };
      });

      const result = await executeWithRetry(config, provider);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('provider_call_failed');
      expect(result.error?.message).toContain('Network error');
    });

    it('should handle empty provider responses', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse({
        content: '',
      });
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      validateJson.mockReturnValue({
        success: false,
        error: {
          type: 'validation',
          code: 'empty_response',
          message: 'Empty response',
          timestamp: new Date(),
          retryable: true,
          issues: [],
          rawValue: '',
          suggestions: [],
          failureMode: 'empty_response',
          retryStrategy: 'demand_json_format',
          structuredFeedback: {
            problemSummary: 'Empty response',
            specificIssues: [],
            correctionInstructions: [],
          },
        },
      });

      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: false,
          error: result.error,
          attempts: 1,
        };
      });

      const result = await executeWithRetry(config, provider);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.error?.code).toBe('empty_response');
    });
  });

  describe('session handling', () => {
    it('should pass session ID to provider when provided', async () => {
      const config = createMockConfig();
      const provider = createMockProvider({ supportsSession: true });
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: true,
          value: result.value,
          attempts: 1,
        };
      });

      await executeWithRetry(config, provider, 'test-session-id');

      expect(provider.sendPrompt).toHaveBeenCalledWith(
        'test-session-id',
        'Combined prompt',
        expect.any(Object)
      );
    });

    it('should work without session ID', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: true,
          value: result.value,
          attempts: 1,
        };
      });

      await executeWithRetry(config, provider);

      expect(provider.sendPrompt).toHaveBeenCalledWith(
        null,
        'Combined prompt',
        expect.any(Object)
      );
    });
  });

  describe('error edge cases', () => {
    it('should handle unknown validation errors gracefully', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse();
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      // Create minimal error that doesn't match the expected validation error structure
      const malformedError = {
        type: 'unknown',
        message: 'Malformed error',
      } as any;
      
      validateJson.mockReturnValue({
        success: false,
        error: malformedError,
      });

      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: false,
          error: result.error,
          attempts: 1,
        };
      });

      const result = await executeWithRetry(config, provider);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('unknown');  // Should pass through the malformed error
      expect(result.error?.message).toBe('Malformed error');
    });

    it('should handle prompt building failures', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      
      buildPrompt.mockImplementation(() => {
        throw new Error('Prompt building failed');
      });

      await expect(executeWithRetry(config, provider)).rejects.toThrow('Prompt building failed');
    });
  });

  describe('token usage tracking', () => {
    it('should handle responses with token usage information', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse({
        tokenUsage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        },
      });
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: true,
          value: result.value,
          attempts: 1,
        };
      });

      const result = await executeWithRetry(config, provider);

      expect(result.success).toBe(true);
      expect(provider.sendPrompt).toHaveBeenCalledOnce();
    });

    it('should handle responses without token usage information', async () => {
      const config = createMockConfig();
      const provider = createMockProvider();
      const mockResponse = createMockProviderResponse({
        tokenUsage: undefined,
      });
      
      provider.sendPrompt = vi.fn().mockResolvedValue(mockResponse);
      
      retryWithFeedback.mockImplementation(async ({ operation }) => {
        const result = await operation(1);
        return {
          success: true,
          value: result.value,
          attempts: 1,
        };
      });

      const result = await executeWithRetry(config, provider);

      expect(result.success).toBe(true);
    });
  });
});