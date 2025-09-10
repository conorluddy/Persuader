/**
 * Runner Core Module - Backward Compatibility Layer
 *
 * This module maintains backward compatibility by re-exporting the main
 * pipeline functionality from the modular runner implementation. The actual
 * implementation has been decomposed into specialized modules within the
 * runner/ directory for better maintainability and separation of concerns.
 *
 * @deprecated Direct import from this file is maintained for compatibility.
 * Consider importing from './runner/index.js' for the latest modular API.
 */

// Re-export types for external usage
export type {
  ConfigurationValidation,
  ErrorClassification,
  ExecutionResult,
  NormalizedOptions,
  ProcessedConfiguration,
  RecoveryStrategy,
  SessionCoordinationResult,
} from './runner/index.js';
// Re-export the main pipeline API and utilities
// Re-export utility functions
export {
  analyzeErrorRecovery,
  classifyError,
  createMockProvider,
  formatResultMetadata,
  getExecutionStats,
  logErrorRecoveryAnalysis,
  logSessionInfo,
  persuade,
  processRunnerConfiguration,
  validateAndNormalizeOptions,
  validateProviderAdapter,
  validateRunnerOptions,
  validateSessionState,
} from './runner/index.js';
