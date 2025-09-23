/**
 * Anthropic SDK Provider Adapter
 *
 * Integration with Anthropic's Claude API using the official Anthropic SDK,
 * providing stateless LLM interactions. Unlike the ClaudeCode CLI adapter,
 * this adapter uses direct API calls and follows Anthropic's recommendation
 * for stateless operations rather than session-based conversations.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  ProviderAdapter,
  ProviderHealth,
  ProviderPromptOptions,
  ProviderResponse,
  ProviderSessionOptions,
  TokenUsage,
} from '../types/index.js';
import {
  debug,
  info,
  llmError,
  llmRequest,
  llmResponse,
  error as logError,
  logPerformance,
  warn,
} from '../utils/logger.js';

/**
 * Configuration options for Anthropic SDK adapter
 */
export interface AnthropicSDKAdapterConfig {
  /** Anthropic API key (defaults to ANTHROPIC_API_KEY environment variable) */
  readonly apiKey?: string;

  /** Base URL for Anthropic API (for custom endpoints) */
  readonly baseURL?: string;

  /** Default model to use if not specified in options */
  readonly defaultModel?: string;

  /** Request timeout in milliseconds */
  readonly timeout?: number;

  /** Maximum number of retries for failed requests */
  readonly maxRetries?: number;
}

/**
 * Anthropic SDK adapter for Persuader framework
 *
 * Provides integration with Anthropic's Claude API using the official SDK, supporting:
 * - Stateless LLM interactions (following Anthropic's design patterns)
 * - Streaming responses via the Anthropic SDK
 * - Tool use and structured output capabilities
 * - Comprehensive error handling and Anthropic-specific error messages
 * - Health monitoring and API availability checks
 *
 * Note: This adapter intentionally does NOT support sessions, following
 * Anthropic's stateless API design. Each request is independent.
 */
export class AnthropicSDKAdapter implements ProviderAdapter {
  readonly name = 'anthropic-sdk';
  readonly version = '1.0.0';
  readonly supportsSession = false; // Stateless design following Anthropic patterns
  readonly supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-20240620',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    // Model aliases
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
    'claude-3-sonnet-latest',
    'claude-3-haiku-latest',
  ] as const;

  private readonly apiKey: string | undefined;
  private readonly baseURL: string | undefined;
  private readonly defaultModel: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly anthropic: Anthropic;

  constructor(config: AnthropicSDKAdapterConfig = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.baseURL = config.baseURL;
    this.defaultModel = config.defaultModel || 'claude-3-5-sonnet-20241022';
    this.timeout = config.timeout || 60000;
    this.maxRetries = config.maxRetries || 3;

    // Initialize the Anthropic client
    if (!this.apiKey) {
      throw new Error(
        'Anthropic API key not provided. Please set ANTHROPIC_API_KEY environment variable, or pass it in config.'
      );
    }

    this.anthropic = new Anthropic({
      apiKey: this.apiKey,
      ...(this.baseURL && { baseURL: this.baseURL }),
      timeout: this.timeout,
      maxRetries: this.maxRetries,
    });
  }

  /**
   * Check if Anthropic API is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      // Try a minimal test call to verify API key and connectivity
      const response = await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Say "OK"' }],
      });

      return Boolean(
        response.content[0]?.type === 'text' &&
          response.content[0].text.length > 0
      );
    } catch {
      return false;
    }
  }

  /**
   * Get health status of the Anthropic SDK adapter
   */
  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        return {
          healthy: false,
          checkedAt: new Date(),
          responseTimeMs: Date.now() - startTime,
          error: 'Anthropic API key not configured',
          details: {
            apiKeyConfigured: false,
            defaultModel: this.defaultModel,
            baseURL: this.baseURL,
          },
        };
      }

      const available = await this.isAvailable();
      const responseTime = Date.now() - startTime;

      if (!available) {
        return {
          healthy: false,
          checkedAt: new Date(),
          responseTimeMs: responseTime,
          error: 'Anthropic API not responding or authentication failed',
          details: {
            apiKeyConfigured: true,
            defaultModel: this.defaultModel,
            baseURL: this.baseURL,
            timeout: this.timeout,
            maxRetries: this.maxRetries,
          },
        };
      }

      return {
        healthy: true,
        checkedAt: new Date(),
        responseTimeMs: responseTime,
        details: {
          apiKeyConfigured: true,
          defaultModel: this.defaultModel,
          baseURL: this.baseURL,
          timeout: this.timeout,
          maxRetries: this.maxRetries,
          supportedModels: this.supportedModels.length,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          apiKeyConfigured: Boolean(this.apiKey),
          defaultModel: this.defaultModel,
          baseURL: this.baseURL,
          error,
        },
      };
    }
  }

  /**
   * Create a session (not supported - returns null)
   *
   * Anthropic SDK adapter intentionally does not support sessions,
   * following the stateless design pattern recommended by Anthropic.
   * Each request should be independent and self-contained.
   */
  async createSession(
    context: string,
    options?: ProviderSessionOptions
  ): Promise<string> {
    warn(
      'Anthropic SDK adapter does not support sessions - each request is stateless',
      {
        contextLength: context.length,
        model: options?.model,
        provider: this.name,
      }
    );

    throw new Error(
      'Anthropic SDK adapter does not support sessions. Use stateless sendPrompt calls with full context in each request.'
    );
  }

  /**
   * Send a prompt to Anthropic API using the official SDK
   *
   * Note: This adapter does NOT support session continuity. Each request
   * must contain the full context needed for the response. This follows
   * Anthropic's stateless API design patterns.
   */
  async sendPrompt(
    sessionId: string | null,
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse> {
    const requestId = `anthropic-sdk-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    // Warn if session ID is provided since this adapter doesn't support sessions
    if (sessionId) {
      warn(
        'Anthropic SDK adapter received session ID but does not support sessions',
        {
          sessionId,
          requestId,
          provider: this.name,
        }
      );
    }

    // Log the incoming request with full details
    llmRequest({
      provider: this.name,
      model,
      prompt,
      fullPrompt: prompt, // Always include full prompt for JSONL logging
      temperature: options.temperature ?? undefined,
      maxTokens: options.maxTokens ?? undefined,
      sessionId: null, // Always null for stateless adapter
      requestId,
    });

    debug('Anthropic SDK sendPrompt called', {
      requestId,
      promptLength: prompt.length,
      model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      sessionWarning: Boolean(sessionId),
      stateless: true,
    });

    try {
      // Prepare the message parameters
      const messageParams: Anthropic.Messages.MessageCreateParams = {
        model,
        max_tokens: options.maxTokens || 4096,
        messages: [{ role: 'user', content: prompt }],
        ...(options.temperature !== undefined && {
          temperature: options.temperature,
        }),
        ...(options.topP !== undefined && { top_p: options.topP }),
        ...(options.topK !== undefined && { top_k: options.topK }),
      };

      debug('Executing Anthropic SDK message creation', {
        requestId,
        model,
        messageParams: {
          model: messageParams.model,
          max_tokens: messageParams.max_tokens,
          temperature: messageParams.temperature,
          top_p: messageParams.top_p,
          top_k: messageParams.top_k,
          messagesCount: messageParams.messages.length,
        },
      });

      // Execute the API call
      const message = await this.anthropic.messages.create(messageParams);
      const apiDuration = Date.now() - startTime;

      // Extract token usage information
      const tokenUsage: TokenUsage = {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      };

      // Extract content (assuming text content)
      const content = message.content
        .filter(
          (content): content is Anthropic.Messages.TextBlock =>
            content.type === 'text'
        )
        .map(block => block.text)
        .join('');

      // Log the successful response with full details
      llmResponse({
        provider: this.name,
        model,
        response: content,
        tokenUsage,
        cost: 0, // Anthropic SDK doesn't provide cost in the response
        durationMs: apiDuration,
        requestId,
        stopReason: this.mapStopReason(message.stop_reason),
      });

      // Log performance metrics
      logPerformance('Anthropic SDK Request', apiDuration, {
        requestId,
        tokenThroughput: tokenUsage.totalTokens / (apiDuration / 1000), // tokens per second
        efficiency: `${tokenUsage.totalTokens}/${apiDuration}ms`,
        model,
        stopReason: message.stop_reason,
      });

      info('Anthropic SDK response received successfully', {
        requestId,
        contentLength: content?.length || 0,
        tokenUsage,
        stopReason: message.stop_reason,
        durationMs: apiDuration,
        model,
        messageId: message.id,
      });

      return {
        content,
        tokenUsage,
        metadata: {
          model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          stopReason: message.stop_reason,
          messageId: message.id,
          anthropicUsage: message.usage,
          role: message.role,
        },
        truncated: message.stop_reason === 'max_tokens',
        stopReason: this.mapStopReason(message.stop_reason),
      };
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log the error with LLM-specific context
      llmError({
        provider: this.name,
        model,
        error: errorMessage,
        requestId,
        isRetryable: this.isRetryableError(error),
      });

      logError('Anthropic SDK sendPrompt failed', {
        requestId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        promptLength: prompt.length,
        failureDurationMs: errorDuration,
        retryable: this.isRetryableError(error),
        model,
      });

      throw this.enhanceError(error, 'Failed to send prompt to Anthropic SDK');
    }
  }

  /**
   * Destroy session (not supported - no-op)
   *
   * Since this adapter doesn't support sessions, this method is a no-op
   * but is required by the ProviderAdapter interface.
   */
  async destroySession(sessionId: string): Promise<void> {
    debug(
      'Anthropic SDK adapter destroySession called - no-op for stateless adapter',
      {
        sessionId,
        provider: this.name,
      }
    );

    // No-op since we don't support sessions
  }

  /**
   * Map Anthropic stop reason to Persuader stop reason
   */
  private mapStopReason(
    stopReason: string | null
  ): 'max_tokens' | 'stop_sequence' | 'end_turn' | 'other' {
    switch (stopReason) {
      case 'end_turn':
        return 'end_turn';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      case 'tool_use':
        return 'other';
      default:
        return 'end_turn';
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    // Check if it's an Anthropic SDK error
    if (error instanceof Anthropic.APIError) {
      // Rate limit errors are retryable
      if (error.status === 429) return true;

      // Server errors are retryable
      if (error.status && error.status >= 500) return true;

      // Connection errors are retryable
      if (error.status === 0) return true;

      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    );
  }

  /**
   * Enhance errors with Anthropic SDK specific context
   */
  private enhanceError(error: unknown, context: string): Error {
    const originalMessage =
      error instanceof Error ? error.message : String(error);

    // Handle Anthropic SDK specific errors
    if (error instanceof Anthropic.APIError) {
      switch (error.status) {
        case 400:
          return new Error(
            `${context}: Invalid request to Anthropic API. ${error.message}`
          );
        case 401:
          return new Error(
            `${context}: Anthropic API authentication failed. Please check your ANTHROPIC_API_KEY.`
          );
        case 403:
          return new Error(
            `${context}: Anthropic API access forbidden. Please check your account permissions.`
          );
        case 404:
          return new Error(
            `${context}: Anthropic API endpoint not found. The model "${this.defaultModel}" may not exist.`
          );
        case 429:
          return new Error(
            `${context}: Anthropic API rate limit exceeded. Please wait and try again.`
          );
        case 500:
        case 502:
        case 503:
        case 504:
          return new Error(
            `${context}: Anthropic API server error (${error.status}). Please try again later.`
          );
        default:
          return new Error(
            `${context}: Anthropic API error (${error.status}): ${error.message}`
          );
      }
    }

    // Check for specific error patterns
    if (
      originalMessage.includes('API key') ||
      originalMessage.includes('authentication')
    ) {
      return new Error(
        `${context}: Anthropic API key invalid or missing. Please set ANTHROPIC_API_KEY environment variable.`
      );
    }

    if (originalMessage.includes('timeout')) {
      return new Error(
        `${context}: Anthropic API request timed out after ${this.timeout}ms. The request may be too complex.`
      );
    }

    if (
      originalMessage.includes('model') &&
      originalMessage.includes('not found')
    ) {
      return new Error(
        `${context}: Invalid model specified. Supported models: ${Array.from(this.supportedModels).join(', ')}`
      );
    }

    if (
      originalMessage.includes('quota') ||
      originalMessage.includes('billing')
    ) {
      return new Error(
        `${context}: Anthropic API billing issue or quota exceeded. Please check your account usage and billing.`
      );
    }

    // Generic error with context
    return new Error(`${context}: ${originalMessage}`);
  }
}

/**
 * Factory function to create an Anthropic SDK adapter
 */
export function createAnthropicSDKAdapter(
  config?: AnthropicSDKAdapterConfig
): ProviderAdapter {
  return new AnthropicSDKAdapter(config);
}

/**
 * Type guard to check if an adapter is an Anthropic SDK adapter
 */
export function isAnthropicSDKAdapter(
  adapter: ProviderAdapter
): adapter is AnthropicSDKAdapter {
  return adapter.name === 'anthropic-sdk';
}
