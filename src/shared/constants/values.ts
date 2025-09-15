/**
 * Persuader Framework Branded Constants
 *
 * All numeric constants using branded types for compile-time safety
 * and runtime validation. These replace magic numbers scattered throughout
 * the codebase with well-documented, type-safe constants.
 *
 * @since 2.0.0
 */

import {
  type BufferSizeBytes,
  bufferSizeBytes,
  type DelayMs,
  delayMs,
  type MaxTokens,
  maxTokens,
  type RetryCount,
  retryCount,
  type Temperature,
  type TimeoutMs,
  type TokenEstimationDivisor,
  temperature,
  timeoutMs,
  tokenEstimationDivisor,
} from './branded-types.js';

// ============================================================================
// TIMEOUT CONSTANTS
// ============================================================================

/**
 * Maximum timeout for Claude CLI requests.
 *
 * Set to 10 minutes to balance between:
 * - Allowing complex LLM processing to complete
 * - Preventing indefinite hangs in production
 * - Matching Claude CLI's internal timeout limits
 *
 * @since v2.0.0
 */
export const CLAUDE_CLI_MAX_TIMEOUT_MS: TimeoutMs = timeoutMs(600000);

/**
 * Default timeout for Claude CLI requests.
 *
 * Set to 2 minutes as a reasonable default for most operations:
 * - Covers 95% of typical LLM response times
 * - Provides feedback before users assume the system is hung
 * - Can be overridden for specific long-running operations
 *
 * @since v2.0.0
 */
export const DEFAULT_REQUEST_TIMEOUT_MS: TimeoutMs = timeoutMs(120000);

/**
 * Default session lifetime.
 *
 * Set to 1 hour to balance between:
 * - Keeping sessions alive for batch operations
 * - Not consuming server resources indefinitely
 * - Allowing reasonable user interaction patterns
 *
 * Note: This represents session lifetime, not request timeout.
 * Uses DelayMs type which allows longer durations than TimeoutMs.
 *
 * @since v2.0.0
 */
export const DEFAULT_SESSION_TIMEOUT_MS: DelayMs = delayMs(3600000);

/**
 * Short timeout for health checks and availability tests.
 *
 * @since v2.0.0
 */
export const HEALTH_CHECK_TIMEOUT_MS: TimeoutMs = timeoutMs(5000);

// ============================================================================
// RETRY CONSTANTS
// ============================================================================

/**
 * Default number of retry attempts for validation failures.
 *
 * Set to 3 retries based on:
 * - Most validation issues resolve within 1-2 retries
 * - Provides reasonable failure recovery
 * - Prevents excessive API usage on persistent failures
 *
 * @since v2.0.0
 */
export const DEFAULT_RETRIES: RetryCount = retryCount(3);

/**
 * Maximum reasonable number of retries for any operation.
 *
 * Hard limit to prevent infinite retry loops and excessive API usage.
 *
 * @since v2.0.0
 */
export const MAX_REASONABLE_RETRIES: RetryCount = retryCount(10);

// ============================================================================
// DELAY CONSTANTS
// ============================================================================

/**
 * Base retry delay in milliseconds.
 *
 * Starting point for exponential backoff calculations.
 *
 * @since v2.0.0
 */
export const BASE_RETRY_DELAY_MS: DelayMs = delayMs(1000);

/**
 * Maximum retry delay in milliseconds.
 *
 * Caps exponential backoff to prevent excessive wait times.
 *
 * @since v2.0.0
 */
export const MAX_RETRY_DELAY_MS: DelayMs = delayMs(10000);

/**
 * Default session cleanup interval.
 *
 * How often to check for expired sessions (24 hours).
 *
 * @since v2.0.0
 */
export const DEFAULT_CLEANUP_INTERVAL_MS: DelayMs = delayMs(86400000);

// ============================================================================
// BUFFER SIZE CONSTANTS
// ============================================================================

/**
 * Maximum buffer size for Claude CLI output.
 *
 * Set to 10MB to handle:
 * - Large JSON responses
 * - Detailed error messages
 * - Comprehensive analysis results
 * - While preventing memory exhaustion
 *
 * @since v2.0.0
 */
export const CLAUDE_CLI_MAX_BUFFER: BufferSizeBytes = bufferSizeBytes(10485760);

// ============================================================================
// TOKEN ESTIMATION CONSTANTS
// ============================================================================

/**
 * Rough token estimation divisor for character-to-token conversion.
 *
 * Based on empirical analysis showing ~4 characters per token
 * for typical English text. Used for:
 * - Quick token usage estimation
 * - Request size validation
 * - Cost calculations
 *
 * Note: This is an approximation. Actual tokenization varies by model.
 *
 * @since v2.0.0
 */
export const TOKEN_ESTIMATION_DIVISOR: TokenEstimationDivisor =
  tokenEstimationDivisor(4);

// ============================================================================
// LLM MODEL DEFAULTS
// ============================================================================

/**
 * Default maximum tokens to generate.
 *
 * Set to 4096 as a reasonable default for most use cases:
 * - Sufficient for detailed responses
 * - Not excessive for token costs
 * - Within limits of all supported models
 *
 * @since v2.0.0
 */
export const DEFAULT_MAX_TOKENS: MaxTokens = maxTokens(4096);

/**
 * Maximum context length for sessions.
 *
 * Set based on current Claude model capabilities.
 *
 * @since v2.0.0
 */
export const DEFAULT_MAX_CONTEXT_LENGTH: MaxTokens = maxTokens(200000);

/**
 * Default temperature for generation.
 *
 * Set to 0.4 for deterministic, consistent responses:
 * - Lower temperature for more predictable outputs
 * - Better for reliable structured output and validation
 * - Reduces variability while maintaining quality
 *
 * @since v2.0.0
 */
export const DEFAULT_TEMPERATURE: Temperature = temperature(0.4);

// ============================================================================
// MULTIPLIERS AND RATIOS
// ============================================================================

/**
 * Retry delay multiplier for exponential backoff.
 *
 * Each retry delay is multiplied by this factor.
 * Set to 1.5 for gradual backoff that's not too aggressive.
 *
 * @since v2.0.0
 */
export const RETRY_DELAY_MULTIPLIER = 1.5 as const;

/**
 * JSON indentation for pretty-printing.
 *
 * @since v2.0.0
 */
export const JSON_INDENT = 2 as const;

// ============================================================================
// MAXIMUM AGE CONSTANTS
// ============================================================================

/**
 * Default maximum session age in milliseconds (30 days).
 *
 * Sessions older than this are considered expired and eligible for cleanup.
 *
 * @since v2.0.0
 */
export const DEFAULT_MAX_SESSION_AGE_MS: DelayMs = delayMs(2592000000);

// ============================================================================
// STRING CONSTANTS (Non-branded)
// ============================================================================

/**
 * Default LLM model identifier.
 * Using Haiku for faster, more efficient processing by default.
 *
 * @since v2.0.0
 */
export const DEFAULT_MODEL = 'claude-3-5-haiku-20241022' as const;

/**
 * Claude CLI binary name (can be overridden).
 *
 * @since v2.0.0
 */
export const CLAUDE_CLI_BINARY = 'claude' as const;

/**
 * Common stop sequences for JSON generation.
 *
 * @since v2.0.0
 */
export const JSON_STOP_SEQUENCES = ['```', '---', '\n\n\n'] as const;

/**
 * Default session storage directory (relative to user home).
 *
 * @since v2.0.0
 */
export const DEFAULT_SESSION_DIR = '~/.persuader/sessions' as const;

/**
 * Session file extension.
 *
 * @since v2.0.0
 */
export const SESSION_FILE_EXT = '.json' as const;

/**
 * Framework version.
 *
 * @since v2.0.0
 */
export const PERSUADER_VERSION = '0.1.0' as const;

// ============================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Legacy constant for backwards compatibility.
 * @deprecated Use DEFAULT_REQUEST_TIMEOUT_MS instead
 */
export const DEFAULT_REQUEST_TIMEOUT = DEFAULT_REQUEST_TIMEOUT_MS;

/**
 * Legacy constant for backwards compatibility.
 * @deprecated Use DEFAULT_SESSION_TIMEOUT_MS instead
 */
export const DEFAULT_SESSION_TIMEOUT = DEFAULT_SESSION_TIMEOUT_MS;

/**
 * Legacy constant for backwards compatibility.
 * @deprecated Use DEFAULT_REQUEST_TIMEOUT_MS instead
 */
export const CLAUDE_CLI_TIMEOUT = DEFAULT_REQUEST_TIMEOUT_MS;
