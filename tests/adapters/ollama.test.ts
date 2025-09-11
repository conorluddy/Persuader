import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOllamaAdapter,
  type OllamaAdapter,
} from '../../src/adapters/ollama.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createOllamaAdapter({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.2',
    }) as OllamaAdapter;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = createOllamaAdapter();
      expect(defaultAdapter.name).toBe('ollama');
      expect(defaultAdapter.version).toBe('1.0.0');
      expect(defaultAdapter.supportsSession).toBe(true);
    });

    it('should create adapter with custom config', () => {
      const customAdapter = createOllamaAdapter({
        baseUrl: 'http://custom:8080',
        timeout: 30000,
        defaultModel: 'custom-model',
      });
      expect(customAdapter.name).toBe('ollama');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Ollama is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      const result = await adapter.isAvailable();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should return false when Ollama is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('should return healthy status when Ollama is available', async () => {
      // Mock models endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2', modified_at: '2024-01-01T00:00:00Z' }],
        }),
      } as Response);

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.details).toMatchObject({
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2',
        availableModels: 1,
      });
    });

    it('should return unhealthy status when Ollama is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const health = await adapter.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Ollama API not responding or not running');
    });
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      // Mock models endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2', modified_at: '2024-01-01T00:00:00Z' }],
        }),
      } as Response);

      const sessionId = await adapter.createSession('Test context', {
        model: 'llama3.2',
        temperature: 0.7,
      });

      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should handle session creation without options', async () => {
      // Mock models endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2', modified_at: '2024-01-01T00:00:00Z' }],
        }),
      } as Response);

      const sessionId = await adapter.createSession('Test context');

      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('sendPrompt', () => {
    it('should send prompt successfully', async () => {
      // Mock chat endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.2',
          created_at: '2024-01-01T00:00:00Z',
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?',
          },
          done: true,
          prompt_eval_count: 10,
          eval_count: 8,
          total_duration: 1000000000,
        }),
      } as Response);

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
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should send prompt with session context', async () => {
      // First create a session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2', modified_at: '2024-01-01T00:00:00Z' }],
        }),
      } as Response);

      const sessionId = await adapter.createSession(
        'You are a helpful assistant'
      );

      // Mock chat endpoint
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: 'llama3.2',
          message: { role: 'assistant', content: 'Response with context' },
          done: true,
          prompt_eval_count: 15,
          eval_count: 10,
        }),
      } as Response);

      const response = await adapter.sendPrompt(sessionId, 'Hello', {
        maxTokens: 100,
      });

      expect(response.content).toBe('Response with context');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/Ollama server error/);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/Cannot connect to Ollama/);
    });
  });

  describe('destroySession', () => {
    it('should destroy session successfully', async () => {
      // First create a session
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2', modified_at: '2024-01-01T00:00:00Z' }],
        }),
      } as Response);

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

  describe('error handling', () => {
    it('should provide helpful error messages for common issues', async () => {
      // Test connection refused
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/Cannot connect to Ollama/);
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/timed out after/);
    });

    it('should handle model not found errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Model not found',
      } as Response);

      await expect(
        adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
      ).rejects.toThrow(/Ollama API endpoint not found/);
    });
  });

  describe('supported models', () => {
    it('should return empty array initially', () => {
      expect(adapter.supportedModels).toEqual([]);
    });
  });

  describe('retryable errors', () => {
    it('should identify retryable errors', async () => {
      const retryableErrors = [
        'timeout',
        'network error',
        'ECONNRESET',
        'fetch failed',
        '502 Bad Gateway',
        '503 Service Unavailable',
        '504 Gateway Timeout',
      ];

      for (const errorMsg of retryableErrors) {
        mockFetch.mockRejectedValueOnce(new Error(errorMsg));

        await expect(
          adapter.sendPrompt(null, 'Hello', { maxTokens: 100 })
        ).rejects.toThrow();
      }
    });
  });
});
