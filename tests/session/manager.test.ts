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
  const mockProvider: ProviderAdapter = {
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
    const session = await manager.createSession(
      'test-context',
      { provider: 'mock-provider' }
    );

    expect(session.id).toBeDefined();
    expect(session.context).toBe('test-context');
    expect(session.metadata.provider).toBe('mock-provider');
  });

  it('retrieves existing session by ID', async () => {
    const session1 = await manager.createSession(
      'context',
      { provider: 'mock-provider' }
    );

    const retrievedSession = await manager.getSession(session1.id);

    expect(retrievedSession).not.toBeNull();
    expect(retrievedSession?.id).toBe(session1.id);
    expect(retrievedSession?.context).toBe('context');
  });

  it('creates different sessions with unique IDs', async () => {
    const session1 = await manager.createSession(
      'context-1',
      { provider: 'mock-provider' }
    );

    const session2 = await manager.createSession(
      'context-2',
      { provider: 'mock-provider' }
    );

    expect(session1.id).not.toBe(session2.id);
    expect(session1.context).toBe('context-1');
    expect(session2.context).toBe('context-2');
  });

  it('handles sessions without specific provider support', async () => {
    const session = await manager.createSession(
      'context',
      { provider: 'no-session' }
    );

    expect(session.id).toBeDefined();
    expect(session.metadata.provider).toBe('no-session');
  });

  it('cleans up expired sessions', async () => {
    // Create a session
    const session = await manager.createSession('context', { provider: 'mock-provider' });
    
    // Verify session exists
    const retrievedSession = await manager.getSession(session.id);
    expect(retrievedSession).not.toBeNull();

    // Manually clean up with very short max age (1ms)
    const deletedCount = await manager.cleanup(1);
    
    expect(deletedCount).toBeGreaterThan(0);
  });

  it('can list created sessions', async () => {
    const session1 = await manager.createSession('context1', { provider: 'provider1' });
    const session2 = await manager.createSession('context2', { provider: 'provider2' });

    const sessions = await manager.listSessions();

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    const sessionIds = sessions.map(s => s.id);
    expect(sessionIds).toContain(session1.id);
    expect(sessionIds).toContain(session2.id);
  });

  it('can update existing sessions', async () => {
    const session = await manager.createSession('original-context', { provider: 'test-provider' });
    
    const updatedSession = await manager.updateSession(session.id, {
      context: 'updated-context',
      metadata: { ...session.metadata, promptCount: 5 }
    });

    expect(updatedSession.id).toBe(session.id);
    expect(updatedSession.context).toBe('updated-context');
    expect(updatedSession.metadata.promptCount).toBe(5);
    expect(updatedSession.updatedAt.getTime()).toBeGreaterThanOrEqual(session.updatedAt.getTime());
  });

  it('handles file read errors gracefully', async () => {
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    const session = await manager.getSession('non-existent-id');
    expect(session).toBeNull();
  });

  it('deletes sessions individually', async () => {
    const session1 = await manager.createSession('context1', { provider: 'provider1' });
    const session2 = await manager.createSession('context2', { provider: 'provider2' });

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
});
