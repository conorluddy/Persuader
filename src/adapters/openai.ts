/**
 * OpenAI Provider Adapter
 *
 * Integration with OpenAI using the Vercel AI SDK, supporting simulated sessions
 * for retry loops and conversation continuity. Since OpenAI doesn't have native
 * session support like Claude CLI, this adapter maintains conversation history
 * in memory during a Persuader call.
 */

import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
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
 * Configuration options for OpenAI adapter
 */
export interface OpenAIAdapterConfig {
  /** OpenAI API key (defaults to OPENAI_API_KEY environment variable) */
  readonly apiKey?: string;

  /** Base URL for OpenAI API (for custom endpoints) */
  readonly baseURL?: string;

  /** Organization ID for OpenAI API */
  readonly organization?: string;

  /** Project ID for OpenAI API */
  readonly project?: string;

  /** Default model to use if not specified in options */
  readonly defaultModel?: string;

  /** Request timeout in milliseconds */
  readonly timeout?: number;

  /** Whether to use JSON mode by default */
  readonly defaultJsonMode?: boolean;
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
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;

  /** Session creation timestamp */
  readonly createdAt: Date;

  /** Session configuration options */
  readonly options: ProviderSessionOptions;
}

/**
 * OpenAI adapter for Persuader framework
 *
 * Provides integration with OpenAI's LLM API using the Vercel AI SDK, supporting:
 * - Simulated sessions through conversation history management
 * - Retry loop continuity by maintaining context across attempts
 * - Structured output via JSON mode when available
 * - Comprehensive error handling and OpenAI-specific error messages
 * - Health monitoring and API availability checks
 */
export class OpenAIAdapter implements ProviderAdapter {
  readonly name = 'openai';
  readonly version = '1.0.0';
  readonly supportsSession = true; // Simulated sessions through conversation history
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
    // Model aliases
    'gpt-4o-latest',
    'chatgpt-4o-latest',
  ] as const;

  private readonly apiKey: string | undefined;
  private readonly baseURL: string | undefined;
  private readonly organization: string | undefined;
  private readonly project: string | undefined;
  private readonly defaultModel: string;
  private readonly timeout: number;
  private readonly defaultJsonMode: boolean;

  // In-memory session storage for simulated sessions
  private readonly sessions = new Map<string, SimulatedSession>();

  constructor(config: OpenAIAdapterConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.baseURL = config.baseURL;
    this.organization = config.organization;
    this.project = config.project;
    this.defaultModel = config.defaultModel || 'gpt-4o';
    this.timeout = config.timeout || 60000;
    this.defaultJsonMode = config.defaultJsonMode || false;
  }

  /**
   * Check if OpenAI API is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      // Try a minimal test call to verify API key and connectivity
      const result = await generateText({
        model: this.getModelInstance(this.defaultModel),
        prompt: 'Say "OK"',
        maxOutputTokens: 5,
      });

      return result.text.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get health status of the OpenAI adapter
   */
  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        return {
          healthy: false,
          checkedAt: new Date(),
          responseTimeMs: Date.now() - startTime,
          error: 'OpenAI API key not configured',
          details: {
            apiKeyConfigured: false,
            defaultModel: this.defaultModel,
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
          error: 'OpenAI API not responding or authentication failed',
          details: {
            apiKeyConfigured: true,
            defaultModel: this.defaultModel,
            baseURL: this.baseURL,
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
          activeSessions: this.sessions.size,
          baseURL: this.baseURL,
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
          error,
        },
      };
    }
  }

  /**
   * Create a simulated session by storing initial context
   *
   * Since OpenAI doesn't have native sessions like Claude CLI, we simulate
   * session behavior by maintaining conversation history in memory during
   * a Persuader call lifecycle.
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

    debug('Creating OpenAI simulated session', {
      sessionId,
      contextLength: context.length,
      model: options.model || this.defaultModel,
      temperature: options.temperature,
    });

    try {
      // Create session with initial context
      const session: SimulatedSession = {
        id: sessionId,
        context,
        messages: [],
        createdAt: new Date(),
        options,
      };

      // Store session in memory
      this.sessions.set(sessionId, session);

      const sessionDuration = Date.now() - startTime;

      info('OpenAI simulated session created', {
        sessionId,
        contextLength: context.length,
        durationMs: sessionDuration,
        model: options.model || this.defaultModel,
        totalSessions: this.sessions.size,
      });

      return sessionId;
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logError('OpenAI session creation failed', {
        sessionId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        contextLength: context.length,
        failureDurationMs: errorDuration,
      });

      throw new Error(`Failed to create OpenAI session: ${errorMessage}`);
    }
  }

  /**
   * Send a prompt to OpenAI using simulated session context
   */
  async sendPrompt(
    sessionId: string | null,
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse> {
    const requestId = `openai-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    // Log the incoming request with full details
    llmRequest({
      provider: this.name,
      model: options.model || this.defaultModel,
      prompt,
      temperature: options.temperature ?? undefined,
      maxTokens: options.maxTokens ?? undefined,
      sessionId: sessionId,
      requestId,
    });

    debug('OpenAI sendPrompt called', {
      requestId,
      promptLength: prompt.length,
      model: options.model || this.defaultModel,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      sessionId: sessionId,
      usingSession: Boolean(sessionId),
    });

    try {
      // Build the complete prompt with session context if available
      const fullPrompt = this.buildPromptWithSessionContext(sessionId, prompt);

      // Configure OpenAI model instance
      const modelInstance = this.getModelInstance(
        options.model || this.defaultModel
      );

      // Prepare generation options
      const generateOptions: Parameters<typeof generateText>[0] = {
        model: modelInstance,
        prompt: fullPrompt,
        ...(options.maxTokens && { maxOutputTokens: options.maxTokens }),
        ...(options.temperature !== undefined && {
          temperature: options.temperature,
        }),
        ...(options.topP !== undefined && { topP: options.topP }),
      };

      // Add JSON mode if requested and supported
      if (options.json || this.defaultJsonMode) {
        // Note: OpenAI's structured output may require different configuration
        // This is a placeholder for JSON mode configuration
        debug('JSON mode requested for OpenAI', { requestId });
      }

      debug('Executing OpenAI generation', {
        requestId,
        model: options.model || this.defaultModel,
        promptLength: fullPrompt.length,
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      });

      // Execute the LLM call
      const result = await generateText(generateOptions);

      const apiDuration = Date.now() - startTime;

      // Extract token usage information
      const tokenUsage: TokenUsage = {
        inputTokens: result.usage?.inputTokens || 0,
        outputTokens: result.usage?.outputTokens || 0,
        totalTokens: result.usage?.totalTokens || 0,
      };

      // Update session with the conversation if using sessions
      if (sessionId) {
        this.updateSessionWithMessage(sessionId, prompt, result.text);
      }

      const content = result.text;

      // Log the successful response with full details
      llmResponse({
        provider: this.name,
        model: options.model || this.defaultModel,
        response: content,
        tokenUsage,
        cost: 0, // OpenAI doesn't provide cost in response - use 0 as placeholder
        durationMs: apiDuration,
        sessionId: sessionId || 'no-session',
        requestId,
        stopReason: this.mapFinishReason(result.finishReason) || 'end_turn',
      });

      // Log performance metrics
      logPerformance('OpenAI API Request', apiDuration, {
        requestId,
        tokenThroughput: tokenUsage.totalTokens / (apiDuration / 1000), // tokens per second
        efficiency: `${tokenUsage.totalTokens}/${apiDuration}ms`,
        model: options.model || this.defaultModel,
      });

      info('OpenAI response received successfully', {
        requestId,
        contentLength: content?.length || 0,
        sessionId: sessionId || undefined,
        tokenUsage,
        finishReason: result.finishReason,
        durationMs: apiDuration,
      });

      return {
        content,
        tokenUsage,
        metadata: {
          sessionId: sessionId,
          model: options.model || this.defaultModel,
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          finishReason: result.finishReason,
          usage: result.usage,
        },
        truncated: result.finishReason === 'length',
        stopReason: this.mapFinishReason(result.finishReason) || 'end_turn',
      };
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log the error with LLM-specific context
      llmError({
        provider: this.name,
        model: options.model || this.defaultModel,
        error: errorMessage,
        requestId,
        isRetryable: this.isRetryableError(error),
      });

      logError('OpenAI sendPrompt failed', {
        requestId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        promptLength: prompt.length,
        failureDurationMs: errorDuration,
        retryable: this.isRetryableError(error),
        sessionId: sessionId || undefined,
      });

      throw this.enhanceError(error, 'Failed to send prompt to OpenAI');
    }
  }

  /**
   * Destroy a simulated session to clean up memory
   */
  async destroySession(sessionId: string): Promise<void> {
    debug('Destroying OpenAI simulated session', { sessionId });

    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      info('OpenAI simulated session destroyed', {
        sessionId,
        messageCount: session.messages.length,
        sessionDuration: Date.now() - session.createdAt.getTime(),
        remainingSessions: this.sessions.size,
      });
    } else {
      warn('Attempted to destroy non-existent OpenAI session', { sessionId });
    }
  }

  /**
   * Get OpenAI model instance with configuration
   */
  private getModelInstance(modelName: string) {
    const provider = createOpenAI({
      ...(this.apiKey && { apiKey: this.apiKey }),
      ...(this.baseURL && { baseURL: this.baseURL }),
      ...(this.organization && { organization: this.organization }),
      ...(this.project && { project: this.project }),
    });

    return provider(modelName);
  }

  /**
   * Build prompt with session context for conversation continuity
   */
  private buildPromptWithSessionContext(
    sessionId: string | null,
    prompt: string
  ): string {
    if (!sessionId) {
      return prompt;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      warn('Session not found, using prompt without context', { sessionId });
      return prompt;
    }

    // Build conversation history
    let fullPrompt = `${session.context}\n\n`;

    // Add previous messages to maintain conversation context
    for (const message of session.messages) {
      if (message.role === 'user') {
        fullPrompt += `Human: ${message.content}\n\n`;
      } else {
        fullPrompt += `Assistant: ${message.content}\n\n`;
      }
    }

    // Add the current prompt
    fullPrompt += `Human: ${prompt}`;

    debug('Built prompt with session context', {
      sessionId,
      originalLength: prompt.length,
      contextLength: session.context.length,
      messageCount: session.messages.length,
      fullPromptLength: fullPrompt.length,
    });

    return fullPrompt;
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
      warn('Cannot update non-existent session', { sessionId });
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

    debug('Updated session with message exchange', {
      sessionId,
      totalMessages: updatedMessages.length,
      userMessageLength: userMessage.length,
      assistantResponseLength: assistantResponse.length,
    });
  }

  /**
   * Map OpenAI finish reason to Persuader stop reason
   */
  private mapFinishReason(
    finishReason: string | undefined
  ): ProviderResponse['stopReason'] {
    switch (finishReason) {
      case 'length':
        return 'max_tokens';
      case 'stop':
        return 'stop_sequence';
      case 'content_filter':
        return 'other';
      case 'function_call':
      case 'tool_calls':
        return 'end_turn';
      default:
        return 'end_turn';
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('network')
    );
  }

  /**
   * Enhance errors with OpenAI specific context
   */
  private enhanceError(error: unknown, context: string): Error {
    const originalMessage =
      error instanceof Error ? error.message : String(error);

    // Check for specific error patterns and provide helpful messages
    if (originalMessage.includes('API key')) {
      return new Error(
        `${context}: OpenAI API key invalid or missing. Please set OPENAI_API_KEY environment variable.`
      );
    }

    if (
      originalMessage.includes('rate limit') ||
      originalMessage.includes('429')
    ) {
      return new Error(
        `${context}: OpenAI API rate limit exceeded. Please wait and try again.`
      );
    }

    if (originalMessage.includes('timeout')) {
      return new Error(
        `${context}: OpenAI API request timed out after ${this.timeout}ms. The request may be too complex.`
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

    if (originalMessage.includes('insufficient_quota')) {
      return new Error(
        `${context}: OpenAI API quota exceeded. Please check your billing and usage limits.`
      );
    }

    // Generic error with context
    return new Error(`${context}: ${originalMessage}`);
  }
}

/**
 * Factory function to create an OpenAI adapter
 */
export function createOpenAIAdapter(
  config?: OpenAIAdapterConfig
): ProviderAdapter {
  return new OpenAIAdapter(config);
}

/**
 * Type guard to check if an adapter is an OpenAI adapter
 */
export function isOpenAIAdapter(
  adapter: ProviderAdapter
): adapter is OpenAIAdapter {
  return adapter.name === 'openai';
}
