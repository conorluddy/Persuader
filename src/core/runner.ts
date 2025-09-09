/**
 * Runner Core Module
 *
 * The central orchestration engine for the Persuader framework that handles
 * the complete prompt → LLM → validation → retry cycle. This module coordinates
 * all pipeline operations while remaining stateless and testable.
 */

import { createClaudeCLIAdapter } from '@/index.js';
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_RETRIES,
  DEFAULT_TEMPERATURE,
  TOKEN_ESTIMATION_DIVISOR,
} from '../shared/constants/index.js';
import type {
  ExecutionMetadata,
  Options,
  ProviderAdapter,
  ProviderError,
  Result,
  ValidationError,
} from '../types/index.js';
import { validateExample } from '../utils/example-generator.js';
import {
  createLogger,
  debug,
  info,
  error as logError,
  setGlobalLogger,
  setGlobalLogLevel,
  warn,
} from '../utils/logger.js';
import { extractSchemaInfo } from '../utils/schema-analyzer.js';
import {
  augmentPromptWithErrors,
  buildPrompt,
  combinePromptParts,
  type PromptParts,
} from './prompt.js';
import { retryWithFeedback } from './retry.js';
import { formatValidationErrorFeedback, validateJson } from './validation.js';

/**
 * Main orchestration function for the Persuader pipeline
 *
 * This function represents the core of the framework, handling the complete
 * flow from input processing to validated output generation with intelligent
 * retry mechanisms.
 *
 * @template T - The expected output type from Zod schema validation
 * @param options - Configuration for the pipeline run
 * @param provider - LLM provider adapter to use for generation: Default to claudeCli
 * @returns Promise resolving to Result with validated data or error information
 */
export async function persuade<T>(
  options: Options<T>,
  provider: ProviderAdapter = createClaudeCLIAdapter()
): Promise<Result<T>> {
  const startTime = Date.now();

  // Set global log level and enable JSONL logging for debug mode
  if (options.logLevel) {
    setGlobalLogLevel(options.logLevel);

    // Enable JSONL logging automatically when debug level is set
    if (options.logLevel === 'debug') {
      const logger = createLogger({
        level: 'debug',
        jsonlLogging: true,
        logsDirectory: './logs',
      });
      setGlobalLogger(logger);
    }
  }

  debug('Starting Persuader pipeline execution', {
    provider: provider.name,
    model: options.model,
    retries: options.retries,
    hasContext: Boolean(options.context),
    hasLens: Boolean(options.lens),
    sessionId: options.sessionId,
    inputType: typeof options.input,
    logLevel: options.logLevel,
  });

  // Log schema information for debugging and visibility
  if (options.schema) {
    try {
      const schemaInfo = extractSchemaInfo(options.schema);
      debug('Schema information extracted', {
        schemaName: schemaInfo.name,
        schemaType: schemaInfo.type,
        hasDescription: Boolean(schemaInfo.description),
        fieldCount: schemaInfo.fieldCount,
        requiredFields: schemaInfo.requiredFields,
        optionalFields: schemaInfo.optionalFields,
        nestedObjects: schemaInfo.nestedObjects,
        arrayFields: schemaInfo.arrayFields,
        enumFields: schemaInfo.enumFields,
        complexity: schemaInfo.complexity,
      });

      // Log detailed schema structure in debug mode
      info('Schema structure passed to Persuader', {
        name: schemaInfo.name || 'unnamed',
        type: schemaInfo.type,
        description: schemaInfo.description,
        shape: schemaInfo.shape,
        complexity: schemaInfo.complexity,
      });
    } catch (schemaError) {
      warn('Failed to extract schema information', {
        error:
          schemaError instanceof Error ? schemaError.message : 'Unknown error',
        schemaType: typeof options.schema,
        schemaConstructor: options.schema.constructor.name,
      });
    }
  } else {
    warn('No schema provided to Persuader pipeline', {
      hasSchema: false,
      inputType: typeof options.input,
    });
  }

  // Validate user-provided example if present
  if (options.exampleOutput && options.schema) {
    debug('Validating user-provided example output');
    const validation = validateExample(options.schema, options.exampleOutput);
    if (!validation.valid) {
      const errorMessage = validation.errors.join('. ');
      debug('User-provided example failed validation', {
        errors: validation.errors,
      });
      throw new Error(
        `Invalid exampleOutput provided: ${errorMessage}. The example must validate against the schema.`
      );
    } else {
      debug('User-provided example validated successfully');
    }
  }

  // Apply default configuration values
  const config = {
    retries: options.retries ?? DEFAULT_RETRIES,
    model: options.model ?? DEFAULT_MODEL,
    maxTokens: DEFAULT_MAX_TOKENS,
    temperature: DEFAULT_TEMPERATURE,
    ...options,
    // Ensure provider options are merged properly
    providerOptions: {
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      ...options.providerOptions,
    },
  };

  info('Pipeline configuration applied', {
    finalRetries: config.retries,
    finalModel: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  });

  // Build initial prompt from schema and input
  let promptParts: PromptParts;
  try {
    debug('Building initial prompt from schema and input', {
      hasSchema: Boolean(config.schema),
      hasInput: Boolean(config.input),
      hasContext: Boolean(config.context),
      hasLens: Boolean(config.lens),
    });

    promptParts = buildPrompt({
      schema: config.schema,
      input: config.input,
      ...(config.context && { context: config.context }),
      ...(config.lens && { lens: config.lens }),
      ...(config.exampleOutput && { exampleOutput: config.exampleOutput }),
    });

    info('Prompt built successfully', {
      promptPartsKeys: Object.keys(promptParts),
      contextLength: config.context?.length || 0,
      lensLength: config.lens?.length || 0,
    });
  } catch (error) {
    logError('Failed to build prompt', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    });
    return createErrorResult<T>(
      {
        type: 'provider',
        code: 'prompt_build_failed',
        message: `Failed to build prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
        provider: provider.name,
        timestamp: new Date(),
        retryable: false,
        details: { originalError: error },
      },
      0,
      startTime,
      provider
    );
  }

  // Handle session creation or reuse
  let sessionId = config.sessionId;

  if (!sessionId && provider.supportsSession && provider.createSession) {
    try {
      debug('Creating new provider session', {
        provider: provider.name,
        supportsSession: provider.supportsSession,
        contextLength: config.context?.length || 0,
      });

      sessionId = await provider.createSession(config.context || '', {
        temperature: config.temperature,
        model: config.model,
      });

      info('Provider session created successfully', {
        sessionId,
        provider: provider.name,
      });
    } catch (error) {
      logError('Failed to create provider session', {
        provider: provider.name,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      });
      return createErrorResult<T>(
        {
          type: 'provider',
          code: 'session_creation_failed',
          message: `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          provider: provider.name,
          timestamp: new Date(),
          retryable: false,
          details: { originalError: error },
        },
        0,
        startTime,
        provider
      );
    }
  }

  // Execute the main pipeline with retry logic
  info('Starting pipeline execution with retry logic', {
    maxAttempts: config.retries + 1,
    sessionId,
    provider: provider.name,
  });

  const retryResult = await retryWithFeedback<T>({
    maxAttempts: config.retries + 1,
    operation: async (attemptNumber, previousError) => {
      debug(`Starting attempt ${attemptNumber}/${config.retries + 1}`, {
        attemptNumber,
        maxAttempts: config.retries + 1,
        hasPreviousError: Boolean(previousError),
        previousErrorType: previousError?.type,
      });

      try {
        // Rebuild prompt with attempt number for progressive urgency
        let finalPromptParts = promptParts;

        if (attemptNumber > 1) {
          // Rebuild the base prompt with attempt-specific urgency
          const progressivePromptParts = buildPrompt({
            schema: config.schema,
            input: config.input,
            ...(config.context && { context: config.context }),
            ...(config.lens && { lens: config.lens }),
            ...(config.exampleOutput && {
              exampleOutput: config.exampleOutput,
            }),
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

          debug('Rebuilt prompt with progressive urgency and error feedback', {
            attemptNumber,
            errorType: previousError?.type,
            errorCode: previousError?.code,
            hasErrorFeedback: Boolean(previousError),
          });
        }

        // Combine prompt parts into final prompt
        const finalPrompt = combinePromptParts(finalPromptParts);

        debug('Final prompt prepared for provider', {
          promptLength: finalPrompt.length,
          attemptNumber,
        });

        // Call provider with the prompt
        debug('Calling provider with final prompt', {
          provider: provider.name,
          model: config.model,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          sessionId: sessionId || null,
          attemptNumber,
        });

        const providerResponse = await provider.sendPrompt(
          sessionId || null,
          finalPrompt,
          {
            ...config.providerOptions,
            model: config.model,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
          }
        );

        debug('Received provider response', {
          responseLength: providerResponse.content?.length || 0,
          hasTokenUsage: Boolean(providerResponse.tokenUsage),
          tokenUsage: providerResponse.tokenUsage,
          attemptNumber,
        });

        // Validate the response against the schema
        debug('Validating response against schema', {
          contentLength: providerResponse.content?.length || 0,
          attemptNumber,
        });

        const validationResult = validateJson(
          config.schema,
          providerResponse.content
        );

        if (validationResult.success) {
          info(`Attempt ${attemptNumber} succeeded - validation passed`, {
            attemptNumber,
            resultType: typeof validationResult.value,
            hasValue: Boolean(validationResult.value),
          });

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

          return {
            success: false,
            error: validationResult.error,
          };
        }
      } catch (error) {
        logError(`Attempt ${attemptNumber} failed with provider error`, {
          attemptNumber,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          errorType:
            error instanceof Error ? error.constructor.name : 'Unknown',
          provider: provider.name,
        });
        // Handle provider errors
        const providerError: ProviderError = {
          type: 'provider',
          code: 'provider_call_failed',
          message: `Provider call failed on attempt ${attemptNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          provider: provider.name,
          timestamp: new Date(),
          retryable: true, // Provider errors are generally retryable
          details: {
            originalError: error,
            attemptNumber,
          },
        };

        return {
          success: false,
          error: providerError,
        };
      }
    },
  });

  // Calculate execution metadata
  const endTime = Date.now();
  const executionMetadata: ExecutionMetadata = {
    executionTimeMs: endTime - startTime,
    startedAt: new Date(startTime),
    completedAt: new Date(endTime),
    provider: provider.name,
    model: config.model,
  };

  // Format final result
  if (retryResult.success && retryResult.value !== undefined) {
    info('Pipeline execution completed successfully', {
      attempts: retryResult.attempts,
      executionTimeMs: executionMetadata.executionTimeMs,
      provider: provider.name,
      model: executionMetadata.model,
      sessionId,
    });

    const result: Result<T> = {
      ok: true,
      value: retryResult.value,
      attempts: retryResult.attempts,
      metadata: executionMetadata,
      ...(sessionId && { sessionId }),
    };
    return result;
  } else {
    logError('Pipeline execution failed after all retry attempts', {
      attempts: retryResult.attempts,
      executionTimeMs: executionMetadata.executionTimeMs,
      errorType: retryResult.error?.type,
      errorCode: retryResult.error?.code,
      errorMessage: retryResult.error?.message,
    });
    // Ensure we have an error when the result is not successful
    const error: ValidationError | ProviderError = retryResult.error || {
      type: 'validation' as const,
      code: 'unknown_error',
      message: 'Unknown error occurred during processing',
      timestamp: new Date(),
      retryable: false,
      issues: [],
      rawValue: undefined,
      suggestions: ['Please try again or contact support'],
      failureMode: 'context_confusion',
      retryStrategy: 'session_reset',
      structuredFeedback: {
        problemSummary: 'Unknown error occurred during processing',
        specificIssues: [],
        correctionInstructions: ['Please try again or contact support'],
      },
    };

    const result: Result<T> = {
      ok: false,
      error,
      attempts: retryResult.attempts,
      metadata: executionMetadata,
      ...(sessionId && { sessionId }),
    };
    return result;
  }
}

/**
 * Helper function to create error results with consistent metadata
 */
function createErrorResult<T>(
  error: ValidationError | ProviderError,
  attempts: number,
  startTime: number,
  provider: ProviderAdapter
): Result<T> {
  const endTime = Date.now();

  return {
    ok: false,
    error,
    attempts,
    metadata: {
      executionTimeMs: endTime - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(endTime),
      provider: provider.name,
    },
  };
}

/**
 * Validate runner options before execution
 *
 * @param options - Options to validate
 * @returns Validation result with specific error details
 */
export function validateRunnerOptions<T>(options: Options<T>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!options.schema) {
    errors.push('Schema is required');
  }

  if (options.input === undefined) {
    errors.push('Input is required');
  }

  // Check numeric constraints
  if (options.retries !== undefined && options.retries < 0) {
    errors.push('Retries must be non-negative');
  }

  if (options.retries !== undefined && options.retries > 10) {
    errors.push('Retries should not exceed 10 for reasonable execution time');
  }

  // Check string constraints
  if (options.model !== undefined && typeof options.model !== 'string') {
    errors.push('Model must be a string');
  }

  if (options.context !== undefined && typeof options.context !== 'string') {
    errors.push('Context must be a string');
  }

  if (options.lens !== undefined && typeof options.lens !== 'string') {
    errors.push('Lens must be a string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate provider adapter before execution
 *
 * @param provider - Provider to validate
 * @returns Validation result with specific error details
 */
export function validateProviderAdapter(provider: ProviderAdapter): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!provider.name || typeof provider.name !== 'string') {
    errors.push('Provider must have a valid name');
  }

  if (typeof provider.sendPrompt !== 'function') {
    errors.push('Provider must implement sendPrompt method');
  }

  if (typeof provider.supportsSession !== 'boolean') {
    errors.push('Provider must specify supportsSession boolean');
  }

  // Check conditional requirements
  if (
    provider.supportsSession &&
    typeof provider.createSession !== 'function'
  ) {
    errors.push(
      'Provider that supports sessions must implement createSession method'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a minimal mock provider for testing
 *
 * @param responses - Array of responses to return in sequence
 * @returns Mock provider adapter
 */
export function createMockProvider(
  responses: string[],
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
export function getExecutionStats<T>(result: Result<T>): {
  successful: boolean;
  attempts: number;
  executionTime: number;
  provider: string;
  model?: string;
  errorType?: string;
  hasSession: boolean;
} {
  const stats = {
    successful: result.ok,
    attempts: result.attempts,
    executionTime: result.metadata.executionTimeMs,
    provider: result.metadata.provider,
    hasSession: Boolean(result.sessionId),
  };

  return {
    ...stats,
    ...(result.metadata.model && { model: result.metadata.model }),
    ...(!result.ok && result.error && { errorType: result.error.type }),
  };
}
