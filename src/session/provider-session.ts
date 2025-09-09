/**
 * Provider Session Integration
 *
 * Provides integration utilities for managing sessions between the SessionManager
 * and provider adapters like Claude CLI, enabling seamless session reuse and
 * token efficiency optimization.
 */

import type {
  ProviderAdapter,
  ProviderSessionOptions,
} from '../types/provider.js';
import type {
  Session,
  SessionManager,
  SessionMetadata,
} from '../types/session.js';

/**
 * Provider session management utilities
 *
 * Bridges the gap between the generic SessionManager and provider-specific
 * session handling, ensuring optimal session reuse and context management.
 */
export class ProviderSessionManager {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly provider: ProviderAdapter
  ) {}

  /**
   * Ensure a session exists for the provider
   *
   * This method implements the session reuse logic described in the issue:
   * - Try to reuse existing session if sessionId provided
   * - Try to load latest session for the provider
   * - Create new session if none exists
   */
  async ensureSession(
    context?: string,
    sessionId?: string,
    options?: ProviderSessionOptions
  ): Promise<{ sessionId: string; session: Session; isNew: boolean }> {
    let session: Session | undefined;
    let isNew = false;

    // Try to use provided session ID first
    if (sessionId) {
      session = (await this.sessionManager.getSession(sessionId)) ?? undefined;
      if (session && session.metadata.provider === this.provider.name) {
        // Update last activity
        await this.sessionManager.updateSession(sessionId, {
          metadata: {
            ...session.metadata,
            lastActivity: new Date(),
          },
        });
        return { sessionId, session, isNew: false };
      }
    }

    // Try to find existing session for this provider
    const existingSessions = await this.sessionManager.listSessions({
      provider: this.provider.name,
      active: true,
      sortBy: 'lastActivity',
      sortOrder: 'desc',
      limit: 1,
    });

    if (existingSessions.length > 0) {
      const existingSession = existingSessions[0];
      if (!existingSession) {
        throw new Error('Unexpected: existingSessions[0] is undefined');
      }
      // Update last activity
      await this.sessionManager.updateSession(existingSession.id, {
        metadata: {
          ...existingSession.metadata,
          lastActivity: new Date(),
        },
      });
      return {
        sessionId: existingSession.id,
        session: existingSession,
        isNew: false,
      };
    }

    // Create new session
    if (!this.provider.supportsSession || !this.provider.createSession) {
      throw new Error(
        `Provider ${this.provider.name} does not support sessions`
      );
    }

    // Create session with provider
    const providerSessionId = await this.provider.createSession(
      context || '',
      options
    );

    // Create session record in session manager
    const metadata: Partial<SessionMetadata> = {
      provider: this.provider.name,
      model: options?.model ?? undefined,
      promptCount: 0,
      totalTokens: 0,
      active: true,
      tags: [],
    };

    session = await this.sessionManager.createSession(context, metadata);
    isNew = true;

    // Store the provider session ID in provider data
    await this.sessionManager.updateSession(session.id, {
      providerData: {
        ...session.providerData,
        providerSessionId,
      },
    });

    const updatedSession = await this.sessionManager.getSession(session.id);
    if (!updatedSession) {
      throw new Error(`Failed to retrieve updated session ${session.id}`);
    }

    return {
      sessionId: session.id,
      session: updatedSession,
      isNew,
    };
  }

  /**
   * Update session after a provider interaction
   *
   * Updates session metadata with token usage and activity tracking
   */
  async updateSessionAfterPrompt(
    sessionId: string,
    _promptLength: number,
    _responseTokens: number = 0,
    totalTokens: number = 0
  ): Promise<Session> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedMetadata: Partial<SessionMetadata> = {
      promptCount: session.metadata.promptCount + 1,
      totalTokens: session.metadata.totalTokens + totalTokens,
      lastActivity: new Date(),
    };

    return await this.sessionManager.updateSession(sessionId, {
      metadata: {
        ...session.metadata,
        ...updatedMetadata,
      },
    });
  }

  /**
   * Get the provider session ID for a managed session
   */
  async getProviderSessionId(sessionId: string): Promise<string | null> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      return null;
    }

    return (session.providerData?.providerSessionId as string) || null;
  }

  /**
   * Mark session as inactive
   */
  async deactivateSession(sessionId: string): Promise<void> {
    await this.sessionManager.updateSession(sessionId, {
      metadata: {
        ...((await this.sessionManager.getSession(sessionId))?.metadata ||
          ({} as SessionMetadata)),
        active: false,
      },
    });
  }

  /**
   * Get session statistics for the provider
   */
  async getProviderStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalPrompts: number;
    totalTokens: number;
    averagePromptsPerSession: number;
    averageTokensPerSession: number;
  }> {
    const sessions = await this.sessionManager.listSessions({
      provider: this.provider.name,
    });

    const activeSessions = sessions.filter(s => s.metadata.active);
    const totalPrompts = sessions.reduce(
      (sum, s) => sum + s.metadata.promptCount,
      0
    );
    const totalTokens = sessions.reduce(
      (sum, s) => sum + s.metadata.totalTokens,
      0
    );

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      totalPrompts,
      totalTokens,
      averagePromptsPerSession:
        sessions.length > 0 ? totalPrompts / sessions.length : 0,
      averageTokensPerSession:
        sessions.length > 0 ? totalTokens / sessions.length : 0,
    };
  }

  /**
   * Clean up old sessions for the provider
   */
  async cleanup(maxAge?: number): Promise<number> {
    const sessions = await this.sessionManager.listSessions({
      provider: this.provider.name,
    });

    const cutoffTime = new Date(
      Date.now() - (maxAge || 30 * 24 * 60 * 60 * 1000)
    ); // 30 days default
    let deletedCount = 0;

    for (const session of sessions) {
      if (session.metadata.lastActivity < cutoffTime) {
        // Try to destroy provider session if supported
        const providerSessionId = session.providerData
          ?.providerSessionId as string;
        if (providerSessionId && this.provider.destroySession) {
          try {
            await this.provider.destroySession(providerSessionId);
          } catch {
            // Ignore errors when cleaning up provider sessions
          }
        }

        await this.sessionManager.deleteSession(session.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

/**
 * Create a provider session manager
 */
export function createProviderSessionManager(
  sessionManager: SessionManager,
  provider: ProviderAdapter
): ProviderSessionManager {
  return new ProviderSessionManager(sessionManager, provider);
}

/**
 * Session management utilities for common patterns
 */
export const SessionUtils = {
  /**
   * Calculate token efficiency savings from session reuse
   */
  calculateTokenSavings(
    sessionsWithReuse: Array<{ promptCount: number; totalTokens: number }>,
    estimatedTokensPerPromptWithoutSession: number
  ): {
    totalTokensUsed: number;
    totalTokensWouldBeUsedWithoutSessions: number;
    tokensSaved: number;
    efficiencyPercentage: number;
  } {
    const totalTokensUsed = sessionsWithReuse.reduce(
      (sum, s) => sum + s.totalTokens,
      0
    );
    const totalPrompts = sessionsWithReuse.reduce(
      (sum, s) => sum + s.promptCount,
      0
    );
    const totalTokensWouldBeUsedWithoutSessions =
      totalPrompts * estimatedTokensPerPromptWithoutSession;
    const tokensSaved = totalTokensWouldBeUsedWithoutSessions - totalTokensUsed;
    const efficiencyPercentage =
      totalTokensWouldBeUsedWithoutSessions > 0
        ? (tokensSaved / totalTokensWouldBeUsedWithoutSessions) * 100
        : 0;

    return {
      totalTokensUsed,
      totalTokensWouldBeUsedWithoutSessions,
      tokensSaved: Math.max(0, tokensSaved),
      efficiencyPercentage: Math.max(0, efficiencyPercentage),
    };
  },

  /**
   * Generate session context summary for debugging
   */
  formatSessionSummary(session: Session): string {
    const { metadata } = session;
    return [
      `Session ${session.id}`,
      `Provider: ${metadata.provider}${metadata.model ? ` (${metadata.model})` : ''}`,
      `Created: ${session.createdAt.toISOString()}`,
      `Last Activity: ${metadata.lastActivity.toISOString()}`,
      `Prompts: ${metadata.promptCount}, Tokens: ${metadata.totalTokens}`,
      `Active: ${metadata.active ? 'Yes' : 'No'}`,
      `Tags: ${metadata.tags?.join(', ') || 'None'}`,
    ].join('\n');
  },

  /**
   * Validate session compatibility with provider
   */
  isSessionCompatible(session: Session, provider: ProviderAdapter): boolean {
    return session.metadata.provider === provider.name;
  },
};
