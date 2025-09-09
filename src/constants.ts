/**
 * Persuader Framework Constants
 *
 * Default values and configuration constants used throughout the framework.
 * These provide sensible defaults while allowing full customization.
 *
 * @deprecated This file is being migrated to the shared constants module.
 * Use imports from '@/shared/constants' for new code.
 */

// Re-export everything from the new shared constants module
export * from './shared/constants/index.js';

// Legacy exports for backwards compatibility
// These will be removed in a future version
import {
  BASE_RETRY_DELAY_MS,
  DEFAULT_CLEANUP_INTERVAL_MS,
  DEFAULT_MAX_SESSION_AGE_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SESSION_TIMEOUT_MS,
  MAX_RETRY_DELAY_MS,
  CLAUDE_CLI_BINARY as NEW_CLAUDE_CLI_BINARY,
  CLAUDE_CLI_MAX_BUFFER as NEW_CLAUDE_CLI_MAX_BUFFER,
  DEFAULT_MAX_CONTEXT_LENGTH as NEW_DEFAULT_MAX_CONTEXT_LENGTH,
  DEFAULT_MAX_TOKENS as NEW_DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL as NEW_DEFAULT_MODEL,
  DEFAULT_RETRIES as NEW_DEFAULT_RETRIES,
  DEFAULT_SESSION_DIR as NEW_DEFAULT_SESSION_DIR,
  DEFAULT_TEMPERATURE as NEW_DEFAULT_TEMPERATURE,
  JSON_INDENT as NEW_JSON_INDENT,
  JSON_STOP_SEQUENCES as NEW_JSON_STOP_SEQUENCES,
  PERSUADER_VERSION as NEW_PERSUADER_VERSION,
  RETRY_DELAY_MULTIPLIER as NEW_RETRY_DELAY_MULTIPLIER,
  SESSION_FILE_EXT as NEW_SESSION_FILE_EXT,
} from './shared/constants/index.js';

// Legacy constants maintained for backwards compatibility
// These unwrap branded types to plain numbers for existing code

/**
 * @deprecated Use DEFAULT_RETRIES from shared/constants instead
 */
export const DEFAULT_RETRIES = NEW_DEFAULT_RETRIES;

/**
 * @deprecated Use DEFAULT_MODEL from shared/constants instead
 */
export const DEFAULT_MODEL = NEW_DEFAULT_MODEL;

/**
 * @deprecated Use DEFAULT_MAX_TOKENS from shared/constants instead
 */
export const DEFAULT_MAX_TOKENS = NEW_DEFAULT_MAX_TOKENS;

/**
 * @deprecated Use DEFAULT_TEMPERATURE from shared/constants instead
 */
export const DEFAULT_TEMPERATURE = NEW_DEFAULT_TEMPERATURE;

/**
 * @deprecated Use DEFAULT_SESSION_TIMEOUT_MS from shared/constants instead
 */
export const DEFAULT_SESSION_TIMEOUT = DEFAULT_SESSION_TIMEOUT_MS;

/**
 * @deprecated Use DEFAULT_MAX_CONTEXT_LENGTH from shared/constants instead
 */
export const DEFAULT_MAX_CONTEXT_LENGTH = NEW_DEFAULT_MAX_CONTEXT_LENGTH;

/**
 * @deprecated Use DEFAULT_REQUEST_TIMEOUT_MS from shared/constants instead
 */
export const DEFAULT_REQUEST_TIMEOUT = DEFAULT_REQUEST_TIMEOUT_MS;

/**
 * @deprecated Use RETRY_DELAY_MULTIPLIER from shared/constants instead
 */
export const RETRY_DELAY_MULTIPLIER = NEW_RETRY_DELAY_MULTIPLIER;

/**
 * @deprecated Use BASE_RETRY_DELAY_MS from shared/constants instead
 */
export const BASE_RETRY_DELAY = BASE_RETRY_DELAY_MS;

/**
 * @deprecated Use MAX_RETRY_DELAY_MS from shared/constants instead
 */
export const MAX_RETRY_DELAY = MAX_RETRY_DELAY_MS;

/**
 * @deprecated Use JSON_STOP_SEQUENCES from shared/constants instead
 */
export const JSON_STOP_SEQUENCES = NEW_JSON_STOP_SEQUENCES;

/**
 * @deprecated Use CLAUDE_CLI_BINARY from shared/constants instead
 */
export const CLAUDE_CLI_BINARY = NEW_CLAUDE_CLI_BINARY;

/**
 * @deprecated Use DEFAULT_REQUEST_TIMEOUT_MS from shared/constants instead
 */
export const CLAUDE_CLI_TIMEOUT = DEFAULT_REQUEST_TIMEOUT_MS;

/**
 * @deprecated Use CLAUDE_CLI_MAX_BUFFER from shared/constants instead
 */
export const CLAUDE_CLI_MAX_BUFFER = NEW_CLAUDE_CLI_MAX_BUFFER;

/**
 * @deprecated Use DEFAULT_SESSION_DIR from shared/constants instead
 */
export const DEFAULT_SESSION_DIR = NEW_DEFAULT_SESSION_DIR;

/**
 * @deprecated Use SESSION_FILE_EXT from shared/constants instead
 */
export const SESSION_FILE_EXT = NEW_SESSION_FILE_EXT;

/**
 * @deprecated Use DEFAULT_CLEANUP_INTERVAL_MS from shared/constants instead
 */
export const DEFAULT_CLEANUP_INTERVAL = DEFAULT_CLEANUP_INTERVAL_MS;

/**
 * @deprecated Use DEFAULT_MAX_SESSION_AGE_MS from shared/constants instead
 */
export const DEFAULT_MAX_SESSION_AGE = DEFAULT_MAX_SESSION_AGE_MS;

/**
 * @deprecated Use JSON_INDENT from shared/constants instead
 */
export const JSON_INDENT = NEW_JSON_INDENT;

/**
 * @deprecated Use PERSUADER_VERSION from shared/constants instead
 */
export const PERSUADER_VERSION = NEW_PERSUADER_VERSION;
