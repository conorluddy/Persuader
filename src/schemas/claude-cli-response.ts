/**
 * Claude CLI Response Schema
 *
 * Zod schema for parsing the structured JSON response from Claude CLI
 * when using --output-format json
 */

import { z } from 'zod';

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
 * Success response structure
 */
export const ClaudeCLISuccessResponseSchema = z.object({
  type: z.literal('result'),
  subtype: z.literal('success'),
  is_error: z.literal(false),
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

/**
 * Error response structure
 */
export const ClaudeCLIErrorResponseSchema = z.object({
  type: z.literal('result'),
  subtype: z.enum(['error', 'failure']),
  is_error: z.literal(true),
  duration_ms: z.number().optional(),
  duration_api_ms: z.number().optional(),
  num_turns: z.number().optional(),
  result: z.string().optional(), // May be undefined for errors
  error: z.string().optional(), // Error message
  session_id: z.string().optional(),
  total_cost_usd: z.number().optional(),
  usage: ClaudeUsageSchema.optional(),
  permission_denials: z.array(PermissionDenialSchema).default([]),
  uuid: z.string().optional(),
});

/**
 * Complete Claude CLI JSON response structure (union of success and error)
 */
export const ClaudeCLIResponseSchema = z.discriminatedUnion('is_error', [
  ClaudeCLISuccessResponseSchema,
  ClaudeCLIErrorResponseSchema,
]);

export type ClaudeCLIResponse = z.infer<typeof ClaudeCLIResponseSchema>;
export type ClaudeUsage = z.infer<typeof ClaudeUsageSchema>;
export type PermissionDenial = z.infer<typeof PermissionDenialSchema>;

/**
 * Parse Claude CLI JSON response safely
 */
export function parseClaudeCLIResponse(jsonString: string): ClaudeCLIResponse {
  try {
    const parsed = JSON.parse(jsonString);
    const result = ClaudeCLIResponseSchema.safeParse(parsed);
    
    if (!result.success) {
      // Log the validation error details for debugging
      console.error('Claude CLI response validation failed:', {
        errors: result.error.issues,
        rawResponse: parsed,
      });
      
      // Throw a more descriptive error
      throw new Error(
        `Invalid Claude CLI response format: ${result.error.issues
          .map(issue => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ')}`
      );
    }
    
    return result.data;
  } catch (parseError) {
    if (parseError instanceof SyntaxError) {
      throw new Error(`Invalid JSON response from Claude CLI: ${parseError.message}`);
    }
    throw parseError;
  }
}

/**
 * Extract the actual content from Claude CLI response
 */
export function extractContentFromResponse(
  response: ClaudeCLIResponse
): string {
  if (response.is_error) {
    // For error responses, prefer the error field, fall back to result
    return response.error || response.result || 'Unknown error occurred';
  }
  
  // For success responses, result is guaranteed to exist
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
  // For error responses, usage might be undefined
  if (!response.usage) {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

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
