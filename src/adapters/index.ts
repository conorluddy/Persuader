/**
 * Provider Adapters Module
 *
 * Centralized exports for all LLM provider adapters, providing a clean
 * boundary for provider integration and management.
 *
 * @module adapters
 */

import type { ProviderAdapter } from '../types/provider.js';
// Imports for internal use
import {
  type ClaudeCLIAdapterConfig,
  createClaudeCLIAdapter,
} from './claude-cli.js';

// Provider types and utilities
export type {
  ProviderAdapter,
  ProviderHealth,
  ProviderPromptOptions,
  ProviderResponse,
} from '../types/provider.js';
// Claude CLI Adapter - Primary adapter for Claude via CLI
export {
  type ClaudeCLIAdapterConfig,
  createClaudeCLIAdapter,
  isClaudeCLIAdapter,
} from './claude-cli.js';

/**
 * Available provider types for adapter creation
 */
export type ProviderType = 'claude-cli' | 'openai' | 'anthropic-sdk' | 'local';

/**
 * Factory function to create provider adapters by type
 *
 * Provides a unified interface for creating different provider types
 * with sensible defaults and validation.
 *
 * @param type - The provider type to create
 * @param options - Provider-specific options
 * @returns Configured provider adapter
 */
export function createProviderAdapter(
  type: ProviderType,
  options?: Record<string, unknown>
): ProviderAdapter {
  switch (type) {
    case 'claude-cli':
      return createClaudeCLIAdapter(options as ClaudeCLIAdapterConfig);

    case 'openai':
    case 'anthropic-sdk':
    case 'local':
      throw new Error(
        `Provider type '${type}' is not yet implemented. Currently supported: claude-cli`
      );

    default:
      throw new Error(
        `Unknown provider type: ${type}. Supported types: claude-cli`
      );
  }
}

/**
 * Get list of available provider types
 *
 * @returns Array of supported provider types
 */
export function getAvailableProviders(): ProviderType[] {
  return ['claude-cli'];
}

/**
 * Check if a provider type is supported
 *
 * @param type - Provider type to check
 * @returns True if provider type is supported
 */
export function isProviderTypeSupported(type: string): type is ProviderType {
  return getAvailableProviders().includes(type as ProviderType);
}
