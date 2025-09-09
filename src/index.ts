/**
 * Persuader - The Type-Safe LLM Framework
 *
 * Session-based LLM orchestration with validation-driven retry loops.
 * Messy AI responses go in, clean validated data comes out.
 */

import { z } from 'zod';

// Export adapters
export * from './adapters/claude-cli.js';
// Export constants
export * from './constants.js';
export * from './core/prompt.js';
// Export retry functionality with explicit naming to avoid conflicts
export {
  formatRetryError,
  getRetryStats,
  retryOperation,
  retryWithFeedback,
} from './core/retry.js';
// Export core modules
export * from './core/runner.js';
export * from './core/validation.js';
// Export schemas
export * from './schemas/claude-cli-response.js';
// Export session management - explicit exports to avoid conflicts
export {
  createProviderSessionManager,
  createSessionManager,
  defaultSessionManager,
  ProviderSessionManager,
  SessionManager,
  SessionUtils,
} from './session/index.js';

// Export all comprehensive types
export * from './types/index.js';

// Export logging utilities
export * from './utils/logger.js';

// Export schema analysis utilities
export * from './utils/schema-analyzer.js';

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
