import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnthropicSDKAdapter } from '../../src/adapters/anthropic-sdk.js';
import {
  type AnthropicSDKAdapterConfig,
  createAnthropicSDKAdapter,
} from '../../src/adapters/anthropic-sdk.js';

// Mock the Anthropic SDK
const mockMessages = {
  create: vi.fn(),
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: mockMessages,
  })),
  APIError: class MockAPIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = 'APIError';
    }
  },
}));

// Import the mocked constructor
import Anthropic from '@anthropic-ai/sdk';

const MockedAnthropic = vi.mocked(Anthropic);

describe('AnthropicSDKAdapter', () => {
  let adapter: AnthropicSDKAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMessages.create.mockClear();

    // Set environment variable for testing
    process.env.ANTHROPIC_API_KEY = 'test-api-key';

    adapter = createAnthropicSDKAdapter({
      apiKey: 'test-api-key',
      defaultModel: 'claude-3-5-sonnet-20241022',
    }) as AnthropicSDKAdapter;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('constructor', () => {
    it('should create adapter with API key from config', () => {
      const customAdapter = createAnthropicSDKAdapter({
        apiKey: 'custom-key',
        baseURL: 'https://custom-endpoint.com',
        defaultModel: 'claude-3-opus-20240229',
        timeout: 30000,
        maxRetries: 5,
      });

      expect(customAdapter.name).toBe('anthropic-sdk');
      expect(customAdapter.version).toBe('1.0.0');
      expect(customAdapter.supportsSession).toBe(false);
    });

    it('should create adapter with API key from environment', () => {
      const envAdapter = createAnthropicSDKAdapter();
      expect(envAdapter.name).toBe('anthropic-sdk');
    });

    it('should throw error when no API key is provided', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => createAnthropicSDKAdapter()).toThrow(/API key not provided/);
    });

    it('should support expected Claude models', () => {
      const expectedModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-3-5-sonnet-latest',
        'claude-3-5-haiku-latest',
        'claude-3-opus-latest',
        'claude-3-sonnet-latest',
        'claude-3-haiku-latest',
      ];

      expect(adapter.supportedModels).toEqual(expectedModels);
    });
  });

  describe('isAvailable', () => {
    it('should return true when Anthropic API is available', async () => {
      mockMessages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 5, output_tokens: 1 },
      });

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when API key is missing', async () => {
      const adapterWithoutKey = Object.create(adapter);
      (adapterWithoutKey as any).apiKey = undefined;

      const result = await adapterWithoutKey.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when API call fails', async () => {
      mockMessages.create.mockRejectedValueOnce(new Error('API Error'));

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when response content is invalid', async () => {
      mockMessages.create.mockResolvedValueOnce({
        content: [],
        usage: { input_tokens: 5, output_tokens: 0 },
      });

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when API is available', async () => {
      mockMessages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 5, output_tokens: 1 },
      });

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        apiKeyConfigured: true,
        defaultModel: 'claude-3-5-sonnet-20241022',
        supportedModels: 11,
      });
    });

    it('should return unhealthy status when API key is missing', async () => {
      const adapterWithoutKey = Object.create(adapter);
      (adapterWithoutKey as any).apiKey = undefined;

      const health = await adapterWithoutKey.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Anthropic API key not configured');
    });

    it('should return unhealthy status when API is not available', async () => {
      mockMessages.create.mockRejectedValueOnce(new Error('API Error'));

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe(
        'Anthropic API not responding or authentication failed'
      );
    });

    it('should include response time in health check', async () => {
      mockMessages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 5, output_tokens: 1 },
      });

      const health = await adapter.getHealth();

      expect(health.responseTimeMs).toBeGreaterThan(0);
      expect(typeof health.responseTimeMs).toBe('number');
    });
  });

  describe('createSession', () => {
    it('should throw error since sessions are not supported', async () => {
      await expect(
        adapter.createSession('Test context', {
          model: 'claude-3-5-sonnet-20241022',
          temperature: 0.7,
        })
      ).rejects.toThrow(/does not support sessions/);
    });

    it('should throw error even without options', async () => {
      await expect(adapter.createSession('Test context')).rejects.toThrow(
        /does not support sessions/
      );
    });
  });

  describe('sendPrompt', () => {
    it('should send prompt successfully', async () => {
      mockMessages.create.mockResolvedValueOnce({
        id: 'msg_123',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        usage: {
          input_tokens: 10,
          output_tokens: 8,
        },
        stop_reason: 'end_turn',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
      });

      const response = await adapter.sendPrompt(null, 'Hello', {
        maxTokens: 100,
        temperature: 0.7,
      });

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.tokenUsage).toMatchObject({
        inputTokens: 10,
        outputTokens: 8,
        totalTokens: 18,
      });
      expect(response.stopReason).toBe('end_turn');

      expect(mockMessages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      });
    });

    it('should handle session ID warning (stateless adapter)', async () => {
      mockMessages.create.mockResolvedValueOnce({
        id: 'msg_123',
        content: [{ type: 'text', text: 'Response without session' }],
        usage: { input_tokens: 15, output_tokens: 10 },
        stop_reason: 'end_turn',
        role: 'assistant',
      });

      const response = await adapter.sendPrompt('fake-session-id', 'Hello', {
        maxTokens: 100,
      });

      expect(response.content).toBe('Response without session');

      // Should ignore session ID and work normally
      expect(mockMessages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      });
    });

    it('should handle multiple content blocks', async () => {
      mockMessages.create.mockResolvedValueOnce({
        id: 'msg_123',
        content: [
          { type: 'text', text: 'First part ' },
          { type: 'text', text: 'Second part' },
        ],
        usage: { input_tokens: 10, output_tokens: 8 },
        stop_reason: 'end_turn',
        role: 'assistant',
      });

      const response = await adapter.sendPrompt(null, 'Hello', {
        maxTokens: 100,
      });

      expect(response.content).toBe('First part Second part');
    });

    it('should handle advanced options', async () => {
      mockMessages.create.mockResolvedValueOnce({
        id: 'msg_123',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
        role: 'assistant',
      });

      await adapter.sendPrompt(null, 'Hello', {
        maxTokens: 200,
        temperature: 0.9,
        topP: 0.95,
        topK: 50,
        model: 'claude-3-opus-20240229',
      });

      expect(mockMessages.create).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.9,
        top_p: 0.95,
        top_k: 50,
      });
    });

    it('should handle max_tokens stop reason', async () => {
      mockMessages.create.mockResolvedValueOnce({
        id: 'msg_123',
        content: [{ type: 'text', text: 'Truncated response...' }],
        usage: { input_tokens: 10, output_tokens: 100 },
        stop_reason: 'max_tokens',
        role: 'assistant',
      });

      const response = await adapter.sendPrompt(null, 'Hello', {
        maxTokens: 100,
      });

      expect(response.stopReason).toBe('max_tokens');
      expect(response.truncated).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const MockedError = MockedAnthropic.APIError as any;
      mockMessages.create.mockRejectedValueOnce(
        new MockedError('Invalid API key', 401)
      );

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/authentication failed/);
    });

    it('should handle rate limit errors', async () => {
      const MockedError = MockedAnthropic.APIError as any;
      mockMessages.create.mockRejectedValueOnce(
        new MockedError('Rate limit exceeded', 429)
      );

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/rate limit exceeded/);
    });

    it('should handle server errors', async () => {
      const MockedError = MockedAnthropic.APIError as any;
      mockMessages.create.mockRejectedValueOnce(
        new MockedError('Internal server error', 500)
      );

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/server error \(500\)/);
    });

    it('should handle timeout errors', async () => {
      mockMessages.create.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/timed out after/);
    });
  });

  describe('destroySession', () => {
    it('should be a no-op since sessions are not supported', async () => {
      await expect(
        adapter.destroySession('fake-session')
      ).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should provide helpful error messages for common API errors', async () => {
      const MockedError = MockedAnthropic.APIError as any;
      const testCases = [
        {
          error: new MockedError('Bad request', 400),
          expectedMessage: /Invalid request to Anthropic API/,
        },
        {
          error: new MockedError('Unauthorized', 401),
          expectedMessage: /authentication failed/,
        },
        {
          error: new MockedError('Forbidden', 403),
          expectedMessage: /access forbidden/,
        },
        {
          error: new MockedError('Not found', 404),
          expectedMessage: /endpoint not found/,
        },
        {
          error: new MockedError('Too many requests', 429),
          expectedMessage: /rate limit exceeded/,
        },
      ];

      for (const testCase of testCases) {
        mockMessages.create.mockRejectedValueOnce(testCase.error);

        await expect(
          adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });

    it('should handle model not found errors', async () => {
      mockMessages.create.mockRejectedValueOnce(new Error('model not found'));

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/Invalid model specified/);
    });

    it('should handle billing/quota errors', async () => {
      mockMessages.create.mockRejectedValueOnce(new Error('billing issue'));

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/billing issue or quota exceeded/);
    });
  });

  describe('retryable errors', () => {
    it('should identify retryable errors correctly', async () => {
      const MockedError = MockedAnthropic.APIError as any;
      const retryableErrors = [
        new MockedError('Rate limit', 429),
        new MockedError('Server error', 500),
        new MockedError('Bad gateway', 502),
        new MockedError('Service unavailable', 503),
        new MockedError('Gateway timeout', 504),
        new Error('timeout'),
        new Error('network error'),
        new Error('ECONNRESET'),
      ];

      for (const error of retryableErrors) {
        mockMessages.create.mockRejectedValueOnce(error);

        await expect(
          adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
        ).rejects.toThrow();
      }
    });

    it('should identify non-retryable errors correctly', async () => {
      const MockedError = MockedAnthropic.APIError as any;
      const nonRetryableErrors = [
        new MockedError('Bad request', 400),
        new MockedError('Unauthorized', 401),
        new MockedError('Forbidden', 403),
        new MockedError('Not found', 404),
      ];

      for (const error of nonRetryableErrors) {
        mockMessages.create.mockRejectedValueOnce(error);

        await expect(
          adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
        ).rejects.toThrow();
      }
    });
  });

  describe('stop reason mapping', () => {
    it('should map stop reasons correctly', async () => {
      const stopReasonTests = [
        { anthropic: 'end_turn', expected: 'end_turn' },
        { anthropic: 'max_tokens', expected: 'max_tokens' },
        { anthropic: 'stop_sequence', expected: 'stop_sequence' },
        { anthropic: 'tool_use', expected: 'other' },
        { anthropic: null, expected: 'end_turn' },
        { anthropic: 'unknown', expected: 'end_turn' },
      ];

      for (const test of stopReasonTests) {
        mockMessages.create.mockResolvedValueOnce({
          id: 'msg_123',
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: test.anthropic,
          role: 'assistant',
        });

        const response = await adapter.sendPrompt(null, 'Hello', {
          maxTokens: 100,
        });

        expect(response.stopReason).toBe(test.expected);
      }
    });
  });

  describe('configuration options', () => {
    it('should respect custom configuration', () => {
      const customConfig: AnthropicSDKAdapterConfig = {
        apiKey: 'custom-key',
        baseURL: 'https://custom-endpoint.com',
        defaultModel: 'claude-3-opus-20240229',
        timeout: 30000,
        maxRetries: 5,
      };

      const customAdapter = createAnthropicSDKAdapter(customConfig);

      expect(customAdapter.name).toBe('anthropic-sdk');
      expect(customAdapter.supportsSession).toBe(false);
    });

    it('should use sensible defaults', () => {
      const defaultAdapter = createAnthropicSDKAdapter({
        apiKey: 'test-key',
      });

      expect(defaultAdapter.name).toBe('anthropic-sdk');
      expect(defaultAdapter.supportedModels).toContain(
        'claude-3-5-sonnet-20241022'
      );
    });
  });

  describe('metadata and logging', () => {
    it('should include comprehensive metadata in response', async () => {
      mockMessages.create.mockResolvedValueOnce({
        id: 'msg_123',
        content: [{ type: 'text', text: 'Response' }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
        stop_reason: 'end_turn',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
      });

      const response = await adapter.sendPrompt(null, 'Hello', {
        maxTokens: 100,
        temperature: 0.7,
      });

      expect(response.metadata).toMatchObject({
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 100,
        stopReason: 'end_turn',
        messageId: 'msg_123',
        role: 'assistant',
      });

      expect(response.metadata.anthropicUsage).toEqual({
        input_tokens: 10,
        output_tokens: 5,
      });
    });
  });
});
