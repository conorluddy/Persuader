/**
 * Execution Engine for Runner Pipeline
 *
 * Coordinates the core execution logic with intelligent retry mechanisms.
 * Handles prompt building, provider calls, validation, and progressive
 * refinement through retry loops. Manages the core LLM interaction cycle.
 */

import type {
  ProviderAdapter,
  ProviderError,
  ValidationError,
  SessionSuccessFeedback,
  SessionMetrics,
  SessionManager,
} from '../../types/index.js';
import { 
  debug, 
  info, 
  error as logError, 
  warn, 
  verboseDebug,
  llmRequest,
  llmResponse,
  getGlobalLogger,
} from '../../utils/logger.js';
import {
  logValidationFailure,
  logValidationSuccess,
} from '../../utils/validation-logger.js';
import {
  augmentPromptWithErrors,
  buildPrompt,
  combinePromptParts,
  type PromptParts,
} from '../prompt.js';
import { retryWithFeedback } from '../retry.js';
import { formatValidationErrorFeedback, validateJson } from '../validation.js';
import type { ProcessedConfiguration } from './configuration-manager.js';
import { buildEnhancementPrompt, evaluateImprovement } from './enhancement-utilities.js';

/**
 * Execution result from the retry engine
 */
export interface ExecutionResult<T> {
  readonly success: boolean;
  readonly value?: T | undefined;
  readonly error?: ValidationError | ProviderError | undefined;
  readonly attempts: number;
}

/**
 * Executes the pipeline with intelligent retry logic
 *
 * This function coordinates the core execution flow: prompt building,
 * provider calls, validation, and progressive refinement through retries.
 * It maintains state across retry attempts and provides detailed logging
 * for debugging complex interaction patterns.
 *
 * @template T The expected output type
 * @param config Processed pipeline configuration
 * @param provider Provider adapter for LLM calls
 * @param sessionId Optional session ID for context reuse
 * @returns Execution result with validated data or error information
 */
export async function executeWithRetry<T>(
  config: ProcessedConfiguration<T>,
  provider: ProviderAdapter,
  sessionId?: string,
  sessionManager?: SessionManager
): Promise<ExecutionResult<T>> {
  // Build initial prompt from configuration
  const initialPromptParts = await buildInitialPrompt(config);

  debug('Initial prompt built for execution', {
    promptPartsKeys: Object.keys(initialPromptParts),
    hasContext: Boolean(config.context),
    hasLens: Boolean(config.lens),
    hasExampleOutput: Boolean(config.exampleOutput),
  });

  // Execute with retry logic
  const retryResult = await retryWithFeedback<T>({
    maxAttempts: config.retries + 1,
    operation: async (attemptNumber, previousError) => {
      debug(
        `Starting execution attempt ${attemptNumber}/${config.retries + 1}`,
        {
          attemptNumber,
          maxAttempts: config.retries + 1,
          hasPreviousError: Boolean(previousError),
          previousErrorType: previousError?.type,
        }
      );

      const attemptResult = await executeAttempt(
        config,
        provider,
        sessionId,
        initialPromptParts,
        attemptNumber,
        previousError,
        sessionManager
      );

      if (attemptResult.success) {
        return {
          success: true,
          value: attemptResult.value as T,
        };
      } else {
        return {
          success: false,
          error: attemptResult.error || {
            type: 'validation' as const,
            code: 'unknown_error',
            message: 'Unknown validation error occurred',
            timestamp: new Date(),
            retryable: false,
            issues: [],
            rawValue: undefined,
            suggestions: [],
            failureMode: 'context_confusion',
            retryStrategy: 'session_reset',
            structuredFeedback: {
              problemSummary: 'Unknown validation error occurred',
              specificIssues: [],
              correctionInstructions: [],
            },
          },
        };
      }
    },
  });

  // Apply enhancement rounds if configured and initial execution succeeded
  if (retryResult.success && config.enhancement && config.enhancement.rounds > 0) {
    const enhancedResult = await applyEnhancementRounds(
      config,
      provider,
      sessionId,
      retryResult.value as T,
      sessionManager
    );
    
    return {
      success: true,
      value: enhancedResult.value,
      error: undefined,
      attempts: retryResult.attempts + enhancedResult.enhancementAttempts,
    };
  }

  return {
    success: retryResult.success,
    value: retryResult.value,
    error: retryResult.error,
    attempts: retryResult.attempts,
  };
}

/**
 * Builds the initial prompt from configuration
 *
 * @template T The expected output type
 * @param config Processed pipeline configuration
 * @returns Promise resolving to prompt parts
 */
async function buildInitialPrompt<T>(
  config: ProcessedConfiguration<T>
): Promise<PromptParts> {
  try {
    debug('Building initial prompt from configuration', {
      hasSchema: Boolean(config.schema),
      hasInput: Boolean(config.input),
      hasContext: Boolean(config.context),
      hasLens: Boolean(config.lens),
      hasExampleOutput: Boolean(config.exampleOutput),
    });

    const promptParts = buildPrompt({
      schema: config.schema,
      input: config.input,
      ...(config.context && { context: config.context }),
      ...(config.lens && { lens: config.lens }),
      ...(config.exampleOutput && { exampleOutput: config.exampleOutput }),
    });

    info('Initial prompt built successfully', {
      promptPartsKeys: Object.keys(promptParts),
      contextLength: config.context?.length || 0,
      lensLength: config.lens?.length || 0,
    });

    return promptParts;
  } catch (promptError) {
    logError('Failed to build initial prompt', {
      errorMessage:
        promptError instanceof Error ? promptError.message : 'Unknown error',
      errorType:
        promptError instanceof Error ? promptError.constructor.name : 'Unknown',
    });
    throw promptError;
  }
}

/**
 * Executes a single attempt with progressive prompt refinement
 *
 * @template T The expected output type
 * @param config Processed pipeline configuration
 * @param provider Provider adapter for LLM calls
 * @param sessionId Optional session ID
 * @param initialPromptParts Base prompt parts
 * @param attemptNumber Current attempt number (1-indexed)
 * @param previousError Error from previous attempt (if any)
 * @returns Promise resolving to attempt result
 */
async function executeAttempt<T>(
  config: ProcessedConfiguration<T>,
  provider: ProviderAdapter,
  sessionId: string | undefined,
  initialPromptParts: PromptParts,
  attemptNumber: number,
  previousError?: ValidationError | ProviderError,
  sessionManager?: SessionManager
): Promise<{
  success: boolean;
  value?: T;
  error?: ValidationError | ProviderError;
}> {
  const attemptStartTime = Date.now();
  try {
    // Build progressive prompt with attempt-specific enhancements
    const finalPromptParts = buildProgressivePrompt(
      config,
      initialPromptParts,
      attemptNumber,
      previousError
    );

    // Combine prompt parts into final prompt
    const finalPrompt = combinePromptParts(finalPromptParts);

    debug('Final prompt prepared for provider', {
      promptLength: finalPrompt.length,
      attemptNumber,
      hasErrorFeedback: Boolean(previousError),
    });

    // Call provider with the prompt
    const providerResponse = await callProvider(
      provider,
      sessionId,
      finalPrompt,
      config,
      attemptNumber
    );

    debug('Received provider response', {
      responseLength: providerResponse.content?.length || 0,
      hasTokenUsage: Boolean(providerResponse.tokenUsage),
      tokenUsage: providerResponse.tokenUsage,
      attemptNumber,
    });

    // Validate response against schema
    const validationResult = await validateProviderResponse(
      config,
      providerResponse.content || '',
      attemptNumber,
      sessionId,
      provider,
      sessionManager
    );

    // Record attempt metrics for session tracking
    if (sessionId && sessionManager) {
      const executionTimeMs = Date.now() - attemptStartTime;
      await recordAttemptMetrics(
        sessionId,
        attemptNumber,
        validationResult.success,
        executionTimeMs,
        providerResponse.tokenUsage,
        sessionManager
      );
    }

    return validationResult;
  } catch (attemptError) {
    // Record failed attempt metrics for session tracking
    if (sessionId && sessionManager) {
      const executionTimeMs = Date.now() - attemptStartTime;
      await recordAttemptMetrics(
        sessionId,
        attemptNumber,
        false, // success = false for provider errors
        executionTimeMs,
        undefined, // No token usage on provider errors
        sessionManager
      );
    }

    logError(`Attempt ${attemptNumber} failed with provider error`, {
      attemptNumber,
      errorMessage:
        attemptError instanceof Error ? attemptError.message : 'Unknown error',
      errorType:
        attemptError instanceof Error
          ? attemptError.constructor.name
          : 'Unknown',
      provider: provider.name,
    });

    // Convert to provider error
    const providerError: ProviderError = {
      type: 'provider',
      code: 'provider_call_failed',
      message: `Provider call failed on attempt ${attemptNumber}: ${attemptError instanceof Error ? attemptError.message : 'Unknown error'}`,
      provider: provider.name,
      timestamp: new Date(),
      retryable: true,
      details: {
        originalError: attemptError,
        attemptNumber,
      },
    };

    return {
      success: false,
      error: providerError,
    };
  }
}

/**
 * Builds progressive prompt with attempt-specific enhancements
 *
 * @template T The expected output type
 * @param config Processed configuration
 * @param initialPromptParts Base prompt parts
 * @param attemptNumber Current attempt number
 * @param previousError Error from previous attempt
 * @returns Enhanced prompt parts
 */
function buildProgressivePrompt<T>(
  config: ProcessedConfiguration<T>,
  initialPromptParts: PromptParts,
  attemptNumber: number,
  previousError?: ValidationError | ProviderError
): PromptParts {
  let finalPromptParts = initialPromptParts;

  if (attemptNumber > 1) {
    // Rebuild the base prompt with attempt-specific urgency
    const progressivePromptParts = buildPrompt({
      schema: config.schema,
      input: config.input,
      ...(config.context && { context: config.context }),
      ...(config.lens && { lens: config.lens }),
      ...(config.exampleOutput && { exampleOutput: config.exampleOutput }),
      attemptNumber,
    });

    // Add error feedback if retrying
    finalPromptParts = previousError
      ? augmentPromptWithErrors(
          progressivePromptParts,
          formatValidationErrorFeedback(
            previousError as ValidationError,
            attemptNumber
          )
        )
      : progressivePromptParts;

    debug('Built progressive prompt with error feedback', {
      attemptNumber,
      errorType: previousError?.type,
      errorCode: previousError?.code,
      hasErrorFeedback: Boolean(previousError),
    });
  }

  return finalPromptParts;
}

/**
 * Calls the provider with comprehensive error handling
 *
 * @template T The expected output type
 * @param provider Provider adapter
 * @param sessionId Optional session ID
 * @param prompt Final prompt to send
 * @param config Pipeline configuration
 * @param attemptNumber Current attempt number
 * @returns Provider response
 */
async function callProvider<T>(
  provider: ProviderAdapter,
  sessionId: string | undefined,
  prompt: string,
  config: ProcessedConfiguration<T>,
  attemptNumber: number
) {
  debug('Calling provider with final prompt', {
    provider: provider.name,
    model: config.model,
    maxTokens: config.providerOptions.maxTokens,
    temperature: config.providerOptions.temperature,
    sessionId: sessionId || null,
    attemptNumber,
  });

  // Enhanced debug logging: Log the full prompt for debugging
  llmRequest({
    provider: provider.name,
    model: config.model,
    prompt: prompt.substring(0, 1000), // Preview for standard logging
    fullPrompt: prompt, // Complete prompt for verbose debug mode
    temperature: config.providerOptions.temperature,
    maxTokens: config.providerOptions.maxTokens,
    sessionId: sessionId || null,
    attemptNumber,
    requestId: `${provider.name}-${Date.now()}-${attemptNumber}`,
  });

  const providerResponse = await provider.sendPrompt(sessionId || null, prompt, {
    ...config.providerOptions,
    model: config.model,
    maxTokens: config.providerOptions.maxTokens,
    temperature: config.providerOptions.temperature,
  });

  // Enhanced debug logging: Log the raw response for debugging
  const responseData: Parameters<typeof llmResponse>[0] = {
    provider: provider.name,
    model: config.model,
    response: providerResponse.content,
    rawResponse: providerResponse.content, // Raw response for verbose debug mode
    requestId: `${provider.name}-${Date.now()}-${attemptNumber}`,
  };

  if (sessionId) {
    responseData.sessionId = sessionId;
  }

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

/**
 * Validates provider response against schema
 *
 * @template T The expected output type
 * @param config Pipeline configuration
 * @param responseContent Provider response content
 * @param attemptNumber Current attempt number
 * @param sessionId Optional session ID for success feedback
 * @param provider Optional provider adapter for sending feedback
 * @returns Validation result
 */
async function validateProviderResponse<T>(
  config: ProcessedConfiguration<T>,
  responseContent: string,
  attemptNumber: number,
  sessionId?: string,
  provider?: ProviderAdapter,
  sessionManager?: SessionManager
): Promise<{ success: boolean; value?: T; error?: ValidationError }> {
  debug('Validating response against schema', {
    contentLength: responseContent.length,
    attemptNumber,
  });

  const validationResult = validateJson(config.schema, responseContent);

  if (validationResult.success) {
    info(`Attempt ${attemptNumber} succeeded - validation passed`, {
      attemptNumber,
      resultType: typeof validationResult.value,
      hasValue: Boolean(validationResult.value),
    });

    // Log validation success with preview when in debug or verbose mode
    const logger = getGlobalLogger();
    if (logger.getLevel() === 'debug' || logger.getLevel() === 'verboseDebug' || logger.getLevel() === 'prompts') {
      logValidationSuccess(validationResult.value, attemptNumber);
    }

    // Send success feedback if conditions are met (after every successful validation)
    if (config.successMessage && sessionId) {
      try {
        await sendSuccessFeedback(
          config,
          sessionId,
          validationResult.value,
          attemptNumber,
          provider,
          sessionManager
        );
      } catch (error) {
        // Log but don't fail the main operation if success feedback fails
        warn('Failed to send success feedback', {
          sessionId,
          attemptNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: true,
      value: validationResult.value,
    };
  } else {
    warn(`Attempt ${attemptNumber} failed validation`, {
      attemptNumber,
      errorType: validationResult.error.type,
      errorCode: validationResult.error.code,
      errorMessage: validationResult.error.message,
      issues: validationResult.error.issues?.length || 0,
    });

    // Enhanced validation failure logging with actual content display
    const logger = getGlobalLogger();
    if (logger.getLevel() === 'debug' || logger.getLevel() === 'verboseDebug' || logger.getLevel() === 'prompts') {
      logValidationFailure(validationResult.error, responseContent, attemptNumber, {
        maxContentLength: 2000,
        showDiff: true,
        showSuggestions: true,
        showRawContent: true,
        formatJson: true,
      });
    }

    // Keep original verbose debug logging for JSONL
    verboseDebug('Raw response content that failed validation', {
      attemptNumber,
      rawContent: responseContent,
      contentLength: responseContent.length,
      errorType: validationResult.error.type,
      errorCode: validationResult.error.code,
      issues: validationResult.error.issues?.slice(0, 3), // First 3 issues for debugging
    });

    return {
      success: false,
      error: validationResult.error,
    };
  }
}

/**
 * Sends success feedback to session for learning reinforcement
 *
 * @template T The expected output type
 * @param config Pipeline configuration
 * @param sessionId Session ID to send feedback to
 * @param validatedOutput The validated output that succeeded
 * @param attemptNumber Current attempt number
 * @param provider Provider adapter to potentially send feedback through
 */
async function sendSuccessFeedback<T>(
  config: ProcessedConfiguration<T>,
  sessionId: string,
  validatedOutput: T,
  attemptNumber: number,
  provider?: ProviderAdapter,
  sessionManager?: SessionManager
): Promise<void> {
  try {
    debug('Sending success feedback to session', {
      sessionId,
      attemptNumber,
      hasSuccessMessage: Boolean(config.successMessage),
      messageLength: config.successMessage?.length || 0,
      hasProviderFeedback: Boolean(provider?.sendSuccessFeedback),
    });

    if (!config.successMessage) {
      debug('Skipping success feedback - no success message provided');
      return;
    }

    const successFeedback: SessionSuccessFeedback = {
      message: config.successMessage,
      validatedOutput,
      attemptNumber,
      timestamp: new Date(),
      metadata: {
        schemaName: config.schema.constructor.name || 'ZodSchema',
      },
    };

    // Store feedback in session manager
    if (sessionManager) {
      await sessionManager.addSuccessFeedback?.(sessionId, successFeedback);
    }

    // Also send feedback directly to the provider if supported
    if (provider?.sendSuccessFeedback) {
      try {
        await provider.sendSuccessFeedback(sessionId, config.successMessage, {
          attemptNumber,
          validatedOutput,
          timestamp: successFeedback.timestamp,
        });
        debug('Success feedback sent to provider', {
          provider: provider.name,
          sessionId,
          attemptNumber,
        });
      } catch (providerError) {
        // Log provider feedback failure but don't fail the main operation
        debug('Provider success feedback failed, continuing with session storage only', {
          provider: provider.name,
          sessionId,
          error: providerError instanceof Error ? providerError.message : 'Unknown error',
        });
      }
    }

    info('Success feedback sent to session', {
      sessionId,
      attemptNumber,
      messageLength: config.successMessage.length,
      feedbackTimestamp: successFeedback.timestamp.toISOString(),
      sentToProvider: Boolean(provider?.sendSuccessFeedback),
    });
  } catch (error) {
    logError('Failed to send success feedback to session', {
      sessionId,
      attemptNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });
    throw error;
  }
}

/**
 * Apply enhancement rounds to improve initial successful result
 * 
 * @template T The expected output type
 * @param config Processed pipeline configuration with enhancement settings
 * @param provider Provider adapter for LLM calls
 * @param sessionId Optional session ID for context reuse
 * @param baseline The initial valid result to improve
 * @param sessionManager Optional session manager for metrics
 * @returns Enhanced result with attempt count
 */
async function applyEnhancementRounds<T>(
  config: ProcessedConfiguration<T>,
  provider: ProviderAdapter,
  sessionId: string | undefined,
  baseline: T,
  sessionManager?: SessionManager
): Promise<{ value: T; enhancementAttempts: number }> {
  if (!config.enhancement) {
    return { value: baseline, enhancementAttempts: 0 };
  }

  info('Starting enhancement rounds', {
    rounds: config.enhancement.rounds,
    strategy: config.enhancement.strategy,
    minImprovement: config.enhancement.minImprovement,
    hasSessionId: Boolean(sessionId),
  });

  let currentBest = baseline;
  let enhancementAttempts = 0;

  for (let round = 1; round <= config.enhancement.rounds; round++) {
    try {
      debug(`Starting enhancement round ${round}/${config.enhancement.rounds}`, {
        round,
        totalRounds: config.enhancement.rounds,
        strategy: config.enhancement.strategy,
      });

      // Build enhancement prompt
      const enhancementPrompt = buildEnhancementPrompt(
        config.enhancement,
        currentBest,
        round
      );

      // Combine with original context
      const fullPrompt = combineEnhancementPrompt(
        config,
        enhancementPrompt,
        currentBest
      );

      // Call provider for enhancement
      const enhancementStartTime = Date.now();
      const providerResponse = await callProvider(
        provider,
        sessionId,
        fullPrompt,
        config,
        round + 100  // Use high attempt number to distinguish from retries
      );

      enhancementAttempts++;

      // Validate enhanced response
      const validationResult = validateJson(config.schema, providerResponse.content || '');

      if (validationResult.success) {
        // Evaluate improvement
        const improvementScore = evaluateImprovement(
          config.enhancement,
          currentBest,
          validationResult.value
        );

        info(`Enhancement round ${round} completed`, {
          round,
          improvementScore,
          meetsThreshold: improvementScore >= config.enhancement.minImprovement,
          threshold: config.enhancement.minImprovement,
        });

        // Accept enhancement if it meets improvement threshold
        if (improvementScore >= config.enhancement.minImprovement) {
          info(`Enhancement accepted - improvement threshold met`, {
            round,
            improvementScore,
            threshold: config.enhancement.minImprovement,
          });
          currentBest = validationResult.value;

          // Record enhancement success in session metrics
          if (sessionId && sessionManager) {
            const executionTimeMs = Date.now() - enhancementStartTime;
            await recordAttemptMetrics(
              sessionId,
              round + 100,
              true,
              executionTimeMs,
              providerResponse.tokenUsage,
              sessionManager
            );
          }
        } else {
          debug(`Enhancement rejected - below improvement threshold`, {
            round,
            improvementScore,
            threshold: config.enhancement.minImprovement,
          });
        }
      } else {
        warn(`Enhancement round ${round} failed validation`, {
          round,
          errorCode: validationResult.error.code,
          errorMessage: validationResult.error.message,
        });
      }
    } catch (error) {
      warn(`Enhancement round ${round} failed with error`, {
        round,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with next round or return current best
    }
  }

  info('Enhancement rounds completed', {
    totalRounds: config.enhancement.rounds,
    enhancementAttempts,
    baselineImproved: currentBest !== baseline,
  });

  return {
    value: currentBest,
    enhancementAttempts,
  };
}

/**
 * Combine enhancement prompt with original context
 * 
 * @template T The expected output type
 * @param config Pipeline configuration
 * @param enhancementPrompt The enhancement-specific prompt
 * @param currentResult The current valid result
 * @returns Combined prompt for enhancement
 */
function combineEnhancementPrompt<T>(
  config: ProcessedConfiguration<T>,
  enhancementPrompt: string,
  currentResult: T
): string {
  const parts: string[] = [];

  // Add original context if provided
  if (config.context) {
    parts.push(`[CONTEXT]\n${config.context}`);
  }

  // Add schema information
  parts.push(`[SCHEMA]\nThe output must strictly conform to the following structure:`);
  parts.push(JSON.stringify(config.schema, null, 2));

  // Add current result as baseline
  parts.push(`[CURRENT RESULT]\nHere is the current valid result:`);
  parts.push(JSON.stringify(currentResult, null, 2));

  // Add enhancement instruction
  parts.push(`[ENHANCEMENT REQUEST]\n${enhancementPrompt}`);

  // Add lens if provided
  if (config.lens) {
    parts.push(`[LENS]\n${config.lens}`);
  }

  return parts.join('\n\n');
}

/**
 * Records attempt metrics for session tracking
 *
 * @param sessionId Session ID to record metrics for
 * @param attemptNumber Current attempt number
 * @param success Whether the attempt was successful
 * @param executionTimeMs Time taken for this attempt
 * @param tokenUsage Token usage information (if available)
 */
async function recordAttemptMetrics(
  sessionId: string,
  attemptNumber: number,
  success: boolean,
  executionTimeMs: number,
  tokenUsage?: { inputTokens: number; outputTokens: number; totalTokens: number },
  sessionManager?: SessionManager
): Promise<void> {
  try {
    debug('Recording attempt metrics', {
      sessionId,
      attemptNumber,
      success,
      executionTimeMs,
      hasTokenUsage: Boolean(tokenUsage),
    });

    if (!sessionManager) {
      debug('No session manager provided for metrics recording', { sessionId });
      return;
    }

    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      debug('Session not found for metrics recording', { sessionId });
      return;
    }

    const currentMetrics = session.metrics || {
      totalAttempts: 0,
      successfulValidations: 0,
      avgAttemptsToSuccess: 0,
      successRate: 0,
      lastSuccessTimestamp: undefined,
      totalExecutionTimeMs: 0,
      avgExecutionTimeMs: 0,
      totalTokenUsage: undefined,
      operationsWithRetries: 0,
      maxAttemptsForOperation: 0,
    };

    // Update metrics
    const newTotalAttempts = currentMetrics.totalAttempts + 1;
    const newSuccessfulValidations = success ? currentMetrics.successfulValidations + 1 : currentMetrics.successfulValidations;
    const newTotalExecutionTime = currentMetrics.totalExecutionTimeMs + executionTimeMs;
    const newOperationsWithRetries = (attemptNumber > 1 && success) ? currentMetrics.operationsWithRetries + 1 : currentMetrics.operationsWithRetries;
    const newMaxAttemptsForOperation = Math.max(currentMetrics.maxAttemptsForOperation, attemptNumber);

    // Update token usage if provided
    let newTotalTokenUsage = currentMetrics.totalTokenUsage;
    if (tokenUsage) {
      newTotalTokenUsage = {
        inputTokens: (currentMetrics.totalTokenUsage?.inputTokens || 0) + tokenUsage.inputTokens,
        outputTokens: (currentMetrics.totalTokenUsage?.outputTokens || 0) + tokenUsage.outputTokens,
        totalTokens: (currentMetrics.totalTokenUsage?.totalTokens || 0) + tokenUsage.totalTokens,
      };
    }

    const baseMetrics = {
      totalAttempts: newTotalAttempts,
      successfulValidations: newSuccessfulValidations,
      avgAttemptsToSuccess: newSuccessfulValidations > 0 ? newTotalAttempts / newSuccessfulValidations : 0,
      successRate: newTotalAttempts > 0 ? newSuccessfulValidations / newTotalAttempts : 0,
      totalExecutionTimeMs: newTotalExecutionTime,
      avgExecutionTimeMs: newTotalAttempts > 0 ? newTotalExecutionTime / newTotalAttempts : 0,
      operationsWithRetries: newOperationsWithRetries,
      maxAttemptsForOperation: newMaxAttemptsForOperation,
    };

    const updatedMetrics: SessionMetrics = {
      ...baseMetrics,
      ...(success || currentMetrics.lastSuccessTimestamp ? { 
        lastSuccessTimestamp: success ? new Date() : currentMetrics.lastSuccessTimestamp! 
      } : {}),
      ...(newTotalTokenUsage ? { totalTokenUsage: newTotalTokenUsage } : {}),
    };

    // Update session with new metrics
    await sessionManager.updateSession(sessionId, { metrics: updatedMetrics });

    debug('Attempt metrics recorded successfully', {
      sessionId,
      attemptNumber,
      success,
      newTotalAttempts,
      newSuccessfulValidations,
      successRate: updatedMetrics.successRate,
    });
  } catch (error) {
    warn('Failed to record attempt metrics', {
      sessionId,
      attemptNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - metrics recording should not fail the main operation
  }
}
