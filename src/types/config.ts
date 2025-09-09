/**
 * CLI and Configuration Types
 *
 * Type definitions for CLI commands, configuration management, and framework settings.
 * These types define the contract for command-line interfaces and system configuration.
 */

import type { ProviderConfig } from './provider.js';
import type { RetryConfig } from './retry.js';
import type { SessionConfig } from './session.js';

/**
 * CLI command configuration
 */
export interface CLICommand {
  /** Command name */
  readonly name: string;

  /** Command description */
  readonly description: string;

  /** Command arguments */
  readonly arguments: readonly CLIArgument[];

  /** Command options */
  readonly options: readonly CLIOption[];

  /** Command handler function */
  readonly handler: (args: CLIArgs) => Promise<void> | void;
}

/**
 * CLI argument definition
 */
export interface CLIArgument {
  /** Argument name */
  readonly name: string;

  /** Argument description */
  readonly description: string;

  /** Whether argument is required */
  readonly required: boolean;

  /** Argument type */
  readonly type: 'string' | 'number' | 'boolean' | 'array';

  /** Default value */
  readonly defaultValue?: unknown;
}

/**
 * CLI option definition
 */
export interface CLIOption {
  /** Long option name */
  readonly long: string;

  /** Short option name */
  readonly short?: string;

  /** Option description */
  readonly description: string;

  /** Option type */
  readonly type: 'string' | 'number' | 'boolean' | 'array';

  /** Default value */
  readonly defaultValue?: unknown;

  /** Whether option is required */
  readonly required?: boolean;
}

/**
 * Parsed CLI arguments
 */
export interface CLIArgs {
  /** Positional arguments */
  readonly args: readonly string[];

  /** Named options */
  readonly options: Record<string, unknown>;

  /** Raw command line */
  readonly raw: readonly string[];
}

/**
 * Framework configuration
 */
export interface PersuaderConfig {
  /** Default retry configuration */
  readonly retry: RetryConfig;

  /** Default provider configuration */
  readonly provider: ProviderConfig;

  /** Session configuration */
  readonly session: SessionConfig;

  /** Logging configuration */
  readonly logging: LoggingConfig;

  /** Output configuration */
  readonly output: OutputConfig;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Logging level */
  readonly level: 'debug' | 'info' | 'warn' | 'error';

  /** Whether to enable debug mode */
  readonly debug: boolean;

  /** Log format */
  readonly format: 'json' | 'pretty';

  /** Log output destinations */
  readonly outputs: readonly string[];
}

/**
 * Output configuration
 */
export interface OutputConfig {
  /** Default output format */
  readonly format: 'json' | 'yaml' | 'csv';

  /** Whether to pretty-print output */
  readonly pretty: boolean;

  /** Default output directory */
  readonly directory: string;

  /** File naming strategy */
  readonly naming: 'timestamp' | 'incremental' | 'custom';
}
