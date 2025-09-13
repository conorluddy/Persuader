/**
 * Claude CLI Response Schema
 *
 * Zod schema for parsing the structured JSON response from Claude CLI
 * when using --output-format json
 */

import { z } from 'zod/v4';

/**
 * Usage metrics from Claude CLI response
 */
export const ClaudeUsageSchema = z.object({
  input_tokens: z.number().optional(),
  cache_creation_input_tokens: z.number().optional(),
  cache_read_input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  server_tool_use: z
    .object({
      web_search_requests: z.number().optional(),
    })
    .optional(),
  service_tier: z.string().optional(),
  cache_creation: z
    .object({
      ephemeral_1h_input_tokens: z.number().optional(),
      ephemeral_5m_input_tokens: z.number().optional(),
    })
    .optional(),
});

/**
 * Permission denial information
 */
export const PermissionDenialSchema = z.object({
  tool_name: z.string(),
  tool_use_id: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
});

/**
 * Complete Claude CLI JSON response structure
 */
export const ClaudeCLIResponseSchema = z.object({
  type: z.literal('result'),
  subtype: z.literal('success'),
  is_error: z.boolean(),
  duration_ms: z.number(),
  duration_api_ms: z.number(),
  num_turns: z.number(),
  result: z.string(), // The actual response content
  session_id: z.string(),
  total_cost_usd: z.number(),
  usage: ClaudeUsageSchema,
  permission_denials: z.array(PermissionDenialSchema).default([]),
  uuid: z.string(),
});

export type ClaudeCLIResponse = z.infer<typeof ClaudeCLIResponseSchema>;
export type ClaudeUsage = z.infer<typeof ClaudeUsageSchema>;
export type PermissionDenial = z.infer<typeof PermissionDenialSchema>;

/**
 * Parse Claude CLI JSON response safely
 */
export function parseClaudeCLIResponse(jsonString: string): ClaudeCLIResponse {
  const parsed = JSON.parse(jsonString);
  return ClaudeCLIResponseSchema.parse(parsed);
}

/**
 * Extract the actual content from Claude CLI response
 */
export function extractContentFromResponse(
  response: ClaudeCLIResponse
): string {
  return response.result;
}

/**
 * Get token usage from Claude CLI response
 */
export function getTokenUsage(response: ClaudeCLIResponse): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const usage = response.usage;
  const inputTokens =
    (usage.input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);
  const outputTokens = usage.output_tokens || 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
