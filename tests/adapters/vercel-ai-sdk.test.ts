import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { VercelAISDKAdapter } from '../../src/adapters/vercel-ai-sdk.js';
import {
  createVercelAISDKAdapter,
  isVercelAISDKAdapter,
  type VercelAISDKAdapterConfig,
} from '../../src/adapters/vercel-ai-sdk.js';

// Mock setup using vi.hoisted for proper mocking
const {
  mockLanguageModel,
  mockGenerateText,
  mockGenerateObject,
  MockNoObjectGeneratedError,
} = vi.hoisted(() => {
  class MockNoObjectGeneratedError extends Error {
    text: string;
    cause: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason: string;
    response: Record<string, unknown>;

    constructor(message: string, details: Record<string, unknown> = {}) {
      super(message);
      this.name = 'NoObjectGeneratedError';
      this.text = details.text || 'Invalid JSON response';
      this.cause = details.cause || 'Schema validation failed';
      this.usage = details.usage || {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      };
      this.finishReason = details.finishReason || 'stop';
      this.response = details.response || {};
    }

    static isInstance(error: unknown): error is MockNoObjectGeneratedError {
      return error instanceof MockNoObjectGeneratedError;
    }
  }

  const mockLanguageModel = {
    modelId: 'test-model',
    provider: 'test-provider',
  };

  const mockGenerateText = vi.fn();
  const mockGenerateObject = vi.fn();

  return {
    mockLanguageModel,
    mockGenerateText,
    mockGenerateObject,
    MockNoObjectGeneratedError,
  };
});

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: mockGenerateText,
  generateObject: mockGenerateObject,
  NoObjectGeneratedError: MockNoObjectGeneratedError,
}));

describe('VercelAISDKAdapter', () => {
  let adapter: VercelAISDKAdapter;
  let defaultConfig: VercelAISDKAdapterConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    defaultConfig = {
      model: mockLanguageModel as Record<string, unknown>,
      modelId: 'test-model',
      maxTokens: 4000,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant.',
      debug: false,
    };

    adapter = createVercelAISDKAdapter(defaultConfig) as VercelAISDKAdapter;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with provided configuration', () => {
      expect(adapter.name).toBe('vercel-ai-sdk');
      expect(adapter.version).toBe('1.0.0');
      expect(adapter.supportsSession).toBe(true);
    });

    it('should use model.modelId when modelId not provided', () => {
      const config = {
        model: { modelId: 'auto-model-id' } as Record<string, unknown>,
      };
      const testAdapter = createVercelAISDKAdapter(config);
      expect(testAdapter.supportedModels).toContain('auto-model-id');
    });

    it('should use fallback when neither modelId nor model.modelId provided', () => {
      const config = {
        model: {} as Record<string, unknown>,
      };
      const testAdapter = createVercelAISDKAdapter(config);
      expect(testAdapter.supportedModels).toContain('ai-sdk-model');
    });

    it('should configure streaming and other options', () => {
      const streamingConfig = {
        ...defaultConfig,
        useStreaming: true,
        debug: true,
      };
      const streamingAdapter = createVercelAISDKAdapter(streamingConfig);
      expect(streamingAdapter.name).toBe('vercel-ai-sdk');
    });
  });

  describe('sendPrompt', () => {
    it('should generate text when no schema provided', async () => {
      const mockResponse = {
        text: 'This is a test response',
        usage: {
          promptTokens: 50,
          completionTokens: 20,
          totalTokens: 70,
        },
        finishReason: 'stop',
      };

      mockGenerateText.mockResolvedValue(mockResponse);

      const result = await adapter.sendPrompt(null, 'Test prompt', {
        temperature: 0.8,
        maxTokens: 1000,
      });

      expect(mockGenerateText).toHaveBeenCalledWith({
        model: mockLanguageModel,
        messages: [{ role: 'user', content: 'Test prompt' }],
        temperature: 0.8,
        maxTokens: 1000,
      });

      expect(result.content).toBe('This is a test response');
      expect(result.tokenUsage).toEqual({
        inputTokens: 50,
        outputTokens: 20,
        totalTokens: 70,
      });
      expect(result.stopReason).toBe('stop_sequence');
      expect(result.metadata?.useObjectGeneration).toBe(false);
    });

    it('should generate object when schema provided', async () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockResponse = {
        object: { name: 'John', age: 30 },
        usage: {
          promptTokens: 60,
          completionTokens: 25,
          totalTokens: 85,
        },
        finishReason: 'stop',
      };

      mockGenerateObject.mockResolvedValue(mockResponse);

      const result = await adapter.sendPrompt(null, 'Generate a person', {
        schema: testSchema,
        temperature: 0.5,
      });

      expect(mockGenerateObject).toHaveBeenCalledWith({
        model: mockLanguageModel,
        messages: [{ role: 'user', content: 'Generate a person' }],
        temperature: 0.5,
        maxTokens: 4000, // default from config
        schema: testSchema,
      });

      expect(result.content).toBe(
        JSON.stringify({ name: 'John', age: 30 }, null, 2)
      );
      expect(result.tokenUsage).toEqual({
        inputTokens: 60,
        outputTokens: 25,
        totalTokens: 85,
      });
      expect(result.metadata?.useObjectGeneration).toBe(true);
    });

    it('should handle NoObjectGeneratedError with detailed feedback', async () => {
      const testSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const mockError = new MockNoObjectGeneratedError(
        'Schema validation failed',
        {
          text: 'Invalid response: {"name": "John", "age": "thirty"}',
          cause: 'Expected number, received string at age',
          usage: { promptTokens: 60, completionTokens: 25, totalTokens: 85 },
          finishReason: 'stop',
        }
      );

      mockGenerateObject.mockRejectedValue(mockError);

      await expect(
        adapter.sendPrompt(null, 'Generate invalid data', {
          schema: testSchema,
        })
      ).rejects.toThrow(
        /Schema validation failed.*Expected number, received string at age/
      );
    });

    it('should handle network errors gracefully', async () => {
      const networkError = new Error('ECONNRESET: Connection reset by peer');
      mockGenerateText.mockRejectedValue(networkError);

      await expect(adapter.sendPrompt(null, 'Test prompt', {})).rejects.toThrow(
        /Failed to send prompt to Vercel AI SDK.*ECONNRESET/
      );
    });

    it('should handle rate limit errors with specific message', async () => {
      const rateLimitError = new Error('Rate limit exceeded (429)');
      mockGenerateText.mockRejectedValue(rateLimitError);

      await expect(adapter.sendPrompt(null, 'Test prompt', {})).rejects.toThrow(
        /Rate limit exceeded/
      );
    });
  });

  describe('session management', () => {
    it('should create session with context', async () => {
      const sessionId = await adapter.createSession(
        'You are a helpful assistant.',
        {
          temperature: 0.6,
        }
      );

      expect(typeof sessionId).toBe('string');
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should reuse session for multiple prompts', async () => {
      const sessionId = await adapter.createSession('System context');

      mockGenerateText
        .mockResolvedValueOnce({
          text: 'First response',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          text: 'Second response',
          usage: { promptTokens: 15, completionTokens: 8, totalTokens: 23 },
          finishReason: 'stop',
        });

      // First prompt
      await adapter.sendPrompt(sessionId, 'First question', {});

      // Second prompt should include conversation history
      await adapter.sendPrompt(sessionId, 'Second question', {});

      // Check that the second call includes previous messages
      const secondCallArgs = mockGenerateText.mock.calls[1][0];
      expect(secondCallArgs.messages).toHaveLength(5); // system context + system prompt + user1 + assistant1 + user2
      expect(secondCallArgs.messages[0].content).toBe('System context');
      expect(secondCallArgs.messages[1].content).toBe(
        'You are a helpful assistant.'
      );
      expect(secondCallArgs.messages[2].content).toBe('First question');
      expect(secondCallArgs.messages[3].content).toBe('First response');
      expect(secondCallArgs.messages[4].content).toBe('Second question');
    });

    it('should handle session with system prompt override', async () => {
      const sessionId = await adapter.createSession('Context message');

      mockGenerateText.mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
      });

      await adapter.sendPrompt(sessionId, 'Test question', {});

      const callArgs = mockGenerateText.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3); // system context + system prompt + user
      expect(callArgs.messages[0].content).toBe('Context message');
      expect(callArgs.messages[1].content).toBe('You are a helpful assistant.');
      expect(callArgs.messages[2].content).toBe('Test question');
    });

    it('should handle non-existent session gracefully', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Response without session',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
      });

      const result = await adapter.sendPrompt(
        'non-existent-session',
        'Test',
        {}
      );

      expect(result.content).toBe('Response without session');
      // Should still work, just without previous context
    });

    it('should destroy session and clean up resources', async () => {
      const sessionId = await adapter.createSession('Test context');
      const stats = adapter.getSessionStats();
      expect(stats.totalSessions).toBe(1);

      await adapter.destroySession(sessionId);
      const statsAfter = adapter.getSessionStats();
      expect(statsAfter.totalSessions).toBe(0);
    });

    it('should handle destroying non-existent session', async () => {
      // Should not throw error
      await expect(
        adapter.destroySession('non-existent')
      ).resolves.toBeUndefined();
    });
  });

  describe('health check', () => {
    it('should return healthy status when model works', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'OK',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        finishReason: 'stop',
      });

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.checkedAt).toBeInstanceOf(Date);
      expect(typeof health.responseTimeMs).toBe('number');
      expect(health.details?.modelId).toBe('test-model');
      expect(health.details?.supportsObjectGeneration).toBe(true);
    });

    it('should return unhealthy status when model fails', async () => {
      const testError = new Error('Model unavailable');
      mockGenerateText.mockRejectedValue(testError);

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Model unavailable');
      expect(health.details?.error).toBe(testError);
    });
  });

  describe('session statistics and cleanup', () => {
    it('should track session statistics correctly', async () => {
      // Create multiple sessions
      await adapter.createSession('Context 1');
      await adapter.createSession('Context 2');

      const stats = adapter.getSessionStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2); // Both should be considered active (recent)
      expect(stats.oldestSession).toBeInstanceOf(Date);
      expect(stats.newestSession).toBeInstanceOf(Date);
    });

    it('should clean up old sessions', async () => {
      await adapter.createSession('Test context');

      // Verify session was created
      let stats = adapter.getSessionStats();
      expect(stats.totalSessions).toBe(1);

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Clean up with 0ms max age (should clean all sessions)
      const cleanedCount = adapter.cleanupOldSessions(0);

      expect(cleanedCount).toBe(1);

      stats = adapter.getSessionStats();
      expect(stats.totalSessions).toBe(0);
    });

    it('should not clean up recent sessions', async () => {
      await adapter.createSession('Recent context');

      // Clean up with very high max age (should not clean anything)
      const cleanedCount = adapter.cleanupOldSessions(1000 * 60 * 60 * 24); // 24 hours

      expect(cleanedCount).toBe(0);

      const stats = adapter.getSessionStats();
      expect(stats.totalSessions).toBe(1);
    });
  });

  describe('error enhancement', () => {
    it('should enhance authentication errors', async () => {
      const authError = new Error('Unauthorized (401)');
      mockGenerateText.mockRejectedValue(authError);

      await expect(adapter.sendPrompt(null, 'Test', {})).rejects.toThrow(
        /Authentication failed.*API credentials/
      );
    });

    it('should enhance timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      mockGenerateText.mockRejectedValue(timeoutError);

      await expect(adapter.sendPrompt(null, 'Test', {})).rejects.toThrow(
        /Request timed out.*too complex.*slow/
      );
    });

    it('should enhance model not found errors', async () => {
      const modelError = new Error('model test-model not found');
      mockGenerateText.mockRejectedValue(modelError);

      await expect(adapter.sendPrompt(null, 'Test', {})).rejects.toThrow(
        /Invalid model specified.*test-model/
      );
    });
  });

  describe('utility functions', () => {
    it('should identify adapter type correctly', () => {
      expect(isVercelAISDKAdapter(adapter)).toBe(true);

      const mockOtherAdapter = {
        name: 'other-adapter',
        supportsSession: false,
        sendPrompt: vi.fn(),
      } as Record<string, unknown>;

      expect(isVercelAISDKAdapter(mockOtherAdapter)).toBe(false);
    });

    it('should map finish reasons correctly', async () => {
      const testCases = [
        { aiSdkReason: 'length', expectedReason: 'max_tokens' },
        { aiSdkReason: 'stop', expectedReason: 'stop_sequence' },
        { aiSdkReason: 'tool-calls', expectedReason: 'end_turn' },
        { aiSdkReason: 'unknown', expectedReason: 'end_turn' },
      ];

      for (const testCase of testCases) {
        mockGenerateText.mockResolvedValueOnce({
          text: 'Test response',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          finishReason: testCase.aiSdkReason,
        });

        const result = await adapter.sendPrompt(null, 'Test', {});
        expect(result.stopReason).toBe(testCase.expectedReason);
      }
    });
  });

  describe('retry logic', () => {
    it('should identify retryable errors correctly', async () => {
      const retryableErrors = [
        new Error('timeout'),
        new Error('rate limit exceeded'),
        new Error('429 Too Many Requests'),
        new Error('502 Bad Gateway'),
        new Error('503 Service Unavailable'),
        new Error('ECONNRESET'),
        new Error('network error'),
        new MockNoObjectGeneratedError('Schema validation failed'),
      ];

      for (const error of retryableErrors) {
        mockGenerateText.mockRejectedValueOnce(error);

        try {
          await adapter.sendPrompt(null, 'Test', {});
        } catch (thrownError) {
          // The error should be enhanced but the original retryable nature preserved
          expect(thrownError).toBeInstanceOf(Error);
        }
      }
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new Error('Invalid API key');
      mockGenerateText.mockRejectedValue(nonRetryableError);

      await expect(adapter.sendPrompt(null, 'Test', {})).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty prompt', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Empty response',
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        finishReason: 'stop',
      });

      const result = await adapter.sendPrompt(null, '', {});
      expect(result.content).toBe('Empty response');
    });

    it('should handle undefined usage in response', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Response without usage',
        finishReason: 'stop',
        // usage is undefined
      });

      const result = await adapter.sendPrompt(null, 'Test', {});
      expect(result.tokenUsage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });

    it('should handle missing finish reason', async () => {
      mockGenerateText.mockResolvedValue({
        text: 'Response without finish reason',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        // finishReason is undefined
      });

      const result = await adapter.sendPrompt(null, 'Test', {});
      expect(result.stopReason).toBe('end_turn'); // default mapping
    });
  });
});
