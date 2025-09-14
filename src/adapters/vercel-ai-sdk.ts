/**
 * Vercel AI SDK Provider Adapter
 *
 * Integrates with Vercel AI SDK to provide access to 15+ providers with native
 * Zod schema validation. Supports both structured object generation and text
 * generation with streaming capabilities.
 */

import { randomUUID } from 'node:crypto';
import type { CoreMessage, LanguageModel } from 'ai';
import { generateObject, generateText, NoObjectGeneratedError } from 'ai';
import type {
  ProviderAdapter,
  ProviderHealth,
  ProviderPromptOptions,
  ProviderResponse,
  ProviderSessionOptions,
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
 * Configuration options for Vercel AI SDK adapter
 */
export interface VercelAISDKAdapterConfig {
  /** Pre-configured AI SDK model instance */
  readonly model: LanguageModel;

  /** Optional model ID for logging (defaults to model.modelId) */
  readonly modelId?: string;

  /** Enable streaming object generation */
  readonly useStreaming?: boolean;

  /** Default maximum tokens to generate */
  readonly maxTokens?: number;

  /** Default temperature for generation */
  readonly temperature?: number;

  /** Custom system prompt */
  readonly systemPrompt?: string;

  /** Enable debug logging */
  readonly debug?: boolean;
}

/**
 * Session data structure for managing conversation history
 */
interface SessionData {
  readonly id: string;
  readonly messages: CoreMessage[];
  readonly createdAt: Date;
  readonly lastUsedAt: Date;
  readonly context?: string;
}

/**
 * Vercel AI SDK adapter for Persuader framework
 *
 * Provides integration with the Vercel AI SDK, supporting:
 * - Schema-driven object generation with native Zod validation
 * - Multi-provider support (OpenAI, Anthropic, Google, Mistral, Ollama, etc.)
 * - Session management with CoreMessage conversation history
 * - Intelligent error handling and retry-friendly feedback
 * - Streaming support for real-time generation
 * - Built-in token usage tracking and performance monitoring
 */
export class VercelAISDKAdapter implements ProviderAdapter {
  readonly name = 'vercel-ai-sdk';
  readonly version = '1.0.0';
  readonly supportsSession = true;

  private readonly model: LanguageModel;
  private readonly modelId: string;
  private readonly useStreaming: boolean;
  private readonly defaultMaxTokens: number | undefined;
  private readonly defaultTemperature: number | undefined;
  private readonly systemPrompt: string | undefined;

  // Session storage - in production this could be Redis or database
  private readonly sessions = new Map<string, SessionData>();

  constructor(config: VercelAISDKAdapterConfig) {
    this.model = config.model;
    this.modelId = config.modelId ?? config.model.modelId ?? 'ai-sdk-model';
    this.useStreaming = config.useStreaming ?? false;
    this.defaultMaxTokens = config.maxTokens;
    this.defaultTemperature = config.temperature;
    this.systemPrompt = config.systemPrompt;

    debug('Vercel AI SDK adapter initialized', {
      modelId: this.modelId,
      useStreaming: this.useStreaming,
      supportsSession: this.supportsSession,
      systemPrompt: this.systemPrompt ? 'provided' : 'none',
    });
  }

  /**
   * Get the supported models for this adapter instance
   */
  get supportedModels(): readonly string[] {
    return [this.modelId];
  }

  /**
   * Create a new session with conversation context
   */
  async createSession(
    context: string,
    _options: ProviderSessionOptions = {}
  ): Promise<string> {
    const sessionId = randomUUID();
    const startTime = Date.now();

    info('🔗 SESSION_LIFECYCLE: Creating new Vercel AI SDK session', {
      sessionId,
      contextLength: context.length,
      contextPreview:
        context.substring(0, 200) + (context.length > 200 ? '...' : ''),
      model: this.modelId,
      provider: this.name,
      timestamp: new Date().toISOString(),
    });

    try {
      // Initialize messages with system context if provided
      const messages: CoreMessage[] = [];

      if (context.trim()) {
        messages.push({
          role: 'system',
          content: context,
        });
      }

      // Add custom system prompt if configured
      if (this.systemPrompt) {
        messages.push({
          role: 'system',
          content: this.systemPrompt,
        });
      }

      const sessionData: SessionData = {
        id: sessionId,
        messages,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        context,
      };

      this.sessions.set(sessionId, sessionData);

      const sessionDuration = Date.now() - startTime;

      info('✅ SESSION_LIFECYCLE: Vercel AI SDK session created successfully', {
        sessionId,
        messageCount: messages.length,
        contextLength: context.length,
        durationMs: sessionDuration,
        model: this.modelId,
        provider: this.name,
        timestamp: new Date().toISOString(),
      });

      return sessionId;
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logError('❌ SESSION_LIFECYCLE: Vercel AI SDK session creation failed', {
        sessionId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        contextLength: context.length,
        failureDurationMs: errorDuration,
        provider: this.name,
        timestamp: new Date().toISOString(),
      });

      throw this.enhanceError(error, 'Failed to create Vercel AI SDK session');
    }
  }

  /**
   * Send a prompt using the Vercel AI SDK
   */
  async sendPrompt(
    sessionId: string | null,
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse> {
    const requestId = `ai-sdk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Extract schema from options if available (custom option)
    const schema = (options as Record<string, unknown>)?.schema;
    const useObjectGeneration = Boolean(schema);

    // Log the incoming request
    llmRequest({
      provider: this.name,
      model: this.modelId,
      prompt,
      temperature: options.temperature ?? this.defaultTemperature,
      maxTokens: options.maxTokens ?? this.defaultMaxTokens,
      sessionId,
      requestId,
    });

    info('🔗 SESSION_LIFECYCLE: Using Vercel AI SDK session for prompt', {
      requestId,
      sessionId: sessionId || 'none',
      usingSession: Boolean(sessionId),
      sessionReuse: sessionId ? 'REUSING_EXISTING' : 'NO_SESSION',
      promptLength: prompt.length,
      promptPreview:
        prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
      model: this.modelId,
      useObjectGeneration,
      provider: this.name,
      timestamp: new Date().toISOString(),
    });

    try {
      // Get or create message history
      let messages: CoreMessage[] = [];
      let session: SessionData | undefined;

      if (sessionId) {
        session = this.sessions.get(sessionId);
        if (!session) {
          warn('Session not found, creating new conversation', { sessionId });
        } else {
          messages = [...session.messages];
          // Update last used time
          session = { ...session, lastUsedAt: new Date() };
          this.sessions.set(sessionId, session);
        }
      }

      // Add the current prompt as user message
      messages.push({
        role: 'user',
        content: prompt,
      });

      let content: string;
      let tokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      let finishReason: string | undefined;

      if (useObjectGeneration && schema) {
        // Use generateObject for schema-driven generation
        debug('Using generateObject with schema', {
          requestId,
          schemaType: typeof schema,
          hasSchema: Boolean(schema),
        });

        // Create the generateObject parameters with schema
        const generateObjectParams = {
          model: this.model,
          messages,
          schema,
          ...(options.temperature !== undefined && {
            temperature: options.temperature,
          }),
          ...(this.defaultTemperature !== undefined &&
            options.temperature === undefined && {
              temperature: this.defaultTemperature,
            }),
          ...(options.maxTokens !== undefined && {
            maxTokens: options.maxTokens,
          }),
          ...(this.defaultMaxTokens !== undefined &&
            options.maxTokens === undefined && {
              maxTokens: this.defaultMaxTokens,
            }),
        };

        // Type assertion needed due to Vercel AI SDK version compatibility
        const result = await generateObject(
          generateObjectParams as unknown as Parameters<
            typeof generateObject
          >[0]
        );

        content = JSON.stringify(result.object, null, 2);
        finishReason = result.finishReason;
        tokenUsage = {
          inputTokens: result.usage?.promptTokens ?? 0,
          outputTokens: result.usage?.completionTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        };
      } else {
        // Use generateText for regular text generation
        debug('Using generateText for unstructured generation', {
          requestId,
          messageCount: messages.length,
        });

        // Create the generateText parameters
        const result = await generateText({
          model: this.model,
          messages,
          ...(options.temperature !== undefined && {
            temperature: options.temperature,
          }),
          ...(this.defaultTemperature !== undefined &&
            options.temperature === undefined && {
              temperature: this.defaultTemperature,
            }),
          ...(options.maxTokens !== undefined && {
            maxTokens: options.maxTokens,
          }),
          ...(this.defaultMaxTokens !== undefined &&
            options.maxTokens === undefined && {
              maxTokens: this.defaultMaxTokens,
            }),
        });

        content = result.text;
        finishReason = result.finishReason;
        tokenUsage = {
          inputTokens: result.usage?.promptTokens ?? 0,
          outputTokens: result.usage?.completionTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        };
      }

      const totalDuration = Date.now() - startTime;

      // Update session with assistant response if session exists
      if (sessionId && session) {
        const updatedMessages = [
          ...messages,
          {
            role: 'assistant' as const,
            content,
          },
        ];

        const updatedSession: SessionData = {
          ...session,
          messages: updatedMessages,
          lastUsedAt: new Date(),
        };

        this.sessions.set(sessionId, updatedSession);
      }

      // Log successful response
      const responseLogData: import('../utils/logger.js').LLMResponseLogData = {
        provider: this.name,
        model: this.modelId,
        response: content,
        tokenUsage,
        durationMs: totalDuration,
        requestId,
        stopReason: finishReason || 'end_turn',
        ...(sessionId && { sessionId }),
      };

      llmResponse(responseLogData);

      // Log performance metrics
      logPerformance('Vercel AI SDK Request', totalDuration, {
        requestId,
        tokenThroughput: tokenUsage.totalTokens / (totalDuration / 1000),
        efficiency: `${tokenUsage.totalTokens}/${totalDuration}ms`,
        useObjectGeneration,
        messageCount: messages.length,
      });

      info(
        '✅ SESSION_LIFECYCLE: Vercel AI SDK prompt completed successfully',
        {
          requestId,
          contentLength: content?.length || 0,
          sessionId: sessionId || 'none',
          tokenUsage,
          durationMs: totalDuration,
          useObjectGeneration,
          provider: this.name,
          timestamp: new Date().toISOString(),
        }
      );

      return {
        content,
        tokenUsage,
        metadata: {
          sessionId,
          model: this.modelId,
          temperature: options.temperature ?? this.defaultTemperature,
          maxTokens: options.maxTokens ?? this.defaultMaxTokens,
          finishReason: finishReason,
          useObjectGeneration,
          aiSDKUsage: tokenUsage,
        },
        truncated: finishReason === 'length',
        stopReason: this.mapFinishReason(finishReason) || 'end_turn',
      };
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Enhanced error handling for AI SDK specific errors
      if (NoObjectGeneratedError.isInstance(error)) {
        // Extract detailed validation feedback for retry loops
        const validationFeedback =
          this.formatNoObjectGeneratedErrorFeedback(error);

        llmError({
          provider: this.name,
          model: this.modelId,
          error: errorMessage,
          requestId,
          isRetryable: true,
        });

        throw new Error(`Schema validation failed: ${validationFeedback}`);
      }

      llmError({
        provider: this.name,
        model: this.modelId,
        error: errorMessage,
        requestId,
        isRetryable: this.isRetryableError(error),
      });

      logError('Vercel AI SDK sendPrompt failed', {
        requestId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        model: this.modelId,
        promptLength: prompt.length,
        failureDurationMs: errorDuration,
        retryable: this.isRetryableError(error),
        useObjectGeneration,
      });

      throw this.enhanceError(error, 'Failed to send prompt to Vercel AI SDK');
    }
  }

  /**
   * Destroy a session and clean up resources
   */
  async destroySession(sessionId: string): Promise<void> {
    debug('Destroying Vercel AI SDK session', { sessionId });

    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      info('✅ SESSION_LIFECYCLE: Vercel AI SDK session destroyed', {
        sessionId,
        messageCount: session.messages.length,
        existedFor: Date.now() - session.createdAt.getTime(),
        provider: this.name,
        timestamp: new Date().toISOString(),
      });
    } else {
      warn('Attempted to destroy non-existent session', { sessionId });
    }
  }

  /**
   * Get health status of the adapter
   */
  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Test with a simple generation call
      const result = await generateText({
        model: this.model,
        prompt: 'Say "OK"',
        maxTokens: 10,
        temperature: 0,
      });

      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        checkedAt: new Date(),
        responseTimeMs: responseTime,
        details: {
          modelId: this.modelId,
          testResponse: result.text.substring(0, 100),
          sessionCount: this.sessions.size,
          supportsObjectGeneration: true,
          supportsStreaming: this.useStreaming,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        healthy: false,
        checkedAt: new Date(),
        responseTimeMs: responseTime,
        error: errorMessage,
        details: {
          modelId: this.modelId,
          sessionCount: this.sessions.size,
          error,
        },
      };
    }
  }

  /**
   * Format NoObjectGeneratedError for retry feedback
   */
  private formatNoObjectGeneratedErrorFeedback(error: unknown): string {
    const parts: string[] = [];

    // The actual error structure may vary, so we check for common properties
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as Record<string, unknown>).message === 'string'
    ) {
      parts.push(`Error: ${(error as Record<string, unknown>).message}`);
    }

    if (error && typeof error === 'object' && 'cause' in error) {
      parts.push(`Cause: ${(error as Record<string, unknown>).cause}`);
    }

    parts.push(
      'Please ensure your response matches the required schema exactly.'
    );

    return parts.join('. ');
  }

  /**
   * Map AI SDK finish reasons to our standard stop reasons
   */
  private mapFinishReason(
    finishReason: string | undefined
  ): ProviderResponse['stopReason'] {
    switch (finishReason) {
      case 'length':
        return 'max_tokens';
      case 'stop':
        return 'stop_sequence';
      case 'tool-calls':
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

    // AI SDK specific retryable errors
    if (NoObjectGeneratedError.isInstance(error)) {
      return true; // Schema validation errors are retryable with feedback
    }

    // Common retryable patterns
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('network') ||
      message.includes('connection')
    );
  }

  /**
   * Enhance errors with AI SDK specific context
   */
  private enhanceError(error: unknown, context: string): Error {
    const originalMessage =
      error instanceof Error ? error.message : String(error);

    // AI SDK specific error enhancements
    if (NoObjectGeneratedError.isInstance(error)) {
      return new Error(
        `${context}: Generated content did not match schema. ${this.formatNoObjectGeneratedErrorFeedback(error)}`
      );
    }

    if (
      originalMessage.includes('rate limit') ||
      originalMessage.includes('429')
    ) {
      return new Error(
        `${context}: Rate limit exceeded. Please wait and try again.`
      );
    }

    if (originalMessage.includes('timeout')) {
      return new Error(
        `${context}: Request timed out. The request may be too complex or the service may be slow.`
      );
    }

    if (
      originalMessage.includes('unauthorized') ||
      originalMessage.includes('401')
    ) {
      return new Error(
        `${context}: Authentication failed. Please check your API credentials.`
      );
    }

    if (
      originalMessage.includes('model') &&
      originalMessage.includes('not found')
    ) {
      return new Error(
        `${context}: Invalid model specified. Model ID: ${this.modelId}`
      );
    }

    // Generic error with context
    return new Error(`${context}: ${originalMessage}`);
  }

  /**
   * Get session statistics for monitoring
   */
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    oldestSession?: Date;
    newestSession?: Date;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let activeSessions = 0;
    let oldestSession: Date | undefined;
    let newestSession: Date | undefined;

    for (const session of this.sessions.values()) {
      if (session.lastUsedAt.getTime() > oneHourAgo) {
        activeSessions++;
      }

      if (!oldestSession || session.createdAt < oldestSession) {
        oldestSession = session.createdAt;
      }

      if (!newestSession || session.createdAt > newestSession) {
        newestSession = session.createdAt;
      }
    }

    const result: {
      totalSessions: number;
      activeSessions: number;
      oldestSession?: Date;
      newestSession?: Date;
    } = {
      totalSessions: this.sessions.size,
      activeSessions,
    };

    if (oldestSession) {
      result.oldestSession = oldestSession;
    }

    if (newestSession) {
      result.newestSession = newestSession;
    }

    return result;
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastUsedAt.getTime() > maxAgeMs) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      info('🧹 SESSION_CLEANUP: Cleaned up old Vercel AI SDK sessions', {
        cleanedCount,
        remainingSessions: this.sessions.size,
        maxAgeHours: maxAgeMs / (60 * 60 * 1000),
        provider: this.name,
        timestamp: new Date().toISOString(),
      });
    }

    return cleanedCount;
  }
}

/**
 * Factory function to create a Vercel AI SDK adapter
 */
export function createVercelAISDKAdapter(
  config: VercelAISDKAdapterConfig
): ProviderAdapter {
  return new VercelAISDKAdapter(config);
}

/**
 * Type guard to check if an adapter is a Vercel AI SDK adapter
 */
export function isVercelAISDKAdapter(
  adapter: ProviderAdapter
): adapter is VercelAISDKAdapter {
  return adapter.name === 'vercel-ai-sdk';
}
