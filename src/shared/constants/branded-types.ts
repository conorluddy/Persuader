/**
 * Branded Type Constants for Persuader Framework
 *
 * This module provides type-safe constants using branded types with unique symbols
 * and runtime validation. This prevents accidental misuse of numeric values and
 * provides better IDE support and compile-time safety.
 *
 * @since 2.0.0
 */

// Unique symbols for nominal typing
const TimeoutMsBrand = Symbol('TimeoutMs');
const RetryCountBrand = Symbol('RetryCount');
const BufferSizeBrand = Symbol('BufferSizeBytes');
const TokenEstimationDivisorBrand = Symbol('TokenEstimationDivisor');
const DelayMsBrand = Symbol('DelayMs');
const MaxTokensBrand = Symbol('MaxTokens');
const TemperatureBrand = Symbol('Temperature');

/**
 * Branded type for timeout values in milliseconds
 * Ensures timeout values are validated and within reasonable bounds
 */
export type TimeoutMs = number & { [TimeoutMsBrand]: never };

/**
 * Branded type for retry count values
 * Ensures retry counts are non-negative and within reasonable limits
 */
export type RetryCount = number & { [RetryCountBrand]: never };

/**
 * Branded type for buffer size values in bytes
 * Ensures buffer sizes are positive and within system limits
 */
export type BufferSizeBytes = number & { [BufferSizeBrand]: never };

/**
 * Branded type for token estimation divisor
 * Used for rough token count calculations from character length
 */
export type TokenEstimationDivisor = number & {
  [TokenEstimationDivisorBrand]: never;
};

/**
 * Branded type for delay values in milliseconds
 * Used for retry delays and other timing operations
 */
export type DelayMs = number & { [DelayMsBrand]: never };

/**
 * Branded type for maximum token values
 * Ensures token limits are positive and within model constraints
 */
export type MaxTokens = number & { [MaxTokensBrand]: never };

/**
 * Branded type for temperature values
 * Ensures temperature is within valid range (0.0 to 2.0 for most models)
 */
export type Temperature = number & { [TemperatureBrand]: never };

/**
 * Create a validated timeout value in milliseconds
 *
 * @param ms - Timeout in milliseconds
 * @returns Branded timeout value
 * @throws Error if value is negative or exceeds reasonable maximum
 */
export const timeoutMs = (ms: number): TimeoutMs => {
  if (!Number.isInteger(ms)) {
    throw new Error('Timeout must be an integer value');
  }
  if (ms < 0) {
    throw new Error('Timeout cannot be negative');
  }
  if (ms > 600000) {
    // 10 minutes
    throw new Error('Timeout exceeds maximum of 10 minutes (600000ms)');
  }
  return ms as TimeoutMs;
};

/**
 * Create a validated retry count value
 *
 * @param count - Number of retries
 * @returns Branded retry count value
 * @throws Error if value is negative or exceeds reasonable maximum
 */
export const retryCount = (count: number): RetryCount => {
  if (!Number.isInteger(count)) {
    throw new Error('Retry count must be an integer value');
  }
  if (count < 0) {
    throw new Error('Retry count cannot be negative');
  }
  if (count > 10) {
    throw new Error('Retry count exceeds reasonable maximum of 10');
  }
  return count as RetryCount;
};

/**
 * Create a validated buffer size value in bytes
 *
 * @param bytes - Buffer size in bytes
 * @returns Branded buffer size value
 * @throws Error if value is not positive or exceeds system limits
 */
export const bufferSizeBytes = (bytes: number): BufferSizeBytes => {
  if (!Number.isInteger(bytes)) {
    throw new Error('Buffer size must be an integer value');
  }
  if (bytes <= 0) {
    throw new Error('Buffer size must be positive');
  }
  if (bytes > 100 * 1024 * 1024) {
    // 100MB
    throw new Error('Buffer size exceeds maximum of 100MB');
  }
  return bytes as BufferSizeBytes;
};

/**
 * Create a validated token estimation divisor
 *
 * @param divisor - Divisor for token estimation calculations
 * @returns Branded token estimation divisor value
 * @throws Error if value is not positive
 */
export const tokenEstimationDivisor = (
  divisor: number
): TokenEstimationDivisor => {
  if (!Number.isInteger(divisor)) {
    throw new Error('Token estimation divisor must be an integer value');
  }
  if (divisor <= 0) {
    throw new Error('Token estimation divisor must be positive');
  }
  if (divisor > 10) {
    throw new Error(
      'Token estimation divisor seems unreasonably high (max 10)'
    );
  }
  return divisor as TokenEstimationDivisor;
};

/**
 * Create a validated delay value in milliseconds
 *
 * @param ms - Delay in milliseconds
 * @returns Branded delay value
 * @throws Error if value is negative or exceeds reasonable maximum
 */
export const delayMs = (ms: number): DelayMs => {
  if (!Number.isInteger(ms)) {
    throw new Error('Delay must be an integer value');
  }
  if (ms < 0) {
    throw new Error('Delay cannot be negative');
  }
  if (ms > 2592000000) {
    // 30 days - reasonable maximum for session ages and cleanup intervals
    throw new Error('Delay exceeds maximum of 30 days (2592000000ms)');
  }
  return ms as DelayMs;
};

/**
 * Create a validated maximum tokens value
 *
 * @param tokens - Maximum number of tokens
 * @returns Branded max tokens value
 * @throws Error if value is not positive or exceeds model limits
 */
export const maxTokens = (tokens: number): MaxTokens => {
  if (!Number.isInteger(tokens)) {
    throw new Error('Max tokens must be an integer value');
  }
  if (tokens <= 0) {
    throw new Error('Max tokens must be positive');
  }
  if (tokens > 200000) {
    // Current Claude models max context
    throw new Error('Max tokens exceeds model limits (max 200000)');
  }
  return tokens as MaxTokens;
};

/**
 * Create a validated temperature value
 *
 * @param temp - Temperature value for generation
 * @returns Branded temperature value
 * @throws Error if value is outside valid range
 */
export const temperature = (temp: number): Temperature => {
  if (typeof temp !== 'number' || Number.isNaN(temp)) {
    throw new Error('Temperature must be a valid number');
  }
  if (temp < 0) {
    throw new Error('Temperature cannot be negative');
  }
  if (temp > 2.0) {
    throw new Error('Temperature exceeds maximum of 2.0');
  }
  return temp as Temperature;
};

/**
 * Type guard to check if a number is a TimeoutMs
 */
export const isTimeoutMs = (value: number): value is TimeoutMs => {
  try {
    timeoutMs(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Type guard to check if a number is a RetryCount
 */
export const isRetryCount = (value: number): value is RetryCount => {
  try {
    retryCount(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Type guard to check if a number is a BufferSizeBytes
 */
export const isBufferSizeBytes = (value: number): value is BufferSizeBytes => {
  try {
    bufferSizeBytes(value);
    return true;
  } catch {
    return false;
  }
};
