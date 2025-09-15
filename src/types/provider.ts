/**
 * Provider Adapter Types
 *
 * Type definitions for LLM provider adapters, including the main adapter interface,
 * provider options, responses, and health monitoring.
 */

import type { TokenUsage } from './pipeline.js';

/**
 * Provider adapter interface for LLM backends
 *
 * This abstraction allows Persuader to work with different LLM providers
 * while maintaining consistent behavior and session management.
 */
export interface ProviderAdapter {
  /** Human-readable name of the provider */
  readonly name: string;

  /** Provider version or identifier */
  readonly version?: string;

  /** Supported models by this provider */
  readonly supportedModels?: readonly string[];

  /** Whether this provider supports persistent sessions */
  readonly supportsSession: boolean;

  /**
   * Create a new session with the provider
   *
   * @param context Global context for the session
   * @param options Provider-specific options
   * @returns Promise resolving to session ID
   */
  createSession?(
    context: string,
    options?: ProviderSessionOptions
  ): Promise<string>;

  /**
   * Send a prompt to the provider and get a response
   *
   * This is the core method for LLM interaction, supporting both stateful
   * sessions (when sessionId is provided) and stateless requests.
   *
   * @param sessionId - Session ID for continuing a conversation, or null for stateless requests.
   *                   If the provider supports sessions and a valid sessionId is provided,
   *                   the conversation context will be maintained across multiple calls.
   * @param prompt - The complete prompt to send to the LLM, including system instructions,
   *                user input, examples, and any error feedback from previous attempts.
   * @param options - Provider-specific configuration including model selection, temperature,
   *                 max tokens, stop sequences, and other generation parameters.
   * @returns Promise resolving to ProviderResponse containing the generated content,
   *          usage statistics, stop reason, and session information.
   * @throws ProviderError if the request fails due to authentication, rate limits,
   *         network issues, or other provider-specific problems.
   *
   * @example
   * ```typescript
   * const response = await provider.sendPrompt(
   *   sessionId,
   *   'Analyze this data: {...}',
   *   { model: 'claude-3-sonnet', temperature: 0.4, maxTokens: 4096 }
   * );
   * console.log('Generated:', response.content);
   * ```
   */
  sendPrompt(
    sessionId: string | null,
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse>;

  /**
   * Clean up a session (optional)
   *
   * @param sessionId Session ID to clean up
   */
  destroySession?(sessionId: string): Promise<void>;

  /**
   * Get provider health status
   */
  getHealth?(): Promise<ProviderHealth>;
}

/**
 * Options for creating provider sessions
 */
export interface ProviderSessionOptions {
  /** Maximum context length for the session */
  readonly maxContextLength?: number;

  /** Temperature setting for generation */
  readonly temperature?: number;

  /** Model to use for this session */
  readonly model?: string;

  /** Additional provider-specific options */
  readonly [key: string]: unknown;
}

/**
 * Options for sending prompts to providers
 */
export interface ProviderPromptOptions extends ProviderSessionOptions {
  /** Maximum tokens to generate */
  readonly maxTokens?: number;

  /** Stop sequences */
  readonly stopSequences?: readonly string[];

  /** Top-p sampling parameter */
  readonly topP?: number;

  /** Top-k sampling parameter */
  readonly topK?: number;

  /** Whether to use JSON mode */
  readonly json?: boolean;
}

/**
 * Response from a provider adapter
 */
export interface ProviderResponse {
  /** The generated text response */
  readonly content: string;

  /** Token usage for this response */
  readonly tokenUsage?: TokenUsage;

  /** Provider-specific metadata */
  readonly metadata?: Record<string, unknown>;

  /** Whether the response was truncated */
  readonly truncated?: boolean;

  /** Stop reason if available */
  readonly stopReason?: 'max_tokens' | 'stop_sequence' | 'end_turn' | 'other';
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  /** Whether the provider is healthy */
  readonly healthy: boolean;

  /** Health check timestamp */
  readonly checkedAt: Date;

  /** Response time in milliseconds */
  readonly responseTimeMs?: number;

  /** Error message if unhealthy */
  readonly error?: string;

  /** Additional health details */
  readonly details?: Record<string, unknown>;
}

/**
 * Configuration for a specific provider instance
 */
export interface ProviderInstanceConfig {
  /** Provider adapter class or factory */
  readonly adapter: string;

  /** Provider-specific options */
  readonly options: Record<string, unknown>;

  /** Whether this provider is enabled */
  readonly enabled: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Default provider to use */
  readonly defaultProvider: string;

  /** Provider-specific configurations */
  readonly providers: Record<string, ProviderInstanceConfig>;
}
