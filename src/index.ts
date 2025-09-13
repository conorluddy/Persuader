/**
 * Persuader - The Type-Safe LLM Framework
 *
 * Session-based LLM orchestration with validation-driven retry loops.
 * Messy AI responses go in, clean validated data comes out.
 */

import { z } from 'zod/v4';

// Provider adapters
export {
  type ClaudeCLIAdapterConfig,
  createClaudeCLIAdapter,
  createOpenAIAdapter,
  createProviderAdapter,
  getAvailableProviders,
  isProviderTypeSupported,
  type OpenAIAdapterConfig,
  type ProviderAdapter,
  type ProviderResponse,
  type ProviderType,
} from './adapters/index.js';
// Constants and shared values
export * from './constants.js';
// Core pipeline API - Main entry point
export {
  buildPrompt,
  createMockProvider,
  type ExecutionMetadata,
  formatResultMetadata,
  getExecutionStats,
  isCoreModuleReady,
  type Options,
  type PromptBuildOptions,
  type PromptParts,
  persuade,
  type Result,
  type RetryResult,
  type RetryWithFeedbackOptions,
  retryWithFeedback,
  type ValidationResult,
  validateJson,
} from './core/index.js';
// Schemas for validation
export * from './schemas/claude-cli-response.js';
// Session management
export {
  createProviderSessionManager,
  createSessionManager,
  defaultSessionManager,
  ProviderSessionManager,
  SessionManager,
  SessionUtils,
} from './session/index.js';
// Essential types (focused on public API)
export type {
  ProviderError as CoreProviderError,
  ProviderPromptOptions,
  SessionConfig,
  ValidationError,
} from './types/index.js';
// Utilities (selective exports)
export {
  debug,
  error,
  extractSchemaInfo,
  getSchemaDescription,
  info,
  type LogContext,
  type SchemaInfo,
  warn,
} from './utils/index.js';

// Legacy types for backward compatibility
export interface PersuaderConfig {
  readonly maxRetries?: number;
  readonly timeout?: number;
  readonly debug?: boolean;
}

export const PersuaderConfigSchema = z.object({
  maxRetries: z.number().min(1).max(10).default(3),
  timeout: z.number().min(1000).max(60000).default(10000),
  debug: z.boolean().default(false),
});

// Core Persuader class
export class Persuader {
  private readonly config: PersuaderConfig;

  constructor(config: Partial<PersuaderConfig> = {}) {
    this.config = PersuaderConfigSchema.parse(config);
  }

  /**
   * Create a new Persuader instance with validated configuration
   */
  static create(config: Partial<PersuaderConfig> = {}): Persuader {
    return new Persuader(config);
  }

  /**
   * Get the current configuration
   */
  getConfig(): PersuaderConfig {
    return { ...this.config };
  }

  /**
   * Process input through the LLM with validation
   */
  async process<T>(
    input: unknown,
    schema: z.ZodSchema<T>,
    processor: (input: unknown) => Promise<unknown>
  ): Promise<T> {
    let attempts = 0;
    const maxRetries = this.config.maxRetries || 3;

    while (attempts < maxRetries) {
      try {
        const result = await processor(input);
        return schema.parse(result);
      } catch (error) {
        attempts++;
        if (attempts >= maxRetries) {
          throw new Error(
            `Failed to process after ${maxRetries} attempts: ${error}`
          );
        }
        if (this.config.debug) {
          console.warn(`Attempt ${attempts} failed, retrying...`, error);
        }
      }
    }

    throw new Error('Max retries exceeded');
  }
}

// Default export
export default Persuader;
