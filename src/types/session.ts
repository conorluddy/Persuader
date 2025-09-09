/**
 * Session Management Types
 *
 * Type definitions for session persistence, management, and filtering.
 * Sessions enable context continuity across multiple pipeline operations.
 */

/**
 * Session information for context persistence
 */
export interface Session {
  /** Unique session identifier */
  readonly id: string;

  /** Session creation timestamp */
  readonly createdAt: Date;

  /** Last update timestamp */
  readonly updatedAt: Date;

  /** Global context for this session */
  readonly context: string | undefined;

  /** Provider-specific session data */
  readonly providerData: Record<string, unknown> | undefined;

  /** Session metadata */
  readonly metadata: SessionMetadata;
}

/**
 * Session metadata for tracking and management
 */
export interface SessionMetadata {
  /** Provider used for this session */
  readonly provider: string;

  /** Model used for this session */
  readonly model: string | undefined;

  /** Total prompts sent in this session */
  readonly promptCount: number;

  /** Total tokens used in this session */
  readonly totalTokens: number;

  /** Last activity timestamp */
  readonly lastActivity: Date;

  /** Session tags for organization */
  readonly tags?: readonly string[];

  /** Whether session is active */
  readonly active: boolean;

  /** JSONL log file path for this session (if logging enabled) */
  readonly logFile?: string;

  /** Total cost for this session */
  readonly totalCost?: number;
}

/**
 * Session manager interface for persistence
 */
export interface SessionManager {
  /**
   * Create a new session
   */
  createSession(
    context?: string,
    metadata?: Partial<SessionMetadata>
  ): Promise<Session>;

  /**
   * Get an existing session
   */
  getSession(sessionId: string): Promise<Session | null>;

  /**
   * Update session data
   */
  updateSession(sessionId: string, updates: Partial<Session>): Promise<Session>;

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * List sessions with optional filtering
   */
  listSessions(filter?: SessionFilter): Promise<Session[]>;

  /**
   * Clean up expired sessions
   */
  cleanup(maxAge?: number): Promise<number>;
}

/**
 * Filter criteria for session queries
 */
export interface SessionFilter {
  /** Filter by provider */
  readonly provider?: string;

  /** Filter by model */
  readonly model?: string;

  /** Filter by active status */
  readonly active?: boolean;

  /** Filter by creation date range */
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;

  /** Filter by tags */
  readonly tags?: readonly string[];

  /** Maximum number of results */
  readonly limit?: number;

  /** Sort order */
  readonly sortBy?: 'createdAt' | 'updatedAt' | 'lastActivity';
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Directory for session persistence */
  readonly storageDir: string;

  /** Session expiration time in milliseconds */
  readonly maxAge: number;

  /** Whether to persist sessions to disk */
  readonly persist: boolean;

  /** Cleanup interval in milliseconds */
  readonly cleanupInterval: number;
}
