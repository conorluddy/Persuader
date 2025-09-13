/**
 * Configuration Manager for Runner Pipeline
 *
 * Handles options validation, default value application, and configuration
 * setup for the Persuader pipeline. Provides centralized configuration
 * management with validation and error reporting.
 */

import type { z } from 'zod';
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_RETRIES,
  DEFAULT_TEMPERATURE,
} from '../../shared/constants/index.js';
import type { Options, ProviderAdapter } from '../../types/index.js';
import { validateExample } from '../../utils/example-generator.js';
import type { LogLevel } from '../../utils/logger.js';
import { debug, info, warn } from '../../utils/logger.js';
import { extractSchemaInfo } from '../../utils/schema-analyzer.js';

/**
 * Processed configuration with all defaults applied
 */
export interface ProcessedConfiguration<T> {
  readonly schema: z.ZodSchema<T>;
  readonly input: unknown;
  readonly context?: string;
  readonly lens?: string;
  readonly sessionId?: string;
  readonly output?: string;
  readonly retries: number;
  readonly model: string;
  readonly exampleOutput?: T;
  readonly logLevel?: LogLevel;
  readonly providerOptions: {
    readonly maxTokens: number;
    readonly temperature: number;
  } & Record<string, unknown>;
}

/**
 * Normalized options with validation applied but defaults not yet applied
 */
export interface NormalizedOptions<T> {
  readonly schema: z.ZodSchema<T>;
  readonly input: unknown;
  readonly context?: string;
  readonly lens?: string;
  readonly sessionId?: string;
  readonly output?: string;
  readonly retries?: number;
  readonly model?: string;
  readonly exampleOutput?: T;
  readonly logLevel?: LogLevel;
  readonly providerOptions?: Record<string, unknown>;
}

/**
 * Configuration validation result
 */
export interface ConfigurationValidation {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Validates and normalizes runner options without applying defaults
 *
 * This function performs the validation and normalization phase without applying
 * default values. It's useful when you need to separate validation from default
 * application, such as in CLI contexts where defaults might come from config files.
 *
 * @template T The expected output type from schema validation
 * @param options Raw options provided to the runner
 * @returns Validated and normalized options
 * @throws Error if options are invalid or example output fails validation
 */
export function validateAndNormalizeOptions<T>(
  options: Options<T>
): NormalizedOptions<T> {
  // Validate basic options structure
  const validation = validateRunnerOptions(options);
  if (!validation.valid) {
    throw new Error(`Invalid runner options: ${validation.errors.join(', ')}`);
  }

  // Log schema information for debugging and visibility
  logSchemaInformation(options);

  // Validate user-provided example if present
  validateExampleOutput(options);

  // Return normalized options without applying defaults
  const normalizedOptions: NormalizedOptions<T> = {
    schema: options.schema,
    input: options.input,
    ...(options.context !== undefined && { context: options.context }),
    ...(options.lens !== undefined && { lens: options.lens }),
    ...(options.sessionId !== undefined && { sessionId: options.sessionId }),
    ...(options.output !== undefined && { output: options.output }),
    ...(options.retries !== undefined && { retries: options.retries }),
    ...(options.model !== undefined && { model: options.model }),
    ...(options.exampleOutput !== undefined && {
      exampleOutput: options.exampleOutput,
    }),
    ...(options.logLevel !== undefined && { logLevel: options.logLevel }),
    ...(options.providerOptions !== undefined && {
      providerOptions: options.providerOptions,
    }),
  };

  debug('Options validated and normalized successfully', {
    hasSchema: Boolean(normalizedOptions.schema),
    hasInput: Boolean(normalizedOptions.input),
    hasContext: Boolean(normalizedOptions.context),
    hasLens: Boolean(normalizedOptions.lens),
    hasRetries: normalizedOptions.retries !== undefined,
    hasModel: normalizedOptions.model !== undefined,
    hasExampleOutput: Boolean(normalizedOptions.exampleOutput),
    hasProviderOptions: Boolean(normalizedOptions.providerOptions),
  });

  return normalizedOptions;
}

/**
 * Processes normalized options into a complete configuration with defaults applied
 *
 * This function takes validated and normalized options and applies all default
 * values to create a complete configuration ready for pipeline execution.
 *
 * @template T The expected output type from schema validation
 * @param normalizedOptions Validated and normalized options
 * @returns Processed configuration with all defaults applied
 */
export function processRunnerConfiguration<T>(
  normalizedOptions: NormalizedOptions<T>
): ProcessedConfiguration<T> {
  // Apply default configuration values
  const processedConfig: ProcessedConfiguration<T> = {
    schema: normalizedOptions.schema,
    input: normalizedOptions.input,
    retries: normalizedOptions.retries ?? DEFAULT_RETRIES,
    model: normalizedOptions.model ?? DEFAULT_MODEL,
    providerOptions: {
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      ...normalizedOptions.providerOptions,
    },
    ...(normalizedOptions.context && { context: normalizedOptions.context }),
    ...(normalizedOptions.lens && { lens: normalizedOptions.lens }),
    ...(normalizedOptions.sessionId && {
      sessionId: normalizedOptions.sessionId,
    }),
    ...(normalizedOptions.output && { output: normalizedOptions.output }),
    ...(normalizedOptions.exampleOutput && {
      exampleOutput: normalizedOptions.exampleOutput,
    }),
    ...(normalizedOptions.logLevel && { logLevel: normalizedOptions.logLevel }),
  };

  info('Pipeline configuration processed successfully', {
    finalRetries: processedConfig.retries,
    finalModel: processedConfig.model,
    maxTokens: processedConfig.providerOptions.maxTokens,
    temperature: processedConfig.providerOptions.temperature,
    hasContext: Boolean(processedConfig.context),
    hasLens: Boolean(processedConfig.lens),
    hasExampleOutput: Boolean(processedConfig.exampleOutput),
  });

  return processedConfig;
}

/**
 * Validates and processes runner options into a complete configuration
 *
 * This is a convenience function that combines validation, normalization, and
 * default application in a single call. For more granular control, use the
 * separate `validateAndNormalizeOptions` and `processRunnerConfiguration` functions.
 *
 * @template T The expected output type from schema validation
 * @param options Raw options provided to the runner
 * @returns Processed configuration with all defaults applied
 * @throws Error if options are invalid or example output fails validation
 */
export function processConfiguration<T>(
  options: Options<T>
): ProcessedConfiguration<T> {
  const normalizedOptions = validateAndNormalizeOptions(options);
  return processRunnerConfiguration(normalizedOptions);
}

/**
 * Validates runner options before processing
 *
 * @template T The expected output type
 * @param options Options to validate
 * @returns Validation result with specific error details
 */
export function validateRunnerOptions<T>(
  options: Options<T>
): ConfigurationValidation {
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
 * Validates provider adapter before execution
 *
 * @param provider Provider to validate
 * @returns Validation result with specific error details
 */
export function validateProviderAdapter(
  provider: ProviderAdapter
): ConfigurationValidation {
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
 * Logs comprehensive schema information for debugging and visibility
 *
 * @template T The expected output type
 * @param options Options containing the schema to analyze
 */
function logSchemaInformation<T>(options: Options<T>): void {
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
}

/**
 * Validates user-provided example output against schema
 *
 * @template T The expected output type
 * @param options Options containing schema and example output
 * @throws Error if example validation fails
 */
function validateExampleOutput<T>(options: Options<T>): void {
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
}
