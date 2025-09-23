/**
 * Core Module - Persuader Pipeline API
 *
 * Main entry point for the Persuader core functionality, providing
 * a clean separation between high-level APIs and implementation details.
 *
 * @module core
 */

import { buildPrompt } from './prompt.js';
import { retryWithFeedback } from './retry.js';
// Internal imports for module health checking
import { persuade, preload } from './runner/index.js';
import { validateJson } from './validation/index.js';

// Core pipeline types
export type {
  ExecutionMetadata,
  InitSessionOptions,
  InitSessionResult,
  Options,
  PreloadOptions,
  PreloadResult,
  Result,
} from '../types/pipeline.js';
// Prompt building utilities
export {
  buildPrompt,
  type PromptBuildOptions,
  type PromptParts,
} from './prompt.js';
// Retry utilities - high-level API only
export {
  type RetryResult,
  type RetryWithFeedbackOptions,
  retryWithFeedback,
} from './retry.js';
// High-level pipeline API - Main entry point
// Configuration and validation utilities (high-level)
// Execution statistics and monitoring
// Testing utilities
export {
  type ConfigurationValidation,
  createMockProvider,
  formatResultMetadata,
  getExecutionStats,
  getSessionMetrics,
  initSession,
  persuade,
  preload,
  validateRunnerOptions,
} from './runner/index.js';
// Validation utilities - high-level API only
export {
  formatValidationErrorFeedback,
  type ValidationResult,
  validateJson,
} from './validation/index.js';

/**
 * Core module version and metadata
 */
export const CORE_MODULE_VERSION = '1.0.0';
export const CORE_MODULE_NAME = 'persuader-core';

/**
 * Check if the core module is properly initialized
 *
 * @returns True if all core dependencies are available
 */
export function isCoreModuleReady(): boolean {
  try {
    // Basic smoke test - ensure main functions are available
    return (
      typeof persuade === 'function' &&
      typeof preload === 'function' &&
      typeof validateJson === 'function' &&
      typeof buildPrompt === 'function' &&
      typeof retryWithFeedback === 'function'
    );
  } catch {
    return false;
  }
}
