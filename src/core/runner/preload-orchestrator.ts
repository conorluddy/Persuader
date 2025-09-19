/**
 * Preload Orchestrator for Session Data Loading
 *
 * Simplified orchestration for loading data into existing sessions without
 * validation complexity. Follows the same patterns as pipeline-orchestrator
 * but optimized for the preload use case with single-attempt execution.
 */

import { createClaudeCLIAdapter } from '../../adapters/claude-cli.js';
import type {
  PreloadOptions,
  PreloadResult,
  ProviderAdapter,
  ProviderError,
  ValidationError,
} from '../../types/index.js';
import {
  createLogger,
  debug,
  info,
  setGlobalLogger,
  setGlobalLogLevel,
} from '../../utils/logger.js';
import { validateJson } from '../validation/index.js';
import { processPreloadConfiguration } from './configuration-manager.js';
import { executePreload } from './preload-execution.js';

/**
 * Main orchestration function for preload operations
 *
 * This function provides simplified orchestration for loading data into
 * existing sessions. Unlike the main pipeline, it performs single-attempt
 * execution without retry loops, making it ideal for context building.
 *
 * @param options Configuration for the preload operation
 * @param provider LLM provider adapter to use (defaults to Claude CLI)
 * @returns Promise resolving to preload result with raw response
 */
export async function orchestratePreload(
  options: PreloadOptions,
  provider: ProviderAdapter = createClaudeCLIAdapter()
): Promise<PreloadResult> {
  const startTime = Date.now();

  // Configure logging before any other operations
  configurePreloadLogging(options);

  debug('Starting preload orchestration', {
    provider: provider.name,
    sessionId: options.sessionId,
    model: options.model,
    hasContext: Boolean(options.context),
    hasLens: Boolean(options.lens),
    hasInputValidation: Boolean(options.validateInput),
    inputType: typeof options.input,
    logLevel: options.logLevel,
  });

  try {
    // Step 1: Process and validate configuration
    const config = processPreloadConfiguration(options);

    // Step 2: Validate input data if schema provided (optional quality gate)
    if (config.validateInput) {
      info('Validating input data before preload', {
        hasValidationSchema: true,
        inputType: typeof config.input,
      });

      const inputValidation = validatePreloadInput(config.input, config.validateInput);
      if (!inputValidation.success) {
        const validationError = inputValidation.error!; // We know error exists when success is false
        debug('Input validation failed, returning error result', {
          errorType: validationError.type,
          errorCode: validationError.code,
          errorMessage: validationError.message,
        });

        return createPreloadErrorResult(
          validationError,
          startTime,
          provider,
          options.sessionId
        );
      }

      info('Input validation passed successfully', {
        validatedInputType: typeof inputValidation.value,
      });
    }

    // Step 3: Execute preload (single attempt, no retries)
    info('Starting preload execution', {
      sessionId: config.sessionId,
      provider: provider.name,
      model: config.model,
    });

    const result = await executePreload(config, provider, startTime);

    info('Preload orchestration completed', {
      success: result.ok,
      executionTimeMs: result.metadata.executionTimeMs,
      provider: provider.name,
      sessionId: result.sessionId,
      responseLength: result.rawResponse?.length || 0,
    });

    return result;
  } catch (orchestrationError) {
    // Handle unexpected orchestration errors
    const error: ProviderError = {
      type: 'provider',
      code: 'preload_orchestration_failed',
      message: `Preload orchestration failed: ${
        orchestrationError instanceof Error
          ? orchestrationError.message
          : 'Unknown error'
      }`,
      provider: provider.name,
      timestamp: new Date(),
      retryable: false,
      details: { originalError: orchestrationError },
    };

    debug('Preload orchestration failed with unexpected error', {
      errorMessage:
        orchestrationError instanceof Error
          ? orchestrationError.message
          : 'Unknown error',
      errorType:
        orchestrationError instanceof Error
          ? orchestrationError.constructor.name
          : 'Unknown',
      sessionId: options.sessionId,
    });

    return createPreloadErrorResult(error, startTime, provider, options.sessionId);
  }
}

/**
 * Configures global logging based on preload options
 *
 * Sets up appropriate logging levels and enables JSONL logging
 * for debug mode to support detailed preload debugging.
 *
 * @param options Preload options containing logging configuration
 */
function configurePreloadLogging(options: PreloadOptions): void {
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
}

/**
 * Validates input data against optional schema before preloading
 *
 * Provides an optional quality gate to ensure data meets requirements
 * before being sent to the LLM for context building.
 *
 * @param input Input data to validate
 * @param schema Zod schema for validation
 * @returns Validation result with typed value or error details
 */
function validatePreloadInput(
  input: unknown,
  schema: import('zod').ZodSchema<unknown>
): { success: boolean; value?: unknown; error?: ValidationError } {
  try {
    debug('Validating preload input against schema', {
      inputType: typeof input,
      inputSize: typeof input === 'string' ? input.length : 'unknown',
    });

    // Convert input to JSON string if it's not already
    const inputString = typeof input === 'string' ? input : JSON.stringify(input);
    
    // Use existing validation infrastructure
    const validationResult = validateJson(schema, inputString);

    if (validationResult.success) {
      debug('Preload input validation passed', {
        validatedType: typeof validationResult.value,
      });

      return {
        success: true,
        value: validationResult.value,
      };
    } else {
      debug('Preload input validation failed', {
        errorType: validationResult.error.type,
        errorCode: validationResult.error.code,
        issueCount: validationResult.error.issues?.length || 0,
      });

      return {
        success: false,
        error: validationResult.error,
      };
    }
  } catch (validationError) {
    debug('Preload input validation threw unexpected error', {
      errorMessage:
        validationError instanceof Error ? validationError.message : 'Unknown error',
      errorType:
        validationError instanceof Error
          ? validationError.constructor.name
          : 'Unknown',
    });

    // Create validation error for unexpected failures
    const error: ValidationError = {
      type: 'validation',
      code: 'input_validation_failed',
      message: `Input validation failed: ${
        validationError instanceof Error ? validationError.message : 'Unknown error'
      }`,
      timestamp: new Date(),
      retryable: false,
      issues: [],
      rawValue: input,
      suggestions: [],
      failureMode: 'json_parse_failure',
      retryStrategy: 'demand_json_format',
      structuredFeedback: {
        problemSummary: 'Input validation encountered an unexpected error',
        specificIssues: ['Input validation failed unexpectedly'],
        correctionInstructions: ['Check input data format and schema compatibility'],
      },
    };

    return {
      success: false,
      error,
    };
  }
}

/**
 * Creates a standardized error result for preload failures
 *
 * @param error The error that occurred
 * @param startTime Preload start time
 * @param provider Provider adapter being used
 * @param sessionId Session ID for the preload operation
 * @returns Formatted error result
 */
function createPreloadErrorResult(
  error: ValidationError | ProviderError,
  startTime: number,
  provider: ProviderAdapter,
  sessionId: string
): PreloadResult {
  const endTime = Date.now();

  return {
    ok: false,
    sessionId,
    error,
    metadata: {
      executionTimeMs: endTime - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(endTime),
      provider: provider.name,
    },
  };
}