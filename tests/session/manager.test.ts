import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultSessionManager,
  SessionManager,
} from '../../src/session/manager.js';
import type { ProviderAdapter } from '../../src/types/provider.js';

vi.mock('node:fs/promises');

describe('SessionManager', () => {
  let manager: SessionManager;
  const _mockProvider: ProviderAdapter = {
    name: 'mock-provider',
    supportsSession: true,
    sendPrompt: vi.fn(),
    createSession: vi.fn().mockResolvedValue('session-123'),
  };

  const mockFs = vi.mocked(fs);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    manager = new SessionManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates new instance', () => {
    const instance1 = new SessionManager();
    const instance2 = new SessionManager();
    expect(instance1).not.toBe(instance2);
    expect(defaultSessionManager).toBeInstanceOf(SessionManager);
  });

  it('creates new session when none exists', async () => {
    const session = await manager.createSession('test-context', {
      provider: 'mock-provider',
    });

    expect(session.id).toBeDefined();
    expect(session.context).toBe('test-context');
    expect(session.metadata.provider).toBe('mock-provider');
  });

  it('retrieves existing session by ID', async () => {
    const session1 = await manager.createSession('context', {
      provider: 'mock-provider',
    });

    const retrievedSession = await manager.getSession(session1.id);

    expect(retrievedSession).not.toBeNull();
    expect(retrievedSession?.id).toBe(session1.id);
    expect(retrievedSession?.context).toBe('context');
  });

  it('creates different sessions with unique IDs', async () => {
    const session1 = await manager.createSession('context-1', {
      provider: 'mock-provider',
    });

    const session2 = await manager.createSession('context-2', {
      provider: 'mock-provider',
    });

    expect(session1.id).not.toBe(session2.id);
    expect(session1.context).toBe('context-1');
    expect(session2.context).toBe('context-2');
  });

  it('handles sessions without specific provider support', async () => {
    const session = await manager.createSession('context', {
      provider: 'no-session',
    });

    expect(session.id).toBeDefined();
    expect(session.metadata.provider).toBe('no-session');
  });

  it('cleans up expired sessions', async () => {
    // Create a session
    const session = await manager.createSession('context', {
      provider: 'mock-provider',
    });

    // Verify session exists
    const retrievedSession = await manager.getSession(session.id);
    expect(retrievedSession).not.toBeNull();

    // Manually clean up with very short max age (1ms)
    const deletedCount = await manager.cleanup(1);

    expect(deletedCount).toBeGreaterThan(0);
  });

  it('can list created sessions', async () => {
    const session1 = await manager.createSession('context1', {
      provider: 'provider1',
    });
    const session2 = await manager.createSession('context2', {
      provider: 'provider2',
    });

    const sessions = await manager.listSessions();

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    const sessionIds = sessions.map(s => s.id);
    expect(sessionIds).toContain(session1.id);
    expect(sessionIds).toContain(session2.id);
  });

  it('can update existing sessions', async () => {
    const session = await manager.createSession('original-context', {
      provider: 'test-provider',
    });

    const updatedSession = await manager.updateSession(session.id, {
      context: 'updated-context',
      metadata: { ...session.metadata, promptCount: 5 },
    });

    expect(updatedSession.id).toBe(session.id);
    expect(updatedSession.context).toBe('updated-context');
    expect(updatedSession.metadata.promptCount).toBe(5);
    expect(updatedSession.updatedAt.getTime()).toBeGreaterThanOrEqual(
      session.updatedAt.getTime()
    );
  });

  it('handles file read errors gracefully', async () => {
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    const session = await manager.getSession('non-existent-id');
    expect(session).toBeNull();
  });

  it('deletes sessions individually', async () => {
    const session1 = await manager.createSession('context1', {
      provider: 'provider1',
    });
    const session2 = await manager.createSession('context2', {
      provider: 'provider2',
    });

    // Verify sessions exist
    expect(await manager.getSession(session1.id)).not.toBeNull();
    expect(await manager.getSession(session2.id)).not.toBeNull();

    // Delete sessions
    await manager.deleteSession(session1.id);
    await manager.deleteSession(session2.id);

    // Verify sessions are deleted
    expect(await manager.getSession(session1.id)).toBeNull();
    expect(await manager.getSession(session2.id)).toBeNull();
  });

  it('generates unique session IDs', async () => {
    const session1 = await manager.createSession('context', 'provider');
    const session2 = await manager.createSession('context', 'provider');
    const session3 = await manager.createSession('different', 'provider');

    expect(session1.id).not.toBe(session2.id);
    expect(session1.id).not.toBe(session3.id);
    expect(session2.id).not.toBe(session3.id);
  });

  describe('Session Metrics', () => {
    it('returns null for non-existent session metrics', async () => {
      const metrics = await manager.getSessionMetrics?.('non-existent-session');
      expect(metrics).toBeNull();
    });

    it('calculates basic metrics from success feedback', async () => {
      const session = await manager.createSession('test-context', {
        provider: 'test-provider',
      });

      // Add some success feedback to simulate completed operations
      await manager.addSuccessFeedback?.(session.id, {
        message: 'Great job!',
        validatedOutput: { result: 'success' },
        attemptNumber: 1,
        timestamp: new Date(),
        metadata: {
          executionTimeMs: 1000,
          tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      });

      await manager.addSuccessFeedback?.(session.id, {
        message: 'Excellent work!',
        validatedOutput: { result: 'success2' },
        attemptNumber: 2, // Required 2 attempts
        timestamp: new Date(),
        metadata: {
          executionTimeMs: 1500,
          tokenUsage: { inputTokens: 120, outputTokens: 60, totalTokens: 180 },
        },
      });

      const metrics = await manager.getSessionMetrics?.(session.id);
      expect(metrics).toBeDefined();
      expect(metrics?.totalAttempts).toBe(3); // 1 + 2 attempts
      expect(metrics?.successfulValidations).toBe(2);
      expect(metrics?.avgAttemptsToSuccess).toBe(1.5); // (1 + 2) / 2
      expect(metrics?.successRate).toBeCloseTo(0.67, 2); // 2 successes / 3 attempts
      expect(metrics?.totalExecutionTimeMs).toBe(2500);
      expect(metrics?.avgExecutionTimeMs).toBe(1250);
      expect(metrics?.totalTokenUsage?.totalTokens).toBe(330);
      expect(metrics?.operationsWithRetries).toBe(1); // Second operation required retry
      expect(metrics?.maxAttemptsForOperation).toBe(2);
      expect(metrics?.lastSuccessTimestamp).toBeDefined();
    });

    it('handles sessions with no success feedback', async () => {
      const session = await manager.createSession('empty-session', {
        provider: 'test-provider',
      });

      const metrics = await manager.getSessionMetrics?.(session.id);
      expect(metrics).toBeDefined();
      expect(metrics?.totalAttempts).toBe(0);
      expect(metrics?.successfulValidations).toBe(0);
      expect(metrics?.avgAttemptsToSuccess).toBe(0);
      expect(metrics?.successRate).toBe(0);
      expect(metrics?.totalExecutionTimeMs).toBe(0);
      expect(metrics?.avgExecutionTimeMs).toBe(0);
      expect(metrics?.totalTokenUsage).toBeUndefined();
      expect(metrics?.operationsWithRetries).toBe(0);
      expect(metrics?.maxAttemptsForOperation).toBe(0);
      expect(metrics?.lastSuccessTimestamp).toBeUndefined();
    });

    it('caches metrics in session after calculation', async () => {
      const session = await manager.createSession('cached-session', {
        provider: 'test-provider',
      });

      await manager.addSuccessFeedback?.(session.id, {
        message: 'Success!',
        validatedOutput: { result: 'test' },
        attemptNumber: 1,
        timestamp: new Date(),
        metadata: { executionTimeMs: 500 },
      });

      // First call should calculate and cache metrics
      const metrics1 = await manager.getSessionMetrics?.(session.id);
      expect(metrics1).toBeDefined();

      // Verify that metrics are now cached in the session
      const updatedSession = await manager.getSession(session.id);
      expect(updatedSession?.metrics).toBeDefined();
      expect(updatedSession?.metrics?.totalAttempts).toBe(1);

      // Second call should return cached metrics
      const metrics2 = await manager.getSessionMetrics?.(session.id);
      expect(metrics2).toEqual(metrics1);
    });

    it('handles success feedback with missing metadata gracefully', async () => {
      const session = await manager.createSession('minimal-session', {
        provider: 'test-provider',
      });

      // Add success feedback without execution time or token usage
      await manager.addSuccessFeedback?.(session.id, {
        message: 'Success without metadata!',
        validatedOutput: { result: 'minimal' },
        attemptNumber: 1,
        timestamp: new Date(),
        // No metadata provided
      });

      const metrics = await manager.getSessionMetrics?.(session.id);
      expect(metrics).toBeDefined();
      expect(metrics?.totalAttempts).toBe(1);
      expect(metrics?.successfulValidations).toBe(1);
      expect(metrics?.totalExecutionTimeMs).toBe(0); // No execution time provided
      expect(metrics?.totalTokenUsage).toBeUndefined(); // No token usage provided
    });

    it('tracks operations with retries correctly', async () => {
      const session = await manager.createSession('retry-session', {
        provider: 'test-provider',
      });

      // Add multiple operations, some requiring retries
      await manager.addSuccessFeedback?.(session.id, {
        message: 'First try success',
        validatedOutput: { result: 'first' },
        attemptNumber: 1, // Success on first attempt
        timestamp: new Date(),
      });

      await manager.addSuccessFeedback?.(session.id, {
        message: 'Second try success',
        validatedOutput: { result: 'second' },
        attemptNumber: 3, // Required 3 attempts
        timestamp: new Date(),
      });

      await manager.addSuccessFeedback?.(session.id, {
        message: 'Third try success',
        validatedOutput: { result: 'third' },
        attemptNumber: 2, // Required 2 attempts
        timestamp: new Date(),
      });

      const metrics = await manager.getSessionMetrics?.(session.id);
      expect(metrics).toBeDefined();
      expect(metrics?.totalAttempts).toBe(6); // 1 + 3 + 2
      expect(metrics?.successfulValidations).toBe(3);
      expect(metrics?.operationsWithRetries).toBe(2); // 2nd and 3rd operations required retries
      expect(metrics?.maxAttemptsForOperation).toBe(3); // Maximum was 3 attempts
      expect(metrics?.successRate).toBe(0.5); // 3 successes / 6 total attempts
    });
  });
});
