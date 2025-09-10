/**
 * Validation Utilities
 *
 * Utilities for validating LLM outputs against Zod schemas and providing
 * actionable error feedback for retries.
 *
 * This module has been refactored into smaller, focused modules for better
 * maintainability and progressive disclosure. All functionality is preserved
 * through re-exports to maintain backward compatibility.
 */

// Re-export all validation functionality from the modular implementation
export * from './validation/index.js';

// Backward compatibility type aliases
export type { ValidationResult } from './validation/json-parser.js';
