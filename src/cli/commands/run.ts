/**
 * Run Command Implementation
 *
 * Implements the `persuader run` command that orchestrates the complete pipeline
 * from schema loading through LLM processing to validated output generation.
 */

import { resolve } from 'node:path';
import chalk from 'chalk';
import { consola } from 'consola';
import ora, { type Ora } from 'ora';
import type { z } from 'zod';
import { createClaudeCLIAdapter } from '../../adapters/claude-cli.js';
import { persuade, validateRunnerOptions } from '../../core/runner.js';
import type { Options, Result } from '../../types/index.js';
import type { ReadInputsResult } from '../../utils/file-io.js';
import { readInputs, writeOutput } from '../../utils/file-io.js';
import { loadSchema } from '../../utils/schema-loader.js';

/**
 * CLI run command options interface
 */
export interface RunOptions {
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
}

/**
 * Schema loading result (adapted from utility module)
 */
interface SchemaLoadResult {
  schema: z.ZodSchema<unknown>;
  schemaName: string;
}

/**
 * Input processing result (using ReadInputsResult from file-io utilities)
 */
type InputResult = ReadInputsResult;

/**
 * Main run command handler
 */
export async function runCommand(options: RunOptions): Promise<void> {
  const startTime = Date.now();
  let spinner: Ora | null = null;

  try {
    // Configure logging based on verbose flag
    if (options.verbose) {
      consola.level = 4; // Debug level
      consola.info(chalk.blue('🔧 Verbose mode enabled'));
      consola.debug('Run options:', options);
    } else {
      consola.level = 3; // Info level
    }

    consola.info(chalk.green('Starting Persuader pipeline...'));

    // Step 1: Validate and load schema
    spinner = ora('Loading schema...').start();
    const schemaResult = await loadSchemaWrapper(
      options.schema,
      options.verbose
    );
    spinner.succeed(chalk.green(`Schema loaded: ${schemaResult.schemaName}`));

    // Step 2: Process input files
    spinner = ora('Processing input files...').start();
    const inputResult = await processInputFiles(options.input, options.verbose);
    spinner.succeed(
      chalk.green(
        `Found ${inputResult.data.length} input items from ${inputResult.fileCount} file(s)`
      )
    );

    // Step 3: Validate runner options
    spinner = ora('Validating configuration...').start();
    const runOptions: Options<unknown> = {
      schema: schemaResult.schema,
      input: inputResult.data,
      ...(options.context && { context: options.context }),
      ...(options.lens && { lens: options.lens }),
      ...(options.sessionId && { sessionId: options.sessionId }),
      retries: parseInt(options.retries, 10),
      ...(options.model && { model: options.model }),
    };

    const validation = validateRunnerOptions(runOptions);
    if (!validation.valid) {
      spinner.fail(chalk.red('Configuration validation failed'));
      for (const error of validation.errors) {
        consola.error(chalk.red(`  • ${error}`));
      }
      process.exit(1);
    }
    spinner.succeed(chalk.green('Configuration validated'));

    // Step 4: Handle dry-run mode
    if (options.dryRun) {
      consola.success(chalk.green('✅ Dry run completed successfully'));
      consola.info(chalk.blue('Would process:'));
      consola.info(
        chalk.blue(`  • Schema: ${options.schema} (${schemaResult.schemaName})`)
      );
      consola.info(chalk.blue(`  • Input files: ${inputResult.fileCount}`));
      consola.info(chalk.blue(`  • Input items: ${inputResult.data.length}`));
      consola.info(chalk.blue(`  • Output: ${options.output}`));
      consola.info(chalk.blue(`  • Model: ${options.model || 'default'}`));
      consola.info(chalk.blue(`  • Retries: ${options.retries}`));

      const elapsed = Date.now() - startTime;
      consola.success(chalk.green(`🎉 Dry run completed in ${elapsed}ms`));
      return;
    }

    // Step 5: Initialize provider
    spinner = ora('Initializing LLM provider...').start();
    const provider = createClaudeCLIAdapter();

    // Check provider health
    const health = await provider.getHealth?.();
    if (!health || !health.healthy) {
      spinner.fail(chalk.red('Provider health check failed'));
      consola.error(chalk.red(health?.error || 'Unknown provider error'));
      if (health?.details && options.verbose) {
        consola.debug('Provider health details:', health.details);
      }
      process.exit(1);
    }
    spinner.succeed(chalk.green('LLM provider ready'));

    // Step 6: Run the pipeline
    spinner = ora('Running LLM pipeline...').start();
    if (options.verbose) {
      spinner.stop();
      consola.info(chalk.blue('🔄 Processing data through LLM...'));
    }

    const result = await persuade(runOptions, provider);

    if (!result.ok) {
      if (spinner?.isSpinning)
        spinner.fail(chalk.red('Pipeline execution failed'));
      consola.error(chalk.red('❌ Pipeline failed:'));
      consola.error(chalk.red(`  Type: ${result.error?.type || 'unknown'}`));
      consola.error(
        chalk.red(`  Message: ${result.error?.message || 'No error message'}`)
      );

      if (options.verbose && result.error?.details) {
        consola.debug('Error details:', result.error.details);
      }

      consola.info(chalk.blue(`Attempts made: ${result.attempts}`));

      const elapsed = Date.now() - startTime;
      consola.info(chalk.blue(`Total time: ${elapsed}ms`));
      process.exit(1);
    }

    if (spinner?.isSpinning) {
      spinner.succeed(chalk.green('Pipeline completed successfully'));
    }

    // Step 7: Save results
    spinner = ora('Saving results...').start();
    await saveResults(result, options.output, options.verbose);
    spinner.succeed(chalk.green(`Results saved to: ${options.output}`));

    // Step 8: Report success metrics
    const elapsed = Date.now() - startTime;
    consola.success(
      chalk.green('🎉 Persuader pipeline completed successfully!')
    );

    if (options.verbose) {
      consola.info(chalk.blue('📊 Execution Summary:'));
      consola.info(chalk.blue(`  • Total time: ${elapsed}ms`));
      consola.info(
        chalk.blue(`  • LLM time: ${result.metadata.executionTimeMs}ms`)
      );
      consola.info(chalk.blue(`  • Attempts: ${result.attempts}`));
      consola.info(chalk.blue(`  • Provider: ${result.metadata.provider}`));
      consola.info(
        chalk.blue(`  • Model: ${result.metadata.model || 'default'}`)
      );
      consola.info(chalk.blue(`  • Session: ${result.sessionId || 'none'}`));

      if (result.metadata.tokenUsage) {
        consola.info(
          chalk.blue(
            `  • Input tokens: ${result.metadata.tokenUsage.inputTokens}`
          )
        );
        consola.info(
          chalk.blue(
            `  • Output tokens: ${result.metadata.tokenUsage.outputTokens}`
          )
        );
        consola.info(
          chalk.blue(
            `  • Total tokens: ${result.metadata.tokenUsage.totalTokens}`
          )
        );

        if (result.metadata.tokenUsage.estimatedCost) {
          consola.info(
            chalk.blue(
              `  • Estimated cost: $${result.metadata.tokenUsage.estimatedCost.toFixed(4)}`
            )
          );
        }
      }
    } else {
      consola.success(
        chalk.green(
          `✨ Completed in ${elapsed}ms with ${result.attempts} attempt(s)`
        )
      );
    }
  } catch (error) {
    if (spinner?.isSpinning) {
      spinner.fail(chalk.red('Operation failed'));
    }

    consola.error(chalk.red('❌ Unexpected error:'));

    if (error instanceof Error) {
      consola.error(chalk.red(error.message));
      if (options.verbose && error.stack) {
        consola.debug('Stack trace:', error.stack);
      }
    } else {
      consola.error(chalk.red('Unknown error occurred'));
      if (options.verbose) {
        consola.debug('Error details:', error);
      }
    }

    process.exit(1);
  }
}

/**
 * Load and validate schema file using utility module
 */
async function loadSchemaWrapper(
  schemaPath: string,
  verbose = false
): Promise<SchemaLoadResult> {
  try {
    const result = await loadSchema(schemaPath, { verbose });
    return {
      schema: result.schema as z.ZodSchema<unknown>,
      schemaName: result.exportName,
    };
  } catch (error) {
    throw new Error(
      `Failed to load schema from ${schemaPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Process input files and patterns to extract data using file-io utilities
 */
async function processInputFiles(
  inputPattern: string,
  verbose = false
): Promise<InputResult> {
  try {
    if (verbose) {
      consola.debug(`Processing input pattern: ${inputPattern}`);
    }

    const result = await readInputs(inputPattern, {
      flattenArrays: true, // Flatten arrays from multiple files for batch processing
      allowEmpty: false, // Throw error if no files found
    });

    if (verbose) {
      consola.debug(
        `Found ${result.fileCount} file(s), ${result.data.length} items total`
      );
      for (const file of result.files) {
        consola.debug(
          `  • ${file.filePath} (${file.format}, ${file.size} bytes)`
        );
      }
    }

    return result;
  } catch (error) {
    // Convert file-io errors to CLI-friendly messages
    if ((error as { type?: string }).type === 'file_io') {
      const fileError = error as {
        message: string;
        type?: string;
        operation?: string;
      };
      throw new Error(`File processing failed: ${fileError.message}`);
    }
    throw error;
  }
}

/**
 * Save results to output file using file-io utilities
 */
async function saveResults(
  result: Result<unknown>,
  outputPath: string,
  verbose = false
): Promise<void> {
  try {
    if (verbose) {
      consola.debug(`Saving results to: ${resolve(outputPath)}`);
    }

    // Prepare output data
    const outputData = {
      success: result.ok,
      data: result.value,
      metadata: {
        attempts: result.attempts,
        sessionId: result.sessionId,
        executionTimeMs: result.metadata.executionTimeMs,
        startedAt: result.metadata.startedAt,
        completedAt: result.metadata.completedAt,
        provider: result.metadata.provider,
        model: result.metadata.model,
        tokenUsage: result.metadata.tokenUsage,
      },
      error: result.ok
        ? undefined
        : {
            type: result.error?.type,
            message: result.error?.message,
            code: (result.error as { code?: string })?.code,
            retryable: (result.error as { retryable?: boolean })?.retryable,
          },
    };

    // Use file-io utilities with pretty printing enabled
    await writeOutput(outputData, outputPath, {
      pretty: true,
      createDir: true,
    });

    if (verbose) {
      const jsonOutput = JSON.stringify(outputData, null, 2);
      consola.debug(`Results written: ${jsonOutput.length} characters`);
    }
  } catch (error) {
    // Convert file-io errors to CLI-friendly messages
    if ((error as { type?: string }).type === 'file_io') {
      const fileError = error as {
        message: string;
        type?: string;
        operation?: string;
      };
      throw new Error(`Failed to save results: ${fileError.message}`);
    }
    throw new Error(
      `Failed to write results to ${outputPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
