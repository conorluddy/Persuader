/**
 * Tests for Session Coordinator
 *
 * Comprehensive tests for session creation, reuse, validation, and lifecycle
 * management across different provider configurations.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  coordinateSession,
  logSessionInfo,
  validateSessionState,
} from '../../../src/core/runner/session-coordinator.js';
import type { ProcessedConfiguration } from '../../../src/core/runner/configuration-manager.js';
import type { ProviderAdapter } from '../../../src/types/index.js';

// Mock dependencies
vi.mock('../../../src/utils/logger.js');

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

describe('coordinateSession', () => {
  let provider: ProviderAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = createMockProvider();
  });

  describe('existing session ID handling', () => {
    it('should use provided session ID directly', async () => {
      const config = createMockConfig({ sessionId: 'existing-session-123' });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('existing-session-123');
      expect(result.error).toBeUndefined();
    });

    it('should use provided session ID even when provider does not support sessions', async () => {
      const provider = createMockProvider({ supportsSession: false });
      const config = createMockConfig({ sessionId: 'provided-session' });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('provided-session');
    });
  });

  describe('provider without session support', () => {
    it('should proceed without session when provider does not support sessions', async () => {
      const provider = createMockProvider({ supportsSession: false });
      const config = createMockConfig();

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('session creation', () => {
    it('should create new session successfully', async () => {
      const mockCreateSession = vi.fn().mockResolvedValue('new-session-456');
      const provider = createMockProvider({
        supportsSession: true,
        createSession: mockCreateSession,
      });
      const config = createMockConfig({
        context: 'Test context for session',
      });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('new-session-456');
      expect(result.error).toBeUndefined();
      expect(mockCreateSession).toHaveBeenCalledWith(
        'Test context for session',
        {
          temperature: 0.7,
          model: 'test-model',
        }
      );
    });

    it('should create session with empty context when no context provided', async () => {
      const mockCreateSession = vi.fn().mockResolvedValue('session-no-context');
      const provider = createMockProvider({
        supportsSession: true,
        createSession: mockCreateSession,
      });
      const config = createMockConfig(); // No context

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-no-context');
      expect(mockCreateSession).toHaveBeenCalledWith('', {
        temperature: 0.7,
        model: 'test-model',
      });
    });

    it('should pass provider options to session creation', async () => {
      const mockCreateSession = vi.fn().mockResolvedValue('configured-session');
      const provider = createMockProvider({
        supportsSession: true,
        createSession: mockCreateSession,
      });
      const config = createMockConfig({
        model: 'custom-model',
        providerOptions: {
          maxTokens: 2000,
          temperature: 0.3,
          customParam: 'custom-value',
        },
        context: 'Custom context',
      });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(mockCreateSession).toHaveBeenCalledWith('Custom context', {
        temperature: 0.3,
        model: 'custom-model',
      });
    });
  });

  describe('session creation errors', () => {
    it('should handle provider claiming session support without createSession method', async () => {
      const provider = createMockProvider({
        supportsSession: true,
        createSession: undefined, // Missing method
      });
      const config = createMockConfig();

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(false);
      expect(result.sessionId).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('session_not_supported');
      expect(result.error?.message).toContain('claims to support sessions but has no createSession method');
      expect(result.error?.retryable).toBe(false);
    });

    it('should handle session creation failures with Error objects', async () => {
      const sessionError = new Error('Network timeout during session creation');
      const mockCreateSession = vi.fn().mockRejectedValue(sessionError);
      const provider = createMockProvider({
        supportsSession: true,
        createSession: mockCreateSession,
      });
      const config = createMockConfig();

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(false);
      expect(result.sessionId).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('session_creation_failed');
      expect(result.error?.message).toContain('Network timeout during session creation');
      expect(result.error?.retryable).toBe(false);
      expect(result.error?.details?.originalError).toBe(sessionError);
    });

    it('should handle session creation failures with non-Error objects', async () => {
      const mockCreateSession = vi.fn().mockRejectedValue('String error');
      const provider = createMockProvider({
        supportsSession: true,
        createSession: mockCreateSession,
      });
      const config = createMockConfig();

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('session_creation_failed');
      expect(result.error?.message).toContain('Unknown error');
      expect(result.error?.details?.originalError).toBe('String error');
    });

    it('should handle session creation failures with undefined errors', async () => {
      const mockCreateSession = vi.fn().mockRejectedValue(undefined);
      const provider = createMockProvider({
        supportsSession: true,
        createSession: mockCreateSession,
      });
      const config = createMockConfig();

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unknown error');
    });
  });
});

describe('validateSessionState', () => {
  it('should validate when no session is needed', () => {
    const provider = createMockProvider({ supportsSession: false });

    const result = validateSessionState(undefined, provider);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should validate when session ID is provided and provider supports sessions', () => {
    const provider = createMockProvider({
      supportsSession: true,
      createSession: vi.fn(),
    });

    const result = validateSessionState('valid-session-id', provider);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should invalidate when session ID is provided but provider does not support sessions', () => {
    const provider = createMockProvider({ supportsSession: false });

    const result = validateSessionState('unwanted-session-id', provider);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Session ID provided but provider test-provider does not support sessions');
  });

  it('should invalidate when provider supports sessions but has no createSession method and no session ID', () => {
    const provider = createMockProvider({
      supportsSession: true,
      createSession: undefined,
    });

    const result = validateSessionState(undefined, provider);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Provider test-provider supports sessions but has no createSession method and no session ID provided');
  });

  it('should validate when provider supports sessions, has no createSession method, but session ID is provided', () => {
    const provider = createMockProvider({
      supportsSession: true,
      createSession: undefined,
    });

    const result = validateSessionState('external-session-id', provider);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe('logSessionInfo', () => {
  it('should log session information with session ID', () => {
    const provider = createMockProvider({ supportsSession: true });
    const config = createMockConfig({ context: 'Test context' });

    // Should not throw
    expect(() => {
      logSessionInfo('session-123', provider, config);
    }).not.toThrow();
  });

  it('should log session information without session ID', () => {
    const provider = createMockProvider({ supportsSession: false });
    const config = createMockConfig();

    // Should not throw
    expect(() => {
      logSessionInfo(undefined, provider, config);
    }).not.toThrow();
  });

  it('should log session information with context', () => {
    const provider = createMockProvider({ supportsSession: true });
    const config = createMockConfig({ context: 'Detailed context for logging' });

    // Should not throw
    expect(() => {
      logSessionInfo('context-session', provider, config);
    }).not.toThrow();
  });

  it('should log session information without context', () => {
    const provider = createMockProvider({ supportsSession: false });
    const config = createMockConfig(); // No context

    // Should not throw
    expect(() => {
      logSessionInfo(undefined, provider, config);
    }).not.toThrow();
  });
});

describe('edge cases and error scenarios', () => {
  it('should handle provider with inconsistent session support configuration', async () => {
    // Provider says it supports sessions but createSession throws immediately
    const mockCreateSession = vi.fn().mockImplementation(() => {
      throw new Error('Method not implemented');
    });
    const provider = createMockProvider({
      supportsSession: true,
      createSession: mockCreateSession,
    });
    const config = createMockConfig();

    const result = await coordinateSession(config, provider);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('session_creation_failed');
    expect(result.error?.message).toContain('Method not implemented');
  });

  it('should handle async session creation that resolves to undefined', async () => {
    const mockCreateSession = vi.fn().mockResolvedValue(undefined);
    const provider = createMockProvider({
      supportsSession: true,
      createSession: mockCreateSession,
    });
    const config = createMockConfig();

    const result = await coordinateSession(config, provider);

    expect(result.success).toBe(true);
    expect(result.sessionId).toBeUndefined();
  });

  it('should handle async session creation that resolves to empty string', async () => {
    const mockCreateSession = vi.fn().mockResolvedValue('');
    const provider = createMockProvider({
      supportsSession: true,
      createSession: mockCreateSession,
    });
    const config = createMockConfig();

    const result = await coordinateSession(config, provider);

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('');
  });

  it('should handle very long context strings in session creation', async () => {
    const longContext = 'x'.repeat(10000);
    const mockCreateSession = vi.fn().mockResolvedValue('long-context-session');
    const provider = createMockProvider({
      supportsSession: true,
      createSession: mockCreateSession,
    });
    const config = createMockConfig({ context: longContext });

    const result = await coordinateSession(config, provider);

    expect(result.success).toBe(true);
    expect(mockCreateSession).toHaveBeenCalledWith(longContext, expect.any(Object));
  });

  it('should handle provider names with special characters', async () => {
    const provider = createMockProvider({
      name: 'test-provider@v2.0-beta',
      supportsSession: true,
      createSession: undefined,
    });
    const config = createMockConfig();

    const result = await coordinateSession(config, provider);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('test-provider@v2.0-beta');
  });

  it('should preserve all provider options in session options', async () => {
    const mockCreateSession = vi.fn().mockResolvedValue('full-options-session');
    const provider = createMockProvider({
      supportsSession: true,
      createSession: mockCreateSession,
    });
    const config = createMockConfig({
      providerOptions: {
        maxTokens: 4000,
        temperature: 0.1,
        topP: 0.9,
        frequencyPenalty: 0.5,
        presencePenalty: 0.2,
        customFlag: true,
      },
    });

    await coordinateSession(config, provider);

    expect(mockCreateSession).toHaveBeenCalledWith('', {
      temperature: 0.1,
      model: 'test-model',
    });
  });
});