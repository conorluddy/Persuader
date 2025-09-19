/**
 * Runner Core Module - Main Pipeline API
 *
 * Maintains the primary public API for the Persuader pipeline while
 * delegating implementation to specialized component modules. This
 * preserves backward compatibility while enabling modular architecture.
 */

import { createClaudeCLIAdapter } from '../../adapters/claude-cli.js';
import { TOKEN_ESTIMATION_DIVISOR } from '../../shared/constants/index.js';
import type { Options, PreloadOptions, PreloadResult, ProviderAdapter, Result } from '../../types/index.js';
import { orchestratePipeline } from './pipeline-orchestrator.js';
import { orchestratePreload } from './preload-orchestrator.js';
// Configuration validation functions are re-exported below
import { getExecutionStats } from './result-processor.js';

/**
 * Main orchestration function for the Persuader pipeline
 *
 * This function represents the core of the framework, handling the complete
 * flow from input processing to validated output generation with intelligent
 * retry mechanisms.
 *
 * @template T - The expected output type from Zod schema validation
 * @param options - Configuration for the pipeline run
 * @param provider - LLM provider adapter to use for generation (defaults to Claude CLI)
 * @returns Promise resolving to Result with validated data or error information
 */
export async function persuade<T>(
  options: Options<T>,
  provider: ProviderAdapter = createClaudeCLIAdapter()
): Promise<Result<T>> {
  return await orchestratePipeline(options, provider);
}

/**
 * Initialize a schema-free session for flexible LLM interactions
 *
 * This function creates a persistent session context without requiring schema validation,
 * enabling exploratory interactions, context setup, and multi-step workflows that mix
 * raw and validated responses. Perfect for cost optimization through context reuse.
 *
 * @param options Configuration for session initialization
 * @returns Promise resolving to session ID and optional response with metadata
 *
 * @example
 * ```typescript
 * // Initialize session with context
 * const { sessionId, response } = await initSession({
 *   context: 'You are a yoga instructor specializing in pose analysis',
 *   initialPrompt: 'Introduce yourself and explain your teaching approach'
 * });
 *
 * console.log(response); // Raw introduction
 *
 * // Continue with validated calls
 * const analysis = await persuade({
 *   schema: YogaPoseAnalysisSchema,
 *   input: 'Analyze this yoga sequence...',
 *   sessionId // Continue same conversation
 * });
 * ```
 */
export async function initSession(
  options: import('../../types/pipeline.js').InitSessionOptions
): Promise<import('../../types/pipeline.js').InitSessionResult> {
  const startTime = Date.now();
  const provider = options.provider || createClaudeCLIAdapter();

  // If sessionId is provided and provider supports sessions, attempt to reuse existing session
  if (options.sessionId && provider.supportsSession) {
    const metadata = {
      executionTimeMs: Date.now() - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      provider: provider.name,
      ...(options.model && { model: options.model }),
    };

    // If no initial prompt, just return the existing session ID
    if (!options.initialPrompt) {
      return {
        sessionId: options.sessionId,
        metadata,
      };
    }

    // Send initial prompt to existing session
    try {
      const promptOptions = {
        ...options.providerOptions,
        ...(options.model && { model: options.model }),
      };

      const response = await provider.sendPrompt(
        options.sessionId,
        options.initialPrompt,
        promptOptions
      );

      return {
        sessionId: options.sessionId,
        response: response.content,
        metadata: {
          ...metadata,
          executionTimeMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to send initial prompt to existing session: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Create new session if provider supports it
  if (provider.supportsSession && provider.createSession) {
    try {
      const sessionOptions = {
        ...options.providerOptions,
        ...(options.model && { model: options.model }),
      };

      const sessionId = await provider.createSession(options.context, sessionOptions);

      const metadata = {
        executionTimeMs: Date.now() - startTime,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        provider: provider.name,
        ...(options.model && { model: options.model }),
      };

      // If no initial prompt, return session ID only
      if (!options.initialPrompt) {
        return {
          sessionId,
          metadata,
        };
      }

      // Send initial prompt to new session
      const promptOptions = {
        ...options.providerOptions,
        ...(options.model && { model: options.model }),
      };

      const response = await provider.sendPrompt(
        sessionId,
        options.initialPrompt,
        promptOptions
      );

      return {
        sessionId,
        response: response.content,
        metadata: {
          ...metadata,
          executionTimeMs: Date.now() - startTime,
          completedAt: new Date(),
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to create session: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Provider doesn't support sessions - handle as stateless request
  if (!options.initialPrompt) {
    throw new Error(
      `Provider ${provider.name} does not support sessions and no initial prompt provided. Either use a session-capable provider or provide an initial prompt for immediate processing.`
    );
  }

  try {
    // Send stateless request with context included in prompt
    const fullPrompt = options.context
      ? `${options.context}\n\n${options.initialPrompt}`
      : options.initialPrompt;

    const promptOptions = {
      ...options.providerOptions,
      ...(options.model && { model: options.model }),
    };

    const response = await provider.sendPrompt(null, fullPrompt, promptOptions);

    const metadata = {
      executionTimeMs: Date.now() - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      provider: provider.name,
      ...(options.model && { model: options.model }),
    };

    // Generate a unique identifier for this stateless interaction
    const sessionId = `stateless-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      sessionId,
      response: response.content,
      metadata,
    };
  } catch (error) {
    throw new Error(
      `Failed to send stateless request: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Preload data into an existing session without output validation
 *
 * This function provides a streamlined way to load context data, documents,
 * or other information into an existing session for later structured extraction.
 * Perfect for multi-step workflows where you want to build rich context before
 * using persuade() for validated output.
 *
 * @param options Configuration for the preload operation
 * @param provider LLM provider adapter to use for generation (defaults to Claude CLI)
 * @returns Promise resolving to preload result with raw response
 *
 * @example
 * ```typescript
 * // Load financial data into session
 * const result = await preload({
 *   sessionId: 'financial-session',
 *   input: 'Q4 earnings report: [large document]',
 *   context: 'Store this financial data for analysis'
 * });
 *
 * if (result.ok) {
 *   console.log('Data loaded successfully');
 *   
 *   // Later extract structured insights
 *   const analysis = await persuade({
 *     schema: AnalysisSchema,
 *     input: 'Summarize key financial insights',
 *     sessionId: 'financial-session'
 *   });
 * }
 * ```
 */
export async function preload(
  options: PreloadOptions,
  provider: ProviderAdapter = createClaudeCLIAdapter()
): Promise<PreloadResult> {
  return await orchestratePreload(options, provider);
}

// Re-export validation and configuration functions directly
export {
  processRunnerConfiguration,
  validateAndNormalizeOptions,
  validateProviderAdapter,
  validateRunnerOptions,
  // Preload configuration functions
  processPreloadConfiguration,
  validatePreloadOptions,
  type ProcessedPreloadConfiguration,
} from './configuration-manager.js';

/**
 * Create a minimal mock provider for testing
 *
 * @param responses - Array of responses to return in sequence (defaults to valid JSON responses)
 * @param name - Provider name for identification
 * @returns Mock provider adapter
 */
export function createMockProvider(
  responses: string[] = [
    '{"message": "Hello from mock provider", "success": true, "timestamp": 1631234567890}',
    '{"result": "Mock response", "status": "completed", "confidence": 0.95}',
    '{"data": "Test data", "processed": true, "score": 8.5}',
  ],
  name: string = 'mock-provider'
): ProviderAdapter {
  let callCount = 0;

  return {
    name,
    supportsSession: false,

    async sendPrompt(_sessionId, prompt, _options) {
      const response = responses[callCount % responses.length];
      callCount++;

      if (!response) {
        throw new Error('No response available in mock provider');
      }

      return {
        content: response,
        tokenUsage: {
          inputTokens: prompt.length / TOKEN_ESTIMATION_DIVISOR, // Rough estimation
          outputTokens: response.length / TOKEN_ESTIMATION_DIVISOR,
          totalTokens:
            (prompt.length + response.length) / TOKEN_ESTIMATION_DIVISOR,
        },
      };
    },
  };
}

/**
 * Get runner execution statistics
 *
 * @param result - Result from persuade execution
 * @returns Execution statistics for monitoring and debugging
 */
export { getExecutionStats };

// Re-export configuration types for external use
export type {
  ConfigurationValidation,
  NormalizedOptions,
  ProcessedConfiguration,
} from './configuration-manager.js';
export type {
  ErrorClassification,
  RecoveryStrategy,
} from './error-recovery.js';
export {
  analyzeErrorRecovery,
  classifyError,
  logErrorRecoveryAnalysis,
} from './error-recovery.js';
export type { ExecutionResult } from './execution-engine.js';

// Re-export utility functions that may be useful externally
export { formatResultMetadata } from './result-processor.js';
export type { SessionCoordinationResult } from './session-coordinator.js';
export { logSessionInfo, validateSessionState } from './session-coordinator.js';
