/**
 * Pipeline Orchestrator for Runner Framework
 *
 * The main coordination engine that manages the complete pipeline execution
 * flow. This orchestrator coordinates between configuration, sessions, prompt
 * building, execution, and result processing while maintaining clean separation
 * of concerns.
 */

import { createClaudeCLIAdapter } from '../../adapters/claude-cli.js';
import { defaultSessionManager } from '../../session/manager.js';
import type {
  ExecutionMetadata,
  Options,
  ProviderAdapter,
  ProviderError,
  Result,
  ValidationError,
} from '../../types/index.js';
import {
  createLogger,
  debug,
  info,
  setGlobalLogger,
  setGlobalLogLevel,
} from '../../utils/logger.js';
import { processConfiguration } from './configuration-manager.js';
import { executeWithRetry } from './execution-engine.js';
import { processResult } from './result-processor.js';
import { coordinateSession } from './session-coordinator.js';

/**
 * Main orchestration function for the Persuader pipeline
 *
 * This function represents the core of the framework, handling the complete
 * flow from input processing to validated output generation with intelligent
 * retry mechanisms. It coordinates all pipeline components while maintaining
 * a clean, testable interface.
 *
 * @template T The expected output type from Zod schema validation
 * @param options Configuration for the pipeline run
 * @param provider LLM provider adapter to use for generation (defaults to Claude CLI)
 * @returns Promise resolving to Result with validated data or error information
 */
export async function orchestratePipeline<T>(
  options: Options<T>,
  provider: ProviderAdapter = createClaudeCLIAdapter()
): Promise<Result<T>> {
  const startTime = Date.now();

  // Configure logging before any other operations
  configureLogging(options);

  debug('Starting Persuader pipeline orchestration', {
    provider: provider.name,
    model: options.model,
    retries: options.retries,
    hasContext: Boolean(options.context),
    hasLens: Boolean(options.lens),
    sessionId: options.sessionId,
    inputType: typeof options.input,
    logLevel: options.logLevel,
  });

  try {
    // Step 1: Process and validate configuration
    const config = processConfiguration(options);

    // Step 2: Coordinate session management
    const sessionResult = await coordinateSession(config, provider);
    if (!sessionResult.success) {
      const error = sessionResult.error || {
        type: 'provider' as const,
        code: 'session_coordination_failed',
        message: 'Session coordination failed without specific error',
        provider: provider.name,
        timestamp: new Date(),
        retryable: false,
        details: {},
      };
      return createErrorResult<T>(error, 0, startTime, provider);
    }

    // Step 3: Execute pipeline with retry logic
    info('Starting pipeline execution with retry logic', {
      maxAttempts: config.retries + 1,
      sessionId: sessionResult.sessionId,
      provider: provider.name,
    });

    const executionResult = await executeWithRetry(
      config,
      provider,
      sessionResult.sessionId,
      defaultSessionManager
    );

    // Step 4: Process and format final result
    const result = processResult(
      executionResult,
      sessionResult.sessionId,
      startTime,
      provider
    );

    info('Pipeline orchestration completed', {
      success: result.ok,
      attempts: result.attempts,
      executionTimeMs: result.metadata.executionTimeMs,
      provider: provider.name,
      sessionId: result.sessionId,
    });

    return result;
  } catch (orchestrationError) {
    // Handle unexpected orchestration errors
    const error: ProviderError = {
      type: 'provider',
      code: 'orchestration_failed',
      message: `Pipeline orchestration failed: ${orchestrationError instanceof Error ? orchestrationError.message : 'Unknown error'}`,
      provider: provider.name,
      timestamp: new Date(),
      retryable: false,
      details: { originalError: orchestrationError },
    };

    debug('Pipeline orchestration failed with unexpected error', {
      errorMessage:
        orchestrationError instanceof Error
          ? orchestrationError.message
          : 'Unknown error',
      errorType:
        orchestrationError instanceof Error
          ? orchestrationError.constructor.name
          : 'Unknown',
    });

    return createErrorResult<T>(error, 0, startTime, provider);
  }
}

/**
 * Configures global logging based on pipeline options
 *
 * Sets up appropriate logging levels and enables JSONL logging
 * for debug mode to support detailed pipeline debugging.
 *
 * @template T The expected output type
 * @param options Pipeline options containing logging configuration
 */
function configureLogging<T>(options: Options<T>): void {
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
 * Creates a standardized error result for orchestration failures
 *
 * @template T The expected output type
 * @param error The error that occurred
 * @param attempts Number of attempts made
 * @param startTime Pipeline start time
 * @param provider Provider adapter being used
 * @returns Formatted error result
 */
function createErrorResult<T>(
  error: ValidationError | ProviderError,
  attempts: number,
  startTime: number,
  provider: ProviderAdapter
): Result<T> {
  const endTime = Date.now();

  const metadata: ExecutionMetadata = {
    executionTimeMs: endTime - startTime,
    startedAt: new Date(startTime),
    completedAt: new Date(endTime),
    provider: provider.name,
  };

  return {
    ok: false,
    error,
    attempts,
    metadata,
  };
}
