/**
 * Session Management Types
 *
 * Type definitions for session persistence, management, and filtering.
 * Sessions enable context continuity across multiple pipeline operations.
 */

/**
 * Success feedback information for session-based learning
 *
 * Stores positive reinforcement messages sent after successful validation
 * to help the LLM understand and maintain successful patterns.
 */
export interface SessionSuccessFeedback {
  /** The success message sent to the LLM */
  readonly message: string;

  /** Validated output that triggered the success feedback */
  readonly validatedOutput: unknown;

  /** Attempt number when success occurred (1-indexed) */
  readonly attemptNumber: number;

  /** Timestamp when success feedback was sent */
  readonly timestamp: Date;

  /** Optional metadata about the successful operation */
  readonly metadata?: {
    /** Schema name or identifier */
    readonly schemaName?: string;
    /** Token usage for the successful request */
    readonly tokenUsage?: {
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly totalTokens: number;
    };
    /** Execution time for the successful request */
    readonly executionTimeMs?: number;
  };
}

/**
 * Session performance and success metrics
 *
 * Tracks success rates and performance data for session-based learning.
 * Provides insights into validation patterns and optimization opportunities.
 */
export interface SessionMetrics {
  /** Total number of validation attempts across all operations */
  readonly totalAttempts: number;

  /** Number of successful validations */
  readonly successfulValidations: number;

  /** Average number of attempts needed to achieve success */
  readonly avgAttemptsToSuccess: number;

  /** Success rate as a percentage (0-1) */
  readonly successRate: number;

  /** Timestamp of the most recent successful validation */
  readonly lastSuccessTimestamp?: Date;

  /** Total execution time across all attempts (milliseconds) */
  readonly totalExecutionTimeMs: number;

  /** Average execution time per attempt (milliseconds) */
  readonly avgExecutionTimeMs: number;

  /** Total token usage across all attempts */
  readonly totalTokenUsage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
  };

  /** Number of operations that required retry attempts */
  readonly operationsWithRetries: number;

  /** Maximum number of attempts needed for any single operation */
  readonly maxAttemptsForOperation: number;
}

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

  /** Success feedback history for session-based learning */
  readonly successFeedback?: readonly SessionSuccessFeedback[];

  /** Performance and success metrics for this session */
  readonly metrics?: SessionMetrics;
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

  /**
   * Add success feedback to a session
   *
   * Appends positive reinforcement feedback to the session's learning history.
   * This feedback helps maintain successful patterns across multiple requests.
   *
   * @param sessionId - Session to add feedback to
   * @param feedback - Success feedback information
   * @returns Updated session with new feedback
   */
  addSuccessFeedback?(
    sessionId: string,
    feedback: SessionSuccessFeedback
  ): Promise<Session>;

  /**
   * Get success feedback history for a session
   *
   * Retrieves all success feedback messages for learning context.
   * Useful for understanding what patterns have been successful.
   *
   * @param sessionId - Session to get feedback for
   * @param limit - Maximum number of feedback entries to return (most recent first)
   * @returns Array of success feedback entries
   */
  getSuccessFeedback?(
    sessionId: string,
    limit?: number
  ): Promise<readonly SessionSuccessFeedback[]>;

  /**
   * Get performance metrics for a session
   *
   * Calculates success rates, average attempts, and other performance metrics
   * for analyzing session effectiveness and optimization opportunities.
   *
   * @param sessionId - Session to get metrics for
   * @returns Session performance metrics
   */
  getSessionMetrics?(sessionId: string): Promise<SessionMetrics | null>;
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
