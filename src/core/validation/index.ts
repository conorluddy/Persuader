/**
 * Validation Module Exports
 *
 * Re-exports all validation utilities for clean, organized access.
 * Follows the progressive disclosure principle by providing a single
 * entry point for all validation-related functionality.
 */

// Error factory functions and type guards
export {
  createValidationError,
  generateSchemaDescription,
  hasOptions,
  hasValidation,
  isTooBigIssue,
  isTooSmallIssue,
} from './error-factory.js';
// Feedback formatting utilities
export {
  formatFieldCorrections,
  formatGenericErrorFeedback,
  formatJsonParseErrorFeedback,
  formatSchemaValidationErrorFeedback,
  formatSuggestionsList,
  formatValidationErrorFeedback,
  formatValidationIssues,
  generateAttemptSpecificInstructions,
  generateFinalAttemptWarning,
  generateUrgencyPrefix,
} from './feedback-formatter.js';
// Field analysis utilities
export { extractFieldErrors } from './field-analyzer.js';
// Core validation functions and types
export {
  parseJsonWithEnhancedErrors,
  type ValidationResult,
  validateJson,
  validateParsedJson,
} from './json-parser.js';
// Suggestion generation utilities
export {
  createStructuredSuggestions,
  type FieldCorrection,
  generateFieldCorrections,
  generateValidationSuggestions,
  type ValidationSuggestion,
} from './suggestion-generator.js';
