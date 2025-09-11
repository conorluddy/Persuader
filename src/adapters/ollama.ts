/**
 * Ollama Provider Adapter
 *
 * Integration with local Ollama instance via REST API, supporting simulated sessions
 * for retry loops and conversation continuity. Since Ollama doesn't have native
 * session support, this adapter maintains conversation history in memory during
 * a Persuader call lifecycle, similar to the OpenAI adapter.
 */

import { randomUUID } from 'node:crypto';
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
 * Configuration options for Ollama adapter
 */
export interface OllamaAdapterConfig {
  /** Base URL for Ollama API (defaults to http://localhost:11434) */
  readonly baseUrl?: string;

  /** Request timeout in milliseconds */
  readonly timeout?: number;

  /** Default model to use if not specified in options */
  readonly defaultModel?: string;

  /** Whether to use streaming by default */
  readonly defaultStreaming?: boolean;
}

/**
 * Simulated session data for conversation continuity
 */
interface SimulatedSession {
  /** Unique session identifier */
  readonly id: string;

  /** Initial session context/system prompt */
  readonly context: string;

  /** Conversation history (user messages and assistant responses) */
  readonly messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;

  /** Session creation timestamp */
  readonly createdAt: Date;

  /** Session configuration options */
  readonly options: ProviderSessionOptions;
}

/**
 * Ollama API response structure for chat endpoint
 */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Ollama API request structure for chat endpoint
 */
interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    max_tokens?: number;
  };
}

/**
 * Ollama models list response
 */
interface OllamaModelsResponse {
  models: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
      parent_model?: string;
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

/**
 * Ollama adapter for Persuader framework
 *
 * Provides integration with local Ollama instances via REST API, supporting:
 * - Simulated sessions through conversation history management
 * - Retry loop continuity by maintaining context across attempts
 * - Dynamic model discovery from local Ollama instance
 * - Comprehensive error handling and Ollama-specific error messages
 * - Health monitoring and connectivity checks
 */
export class OllamaAdapter implements ProviderAdapter {
  readonly name = 'ollama';
  readonly version = '1.0.0';
  readonly supportsSession = true; // Simulated sessions through conversation history
  private _supportedModels: readonly string[] = [];

  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly defaultModel: string;

  // In-memory session storage for simulated sessions
  private readonly sessions = new Map<string, SimulatedSession>();

  constructor(config: OllamaAdapterConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || 60000;
    this.defaultModel = config.defaultModel || 'llama3.2';
  }

  /**
   * Get supported models (cached after first call)
   */
  get supportedModels(): readonly string[] {
    return this._supportedModels;
  }

  /**
   * Check if Ollama API is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch and cache available models from Ollama
   */
  private async fetchSupportedModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaModelsResponse;
      const models = data.models.map(model => model.name);

      // Cache the models
      this._supportedModels = models;

      return models;
    } catch (error) {
      warn('Failed to fetch Ollama models, using default', { error });
      return [this.defaultModel];
    }
  }

  /**
   * Get health status of the Ollama adapter
   */
  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const available = await this.isAvailable();
      const responseTime = Date.now() - startTime;

      if (!available) {
        return {
          healthy: false,
          checkedAt: new Date(),
          responseTimeMs: responseTime,
          error: 'Ollama API not responding or not running',
          details: {
            baseUrl: this.baseUrl,
            defaultModel: this.defaultModel,
          },
        };
      }

      // Fetch models to validate functionality
      const models = await this.fetchSupportedModels();

      return {
        healthy: true,
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: {
          baseUrl: this.baseUrl,
          defaultModel: this.defaultModel,
          activeSessions: this.sessions.size,
          availableModels: models.length,
          models: models.slice(0, 5), // Show first 5 models
        },
      };
    } catch (error) {
      return {
        healthy: false,
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          baseUrl: this.baseUrl,
          defaultModel: this.defaultModel,
          error,
        },
      };
    }
  }

  /**
   * Create a simulated session by storing initial context
   *
   * Since Ollama doesn't have native sessions, we simulate session behavior
   * by maintaining conversation history in memory during a Persuader call lifecycle.
   *
   * @param context - Initial context/system prompt for the session
   * @param options - Session configuration options
   * @returns Promise resolving to session ID for use in subsequent calls
   */
  async createSession(
    context: string,
    options: ProviderSessionOptions = {}
  ): Promise<string> {
    const sessionId = randomUUID();
    const startTime = Date.now();

    debug('Creating Ollama simulated session', {
      sessionId,
      contextLength: context.length,
      model: options.model || this.defaultModel,
      temperature: options.temperature,
      baseUrl: this.baseUrl,
    });

    try {
      // Ensure we have models available
      if (this._supportedModels.length === 0) {
        await this.fetchSupportedModels();
      }

      // Create session with initial context
      const session: SimulatedSession = {
        id: sessionId,
        context,
        messages: [
          {
            role: 'system',
            content: context,
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
        options,
      };

      // Store session in memory
      this.sessions.set(sessionId, session);

      const sessionDuration = Date.now() - startTime;

      info('Ollama simulated session created', {
        sessionId,
        contextLength: context.length,
        durationMs: sessionDuration,
        model: options.model || this.defaultModel,
        totalSessions: this.sessions.size,
        baseUrl: this.baseUrl,
      });

      return sessionId;
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logError('Ollama session creation failed', {
        sessionId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        contextLength: context.length,
        failureDurationMs: errorDuration,
        baseUrl: this.baseUrl,
      });

      throw new Error(`Failed to create Ollama session: ${errorMessage}`);
    }
  }

  /**
   * Send a prompt to Ollama using simulated session context
   */
  async sendPrompt(
    sessionId: string | null,
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse> {
    const requestId = `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    // Log the incoming request with full details
    llmRequest({
      provider: this.name,
      model,
      prompt,
      temperature: options.temperature ?? undefined,
      maxTokens: options.maxTokens ?? undefined,
      sessionId: sessionId,
      requestId,
    });

    debug('Ollama sendPrompt called', {
      requestId,
      promptLength: prompt.length,
      model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      sessionId: sessionId,
      usingSession: Boolean(sessionId),
      baseUrl: this.baseUrl,
    });

    try {
      // Build the complete messages array with session context if available
      const messages = this.buildMessagesWithSessionContext(sessionId, prompt);

      // Prepare the request payload
      const requestPayload: OllamaChatRequest = {
        model,
        messages,
        stream: false, // Always use non-streaming for simplicity
        ...(options.temperature !== undefined && {
          options: {
            temperature: options.temperature,
            ...(options.topP !== undefined && { top_p: options.topP }),
            ...(options.topK !== undefined && { top_k: options.topK }),
            ...(options.maxTokens && { max_tokens: options.maxTokens }),
          },
        }),
      };

      debug('Executing Ollama API request', {
        requestId,
        model,
        messagesCount: messages.length,
        baseUrl: this.baseUrl,
        hasOptions: Boolean(requestPayload.options),
      });

      // Execute the API call
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`
        );
      }

      const result = (await response.json()) as OllamaChatResponse;
      const apiDuration = Date.now() - startTime;

      // Extract token usage information (Ollama provides these metrics)
      const tokenUsage: TokenUsage = {
        inputTokens: result.prompt_eval_count || 0,
        outputTokens: result.eval_count || 0,
        totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
      };

      // Update session with the conversation if using sessions
      if (sessionId) {
        this.updateSessionWithMessage(
          sessionId,
          prompt,
          result.message.content
        );
      }

      const content = result.message.content;

      // Log the successful response with full details
      llmResponse({
        provider: this.name,
        model,
        response: content,
        tokenUsage,
        cost: 0, // Ollama doesn't provide cost information
        durationMs: apiDuration,
        sessionId: sessionId || 'no-session',
        requestId,
        stopReason: result.done ? 'end_turn' : 'other',
      });

      // Log performance metrics
      logPerformance('Ollama API Request', apiDuration, {
        requestId,
        tokenThroughput: tokenUsage.totalTokens / (apiDuration / 1000), // tokens per second
        efficiency: `${tokenUsage.totalTokens}/${apiDuration}ms`,
        model,
        baseUrl: this.baseUrl,
      });

      info('Ollama response received successfully', {
        requestId,
        contentLength: content?.length || 0,
        sessionId: sessionId || undefined,
        tokenUsage,
        durationMs: apiDuration,
        model,
      });

      return {
        content,
        tokenUsage,
        metadata: {
          sessionId: sessionId,
          model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          baseUrl: this.baseUrl,
          ollamaMetrics: {
            total_duration: result.total_duration,
            load_duration: result.load_duration,
            prompt_eval_duration: result.prompt_eval_duration,
            eval_duration: result.eval_duration,
          },
        },
        truncated: false, // Ollama doesn't indicate truncation directly
        stopReason: result.done ? 'end_turn' : 'other',
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

      logError('Ollama sendPrompt failed', {
        requestId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        promptLength: prompt.length,
        failureDurationMs: errorDuration,
        retryable: this.isRetryableError(error),
        sessionId: sessionId || undefined,
        baseUrl: this.baseUrl,
        model,
      });

      throw this.enhanceError(error, 'Failed to send prompt to Ollama');
    }
  }

  /**
   * Destroy a simulated session to clean up memory
   */
  async destroySession(sessionId: string): Promise<void> {
    debug('Destroying Ollama simulated session', {
      sessionId,
      baseUrl: this.baseUrl,
    });

    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      info('Ollama simulated session destroyed', {
        sessionId,
        messageCount: session.messages.length,
        sessionDuration: Date.now() - session.createdAt.getTime(),
        remainingSessions: this.sessions.size,
        baseUrl: this.baseUrl,
      });
    } else {
      warn('Attempted to destroy non-existent Ollama session', {
        sessionId,
        baseUrl: this.baseUrl,
      });
    }
  }

  /**
   * Build messages array with session context for conversation continuity
   */
  private buildMessagesWithSessionContext(
    sessionId: string | null,
    prompt: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }> = [];

    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        // Add all previous messages to maintain conversation context
        for (const message of session.messages) {
          messages.push({
            role: message.role,
            content: message.content,
          });
        }
      } else {
        warn('Session not found, using prompt without context', {
          sessionId,
          baseUrl: this.baseUrl,
        });
      }
    }

    // Add the current user prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    debug('Built messages array for Ollama', {
      sessionId,
      messagesCount: messages.length,
      promptLength: prompt.length,
      baseUrl: this.baseUrl,
    });

    return messages;
  }

  /**
   * Update session with new message exchange
   */
  private updateSessionWithMessage(
    sessionId: string,
    userMessage: string,
    assistantResponse: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      warn('Cannot update non-existent session', {
        sessionId,
        baseUrl: this.baseUrl,
      });
      return;
    }

    // Create a mutable copy to work with
    const updatedMessages = [...session.messages];

    // Add user message
    updatedMessages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Add assistant response
    updatedMessages.push({
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date(),
    });

    // Update the session with new messages
    const updatedSession: SimulatedSession = {
      ...session,
      messages: updatedMessages,
    };

    this.sessions.set(sessionId, updatedSession);

    debug('Updated Ollama session with message exchange', {
      sessionId,
      totalMessages: updatedMessages.length,
      userMessageLength: userMessage.length,
      assistantResponseLength: assistantResponse.length,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('fetch') ||
      // Ollama might be loading a model
      (message.includes('model') && message.includes('loading')) ||
      // HTTP status codes that indicate temporary issues
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }

  /**
   * Enhance errors with Ollama specific context
   */
  private enhanceError(error: unknown, context: string): Error {
    const originalMessage =
      error instanceof Error ? error.message : String(error);

    // Check for specific error patterns and provide helpful messages
    if (
      originalMessage.includes('ECONNREFUSED') ||
      originalMessage.includes('fetch failed')
    ) {
      return new Error(
        `${context}: Cannot connect to Ollama at ${this.baseUrl}. Please ensure Ollama is running.`
      );
    }

    if (originalMessage.includes('timeout')) {
      return new Error(
        `${context}: Ollama request timed out after ${this.timeout}ms. The model may be loading or the request is too complex.`
      );
    }

    if (
      originalMessage.includes('model') &&
      originalMessage.includes('not found')
    ) {
      return new Error(
        `${context}: Model "${this.defaultModel}" not found in Ollama. Available models can be checked with: ollama list`
      );
    }

    if (originalMessage.includes('404')) {
      return new Error(
        `${context}: Ollama API endpoint not found. Please check if Ollama is running and accessible at ${this.baseUrl}`
      );
    }

    if (
      originalMessage.includes('500') ||
      originalMessage.includes('502') ||
      originalMessage.includes('503')
    ) {
      return new Error(
        `${context}: Ollama server error. The model may be loading or there's a temporary issue.`
      );
    }

    // Generic error with context
    return new Error(`${context}: ${originalMessage}`);
  }
}

/**
 * Factory function to create an Ollama adapter
 */
export function createOllamaAdapter(
  config?: OllamaAdapterConfig
): ProviderAdapter {
  return new OllamaAdapter(config);
}

/**
 * Type guard to check if an adapter is an Ollama adapter
 */
export function isOllamaAdapter(
  adapter: ProviderAdapter
): adapter is OllamaAdapter {
  return adapter.name === 'ollama';
}
