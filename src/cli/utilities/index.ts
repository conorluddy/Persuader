/**
 * CLI Utilities Module
 *
 * Centralized exports for all CLI utility modules providing reusable functionality
 * for command implementation, error handling, progress reporting, and workflow orchestration.
 *
 * @module cli/utilities
 */

// Configuration Validation Utilities
export {
  type ConfigValidationResult,
  generateConfigSummary,
  loadAndValidateSchema,
  type OptionValidationError,
  type SchemaLoadResult,
  suggestConfigurationFixes,
  validateOptionValue,
  validatePipelineConfig,
} from './config-validator.js';
// Error Handling Utilities
export {
  analyzeErrorRecoverability,
  type CLIError,
  convertFileError,
  convertPipelineError,
  convertProviderError,
  convertValidationError,
  ERROR_TEMPLATES,
  type ErrorContext,
  type ErrorSeverity,
  EXIT_CODES,
  formatErrorForDisplay,
  generateRecoverySuggestions,
  handleCLIError,
} from './error-handler.js';
// File Processing Utilities
export {
  calculateFileProcessingStats,
  type FileProcessorOptions,
  type FileProcessorResult,
  type FileValidationResult,
  formatFileProcessingError,
  processInputFiles,
  validateInputFile,
} from './file-processor.js';
// Progress Reporting Utilities
export {
  createDefaultProgressSteps,
  type ExecutionMetrics,
  formatElapsedTime,
  formatTokenUsage,
  ProgressReporter,
  type ProgressState,
  type ProgressStep,
  reportDryRunSummary,
  reportExecutionMetrics,
} from './progress-reporter.js';

// Workflow Orchestration Utilities
export {
  createWorkflowContext,
  executeRunWorkflow,
  validateWorkflowPrerequisites,
  type WorkflowContext,
  type WorkflowExecutionResult,
  WorkflowOrchestrator,
  type WorkflowStepResult,
} from './workflow-orchestrator.js';

/**
 * Utility function to create a complete CLI utilities context
 *
 * Convenience function that initializes all necessary utilities for a command
 * including progress reporting, error handling, and workflow orchestration.
 *
 * @param options - Command options
 * @returns Initialized utilities context
 */
export function createCLIUtilitiesContext(_options: {
  readonly verbose?: boolean;
  readonly dryRun?: boolean;
}) {
  // Implementation will coordinate all utility modules
  throw new Error(
    'Not implemented: createCLIUtilitiesContext will be implemented during refactoring'
  );
}
