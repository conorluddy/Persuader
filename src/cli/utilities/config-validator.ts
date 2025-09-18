/**
 * Configuration Validation Utilities
 *
 * Handles CLI option validation, schema loading, and configuration validation for commands.
 * Provides type-safe validation with detailed error messages and recovery suggestions.
 *
 * @module cli/utilities/config-validator
 */

import type { z } from 'zod';
import { validateRunnerOptions } from '../../core/runner.js';
import { DEFAULT_RETRIES } from '../../shared/constants/index.js';
import type { Options } from '../../types/pipeline.js';
import type { ReadInputsResult } from '../../utils/file-io.js';
import { readInputs } from '../../utils/file-io.js';
import { loadSchema } from '../../utils/schema-loader.js';

/**
 * Schema loading result with metadata
 */
export interface SchemaLoadResult {
  /** Loaded and validated Zod schema */
  readonly schema: z.ZodSchema<unknown>;
  /** Name of the exported schema */
  readonly schemaName: string;
  /** Path to schema file */
  readonly filePath: string;
  /** Schema loading time in milliseconds */
  readonly loadTimeMs: number;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  readonly valid: boolean;
  /** Validation error messages */
  readonly errors: readonly string[];
  /** Warning messages for suboptimal configuration */
  readonly warnings: readonly string[];
  /** Validated configuration object */
  readonly config?: Options<unknown>;
}

/**
 * CLI option validation errors
 */
export interface OptionValidationError {
  /** Option name that failed validation */
  readonly option: string;
  /** Error message */
  readonly message: string;
  /** Suggested fix or alternative */
  readonly suggestion?: string;
  /** Whether error is recoverable */
  readonly recoverable: boolean;
}

/**
 * Schema validation specific error
 */
export class SchemaValidationError extends Error {
  public readonly code: string;
  public readonly filePath: string | undefined;
  public override readonly cause: Error | undefined;

  constructor(code: string, message: string, filePath?: string, cause?: Error) {
    super(message);
    this.name = 'SchemaValidationError';
    this.code = code;
    this.filePath = filePath ?? undefined;
    this.cause = cause ?? undefined;
  }

  public override toString(): string {
    return `${this.name} [${this.code}]: ${this.message}${this.filePath ? ` (${this.filePath})` : ''}`;
  }
}

/**
 * Load and validate schema file with comprehensive error handling
 *
 * Loads schema files (TypeScript/JavaScript) and validates they export a proper
 * Zod schema. Provides detailed error messages for common issues like missing
 * exports, invalid schemas, or compilation errors.
 *
 * @param schemaPath - Path to schema file
 * @param options - Loading options
 * @returns Promise resolving to validated schema and metadata
 */
export async function loadAndValidateSchema(
  schemaPath: string,
  options: { verbose?: boolean } = {}
): Promise<SchemaLoadResult> {
  const startTime = Date.now();

  try {
    const result = await loadSchema(schemaPath, {
      verbose: options.verbose ?? false,
    });
    const loadTimeMs = Date.now() - startTime;

    return {
      schema: result.schema as z.ZodSchema<unknown>,
      schemaName: result.exportName,
      filePath: result.filePath,
      loadTimeMs,
    };
  } catch (error) {
    throw new SchemaValidationError(
      'SCHEMA_LOAD_FAILED',
      `Failed to load schema from ${schemaPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      schemaPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Validate CLI options and convert to pipeline configuration
 *
 * Takes raw CLI options and validates them according to pipeline requirements.
 * Performs type coercion, range validation, and dependency checking with
 * detailed error reporting.
 *
 * @param rawOptions - Raw CLI options from commander or similar
 * @param schema - Loaded schema for validation context
 * @returns Promise resolving to validation result
 */
export async function validatePipelineConfig(
  rawOptions: Record<string, unknown>,
  schema: z.ZodSchema<unknown>
): Promise<ConfigValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Build the pipeline options from raw CLI options
    const pipelineOptions: Options<unknown> = {
      schema,
      input: rawOptions.input,
      retries:
        typeof rawOptions.retries === 'string'
          ? parseInt(rawOptions.retries, 10)
          : (rawOptions.retries as number) || DEFAULT_RETRIES,
    };

    if (rawOptions.context) {
      (pipelineOptions as { context?: string }).context =
        rawOptions.context as string;
    }
    if (rawOptions.lens) {
      (pipelineOptions as { lens?: string }).lens = rawOptions.lens as string;
    }
    if (rawOptions.sessionId) {
      (pipelineOptions as { sessionId?: string }).sessionId =
        rawOptions.sessionId as string;
    }
    if (rawOptions.model) {
      (pipelineOptions as { model?: string }).model =
        rawOptions.model as string;
    }

    // Use the existing validateRunnerOptions function
    const validation = validateRunnerOptions(pipelineOptions);

    if (!validation.valid) {
      errors.push(...validation.errors);
    }

    // Add configuration warnings
    const retries = pipelineOptions.retries;
    if (retries && retries > 5) {
      warnings.push('High retry count may result in longer execution times');
    }

    if (!pipelineOptions.context && !pipelineOptions.lens) {
      warnings.push(
        'No context or lens provided - consider adding guidance for better results'
      );
    }

    const result: ConfigValidationResult = {
      valid: errors.length === 0,
      errors,
      warnings,
      ...(validation.valid && { config: pipelineOptions }),
    };

    return result;
  } catch (error) {
    errors.push(
      `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    const result: ConfigValidationResult = {
      valid: false,
      errors,
      warnings,
    };

    return result;
  }
}

/**
 * Validate individual CLI option values
 *
 * Performs detailed validation of specific option values including type checking,
 * range validation, file existence, and format verification.
 *
 * @param optionName - Name of the option being validated
 * @param value - Option value to validate
 * @param constraints - Validation constraints for the option
 * @returns Array of validation errors, empty if valid
 */
export function validateOptionValue(
  optionName: string,
  value: unknown,
  constraints: {
    readonly type: 'string' | 'number' | 'boolean' | 'path' | 'pattern';
    readonly required?: boolean;
    readonly min?: number;
    readonly max?: number;
    readonly pattern?: RegExp;
    readonly allowedValues?: readonly string[];
  }
): readonly OptionValidationError[] {
  const errors: OptionValidationError[] = [];

  // Check required constraint
  if (
    constraints.required &&
    (value === undefined || value === null || value === '')
  ) {
    errors.push({
      option: optionName,
      message: `${optionName} is required`,
      suggestion: `Provide a value for --${optionName}`,
      recoverable: true,
    });
    return errors;
  }

  // Skip further validation if value is optional and not provided
  if (value === undefined || value === null) {
    return errors;
  }

  // Type validation
  switch (constraints.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push({
          option: optionName,
          message: `${optionName} must be a string, got ${typeof value}`,
          suggestion: `Provide a string value for --${optionName}`,
          recoverable: true,
        });
      }
      break;

    case 'number': {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (typeof numValue !== 'number' || Number.isNaN(numValue)) {
        errors.push({
          option: optionName,
          message: `${optionName} must be a number, got ${typeof value}`,
          suggestion: `Provide a numeric value for --${optionName}`,
          recoverable: true,
        });
      } else {
        // Range validation for numbers
        if (constraints.min !== undefined && numValue < constraints.min) {
          errors.push({
            option: optionName,
            message: `${optionName} must be at least ${constraints.min}, got ${numValue}`,
            suggestion: `Increase --${optionName} to at least ${constraints.min}`,
            recoverable: true,
          });
        }
        if (constraints.max !== undefined && numValue > constraints.max) {
          errors.push({
            option: optionName,
            message: `${optionName} must be at most ${constraints.max}, got ${numValue}`,
            suggestion: `Reduce --${optionName} to at most ${constraints.max}`,
            recoverable: true,
          });
        }
      }
      break;
    }

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({
          option: optionName,
          message: `${optionName} must be a boolean, got ${typeof value}`,
          suggestion: `Use --${optionName} or --no-${optionName}`,
          recoverable: true,
        });
      }
      break;

    case 'path':
      if (typeof value !== 'string') {
        errors.push({
          option: optionName,
          message: `${optionName} must be a file path (string), got ${typeof value}`,
          suggestion: `Provide a valid file path for --${optionName}`,
          recoverable: true,
        });
      }
      break;

    case 'pattern':
      if (typeof value !== 'string') {
        errors.push({
          option: optionName,
          message: `${optionName} must be a pattern (string), got ${typeof value}`,
          suggestion: `Provide a valid glob pattern for --${optionName}`,
          recoverable: true,
        });
      }
      break;
  }

  // Pattern validation
  if (
    constraints.pattern &&
    typeof value === 'string' &&
    !constraints.pattern.test(value)
  ) {
    errors.push({
      option: optionName,
      message: `${optionName} does not match required pattern`,
      suggestion: `Ensure --${optionName} matches the expected format`,
      recoverable: true,
    });
  }

  // Allowed values validation
  if (
    constraints.allowedValues &&
    typeof value === 'string' &&
    !constraints.allowedValues.includes(value)
  ) {
    errors.push({
      option: optionName,
      message: `${optionName} must be one of: ${constraints.allowedValues.join(', ')}`,
      suggestion: `Use one of the allowed values: ${constraints.allowedValues.join(', ')}`,
      recoverable: true,
    });
  }

  return errors;
}

/**
 * Create a comprehensive configuration validation pipeline
 *
 * Combines schema loading, input validation, and pipeline configuration
 * validation into a single comprehensive validation process.
 *
 * @param options - Raw CLI options to validate
 * @returns Promise resolving to complete validation result
 */
export async function validateCompleteConfiguration(options: {
  schema: string;
  input: string;
  output: string;
  sessionId?: string;
  context?: string;
  lens?: string;
  retries: string;
  model?: string;
  dryRun?: boolean;
  verbose?: boolean;
}): Promise<{
  readonly valid: boolean;
  readonly schemaResult?: SchemaLoadResult;
  readonly inputResult?: ReadInputsResult;
  readonly configResult?: ConfigValidationResult;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  try {
    // Step 1: Validate CLI options
    const cliErrors = validateRunOptions(options);
    allErrors.push(...cliErrors.map(e => e.message));

    if (cliErrors.length > 0) {
      return {
        valid: false,
        errors: allErrors,
        warnings: allWarnings,
      };
    }

    // Step 2: Load and validate schema
    let schemaResult: SchemaLoadResult;
    try {
      const schemaOptions =
        options.verbose !== undefined ? { verbose: options.verbose } : {};
      schemaResult = await loadAndValidateSchema(options.schema, schemaOptions);
    } catch (error) {
      allErrors.push(
        `Schema file loading failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please check that the schema file exists, exports a valid Zod schema, and has no syntax errors.`
      );
      return {
        valid: false,
        errors: allErrors,
        warnings: allWarnings,
      };
    }

    // Step 3: Validate input files
    const inputOptions =
      options.verbose !== undefined ? { verbose: options.verbose } : {};
    const inputValidation = await validateInputFiles(
      options.input,
      inputOptions
    );
    if (!inputValidation.valid) {
      allErrors.push(...inputValidation.errors);
      return {
        valid: false,
        schemaResult,
        errors: allErrors,
        warnings: allWarnings,
      };
    }

    // Step 4: Validate pipeline configuration
    const configResult = await validatePipelineConfig(
      options,
      schemaResult.schema
    );
    if (!configResult.valid) {
      allErrors.push(...configResult.errors);
    }
    allWarnings.push(...configResult.warnings);

    const finalResult = {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      schemaResult,
      ...(inputValidation.inputResult && {
        inputResult: inputValidation.inputResult,
      }),
      configResult,
    };

    return finalResult;
  } catch (error) {
    allErrors.push(
      `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return {
      valid: false,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}

/**
 * Generate configuration summary for dry-run mode
 *
 * Creates a human-readable summary of the validated configuration showing
 * all settings, computed values, and potential issues or optimizations.
 *
 * @param config - Validated pipeline configuration
 * @param schemaResult - Schema loading result
 * @param inputStats - Input file statistics
 * @returns Formatted configuration summary
 */
export function generateConfigSummary(
  config: Options<unknown>,
  schemaResult: SchemaLoadResult,
  inputStats: { fileCount: number; itemCount: number }
): {
  readonly summary: string[];
  readonly warnings: string[];
  readonly optimizations: string[];
} {
  const summary: string[] = [
    `Schema: ${schemaResult.schemaName} (${schemaResult.filePath})`,
    `Input: ${inputStats.itemCount} items from ${inputStats.fileCount} file(s)`,
    `Retries: ${config.retries}`,
  ];

  if (config.model) {
    summary.push(`Model: ${config.model}`);
  }

  if (config.context) {
    const context = config.context;
    summary.push(
      `Context: ${context.substring(0, 50)}${context.length > 50 ? '...' : ''}`
    );
  }

  if (config.lens) {
    const lens = config.lens;
    summary.push(
      `Lens: ${lens.substring(0, 50)}${lens.length > 50 ? '...' : ''}`
    );
  }

  if (config.sessionId) {
    summary.push(`Session ID: ${config.sessionId}`);
  }

  const warnings: string[] = [];
  const optimizations: string[] = [];

  // Generate warnings
  if (config.retries && config.retries > 5) {
    warnings.push('High retry count may result in longer execution times');
  }

  if (!config.context && !config.lens) {
    warnings.push(
      'No context or lens provided - consider adding guidance for better results'
    );
  }

  if (inputStats.itemCount > 100) {
    warnings.push(
      'Large input dataset - consider using sessions for better performance'
    );
  }

  // Generate optimization suggestions
  if (inputStats.itemCount > 10 && !config.sessionId) {
    optimizations.push(
      'Consider using --session-id for better performance with multiple items'
    );
  }

  if (schemaResult.loadTimeMs > 1000) {
    optimizations.push(
      'Schema loading is slow - consider converting TypeScript schemas to JavaScript'
    );
  }

  if (!config.model) {
    optimizations.push(
      'Consider specifying a model with --model for consistent results'
    );
  }

  return {
    summary,
    warnings,
    optimizations,
  };
}

/**
 * Input validation result
 */
export interface InputValidationResult {
  /** Whether input is valid */
  readonly valid: boolean;
  /** Validation error messages */
  readonly errors: readonly string[];
  /** Input file processing result */
  readonly inputResult?: ReadInputsResult;
  /** Input statistics */
  readonly stats: {
    readonly fileCount: number;
    readonly itemCount: number;
  };
}

/**
 * Process and validate input files with comprehensive error handling
 *
 * Validates input patterns, processes files, and provides detailed error reporting
 * for common issues like missing files, empty datasets, or invalid formats.
 *
 * @param inputPattern - Glob pattern or file path for input files
 * @param options - Processing options
 * @returns Promise resolving to validation result
 */
export async function validateInputFiles(
  inputPattern: string,
  options: { verbose?: boolean } = {}
): Promise<InputValidationResult> {
  const errors: string[] = [];

  try {
    if (!inputPattern || typeof inputPattern !== 'string') {
      errors.push('Input pattern must be a non-empty string');
      return {
        valid: false,
        errors,
        stats: { fileCount: 0, itemCount: 0 },
      };
    }

    if (options.verbose) {
      console.debug(`Processing input pattern: ${inputPattern}`);
    }

    const inputResult = await readInputs(inputPattern, {
      flattenArrays: true, // Flatten arrays from multiple files for batch processing
      allowEmpty: false, // Throw error if no files found
    });

    // Validate input result
    if (inputResult.fileCount === 0) {
      errors.push(`No files found matching pattern: ${inputPattern}`);
    }

    if (inputResult.data.length === 0) {
      errors.push('Input files contain no data items');
    }

    // Add warnings for large datasets
    const warnings: string[] = [];
    if (inputResult.data.length > 1000) {
      warnings.push(
        'Large input dataset detected - consider processing in smaller batches'
      );
    }

    if (options.verbose && inputResult.fileCount > 0) {
      console.debug(
        `Found ${inputResult.fileCount} file(s), ${inputResult.data.length} items total`
      );
      for (const file of inputResult.files) {
        console.debug(
          `  • ${file.filePath} (${file.format}, ${file.size} bytes)`
        );
      }
    }

    const result: InputValidationResult = {
      valid: errors.length === 0,
      errors,
      stats: {
        fileCount: inputResult.fileCount,
        itemCount: inputResult.data.length,
      },
      ...(errors.length === 0 && { inputResult }),
    };

    return result;
  } catch (error) {
    // Handle file-io specific errors
    if ((error as { type?: string }).type === 'file_io') {
      errors.push(
        `Input file error: ${error instanceof Error ? error.message : 'Unknown file error'}`
      );
    } else {
      errors.push(
        `Failed to process input files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    const result: InputValidationResult = {
      valid: false,
      errors,
      stats: { fileCount: 0, itemCount: 0 },
    };

    return result;
  }
}

/**
 * Validate CLI run command options comprehensively
 *
 * Performs complete validation of all CLI options for the run command including
 * type checking, range validation, file existence, and cross-option dependencies.
 *
 * @param options - Raw CLI options from commander
 * @returns Array of validation errors
 */
export function validateRunOptions(options: {
  schema: string;
  input: string;
  output: string;
  sessionId?: string;
  context?: string;
  lens?: string;
  retries: string;
  model?: string;
  dryRun?: boolean;
  verbose?: boolean;
}): readonly OptionValidationError[] {
  const errors: OptionValidationError[] = [];

  // Validate required options
  errors.push(
    ...validateOptionValue('schema', options.schema, {
      type: 'path',
      required: true,
    })
  );

  errors.push(
    ...validateOptionValue('input', options.input, {
      type: 'pattern',
      required: true,
    })
  );

  errors.push(
    ...validateOptionValue('output', options.output, {
      type: 'path',
      required: true,
    })
  );

  // Validate retries (string that should be a number)
  const retriesNum = parseInt(options.retries, 10);
  if (Number.isNaN(retriesNum)) {
    errors.push({
      option: 'retries',
      message: 'Retries must be a valid number',
      suggestion: 'Provide a numeric value like --retries 3',
      recoverable: true,
    });
  } else {
    errors.push(
      ...validateOptionValue('retries', retriesNum, {
        type: 'number',
        min: 0,
        max: 10,
      })
    );
  }

  // Validate optional options
  if (options.model !== undefined) {
    errors.push(
      ...validateOptionValue('model', options.model, {
        type: 'string',
      })
    );
  }

  if (options.context !== undefined) {
    errors.push(
      ...validateOptionValue('context', options.context, {
        type: 'string',
      })
    );
  }

  if (options.lens !== undefined) {
    errors.push(
      ...validateOptionValue('lens', options.lens, {
        type: 'string',
      })
    );
  }

  if (options.sessionId !== undefined) {
    errors.push(
      ...validateOptionValue('sessionId', options.sessionId, {
        type: 'string',
        pattern: /^[a-zA-Z0-9_-]+$/, // Simple session ID pattern
      })
    );
  }

  return errors;
}

/**
 * Suggest configuration fixes for common validation errors
 *
 * Analyzes validation errors and provides actionable suggestions for fixing
 * configuration issues. Includes specific commands, file paths, and examples.
 *
 * @param errors - Validation errors from configuration
 * @returns Array of suggested fixes with explanations
 */
export function suggestConfigurationFixes(
  errors: readonly OptionValidationError[]
): readonly {
  readonly error: string;
  readonly suggestion: string;
  readonly command?: string;
  readonly example?: string;
}[] {
  return errors.map(error => ({
    error: error.message,
    suggestion: error.suggestion || 'Check the option value and try again',
    ...(error.option.includes('schema') && {
      command: 'ls -la *.js *.json',
      example:
        'persuader run --schema ./my-schema.js --input data.json --output results.json',
    }),
    ...(error.option.includes('input') && {
      command: 'ls -la *.json *.yaml',
      example:
        'persuader run --schema schema.js --input "data/*.json" --output results.json',
    }),
    ...(error.option.includes('retries') && {
      example:
        'persuader run --schema schema.js --input data.json --retries 3 --output results.json',
    }),
  }));
}
