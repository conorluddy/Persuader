/**
 * HTTP Status Code Constants
 *
 * Well-defined HTTP status codes used for error handling and retry logic.
 * These replace magic numbers with semantically meaningful constants that
 * clearly express intent and improve code maintainability.
 *
 * @since 2.0.0
 */

// ============================================================================
// HTTP STATUS CODES - CLIENT ERRORS (4xx)
// ============================================================================

/**
 * Unauthorized (401) - Authentication required or invalid
 *
 * Indicates missing or invalid authentication credentials. Typically
 * not retryable without updating credentials, but included for
 * comprehensive error handling.
 *
 * @see RFC 7235 Section 3.1
 * @since v2.0.0
 */
export const HTTP_UNAUTHORIZED = 401 as const;

/**
 * Request Timeout (408) - Client took too long to send request
 *
 * Used in retry logic to identify timeout scenarios that are typically
 * retryable due to temporary network conditions or server load.
 *
 * @see RFC 7231 Section 6.5.7
 * @since v2.0.0
 */
export const HTTP_REQUEST_TIMEOUT = 408 as const;

/**
 * Too Many Requests (429) - Rate limit exceeded
 *
 * Used in retry logic to identify rate limiting scenarios that should
 * trigger exponential backoff before retrying. These are always retryable
 * after appropriate delay.
 *
 * @see RFC 6585 Section 4
 * @since v2.0.0
 */
export const HTTP_TOO_MANY_REQUESTS = 429 as const;

// ============================================================================
// HTTP STATUS CODES - SERVER ERRORS (5xx)
// ============================================================================

/**
 * Internal Server Error (500) - Generic server error
 *
 * First status code in the 5xx range, used as boundary check for
 * server-side errors that are typically retryable.
 *
 * @see RFC 7231 Section 6.6.1
 * @since v2.0.0
 */
export const HTTP_INTERNAL_SERVER_ERROR = 500 as const;

/**
 * Bad Gateway (502) - Invalid response from upstream server
 *
 * Common server error that often resolves with retry due to temporary
 * upstream issues or load balancer problems.
 *
 * @see RFC 7231 Section 6.6.3
 * @since v2.0.0
 */
export const HTTP_BAD_GATEWAY = 502 as const;

/**
 * Service Unavailable (503) - Server temporarily overloaded
 *
 * Indicates temporary unavailability, often with Retry-After header.
 * These scenarios typically resolve with appropriate retry delays.
 *
 * @see RFC 7231 Section 6.6.4
 * @since v2.0.0
 */
export const HTTP_SERVICE_UNAVAILABLE = 503 as const;

/**
 * Gateway Timeout (504) - Upstream server timeout
 *
 * Gateway or proxy timeout waiting for upstream response.
 * Often transient and retryable with appropriate backoff.
 *
 * @see RFC 7231 Section 6.6.5
 * @since v2.0.0
 */
export const HTTP_GATEWAY_TIMEOUT = 504 as const;

// ============================================================================
// STATUS CODE RANGES
// ============================================================================

/**
 * Minimum HTTP status code for server errors (5xx range)
 *
 * Used for range checking to identify server-side errors that are
 * typically retryable, as opposed to client errors (4xx) which
 * usually indicate permanent problems.
 *
 * @since v2.0.0
 */
export const HTTP_SERVER_ERROR_MIN = HTTP_INTERNAL_SERVER_ERROR;

/**
 * Maximum reasonable HTTP status code for server errors
 *
 * While the 5xx range technically extends to 599, most real-world
 * server errors fall within 500-599. Used to bound retry logic.
 *
 * @since v2.0.0
 */
export const HTTP_SERVER_ERROR_MAX = 599 as const;

// ============================================================================
// RETRY CLASSIFICATION HELPERS
// ============================================================================

/**
 * HTTP status codes that indicate retryable conditions
 *
 * Consolidates the specific status codes that should trigger retry
 * logic based on their temporary or transient nature.
 *
 * @since v2.0.0
 */
export const RETRYABLE_HTTP_STATUS_CODES = [
  HTTP_REQUEST_TIMEOUT,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_BAD_GATEWAY,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_GATEWAY_TIMEOUT,
] as const;

/**
 * Type representing all retryable HTTP status codes
 *
 * Provides compile-time type safety for status code checking
 * while maintaining the flexibility of the underlying constants.
 *
 * @since v2.0.0
 */
export type RetryableHttpStatusCode =
  (typeof RETRYABLE_HTTP_STATUS_CODES)[number];

// ============================================================================
// STATUS CODE CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Check if HTTP status code represents a server error (5xx range)
 *
 * Server errors are typically retryable because they indicate
 * temporary issues on the server side rather than client problems.
 *
 * @param statusCode - HTTP status code to check
 * @returns true if status code is in 5xx range
 * @since v2.0.0
 */
export const isServerError = (statusCode: number): boolean => {
  return (
    statusCode >= HTTP_SERVER_ERROR_MIN && statusCode <= HTTP_SERVER_ERROR_MAX
  );
};

/**
 * Check if HTTP status code indicates a retryable condition
 *
 * Combines specific retryable status codes (408, 429) with
 * the general rule that 5xx errors are retryable.
 *
 * @param statusCode - HTTP status code to check
 * @returns true if the error condition is retryable
 * @since v2.0.0
 */
export const isRetryableHttpStatus = (statusCode: number): boolean => {
  return (
    statusCode === HTTP_REQUEST_TIMEOUT ||
    statusCode === HTTP_TOO_MANY_REQUESTS ||
    isServerError(statusCode)
  );
};

/**
 * Get human-readable description of HTTP status code
 *
 * Provides context for logging and error reporting by translating
 * numeric status codes to meaningful descriptions.
 *
 * @param statusCode - HTTP status code
 * @returns Human-readable description
 * @since v2.0.0
 */
export const getHttpStatusDescription = (statusCode: number): string => {
  switch (statusCode) {
    case HTTP_REQUEST_TIMEOUT:
      return 'Request Timeout - Client took too long to send request';
    case HTTP_TOO_MANY_REQUESTS:
      return 'Too Many Requests - Rate limit exceeded';
    case HTTP_INTERNAL_SERVER_ERROR:
      return 'Internal Server Error - Generic server error';
    case HTTP_BAD_GATEWAY:
      return 'Bad Gateway - Invalid response from upstream server';
    case HTTP_SERVICE_UNAVAILABLE:
      return 'Service Unavailable - Server temporarily overloaded';
    case HTTP_GATEWAY_TIMEOUT:
      return 'Gateway Timeout - Upstream server timeout';
    default:
      if (isServerError(statusCode)) {
        return `Server Error (${statusCode}) - Server-side error condition`;
      }
      return `HTTP ${statusCode} - Status code not specifically handled`;
  }
};
