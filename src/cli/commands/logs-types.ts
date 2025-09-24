/**
 * Type definitions for log management commands
 */

/**
 * Options for view logs command
 */
export interface ViewLogsOptions {
  readonly lines: string;
  readonly follow?: boolean;
  readonly session?: string;
  readonly request?: string;
  readonly level?: string;
  readonly category?: string;
  readonly since?: string;
  readonly json?: boolean;
  readonly color?: boolean;
}

/**
 * Options for search logs command  
 */
export interface SearchLogsOptions {
  readonly ignoreCase?: boolean;
  readonly lines: string;
  readonly regex?: boolean;
  readonly session?: string;
  readonly since?: string;
  readonly json?: boolean;
}

/**
 * Options for clean logs command
 */
export interface CleanLogsOptions {
  readonly olderThan: string;
  readonly keep: string;
  readonly dryRun?: boolean;
  readonly compress?: boolean;
}

/**
 * Options for stats command
 */
export interface StatsOptions {
  readonly period?: string;
  readonly byLevel?: boolean;
  readonly byCategory?: boolean;
  readonly bySession?: boolean;
  readonly json?: boolean;
}

/**
 * Options for performance command
 */
export interface PerfOptions {
  readonly metric?: string;
  readonly export: string;
  readonly period?: string;
}

/**
 * Options for privacy scan command
 */
export interface PrivacyScanOptions {
  readonly fix?: boolean;
  readonly level?: string;
  readonly report?: boolean;
  readonly dryRun?: boolean;
}

/**
 * Options for configure logging command
 */
export interface ConfigureLoggingOptions {
  readonly setLevel?: string;
  readonly setCategories?: string;
  readonly setPreset?: string;
  readonly enableJsonl?: boolean;
  readonly setPrivacy?: string;
  readonly show?: boolean;
}

/**
 * Options for tail logs command
 */
export interface TailLogsOptions {
  readonly lines: string;
  readonly session?: string;
  readonly category?: string;
  readonly color?: boolean;
}