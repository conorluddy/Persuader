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
import type { Options, PreloadOptions, ProviderAdapter } from '../../types/index.js';
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
    const errorType = validation.errors.some(error => error.includes('Options configuration'))
      ? 'Configuration validation failed'
      : 'Options validation failed';
    
    throw new Error(
      `${errorType}: ${validation.errors.join(' | ')}. This is a configuration issue with your options object, not a Zod schema validation failure.`
    );
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
 * Provides comprehensive validation of all options with specific, actionable error
 * messages that distinguish between configuration issues and schema validation failures.
 *
 * @template T The expected output type
 * @param options Options to validate
 * @returns Validation result with specific error details
 */
export function validateRunnerOptions<T>(
  options: Options<T>
): ConfigurationValidation {
  const errors: string[] = [];

  // Validate options object structure
  if (!options || typeof options !== 'object') {
    errors.push(
      'Options configuration is invalid: Must be a valid object. Please provide an options object with schema and input properties.'
    );
    return { valid: false, errors };
  }

  // Check required fields with detailed guidance
  if (!options.schema) {
    errors.push(
      'Options configuration error: schema property is required. Please provide a valid Zod schema object.'
    );
  } else {
    // Validate schema is a Zod schema
    if (
      !options.schema ||
      typeof options.schema !== 'object' ||
      typeof options.schema.safeParse !== 'function'
    ) {
      errors.push(
        'Options configuration error: schema must be a valid Zod schema object. Ensure you are importing and using a Zod schema (e.g., z.object({...})).'
      );
    }
  }

  if (options.input === undefined) {
    errors.push(
      'Options configuration error: input property is required. Please provide input data to be processed by the LLM.'
    );
  }

  // Check numeric constraints with examples
  if (options.retries !== undefined) {
    if (typeof options.retries !== 'number') {
      errors.push(
        'Options configuration error: retries must be a number. Example: retries: 5'
      );
    } else if (options.retries < 0) {
      errors.push(
        'Options configuration error: retries must be non-negative. Use 0 for no retries, or a positive number like 3.'
      );
    } else if (options.retries > 10) {
      errors.push(
        'Options configuration warning: retries should not exceed 10 for reasonable execution time. Consider using a lower value like 3-5.'
      );
    }
  }

  // Check string constraints with examples
  if (options.model !== undefined && typeof options.model !== 'string') {
    errors.push(
      'Options configuration error: model must be a string. Example: model: "claude-3-5-sonnet-20241022"'
    );
  }

  if (options.context !== undefined && typeof options.context !== 'string') {
    errors.push(
      'Options configuration error: context must be a string. Example: context: "You are an expert data analyst"'
    );
  }

  if (options.lens !== undefined && typeof options.lens !== 'string') {
    errors.push(
      'Options configuration error: lens must be a string. Example: lens: "Focus on accuracy and detail"'
    );
  }

  if (options.sessionId !== undefined && typeof options.sessionId !== 'string') {
    errors.push(
      'Options configuration error: sessionId must be a string. Example: sessionId: "analysis-session-1"'
    );
  }

  if (options.output !== undefined && typeof options.output !== 'string') {
    errors.push(
      'Options configuration error: output must be a string file path. Example: output: "./results.json"'
    );
  }

  // Validate providerOptions structure
  if (options.providerOptions !== undefined) {
    if (typeof options.providerOptions !== 'object' || options.providerOptions === null) {
      errors.push(
        'Options configuration error: providerOptions must be an object. Example: providerOptions: { maxTokens: 1000, temperature: 0.7 }'
      );
    } else {
      // Check common provider option types
      const providerOpts = options.providerOptions;
      
      if ('maxTokens' in providerOpts && typeof providerOpts.maxTokens !== 'number') {
        errors.push(
          'Options configuration error: providerOptions.maxTokens must be a number. Example: maxTokens: 1000'
        );
      }
      
      if ('temperature' in providerOpts && typeof providerOpts.temperature !== 'number') {
        errors.push(
          'Options configuration error: providerOptions.temperature must be a number between 0 and 1. Example: temperature: 0.7'
        );
      }
      
      if ('temperature' in providerOpts && typeof providerOpts.temperature === 'number') {
        const temp = providerOpts.temperature as number;
        if (temp < 0 || temp > 2) {
          errors.push(
            'Options configuration warning: providerOptions.temperature should typically be between 0 and 1. Higher values increase randomness.'
          );
        }
      }
    }
  }

  // Validate logLevel if provided
  if (options.logLevel !== undefined) {
    const validLogLevels = ['none', 'error', 'warn', 'info', 'debug', 'prompts'];
    if (typeof options.logLevel !== 'string' || !validLogLevels.includes(options.logLevel)) {
      errors.push(
        `Options configuration error: logLevel must be one of: ${validLogLevels.join(', ')}. Example: logLevel: "info"`
      );
    }
  }

  // Validate exampleOutput matches schema type if both provided
  if (options.exampleOutput !== undefined && options.schema) {
    try {
      // Quick type check - full validation happens later in validateExampleOutput
      if (typeof options.exampleOutput !== 'object' && typeof options.exampleOutput !== 'string' && typeof options.exampleOutput !== 'number' && typeof options.exampleOutput !== 'boolean') {
        // Only warn for clearly invalid types, let the later validation handle schema specifics
      }
    } catch {
      // Ignore validation errors here - they'll be caught in validateExampleOutput
    }
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

// ============================================================================
// PRELOAD CONFIGURATION PROCESSING
// ============================================================================

/**
 * Processed preload configuration with all defaults applied
 */
export interface ProcessedPreloadConfiguration {
  readonly input: unknown;
  readonly sessionId: string;
  readonly context: string | undefined;
  readonly lens: string | undefined;
  readonly model: string;
  readonly validateInput: z.ZodSchema<unknown> | undefined;
  readonly logLevel: LogLevel | undefined;
  readonly providerOptions: {
    readonly maxTokens: number;
    readonly temperature: number;
  } & Record<string, unknown>;
}

/**
 * Processes and validates preload configuration options
 *
 * This function handles validation and default application for preload operations.
 * It follows the same patterns as the main pipeline configuration but with
 * simplified requirements (no schema validation, no retry configuration).
 *
 * @param options Raw preload options provided by the user
 * @returns Validated and processed preload configuration
 * @throws Error if options are invalid
 */
export function processPreloadConfiguration(
  options: PreloadOptions
): ProcessedPreloadConfiguration {
  // Validate basic preload options structure
  const validation = validatePreloadOptions(options);
  if (!validation.valid) {
    throw new Error(
      `Preload configuration validation failed: ${validation.errors.join(' | ')}`
    );
  }

  debug('Processing preload configuration', {
    hasInput: Boolean(options.input),
    sessionId: options.sessionId,
    hasContext: Boolean(options.context),
    hasLens: Boolean(options.lens),
    hasInputValidation: Boolean(options.validateInput),
    model: options.model,
    logLevel: options.logLevel,
  });

  // Apply defaults and create processed configuration
  const processedConfig: ProcessedPreloadConfiguration = {
    input: options.input,
    sessionId: options.sessionId,
    context: options.context,
    lens: options.lens,
    model: options.model || DEFAULT_MODEL,
    validateInput: options.validateInput,
    logLevel: options.logLevel,
    providerOptions: {
      maxTokens: DEFAULT_MAX_TOKENS,
      temperature: DEFAULT_TEMPERATURE,
      ...options.providerOptions,
    },
  };

  info('Preload configuration processed successfully', {
    sessionId: processedConfig.sessionId,
    model: processedConfig.model,
    hasContext: Boolean(processedConfig.context),
    hasLens: Boolean(processedConfig.lens),
    hasInputValidation: Boolean(processedConfig.validateInput),
    providerOptionsKeys: Object.keys(processedConfig.providerOptions),
  });

  return processedConfig;
}

/**
 * Validates preload options structure and values
 *
 * @param options Preload options to validate
 * @returns Validation result with specific error details
 */
export function validatePreloadOptions(
  options: PreloadOptions
): ConfigurationValidation {
  const errors: string[] = [];

  // Validate required fields
  if (!options.input) {
    errors.push('Preload configuration error: input is required');
  }

  if (!options.sessionId || typeof options.sessionId !== 'string') {
    errors.push(
      'Preload configuration error: sessionId is required and must be a string'
    );
  }

  // Validate optional fields
  if (options.context !== undefined && typeof options.context !== 'string') {
    errors.push(
      'Preload configuration error: context must be a string if provided'
    );
  }

  if (options.lens !== undefined && typeof options.lens !== 'string') {
    errors.push(
      'Preload configuration error: lens must be a string if provided'
    );
  }

  if (options.model !== undefined && typeof options.model !== 'string') {
    errors.push(
      'Preload configuration error: model must be a string if provided'
    );
  }

  // Validate logLevel if provided
  if (options.logLevel !== undefined) {
    const validLogLevels = ['none', 'error', 'warn', 'info', 'debug', 'prompts'];
    if (typeof options.logLevel !== 'string' || !validLogLevels.includes(options.logLevel)) {
      errors.push(
        `Preload configuration error: logLevel must be one of: ${validLogLevels.join(', ')}`
      );
    }
  }

  // Validate provider options if provided
  if (options.providerOptions !== undefined) {
    if (
      typeof options.providerOptions !== 'object' ||
      options.providerOptions === null ||
      Array.isArray(options.providerOptions)
    ) {
      errors.push(
        'Preload configuration error: providerOptions must be an object if provided'
      );
    }
  }

  // Validate input validation schema if provided
  if (options.validateInput !== undefined) {
    try {
      // Basic check to ensure it looks like a Zod schema
      if (
        typeof options.validateInput !== 'object' ||
        typeof options.validateInput.parse !== 'function'
      ) {
        errors.push(
          'Preload configuration error: validateInput must be a valid Zod schema'
        );
      }
    } catch {
      errors.push(
        'Preload configuration error: validateInput must be a valid Zod schema'
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
