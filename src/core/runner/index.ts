/**
 * Runner Core Module - Main Pipeline API
 *
 * Maintains the primary public API for the Persuader pipeline while
 * delegating implementation to specialized component modules. This
 * preserves backward compatibility while enabling modular architecture.
 */

import { createClaudeCLIAdapter } from '../../adapters/claude-cli.js';
import { TOKEN_ESTIMATION_DIVISOR } from '../../shared/constants/index.js';
import type { Options, ProviderAdapter, Result } from '../../types/index.js';
import { orchestratePipeline } from './pipeline-orchestrator.js';
// Configuration validation functions are re-exported below
import { getExecutionStats } from './result-processor.js';

/**
 * Main orchestration function for the Persuader pipeline
 *
 * This function represents the core of the framework, handling the complete
 * flow from input processing to validated output generation with intelligent
 * retry mechanisms.
 *
 * @template T - The expected output type from Zod schema validation
 * @param options - Configuration for the pipeline run
 * @param provider - LLM provider adapter to use for generation (defaults to Claude CLI)
 * @returns Promise resolving to Result with validated data or error information
 */
export async function persuade<T>(
  options: Options<T>,
  provider: ProviderAdapter = createClaudeCLIAdapter()
): Promise<Result<T>> {
  return await orchestratePipeline(options, provider);
}

// Re-export validation and configuration functions directly
export {
  processRunnerConfiguration,
  validateAndNormalizeOptions,
  validateProviderAdapter,
  validateRunnerOptions,
} from './configuration-manager.js';

/**
 * Create a minimal mock provider for testing
 *
 * @param responses - Array of responses to return in sequence (defaults to valid JSON responses)
 * @param name - Provider name for identification
 * @returns Mock provider adapter
 */
export function createMockProvider(
  responses: string[] = [
    '{"message": "Hello from mock provider", "success": true, "timestamp": 1631234567890}',
    '{"result": "Mock response", "status": "completed", "confidence": 0.95}',
    '{"data": "Test data", "processed": true, "score": 8.5}',
  ],
  name: string = 'mock-provider'
): ProviderAdapter {
  let callCount = 0;

  return {
    name,
    supportsSession: false,

    async sendPrompt(_sessionId, prompt, _options) {
      const response = responses[callCount % responses.length];
      callCount++;

      if (!response) {
        throw new Error('No response available in mock provider');
      }

      return {
        content: response,
        tokenUsage: {
          inputTokens: prompt.length / TOKEN_ESTIMATION_DIVISOR, // Rough estimation
          outputTokens: response.length / TOKEN_ESTIMATION_DIVISOR,
          totalTokens:
            (prompt.length + response.length) / TOKEN_ESTIMATION_DIVISOR,
        },
      };
    },
  };
}

/**
 * Get runner execution statistics
 *
 * @param result - Result from persuade execution
 * @returns Execution statistics for monitoring and debugging
 */
export { getExecutionStats };

// Re-export configuration types for external use
export type {
  ConfigurationValidation,
  NormalizedOptions,
  ProcessedConfiguration,
} from './configuration-manager.js';
export type {
  ErrorClassification,
  RecoveryStrategy,
} from './error-recovery.js';
export {
  analyzeErrorRecovery,
  classifyError,
  logErrorRecoveryAnalysis,
} from './error-recovery.js';
export type { ExecutionResult } from './execution-engine.js';

// Re-export utility functions that may be useful externally
export { formatResultMetadata } from './result-processor.js';
export type { SessionCoordinationResult } from './session-coordinator.js';
export { logSessionInfo, validateSessionState } from './session-coordinator.js';
