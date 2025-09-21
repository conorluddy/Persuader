/**
 * Preload Execution Engine
 *
 * Handles the core execution logic for preload operations with simplified
 * flow compared to the main execution engine. Focuses on single-attempt
 * execution without retry loops or output validation.
 */

import type { ProviderAdapter, ProviderError } from '../../types/index.js';
import {
  debug,
  info,
  error as logError,
  llmRequest,
  llmResponse,
} from '../../utils/logger.js';
import {
  buildPreloadPrompt,
  combinePromptParts,
  type PromptParts,
} from '../prompt.js';
import type { ProcessedPreloadConfiguration } from './configuration-manager.js';

/**
 * Executes a preload operation with simplified logic
 *
 * This function handles the core preload flow: prompt building,
 * provider call, and response handling without validation or retry logic.
 * It's designed for context building rather than structured data extraction.
 *
 * @param config Processed preload configuration
 * @param provider Provider adapter for LLM calls
 * @param startTime Operation start time for metadata
 * @returns Promise resolving to preload result
 */
export async function executePreload(
  config: ProcessedPreloadConfiguration,
  provider: ProviderAdapter,
  startTime: number
): Promise<import('../../types/index.js').PreloadResult> {
  try {
    // Build prompt for preload (minimal context loading)
    const promptParts = await buildPreloadPromptParts(config);

    debug('Preload prompt built successfully', {
      promptPartsKeys: Object.keys(promptParts),
      hasContext: Boolean(config.context),
      hasLens: Boolean(config.lens),
      sessionId: config.sessionId,
    });

    // Combine prompt parts into final prompt
    const finalPrompt = combinePromptParts(promptParts);

    debug('Final preload prompt prepared', {
      promptLength: finalPrompt.length,
      sessionId: config.sessionId,
    });

    // Call provider with the prompt
    const providerResponse = await callProviderForPreload(
      provider,
      config.sessionId,
      finalPrompt,
      config
    );

    debug('Received preload provider response', {
      responseLength: providerResponse.content?.length || 0,
      hasTokenUsage: Boolean(providerResponse.tokenUsage),
      tokenUsage: providerResponse.tokenUsage,
      sessionId: config.sessionId,
    });

    // Return success result with raw response
    const endTime = Date.now();
    const metadata: import('../../types/index.js').ExecutionMetadata = {
      executionTimeMs: endTime - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(endTime),
      provider: provider.name,
      model: config.model,
    };

    // Add tokenUsage only if available
    if (providerResponse.tokenUsage) {
      (metadata as typeof metadata & { tokenUsage: typeof providerResponse.tokenUsage }).tokenUsage = providerResponse.tokenUsage;
    }

    const result: import('../../types/index.js').PreloadResult = {
      ok: true,
      sessionId: config.sessionId,
      rawResponse: providerResponse.content,
      metadata,
    };

    info('Preload execution completed successfully', {
      sessionId: config.sessionId,
      executionTimeMs: result.metadata.executionTimeMs,
      responseLength: result.rawResponse?.length || 0,
      tokenUsage: result.metadata.tokenUsage,
    });

    return result;
  } catch (executionError) {
    logError('Preload execution failed', {
      sessionId: config.sessionId,
      errorMessage:
        executionError instanceof Error ? executionError.message : 'Unknown error',
      errorType:
        executionError instanceof Error
          ? executionError.constructor.name
          : 'Unknown',
      provider: provider.name,
    });

    // Convert to provider error
    const providerError: ProviderError = {
      type: 'provider',
      code: 'preload_execution_failed',
      message: `Preload execution failed: ${
        executionError instanceof Error ? executionError.message : 'Unknown error'
      }`,
      provider: provider.name,
      timestamp: new Date(),
      retryable: false,
      details: {
        originalError: executionError,
        sessionId: config.sessionId,
      },
    };

    const endTime = Date.now();
    return {
      ok: false,
      sessionId: config.sessionId,
      error: providerError,
      metadata: {
        executionTimeMs: endTime - startTime,
        startedAt: new Date(startTime),
        completedAt: new Date(endTime),
        provider: provider.name,
        model: config.model,
      },
    };
  }
}

/**
 * Builds the prompt for preload operations
 *
 * Creates a minimal prompt optimized for context loading without schema validation
 * guidance. Uses the specialized buildPreloadPrompt function for efficiency.
 *
 * @param config Processed preload configuration
 * @returns Promise resolving to prompt parts
 */
async function buildPreloadPromptParts(
  config: ProcessedPreloadConfiguration
): Promise<PromptParts> {
  try {
    debug('Building preload prompt from configuration', {
      hasInput: Boolean(config.input),
      hasContext: Boolean(config.context),
      hasLens: Boolean(config.lens),
      sessionId: config.sessionId,
    });

    // Use specialized preload prompt builder for minimal, efficient prompting
    const promptParts = buildPreloadPrompt({
      input: config.input,
      ...(config.context && { context: config.context }),
      ...(config.lens && { lens: config.lens }),
    });

    info('Preload prompt built successfully', {
      promptPartsKeys: Object.keys(promptParts),
      contextLength: config.context?.length || 0,
      lensLength: config.lens?.length || 0,
    });

    return promptParts;
  } catch (promptError) {
    logError('Failed to build preload prompt', {
      errorMessage:
        promptError instanceof Error ? promptError.message : 'Unknown error',
      errorType:
        promptError instanceof Error ? promptError.constructor.name : 'Unknown',
      sessionId: config.sessionId,
    });
    throw promptError;
  }
}

/**
 * Calls the provider for preload operations with comprehensive error handling
 *
 * @param provider Provider adapter
 * @param sessionId Session ID for context preservation
 * @param prompt Final prompt to send
 * @param config Preload configuration
 * @returns Provider response
 */
async function callProviderForPreload(
  provider: ProviderAdapter,
  sessionId: string,
  prompt: string,
  config: ProcessedPreloadConfiguration
) {
  debug('Calling provider for preload operation', {
    provider: provider.name,
    model: config.model,
    sessionId,
    promptLength: prompt.length,
    providerOptions: Object.keys(config.providerOptions),
  });

  // Enhanced debug logging: Log the full prompt for debugging
  llmRequest({
    provider: provider.name,
    model: config.model,
    prompt: prompt.substring(0, 1000), // Preview for standard logging
    fullPrompt: prompt, // Complete prompt for verbose debug mode
    sessionId,
    requestId: `preload-${provider.name}-${Date.now()}`,
  });

  const providerResponse = await provider.sendPrompt(sessionId, prompt, {
    ...config.providerOptions,
    model: config.model,
  });

  // Enhanced debug logging: Log the raw response for debugging
  const responseData: Parameters<typeof llmResponse>[0] = {
    provider: provider.name,
    model: config.model,
    response: providerResponse.content,
    rawResponse: providerResponse.content, // Raw response for verbose debug mode
    requestId: `preload-${provider.name}-${Date.now()}`,
    sessionId,
  };

  if (providerResponse.tokenUsage) {
    responseData.tokenUsage = providerResponse.tokenUsage;
  }
  if (providerResponse.metadata?.cost && typeof providerResponse.metadata.cost === 'number') {
    responseData.cost = providerResponse.metadata.cost;
  }
  if (providerResponse.metadata?.durationMs && typeof providerResponse.metadata.durationMs === 'number') {
    responseData.durationMs = providerResponse.metadata.durationMs;
  }
  if (providerResponse.metadata?.stopReason && typeof providerResponse.metadata.stopReason === 'string') {
    responseData.stopReason = providerResponse.metadata.stopReason;
  }

  llmResponse(responseData);

  return providerResponse;
}