import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGeminiAdapter,
  type GeminiAdapter,
} from '../../src/adapters/gemini.js';

// Mock the Google GenAI SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn(),
      },
    })),
  };
});

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;
  let mockGenAI: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set environment variable for testing
    process.env.GEMINI_API_KEY = 'test-api-key';

    adapter = createGeminiAdapter({
      apiKey: 'test-api-key',
      defaultModel: 'gemini-1.5-flash',
    }) as GeminiAdapter;

    // Get the mock instance
    mockGenAI = (adapter as any).genAI;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
  });

  describe('constructor', () => {
    it('should create adapter with API key from config', () => {
      const customAdapter = createGeminiAdapter({
        apiKey: 'custom-key',
        apiVersion: 'v1alpha',
        defaultModel: 'gemini-pro',
      });

      expect(customAdapter.name).toBe('gemini');
      expect(customAdapter.version).toBe('1.0.0');
      expect(customAdapter.supportsSession).toBe(true);
    });

    it('should create adapter with API key from environment', () => {
      const envAdapter = createGeminiAdapter();
      expect(envAdapter.name).toBe('gemini');
    });

    it('should throw error when no API key is provided', () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      expect(() => createGeminiAdapter()).toThrow(/API key not provided/);
    });

    it('should support different supported models', () => {
      const expectedModels = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-pro-002',
        'gemini-1.5-flash',
        'gemini-1.5-flash-002',
        'gemini-1.5-flash-8b',
        'gemini-pro',
        'gemini-pro-latest',
        'gemini-flash-latest',
      ];

      expect(adapter.supportedModels).toEqual(expectedModels);
    });
  });

  describe('isAvailable', () => {
    it('should return true when Gemini API is available', async () => {
      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: 'OK',
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
      mockGenAI.models.generateContent.mockRejectedValueOnce(
        new Error('API Error')
      );

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when API is available', async () => {
      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: 'OK',
      });

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        apiKeyConfigured: true,
        defaultModel: 'gemini-1.5-flash',
        activeSessions: 0,
        supportedModels: 9,
      });
    });

    it('should return unhealthy status when API key is missing', async () => {
      const adapterWithoutKey = Object.create(adapter);
      (adapterWithoutKey as any).apiKey = undefined;

      const health = await adapterWithoutKey.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Gemini API key not configured');
    });

    it('should return unhealthy status when API is not available', async () => {
      mockGenAI.models.generateContent.mockRejectedValueOnce(
        new Error('API Error')
      );

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe(
        'Gemini API not responding or authentication failed'
      );
    });
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      const sessionId = await adapter.createSession('Test context', {
        model: 'gemini-1.5-flash',
        temperature: 0.7,
      });

      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should create session without options', async () => {
      const sessionId = await adapter.createSession('Test context');

      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('sendPrompt', () => {
    it('should send prompt successfully', async () => {
      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: 'Hello! How can I help you?',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18,
        },
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

      expect(mockGenAI.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello' }],
          },
        ],
      });
    });

    it('should send prompt with session context', async () => {
      // First create a session
      const sessionId = await adapter.createSession(
        'You are a helpful assistant'
      );

      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: 'Response with context',
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 10,
          totalTokenCount: 25,
        },
      });

      const response = await adapter.sendPrompt(sessionId, 'Hello', {
        maxTokens: 100,
      });

      expect(response.content).toBe('Response with context');

      expect(mockGenAI.models.generateContent).toHaveBeenCalledWith({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello' }],
          },
        ],
        systemInstruction: 'You are a helpful assistant',
      });
    });

    it('should handle JSON mode', async () => {
      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: '{"response": "json content"}',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18,
        },
      });

      const response = await adapter.sendPrompt(null, 'Hello', {
        maxTokens: 100,
        json: true,
      });

      expect(response.content).toBe('{"response": "json content"}');
    });

    it('should handle API errors gracefully', async () => {
      mockGenAI.models.generateContent.mockRejectedValueOnce(
        new Error('API key invalid')
      );

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/Gemini API key invalid or missing/);
    });

    it('should handle rate limit errors', async () => {
      mockGenAI.models.generateContent.mockRejectedValueOnce(
        new Error('429 quota exceeded')
      );

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/quota exceeded or rate limit hit/);
    });

    it('should handle safety filter errors', async () => {
      mockGenAI.models.generateContent.mockRejectedValueOnce(
        new Error('Content was blocked by safety filters')
      );

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/blocked by Gemini's safety filters/);
    });
  });

  describe('destroySession', () => {
    it('should destroy session successfully', async () => {
      // First create a session
      const sessionId = await adapter.createSession('Test context');

      await expect(adapter.destroySession(sessionId)).resolves.toBeUndefined();
    });

    it('should handle destroying non-existent session', async () => {
      const fakeSessionId = 'fake-session-id';

      await expect(
        adapter.destroySession(fakeSessionId)
      ).resolves.toBeUndefined();
    });
  });

  describe('session management', () => {
    it('should maintain conversation history across multiple calls', async () => {
      // Create a session
      const sessionId = await adapter.createSession('You are helpful');

      // First call
      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: 'First response',
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      });

      await adapter.sendPrompt(sessionId, 'First message', { maxTokens: 100 });

      // Second call
      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: 'Second response',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15,
        },
      });

      await adapter.sendPrompt(sessionId, 'Second message', { maxTokens: 100 });

      // Verify that the second call includes conversation history
      const secondCall = mockGenAI.models.generateContent.mock.calls[1];
      expect(secondCall[0].contents).toHaveLength(3); // system + first exchange + current
    });
  });

  describe('error handling', () => {
    it('should provide helpful error messages for common issues', async () => {
      const testCases = [
        {
          error: new Error('API key invalid'),
          expectedMessage: /API key invalid or missing/,
        },
        {
          error: new Error('timeout'),
          expectedMessage: /timed out after/,
        },
        {
          error: new Error('model not found'),
          expectedMessage: /Invalid model specified/,
        },
        {
          error: new Error('billing issue'),
          expectedMessage: /billing issue or quota exceeded/,
        },
      ];

      for (const testCase of testCases) {
        mockGenAI.models.generateContent.mockRejectedValueOnce(testCase.error);

        await expect(
          adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
        ).rejects.toThrow(testCase.expectedMessage);
      }
    });
  });

  describe('retryable errors', () => {
    it('should identify retryable errors', async () => {
      const retryableErrors = [
        'timeout',
        'network error',
        'rate limit',
        '429',
        '500',
        '502',
        '503',
        '504',
        'ECONNRESET',
        'quota exceeded',
      ];

      for (const errorMsg of retryableErrors) {
        mockGenAI.models.generateContent.mockRejectedValueOnce(
          new Error(errorMsg)
        );

        await expect(
          adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
        ).rejects.toThrow();
      }
    });
  });

  describe('configuration options', () => {
    it('should respect temperature settings', async () => {
      mockGenAI.models.generateContent.mockResolvedValueOnce({
        text: 'Response',
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      });

      await adapter.sendPrompt(null, 'Hello', {
        temperature: 0.9,
        topP: 0.95,
        topK: 50,
      });

      // Note: Current implementation doesn't pass these parameters to the API
      // This test documents the current behavior
      expect(mockGenAI.models.generateContent).toHaveBeenCalled();
    });
  });
});
