#!/usr/bin/env node

/**
 * Persuader CLI Entry Point
 *
 * Command-line interface for the Persuader framework, providing schema-driven
 * LLM pipeline orchestration with validated JSON generation.
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { consola } from 'consola';
import packageJson from '../../package.json' with { type: 'json' };
import { runCommand } from './commands/run.js';

/**
 * Configure consola options
 */
export function configureConsola(): void {
  consola.options.formatOptions.date = false;
  consola.options.formatOptions.compact = true;
}

/**
 * Create and configure the CLI program
 */
export function createProgram(CommandConstructor = Command): Command {
  const program = new CommandConstructor();

  program
    .name('persuader')
    .description('Schema-driven LLM pipeline for validated JSON generation')
    .version(packageJson.version)
    .addHelpText(
      'after',
      `
Examples:
  $ persuader run -s ./schema.ts -i ./data.json
  $ persuader run -s ./schemas/user.ts -i "./data/*.json" -o ./output/
  $ persuader run -s ./schema.ts -i ./data.json --dry-run
  $ persuader run -s ./schema.ts -i ./data.json --verbose --retries 3

For more information, visit: https://github.com/conorluddy/Persuader
  `
    );

  // Add the run command
  program
    .command('run')
    .description('Run Persuader pipeline on input data')
    .requiredOption(
      '-s, --schema <path>',
      'Path to Zod schema file (TypeScript)'
    )
    .requiredOption('-i, --input <path>', 'Input file path or glob pattern')
    .option(
      '-o, --output <path>',
      'Output file path or directory',
      './output/results.json'
    )
    .option(
      '--session-id <id>',
      'Reuse existing session ID for context continuity'
    )
    .option('--context <text>', 'Global context to provide to the LLM')
    .option('--lens <text>', 'Per-batch focusing hint for the LLM')
    .option(
      '--retries <n>',
      'Maximum retry attempts for validation failures',
      '5'
    )
    .option(
      '--model <name>',
      'LLM model to use (defaults to claude-3-5-haiku-20241022 for faster processing)'
    )
    .option('--dry-run', 'Validate inputs without calling LLM')
    .option('-v, --verbose', 'Enable verbose output with detailed logging')
    .option('-d, --debug', 'Enable debug mode with full prompt/response visibility')
    .addHelpText(
      'after',
      `
Run Command Examples:
  $ persuader run -s ./schemas/person.ts -i ./people.json
    Process people.json with person schema

  $ persuader run -s ./schemas/product.ts -i "./data/*.json" -o ./results/
    Process all JSON files in data/ directory with product schema

  $ persuader run -s ./schema.ts -i ./data.json --context "Extract key details"
    Add global context for LLM processing

  $ persuader run -s ./schema.ts -i ./data.json --lens "Focus on pricing"
    Add specific focusing hint for this batch

  $ persuader run -s ./schema.ts -i ./data.json --retries 3 --verbose
    Use custom retry count with detailed logging

  $ persuader run -s ./schema.ts -i ./data.json --debug
    Enable debug mode for full prompt/response visibility

  $ persuader run -s ./schema.ts -i ./data.json --verbose --debug
    Combine verbose progress with debug-level LLM visibility

  $ persuader run -s ./schema.ts -i ./data.json --dry-run
    Validate schema and inputs without LLM calls
  `
    )
    .action(runCommand);

  // Error handling for unknown commands
  program.on('command:*', (operands: string[]) => {
    consola.error(chalk.red(`Unknown command: ${operands[0]}`));
    consola.info(chalk.blue('Available commands:'));
    program.outputHelp();
    process.exit(1);
  });

  return program;
}

/**
 * Main CLI execution function
 */
export function runCli(CommandConstructor = Command): void {
  // Configure consola
  configureConsola();

  // Create and configure program
  const program = createProgram(CommandConstructor);

  // Parse command line arguments
  program.parse();

  // Show help if no arguments provided
  if (process.argv.length === 2) {
    consola.info(chalk.green('Persuader'));
    consola.info(chalk.blue('Clean validated data from messy AI responses\n'));
    program.outputHelp();
  }
}

// Execute CLI if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
