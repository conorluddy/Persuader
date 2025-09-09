/**
 * Session Manager Implementation
 *
 * Provides persistent session storage and management with cross-platform
 * file system support, concurrent access safety, and comprehensive filtering.
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_CLEANUP_INTERVAL_MS,
  DEFAULT_MAX_SESSION_AGE_MS,
  DEFAULT_SESSION_DIR,
  SESSION_FILE_EXT,
} from '../shared/constants/index.js';
import type {
  Session,
  SessionConfig,
  SessionFilter,
  SessionManager as SessionManagerInterface,
  SessionMetadata,
} from '../types/session.js';

/**
 * File-based session manager implementation
 *
 * Provides persistent session storage with metadata tracking, filtering,
 * and automatic cleanup capabilities. Supports both persistent disk storage
 * and optional in-memory mode for testing.
 */
export class SessionManager implements SessionManagerInterface {
  private readonly config: SessionConfig;
  private readonly inMemoryMode: boolean;
  private readonly memoryStore: Map<string, Session> = new Map();
  private cleanupTimer: NodeJS.Timeout | undefined = undefined;

  constructor(config?: Partial<SessionConfig>, inMemoryMode = false) {
    this.inMemoryMode = inMemoryMode;
    this.config = {
      storageDir: this.resolveStorageDir(
        config?.storageDir || DEFAULT_SESSION_DIR
      ),
      maxAge: config?.maxAge || DEFAULT_MAX_SESSION_AGE_MS,
      persist: config?.persist ?? !inMemoryMode,
      cleanupInterval: config?.cleanupInterval || DEFAULT_CLEANUP_INTERVAL_MS,
    };

    // Start cleanup timer if persistence is enabled
    if (this.config.persist && this.config.cleanupInterval > 0) {
      this.startCleanupTimer();
    }
  }

  /**
   * Create a new session with optional context and metadata
   *
   * @param context - Optional global context to associate with this session.
   *                 This context will be included in all future prompt processing
   *                 for this session, providing consistent background information.
   * @param metadata - Optional session metadata including provider information,
   *                  model details, usage statistics, tags, and other tracking data.
   *                  Partial metadata will be merged with sensible defaults.
   * @returns Promise resolving to the newly created Session object with a unique ID,
   *          creation timestamp, and the provided context and metadata.
   * @throws Error if session creation fails due to storage issues or validation errors.
   *
   * @example
   * ```typescript
   * const session = await sessionManager.createSession(
   *   'You are an expert data analyst',
   *   { provider: 'claude-cli', model: 'claude-3-sonnet', tags: ['analysis'] }
   * );
   * console.log(`Created session ${session.id}`);
   * ```
   */
  async createSession(
    context?: string,
    metadata?: Partial<SessionMetadata>
  ): Promise<Session> {
    const now = new Date();
    const session: Session = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      context: context ?? undefined,
      providerData: {},
      metadata: {
        provider: metadata?.provider || 'unknown',
        model: metadata?.model ?? undefined,
        promptCount: metadata?.promptCount || 0,
        totalTokens: metadata?.totalTokens || 0,
        lastActivity: now,
        tags: metadata?.tags || [],
        active: metadata?.active ?? true,
      },
    };

    await this.saveSession(session);
    return session;
  }

  /**
   * Get an existing session
   */
  async getSession(sessionId: string): Promise<Session | null> {
    try {
      if (this.inMemoryMode) {
        return this.memoryStore.get(sessionId) || null;
      }

      const filePath = this.getSessionFilePath(sessionId);
      const content = await fs.readFile(filePath, 'utf-8');
      const sessionData = JSON.parse(content);

      return this.deserializeSession(sessionData);
    } catch {
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Session>
  ): Promise<Session> {
    const existingSession = await this.getSession(sessionId);
    if (!existingSession) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedSession: Session = {
      ...existingSession,
      ...updates,
      id: sessionId, // Ensure ID cannot be changed
      updatedAt: new Date(),
      metadata: {
        ...existingSession.metadata,
        ...updates.metadata,
        // Only set lastActivity to current time if not explicitly provided
        lastActivity: updates.metadata?.lastActivity || new Date(),
      },
    };

    await this.saveSession(updatedSession);
    return updatedSession;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (this.inMemoryMode) {
      this.memoryStore.delete(sessionId);
      return;
    }

    try {
      const filePath = this.getSessionFilePath(sessionId);
      await fs.unlink(filePath);
    } catch {
      // Ignore errors if session doesn't exist
    }
  }

  /**
   * List sessions with optional filtering
   */
  async listSessions(filter?: SessionFilter): Promise<Session[]> {
    let sessions: Session[];

    if (this.inMemoryMode) {
      sessions = Array.from(this.memoryStore.values());
    } else {
      sessions = await this.loadAllSessions();
    }

    // Apply filters
    if (filter) {
      sessions = this.applyFilter(sessions, filter);
    }

    // Apply sorting
    if (filter?.sortBy) {
      sessions = this.sortSessions(
        sessions,
        filter.sortBy,
        filter.sortOrder || 'desc'
      );
    }

    // Apply limit
    if (filter?.limit && filter.limit > 0) {
      sessions = sessions.slice(0, filter.limit);
    }

    return sessions;
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(maxAge?: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - (maxAge || this.config.maxAge));
    let deletedCount = 0;

    if (this.inMemoryMode) {
      for (const [id, session] of this.memoryStore.entries()) {
        if (session.metadata.lastActivity < cutoffTime) {
          this.memoryStore.delete(id);
          deletedCount++;
        }
      }
    } else {
      const sessions = await this.loadAllSessions();
      for (const session of sessions) {
        if (session.metadata.lastActivity < cutoffTime) {
          await this.deleteSession(session.id);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  }

  /**
   * Get session usage statistics
   */
  async getStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalPrompts: number;
    totalTokens: number;
    providerBreakdown: Record<string, number>;
  }> {
    const sessions = await this.listSessions();

    const stats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.metadata.active).length,
      totalPrompts: sessions.reduce(
        (sum, s) => sum + s.metadata.promptCount,
        0
      ),
      totalTokens: sessions.reduce((sum, s) => sum + s.metadata.totalTokens, 0),
      providerBreakdown: {} as Record<string, number>,
    };

    // Calculate provider breakdown
    for (const session of sessions) {
      const provider = session.metadata.provider;
      stats.providerBreakdown[provider] =
        (stats.providerBreakdown[provider] || 0) + 1;
    }

    return stats;
  }

  /**
   * Destroy the session manager and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.memoryStore.clear();
  }

  // Private methods

  private async saveSession(session: Session): Promise<void> {
    if (this.inMemoryMode) {
      this.memoryStore.set(session.id, session);
      return;
    }

    if (!this.config.persist) {
      return;
    }

    await this.ensureStorageDirectory();
    const filePath = this.getSessionFilePath(session.id);
    const serialized = this.serializeSession(session);
    await fs.writeFile(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
  }

  private async loadAllSessions(): Promise<Session[]> {
    if (!this.config.persist) {
      return [];
    }

    try {
      await this.ensureStorageDirectory();
      const files = await fs.readdir(this.config.storageDir);
      const sessionFiles = files.filter(file =>
        file.endsWith(SESSION_FILE_EXT)
      );

      const sessions: Session[] = [];
      for (const file of sessionFiles) {
        try {
          const filePath = path.join(this.config.storageDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const sessionData = JSON.parse(content);
          sessions.push(this.deserializeSession(sessionData));
        } catch {}
      }

      return sessions;
    } catch {
      return [];
    }
  }

  private applyFilter(sessions: Session[], filter: SessionFilter): Session[] {
    return sessions.filter(session => {
      // Provider filter
      if (filter.provider && session.metadata.provider !== filter.provider) {
        return false;
      }

      // Model filter
      if (filter.model && session.metadata.model !== filter.model) {
        return false;
      }

      // Active filter
      if (
        filter.active !== undefined &&
        session.metadata.active !== filter.active
      ) {
        return false;
      }

      // Date range filters
      if (filter.createdAfter && session.createdAt < filter.createdAfter) {
        return false;
      }

      if (filter.createdBefore && session.createdAt > filter.createdBefore) {
        return false;
      }

      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        const sessionTags = session.metadata.tags || [];
        const hasAllTags = filter.tags.every(tag => sessionTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      return true;
    });
  }

  private sortSessions(
    sessions: Session[],
    sortBy: 'createdAt' | 'updatedAt' | 'lastActivity',
    sortOrder: 'asc' | 'desc'
  ): Session[] {
    return sessions.sort((a, b) => {
      let dateA: Date;
      let dateB: Date;

      switch (sortBy) {
        case 'createdAt':
          dateA = a.createdAt;
          dateB = b.createdAt;
          break;
        case 'updatedAt':
          dateA = a.updatedAt;
          dateB = b.updatedAt;
          break;
        case 'lastActivity':
          dateA = a.metadata.lastActivity;
          dateB = b.metadata.lastActivity;
          break;
      }

      const comparison = dateA.getTime() - dateB.getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  private serializeSession(session: Session): Record<string, unknown> {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      metadata: {
        ...session.metadata,
        lastActivity: session.metadata.lastActivity.toISOString(),
      },
    };
  }

  private deserializeSession(data: Record<string, unknown>): Session {
    const metadata = data.metadata as Record<string, unknown>;
    return {
      ...data,
      createdAt: new Date(data.createdAt as string),
      updatedAt: new Date(data.updatedAt as string),
      metadata: {
        ...metadata,
        lastActivity: new Date(metadata.lastActivity as string),
      },
    } as Session;
  }

  private resolveStorageDir(dir: string): string {
    if (dir.startsWith('~')) {
      return path.join(os.homedir(), dir.slice(1));
    }
    return path.resolve(dir);
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.config.storageDir, `${sessionId}${SESSION_FILE_EXT}`);
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.storageDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create session storage directory: ${error}`);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup();
      } catch {
        // Ignore cleanup errors in background
      }
    }, this.config.cleanupInterval);

    // Don't keep the process alive for cleanup timer
    this.cleanupTimer.unref();
  }
}

/**
 * Default session manager instance
 */
export const defaultSessionManager = new SessionManager();

/**
 * Create a new session manager with custom configuration
 */
export function createSessionManager(
  config?: Partial<SessionConfig>,
  inMemoryMode = false
): SessionManager {
  return new SessionManager(config, inMemoryMode);
}
