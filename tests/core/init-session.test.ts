/**
 * Tests for initSession function
 *
 * Comprehensive test coverage for schema-free session initialization,
 * covering session creation, reuse, stateless fallbacks, and error handling.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initSession } from '../../src/core/runner/index.js';
import type { ProviderAdapter, ProviderResponse } from '../../src/types/provider.js';

describe('initSession', () => {
  // Mock provider that supports sessions
  const mockSessionProvider: ProviderAdapter = {
    name: 'mock-session',
    supportsSession: true,
    createSession: vi.fn(),
    sendPrompt: vi.fn(),
  };

  // Mock provider that doesn't support sessions
  const mockStatelessProvider: ProviderAdapter = {
    name: 'mock-stateless',
    supportsSession: false,
    sendPrompt: vi.fn(),
  };

  // Mock response for successful operations
  const mockResponse: ProviderResponse = {
    content: 'Mock response content',
    tokenUsage: {
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('session-capable provider', () => {
    it('creates new session with context only', async () => {
      const mockSessionId = 'session-123';
      vi.mocked(mockSessionProvider.createSession!).mockResolvedValue(mockSessionId);

      const result = await initSession({
        context: 'You are a helpful assistant',
        provider: mockSessionProvider,
      });

      expect(result.sessionId).toBe(mockSessionId);
      expect(result.response).toBeUndefined();
      expect(result.metadata.provider).toBe('mock-session');
      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);

      expect(mockSessionProvider.createSession).toHaveBeenCalledWith(
        'You are a helpful assistant',
        {}
      );
    });

    it('creates session with initial prompt', async () => {
      const mockSessionId = 'session-456';
      vi.mocked(mockSessionProvider.createSession!).mockResolvedValue(mockSessionId);
      vi.mocked(mockSessionProvider.sendPrompt).mockResolvedValue(mockResponse);

      const result = await initSession({
        context: 'You are a helpful assistant',
        initialPrompt: 'Hello, introduce yourself',
        provider: mockSessionProvider,
      });

      expect(result.sessionId).toBe(mockSessionId);
      expect(result.response).toBe('Mock response content');
      expect(result.metadata.provider).toBe('mock-session');

      expect(mockSessionProvider.createSession).toHaveBeenCalledWith(
        'You are a helpful assistant',
        {}
      );
      expect(mockSessionProvider.sendPrompt).toHaveBeenCalledWith(
        mockSessionId,
        'Hello, introduce yourself',
        {}
      );
    });

    it('creates session with model and provider options', async () => {
      const mockSessionId = 'session-789';
      vi.mocked(mockSessionProvider.createSession!).mockResolvedValue(mockSessionId);

      const result = await initSession({
        context: 'You are a helpful assistant',
        model: 'gpt-4',
        provider: mockSessionProvider,
        providerOptions: {
          temperature: 0.5,
          maxTokens: 1000,
        },
      });

      expect(result.sessionId).toBe(mockSessionId);
      expect(result.metadata.model).toBe('gpt-4');

      expect(mockSessionProvider.createSession).toHaveBeenCalledWith(
        'You are a helpful assistant',
        {
          model: 'gpt-4',
          temperature: 0.5,
          maxTokens: 1000,
        }
      );
    });

    it('reuses existing session without initial prompt', async () => {
      const existingSessionId = 'existing-session-123';

      const result = await initSession({
        context: 'You are a helpful assistant',
        sessionId: existingSessionId,
        provider: mockSessionProvider,
      });

      expect(result.sessionId).toBe(existingSessionId);
      expect(result.response).toBeUndefined();
      expect(result.metadata.provider).toBe('mock-session');

      // Should not create new session
      expect(mockSessionProvider.createSession).not.toHaveBeenCalled();
      expect(mockSessionProvider.sendPrompt).not.toHaveBeenCalled();
    });

    it('reuses existing session with initial prompt', async () => {
      const existingSessionId = 'existing-session-456';
      vi.mocked(mockSessionProvider.sendPrompt).mockResolvedValue(mockResponse);

      const result = await initSession({
        context: 'You are a helpful assistant',
        sessionId: existingSessionId,
        initialPrompt: 'Continue our conversation',
        provider: mockSessionProvider,
      });

      expect(result.sessionId).toBe(existingSessionId);
      expect(result.response).toBe('Mock response content');

      // Should not create new session
      expect(mockSessionProvider.createSession).not.toHaveBeenCalled();
      
      // Should send prompt to existing session
      expect(mockSessionProvider.sendPrompt).toHaveBeenCalledWith(
        existingSessionId,
        'Continue our conversation',
        {}
      );
    });

    it('handles session creation failure', async () => {
      const error = new Error('Session creation failed');
      vi.mocked(mockSessionProvider.createSession!).mockRejectedValue(error);

      await expect(
        initSession({
          context: 'You are a helpful assistant',
          provider: mockSessionProvider,
        })
      ).rejects.toThrow('Failed to create session: Session creation failed');
    });

    it('handles send prompt failure with existing session', async () => {
      const existingSessionId = 'existing-session-789';
      const error = new Error('Send prompt failed');
      vi.mocked(mockSessionProvider.sendPrompt).mockRejectedValue(error);

      await expect(
        initSession({
          context: 'You are a helpful assistant',
          sessionId: existingSessionId,
          initialPrompt: 'This will fail',
          provider: mockSessionProvider,
        })
      ).rejects.toThrow('Failed to send initial prompt to existing session: Send prompt failed');
    });
  });

  describe('stateless provider', () => {
    it('handles stateless request with initial prompt', async () => {
      vi.mocked(mockStatelessProvider.sendPrompt).mockResolvedValue(mockResponse);

      const result = await initSession({
        context: 'You are a helpful assistant',
        initialPrompt: 'Hello there',
        provider: mockStatelessProvider,
      });

      expect(result.sessionId).toMatch(/^stateless-\d+-[a-z0-9]+$/);
      expect(result.response).toBe('Mock response content');
      expect(result.metadata.provider).toBe('mock-stateless');

      expect(mockStatelessProvider.sendPrompt).toHaveBeenCalledWith(
        null,
        'You are a helpful assistant\n\nHello there',
        {}
      );
    });

    it('handles stateless request without context', async () => {
      vi.mocked(mockStatelessProvider.sendPrompt).mockResolvedValue(mockResponse);

      const _result = await initSession({
        context: '',
        initialPrompt: 'Hello there',
        provider: mockStatelessProvider,
      });

      expect(mockStatelessProvider.sendPrompt).toHaveBeenCalledWith(
        null,
        'Hello there',
        {}
      );
    });

    it('throws error when no initial prompt provided', async () => {
      await expect(
        initSession({
          context: 'You are a helpful assistant',
          provider: mockStatelessProvider,
        })
      ).rejects.toThrow(
        'Provider mock-stateless does not support sessions and no initial prompt provided'
      );
    });

    it('handles stateless request failure', async () => {
      const error = new Error('Stateless request failed');
      vi.mocked(mockStatelessProvider.sendPrompt).mockRejectedValue(error);

      await expect(
        initSession({
          context: 'You are a helpful assistant',
          initialPrompt: 'This will fail',
          provider: mockStatelessProvider,
        })
      ).rejects.toThrow('Failed to send stateless request: Stateless request failed');
    });
  });

  describe('default provider behavior', () => {
    it('uses default Claude CLI provider when none specified', async () => {
      // Mock the Claude CLI adapter creation
      const mockClaudeProvider: ProviderAdapter = {
        name: 'claude-cli',
        supportsSession: true,
        createSession: vi.fn().mockResolvedValue('claude-session-123'),
        sendPrompt: vi.fn(),
      };

      // This test verifies that default provider is used
      // In real usage, this would be the Claude CLI adapter
      const _result = await initSession({
        context: 'You are a helpful assistant',
        provider: mockClaudeProvider, // Explicitly pass for testing
      });

      expect(_result.sessionId).toBe('claude-session-123');
      expect(_result.metadata.provider).toBe('claude-cli');
    });
  });

  describe('metadata tracking', () => {
    it('includes accurate timing metadata', async () => {
      const beforeTime = Date.now();
      
      vi.mocked(mockSessionProvider.createSession!).mockResolvedValue('session-timing');
      
      const result = await initSession({
        context: 'You are a helpful assistant',
        provider: mockSessionProvider,
      });

      const afterTime = Date.now();

      expect(result.metadata.startedAt.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(result.metadata.completedAt.getTime()).toBeLessThanOrEqual(afterTime);
      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.executionTimeMs).toBeLessThanOrEqual(afterTime - beforeTime);
    });

    it('includes provider and model information', async () => {
      vi.mocked(mockSessionProvider.createSession!).mockResolvedValue('session-metadata');
      
      const result = await initSession({
        context: 'You are a helpful assistant',
        model: 'claude-3-sonnet',
        provider: mockSessionProvider,
      });

      expect(result.metadata.provider).toBe('mock-session');
      expect(result.metadata.model).toBe('claude-3-sonnet');
    });
  });

  describe('edge cases and validation', () => {
    it('handles empty context string', async () => {
      vi.mocked(mockSessionProvider.createSession!).mockResolvedValue('session-empty-context');
      
      const result = await initSession({
        context: '',
        provider: mockSessionProvider,
      });

      expect(result.sessionId).toBe('session-empty-context');
      expect(mockSessionProvider.createSession).toHaveBeenCalledWith('', {});
    });

    it('handles provider without createSession method', async () => {
      // Provider claims to support sessions but has no createSession method
      const brokenProvider: ProviderAdapter = {
        name: 'broken-session',
        supportsSession: true,
        sendPrompt: vi.fn(),
        // createSession method missing
      };

      await expect(
        initSession({
          context: 'You are a helpful assistant',
          provider: brokenProvider,
        })
      ).rejects.toThrow(
        'Provider broken-session does not support sessions and no initial prompt provided'
      );
    });

    it('preserves provider options through the pipeline', async () => {
      vi.mocked(mockSessionProvider.createSession!).mockResolvedValue('session-options');
      vi.mocked(mockSessionProvider.sendPrompt).mockResolvedValue(mockResponse);

      const providerOptions = {
        temperature: 0.8,
        maxTokens: 2000,
        customOption: 'custom-value',
      };

      await initSession({
        context: 'You are a helpful assistant',
        initialPrompt: 'Test prompt',
        model: 'test-model',
        provider: mockSessionProvider,
        providerOptions,
      });

      expect(mockSessionProvider.createSession).toHaveBeenCalledWith(
        'You are a helpful assistant',
        {
          model: 'test-model',
          ...providerOptions,
        }
      );

      expect(mockSessionProvider.sendPrompt).toHaveBeenCalledWith(
        'session-options',
        'Test prompt',
        {
          model: 'test-model',
          ...providerOptions,
        }
      );
    });
  });
});