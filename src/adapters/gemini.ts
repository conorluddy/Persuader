/**
 * Gemini Provider Adapter
 *
 * Integration with Google's Gemini API using the official Google Gen AI SDK,
 * supporting simulated sessions for retry loops and conversation continuity.
 * Since Gemini doesn't have native session support like Claude CLI, this adapter
 * maintains conversation history in memory during a Persuader call lifecycle.
 */

import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
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
 * Configuration options for Gemini adapter
 */
export interface GeminiAdapterConfig {
  /** Gemini API key (defaults to GEMINI_API_KEY or GOOGLE_API_KEY environment variable) */
  readonly apiKey?: string;

  /** API version to use (v1 or v1alpha) */
  readonly apiVersion?: string;

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
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
    timestamp: Date;
  }>;

  /** Session creation timestamp */
  readonly createdAt: Date;

  /** Session configuration options */
  readonly options: ProviderSessionOptions;
}

/**
 * Gemini adapter for Persuader framework
 *
 * Provides integration with Google's Gemini API using the official SDK, supporting:
 * - Simulated sessions through conversation history management
 * - Retry loop continuity by maintaining context across attempts
 * - Structured output via generationConfig when available
 * - Comprehensive error handling and Gemini-specific error messages
 * - Health monitoring and API availability checks
 */
export class GeminiAdapter implements ProviderAdapter {
  readonly name = 'gemini';
  readonly version = '1.0.0';
  readonly supportsSession = true; // Simulated sessions through conversation history
  readonly supportedModels = [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-pro-002',
    'gemini-1.5-flash',
    'gemini-1.5-flash-002',
    'gemini-1.5-flash-8b',
    'gemini-pro',
    // Model aliases
    'gemini-pro-latest',
    'gemini-flash-latest',
  ] as const;

  private readonly apiKey: string | undefined;
  private readonly apiVersion: string;
  private readonly defaultModel: string;
  private readonly timeout: number;
  private readonly defaultJsonMode: boolean;
  private readonly genAI: GoogleGenAI;

  // In-memory session storage for simulated sessions
  private readonly sessions = new Map<string, SimulatedSession>();

  constructor(config: GeminiAdapterConfig = {}) {
    this.apiKey =
      config.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    this.apiVersion = config.apiVersion || 'v1';
    this.defaultModel = config.defaultModel || 'gemini-1.5-flash';
    this.timeout = config.timeout || 60000;
    this.defaultJsonMode = config.defaultJsonMode || false;

    // Initialize the Google Gen AI client
    if (!this.apiKey) {
      throw new Error(
        'Gemini API key not provided. Please set GEMINI_API_KEY or GOOGLE_API_KEY environment variable, or pass it in config.'
      );
    }

    this.genAI = new GoogleGenAI({
      apiKey: this.apiKey,
      apiVersion: this.apiVersion,
    });
  }

  /**
   * Check if Gemini API is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      // Try a minimal test call to verify API key and connectivity
      const result = await this.genAI.models.generateContent({
        model: this.defaultModel,
        contents: [{ role: 'user', parts: [{ text: 'Say "OK"' }] }],
      });

      return Boolean(result.text && result.text.length > 0);
    } catch {
      return false;
    }
  }

  /**
   * Get health status of the Gemini adapter
   */
  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        return {
          healthy: false,
          checkedAt: new Date(),
          responseTimeMs: Date.now() - startTime,
          error: 'Gemini API key not configured',
          details: {
            apiKeyConfigured: false,
            defaultModel: this.defaultModel,
            apiVersion: this.apiVersion,
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
          error: 'Gemini API not responding or authentication failed',
          details: {
            apiKeyConfigured: true,
            defaultModel: this.defaultModel,
            apiVersion: this.apiVersion,
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
          apiVersion: this.apiVersion,
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
          apiVersion: this.apiVersion,
          error,
        },
      };
    }
  }

  /**
   * Create a simulated session by storing initial context
   *
   * Since Gemini doesn't have native sessions, we simulate session behavior
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

    debug('Creating Gemini simulated session', {
      sessionId,
      contextLength: context.length,
      model: options.model || this.defaultModel,
      temperature: options.temperature,
      apiVersion: this.apiVersion,
    });

    try {
      // Create session with initial context as system instruction
      const session: SimulatedSession = {
        id: sessionId,
        context,
        messages: [], // Start empty - context will be used as systemInstruction
        createdAt: new Date(),
        options,
      };

      // Store session in memory
      this.sessions.set(sessionId, session);

      const sessionDuration = Date.now() - startTime;

      info('Gemini simulated session created', {
        sessionId,
        contextLength: context.length,
        durationMs: sessionDuration,
        model: options.model || this.defaultModel,
        totalSessions: this.sessions.size,
        apiVersion: this.apiVersion,
      });

      return sessionId;
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logError('Gemini session creation failed', {
        sessionId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        contextLength: context.length,
        failureDurationMs: errorDuration,
        apiVersion: this.apiVersion,
      });

      throw new Error(`Failed to create Gemini session: ${errorMessage}`);
    }
  }

  /**
   * Send a prompt to Gemini using simulated session context
   */
  async sendPrompt(
    sessionId: string | null,
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse> {
    const requestId = `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

    debug('Gemini sendPrompt called', {
      requestId,
      promptLength: prompt.length,
      model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      sessionId: sessionId,
      usingSession: Boolean(sessionId),
      apiVersion: this.apiVersion,
    });

    try {
      // Get session data if available
      const session = sessionId ? this.sessions.get(sessionId) : null;

      // Build generation config
      const generationConfig: Record<string, unknown> = {
        ...(options.maxTokens && { maxOutputTokens: options.maxTokens }),
        ...(options.temperature !== undefined && {
          temperature: options.temperature,
        }),
        ...(options.topP !== undefined && { topP: options.topP }),
        ...(options.topK !== undefined && { topK: options.topK }),
      };

      // Add JSON mode if requested
      if (options.json || this.defaultJsonMode) {
        generationConfig.responseMimeType = 'application/json';
      }

      // Build conversation history for continuity
      const contents = this.buildContentsWithSessionContext(
        session || null,
        prompt
      );

      debug('Executing Gemini generation', {
        requestId,
        model,
        contentsCount: contents.length,
        hasSystemInstruction: Boolean(session?.context),
        generationConfig,
      });

      // Execute the generation
      const result = await this.genAI.models.generateContent({
        model,
        contents,
        ...(session?.context && { systemInstruction: session.context }),
      });

      const apiDuration = Date.now() - startTime;

      // Extract token usage information
      const tokenUsage: TokenUsage = {
        inputTokens: result.usageMetadata?.promptTokenCount || 0,
        outputTokens: result.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: result.usageMetadata?.totalTokenCount || 0,
      };

      // Update session with the conversation if using sessions
      if (sessionId && session) {
        this.updateSessionWithMessage(sessionId, prompt, result.text || '');
      }

      const content = result.text || '';

      // Log the successful response with full details
      llmResponse({
        provider: this.name,
        model,
        response: content,
        tokenUsage,
        cost: 0, // Gemini doesn't provide cost in response
        durationMs: apiDuration,
        sessionId: sessionId || 'no-session',
        requestId,
        stopReason: 'end_turn', // Simplified for now since we don't have finish reason
      });

      // Log performance metrics
      logPerformance('Gemini API Request', apiDuration, {
        requestId,
        tokenThroughput: tokenUsage.totalTokens / (apiDuration / 1000), // tokens per second
        efficiency: `${tokenUsage.totalTokens}/${apiDuration}ms`,
        model,
        apiVersion: this.apiVersion,
      });

      info('Gemini response received successfully', {
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
          usageMetadata: result.usageMetadata,
          apiVersion: this.apiVersion,
        },
        truncated: false, // Simplified for now
        stopReason: 'end_turn',
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

      logError('Gemini sendPrompt failed', {
        requestId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        promptLength: prompt.length,
        failureDurationMs: errorDuration,
        retryable: this.isRetryableError(error),
        sessionId: sessionId || undefined,
        model,
        apiVersion: this.apiVersion,
      });

      throw this.enhanceError(error, 'Failed to send prompt to Gemini');
    }
  }

  /**
   * Destroy a simulated session to clean up memory
   */
  async destroySession(sessionId: string): Promise<void> {
    debug('Destroying Gemini simulated session', {
      sessionId,
      apiVersion: this.apiVersion,
    });

    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      info('Gemini simulated session destroyed', {
        sessionId,
        messageCount: session.messages.length,
        sessionDuration: Date.now() - session.createdAt.getTime(),
        remainingSessions: this.sessions.size,
        apiVersion: this.apiVersion,
      });
    } else {
      warn('Attempted to destroy non-existent Gemini session', {
        sessionId,
        apiVersion: this.apiVersion,
      });
    }
  }

  /**
   * Build contents array with session context for conversation continuity
   */
  private buildContentsWithSessionContext(
    session: SimulatedSession | null,
    prompt: string
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> =
      [];

    if (session) {
      // Add previous messages to maintain conversation context
      for (const message of session.messages) {
        contents.push({
          role: message.role,
          parts: message.parts,
        });
      }
    }

    // Add the current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    debug('Built contents array for Gemini', {
      sessionId: session?.id,
      contentsCount: contents.length,
      promptLength: prompt.length,
      hasContext: Boolean(session?.context),
    });

    return contents;
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
        provider: this.name,
      });
      return;
    }

    // Create a mutable copy to work with
    const updatedMessages = [...session.messages];

    // Add user message
    updatedMessages.push({
      role: 'user',
      parts: [{ text: userMessage }],
      timestamp: new Date(),
    });

    // Add model response
    updatedMessages.push({
      role: 'model',
      parts: [{ text: assistantResponse }],
      timestamp: new Date(),
    });

    // Update the session with new messages
    const updatedSession: SimulatedSession = {
      ...session,
      messages: updatedMessages,
    };

    this.sessions.set(sessionId, updatedSession);

    debug('Updated Gemini session with message exchange', {
      sessionId,
      totalMessages: updatedMessages.length,
      userMessageLength: userMessage.length,
      assistantResponseLength: assistantResponse.length,
      provider: this.name,
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
      message.includes('rate limit') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('quota exceeded')
    );
  }

  /**
   * Enhance errors with Gemini specific context
   */
  private enhanceError(error: unknown, context: string): Error {
    const originalMessage =
      error instanceof Error ? error.message : String(error);

    // Check for specific error patterns and provide helpful messages
    if (
      originalMessage.includes('API key') ||
      originalMessage.includes('authentication')
    ) {
      return new Error(
        `${context}: Gemini API key invalid or missing. Please set GEMINI_API_KEY environment variable or check your API key.`
      );
    }

    if (originalMessage.includes('quota') || originalMessage.includes('429')) {
      return new Error(
        `${context}: Gemini API quota exceeded or rate limit hit. Please check your usage limits and try again.`
      );
    }

    if (originalMessage.includes('timeout')) {
      return new Error(
        `${context}: Gemini API request timed out after ${this.timeout}ms. The request may be too complex.`
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
      originalMessage.includes('safety') ||
      originalMessage.includes('blocked')
    ) {
      return new Error(
        `${context}: Content was blocked by Gemini's safety filters. Please modify your prompt to avoid potentially harmful content.`
      );
    }

    if (
      originalMessage.includes('insufficient_quota') ||
      originalMessage.includes('billing')
    ) {
      return new Error(
        `${context}: Gemini API billing issue or quota exceeded. Please check your Google Cloud billing settings.`
      );
    }

    // Generic error with context
    return new Error(`${context}: ${originalMessage}`);
  }
}

/**
 * Factory function to create a Gemini adapter
 */
export function createGeminiAdapter(
  config?: GeminiAdapterConfig
): ProviderAdapter {
  return new GeminiAdapter(config);
}

/**
 * Type guard to check if an adapter is a Gemini adapter
 */
export function isGeminiAdapter(
  adapter: ProviderAdapter
): adapter is GeminiAdapter {
  return adapter.name === 'gemini';
}
