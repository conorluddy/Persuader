/**
 * Persuader Core Types
 *
 * Comprehensive type definitions for the Persuader framework.
 * These types define the contracts for schema-driven LLM pipeline operations,
 * session management, provider adapters, and validation systems.
 *
 * This is the main entry point for all Persuader types, organized into
 * focused modules for better maintainability and discoverability.
 */

// Schema loader utilities
export type {
  SchemaLoaderOptions,
  SchemaLoadResult,
} from '../utils/schema-loader.js';
export {
  inspectSchemaFile,
  loadSchema,
  SchemaLoaderError,
  SUPPORTED_EXTENSIONS,
  validateSchemaIntegrity,
} from '../utils/schema-loader.js';
// CLI and configuration types
export type {
  CLIArgs,
  CLIArgument,
  CLICommand,
  CLIOption,
  LoggingConfig,
  OutputConfig,
  PersuaderConfig,
  // Config
  PersuaderConfig as Config,
} from './config.js';
// Error and validation types
export type {
  AnyPersuaderError,
  ConfigurationError,
  PersuaderError,
  ProviderError,
  ProviderError as AdapterError,
  RateLimitInfo,
  SessionError,
  ValidationError,
  // Errors
  ValidationError as SchemaError,
} from './errors.js';
// Export error type guards
export {
  isConfigurationError,
  isProviderError,
  isSessionError,
  isValidationError,
} from './errors.js';
// Core pipeline types
// Re-export commonly used types for convenience
export type {
  EnhancementConfiguration,
  ExecutionMetadata,
  InitSessionOptions,
  InitSessionResult,
  Options,
  // Core pipeline
  Options as PipelineOptions,
  PreloadOptions,
  PreloadResult,
  Result,
  Result as PipelineResult,
  TokenUsage,
} from './pipeline.js';
// Provider adapter types
export type {
  ProviderAdapter,
  // Provider
  ProviderAdapter as Adapter,
  ProviderConfig,
  ProviderHealth,
  ProviderInstanceConfig,
  ProviderPromptOptions,
  ProviderResponse,
  ProviderResponse as Response,
  ProviderSessionOptions,
} from './provider.js';
// Retry system types
export type {
  RetryAttempt,
  RetryConfig,
  RetryContext,
} from './retry.js';
// Session management types
export type {
  Session,
  // Session
  Session as PersuaderSession,
  SessionConfig,
  SessionFilter,
  SessionManager,
  SessionManager as Sessions,
  SessionMetadata,
  SessionMetrics,
  SessionSuccessFeedback,
} from './session.js';
// Utility types
export type {
  DeepReadonly,
  InferZodType,
  PartialBy,
  RequiredBy,
} from './utils.js';
