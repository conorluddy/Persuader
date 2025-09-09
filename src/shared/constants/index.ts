/**
 * Shared Constants Module
 *
 * Exports all branded type constants and utilities for type-safe
 * numeric value handling throughout the Persuader framework.
 *
 * @since 2.0.0
 */

// Re-export all branded types and their constructors
export type {
  BufferSizeBytes,
  DelayMs,
  MaxTokens,
  RetryCount,
  Temperature,
  TimeoutMs,
  TokenEstimationDivisor,
} from './branded-types.js';

export {
  bufferSizeBytes,
  delayMs,
  isBufferSizeBytes,
  isRetryCount,
  isTimeoutMs,
  maxTokens,
  retryCount,
  temperature,
  timeoutMs,
  tokenEstimationDivisor,
} from './branded-types.js';

// Re-export all constant values
export * from './values.js';
