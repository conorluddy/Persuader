import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultSessionManager,
  SessionManager,
} from '../../src/session/manager.js';
import type { ProviderAdapter } from '../../src/types/provider.js';

vi.mock('node:fs/promises');

describe.skip('SessionManager', () => {
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
    const sessionId = await manager.getOrCreateSession(
      'test-key',
      'test-context',
      mockProvider
    );

    expect(sessionId).toBe('session-123');
    expect(mockProvider.createSession).toHaveBeenCalledWith('test-context');
  });

  it('reuses existing session for same key', async () => {
    const sessionId1 = await manager.getOrCreateSession(
      'test-key',
      'context',
      mockProvider
    );

    const sessionId2 = await manager.getOrCreateSession(
      'test-key',
      'context',
      mockProvider
    );

    expect(sessionId1).toBe(sessionId2);
    expect(mockProvider.createSession).toHaveBeenCalledTimes(1);
  });

  it('creates different sessions for different keys', async () => {
    vi.mocked(mockProvider.createSession)
      .mockResolvedValueOnce('session-1')
      .mockResolvedValueOnce('session-2');

    const sessionId1 = await manager.getOrCreateSession(
      'key-1',
      'context',
      mockProvider
    );

    const sessionId2 = await manager.getOrCreateSession(
      'key-2',
      'context',
      mockProvider
    );

    expect(sessionId1).toBe('session-1');
    expect(sessionId2).toBe('session-2');
    expect(mockProvider.createSession).toHaveBeenCalledTimes(2);
  });

  it('handles provider without session support', async () => {
    const noSessionProvider: ProviderAdapter = {
      name: 'no-session',
      supportsSession: false,
      sendPrompt: vi.fn(),
    };

    const sessionId = await manager.getOrCreateSession(
      'test-key',
      'context',
      noSessionProvider
    );

    expect(sessionId).toBeNull();
  });

  it('cleans up expired sessions', async () => {
    await manager.getOrCreateSession('test-key', 'context', mockProvider);

    expect(manager.hasSession('test-key')).toBe(true);

    // Fast-forward past cleanup timeout
    vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes

    expect(manager.hasSession('test-key')).toBe(false);
  });

  it('persists sessions to file', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    await manager.getOrCreateSession('test-key', 'context', mockProvider);
    await manager.persistSessions();

    expect(mockFs.writeFile).toHaveBeenCalled();
    const writeCall = mockFs.writeFile.mock.calls[0];
    expect(writeCall[0]).toContain('session-state.json');

    const writtenData = JSON.parse(writeCall[1] as string);
    expect(writtenData).toHaveProperty('sessions');
    expect(writtenData.sessions).toHaveProperty('test-key');
  });

  it('loads sessions from file', async () => {
    const savedSessions = {
      sessions: {
        'saved-key': {
          sessionId: 'saved-session',
          providerName: 'mock-provider',
          context: 'saved-context',
          createdAt: new Date().toISOString(),
        },
      },
    };

    mockFs.readFile.mockResolvedValue(JSON.stringify(savedSessions));

    await manager.loadSessions();

    expect(manager.hasSession('saved-key')).toBe(true);
    const sessionId = await manager.getOrCreateSession(
      'saved-key',
      'saved-context',
      mockProvider
    );
    expect(sessionId).toBe('saved-session');
    expect(mockProvider.createSession).not.toHaveBeenCalled();
  });

  it('handles file read errors gracefully', async () => {
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    await expect(manager.loadSessions()).resolves.not.toThrow();
  });

  it('clears all sessions', () => {
    manager.sessions.set('key1', {
      sessionId: 'session1',
      providerName: 'provider1',
      context: 'context1',
      createdAt: new Date(),
    });
    manager.sessions.set('key2', {
      sessionId: 'session2',
      providerName: 'provider2',
      context: 'context2',
      createdAt: new Date(),
    });

    expect(manager.hasSession('key1')).toBe(true);
    expect(manager.hasSession('key2')).toBe(true);

    manager.clearAllSessions();

    expect(manager.hasSession('key1')).toBe(false);
    expect(manager.hasSession('key2')).toBe(false);
  });

  it('generates consistent session keys', () => {
    const key1 = manager.generateSessionKey('context', 'provider');
    const key2 = manager.generateSessionKey('context', 'provider');
    const key3 = manager.generateSessionKey('different', 'provider');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });
});
