/**
 * Provider Adapters Module
 *
 * Centralized exports for all LLM provider adapters, providing a clean
 * boundary for provider integration and management.
 *
 * @module adapters
 */

import type { ProviderAdapter } from '../types/provider.js';
import {
  type AnthropicSDKAdapterConfig,
  createAnthropicSDKAdapter,
} from './anthropic-sdk.js';
// Imports for internal use
import {
  type ClaudeCLIAdapterConfig,
  createClaudeCLIAdapter,
} from './claude-cli.js';
import { createGeminiAdapter, type GeminiAdapterConfig } from './gemini.js';
import { createOllamaAdapter, type OllamaAdapterConfig } from './ollama.js';
import { createOpenAIAdapter, type OpenAIAdapterConfig } from './openai.js';
import {
  createVercelAISDKAdapter,
  type VercelAISDKAdapterConfig,
} from './vercel-ai-sdk.js';

// Provider types and utilities
export type {
  ProviderAdapter,
  ProviderHealth,
  ProviderPromptOptions,
  ProviderResponse,
} from '../types/provider.js';
// Anthropic SDK Adapter - Provider adapter for Anthropic API via official SDK
export {
  type AnthropicSDKAdapterConfig,
  createAnthropicSDKAdapter,
  isAnthropicSDKAdapter,
} from './anthropic-sdk.js';
// Claude CLI Adapter - Primary adapter for Claude via CLI
export {
  type ClaudeCLIAdapterConfig,
  createClaudeCLIAdapter,
  isClaudeCLIAdapter,
} from './claude-cli.js';
// Gemini Adapter - Provider adapter for Google Gemini API
export {
  createGeminiAdapter,
  type GeminiAdapterConfig,
  isGeminiAdapter,
} from './gemini.js';
// Ollama Adapter - Provider adapter for local Ollama instances
export {
  createOllamaAdapter,
  isOllamaAdapter,
  type OllamaAdapterConfig,
} from './ollama.js';
// OpenAI Adapter - Provider adapter for OpenAI API via AI SDK
export {
  createOpenAIAdapter,
  isOpenAIAdapter,
  type OpenAIAdapterConfig,
} from './openai.js';
// Vercel AI SDK Adapter - Provider adapter for multiple LLM providers via Vercel AI SDK
export {
  createVercelAISDKAdapter,
  isVercelAISDKAdapter,
  type VercelAISDKAdapterConfig,
} from './vercel-ai-sdk.js';

/**
 * Available provider types for adapter creation
 */
export type ProviderType =
  | 'claude-cli'
  | 'openai'
  | 'ollama'
  | 'gemini'
  | 'anthropic-sdk'
  | 'vercel-ai-sdk';

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
      return createOpenAIAdapter(options as OpenAIAdapterConfig);

    case 'ollama':
      return createOllamaAdapter(options as OllamaAdapterConfig);

    case 'gemini':
      return createGeminiAdapter(options as GeminiAdapterConfig);

    case 'anthropic-sdk':
      return createAnthropicSDKAdapter(options as AnthropicSDKAdapterConfig);

    case 'vercel-ai-sdk':
      return createVercelAISDKAdapter(
        options as unknown as VercelAISDKAdapterConfig
      );

    default:
      throw new Error(
        `Unknown provider type: ${type}. Supported types: ${getAvailableProviders().join(', ')}`
      );
  }
}

/**
 * Get list of available provider types
 *
 * @returns Array of supported provider types
 */
export function getAvailableProviders(): ProviderType[] {
  return [
    'claude-cli',
    'openai',
    'ollama',
    'gemini',
    'anthropic-sdk',
    'vercel-ai-sdk',
  ];
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
