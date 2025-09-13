/**
 * Prompt Building Utilities
 *
 * Utilities for constructing prompts from schemas and inputs for LLM processing.
 * This module handles the conversion of Zod schemas to prompt instructions and
 * includes automatic example generation to improve LLM output reliability.
 */

import type { z } from 'zod';
import { generateExampleFromSchema } from '../utils/example-generator.js';
import { debug } from '../utils/logger.js';

/**
 * Structured prompt parts for LLM processing
 */
export interface PromptParts {
  /** System prompt with instructions and schema definition */
  readonly systemPrompt: string;

  /** User prompt with input data and task description */
  readonly userPrompt: string;

  /** Example outputs for few-shot learning */
  readonly examples?: readonly string[];

  /** Error context from previous validation failures */
  readonly errorContext?: string;

  /** Additional context or instructions */
  readonly additionalContext: string | undefined;
}

/**
 * Options for building prompts
 */
export interface PromptBuildOptions {
  /** Zod schema to convert to prompt instructions */
  readonly schema: z.ZodSchema<unknown>;

  /** Input data to be processed */
  readonly input: unknown;

  /** Global context to maintain across session */
  readonly context?: string;

  /** Lens/perspective to apply to processing */
  readonly lens?: string;

  /** Additional examples to include */
  readonly examples?: readonly string[];

  /** Current attempt number for progressive prompting */
  readonly attemptNumber?: number;

  /** Concrete example of valid output (user-provided or auto-generated) */
  readonly exampleOutput?: unknown;
}

/**
 * Build structured prompt parts from schema and input
 *
 * @param options - Prompt building configuration
 * @returns Structured prompt parts ready for LLM processing
 */
export function buildPrompt(options: PromptBuildOptions): PromptParts {
  const {
    schema,
    input,
    context,
    lens,
    examples,
    attemptNumber = 1,
    exampleOutput,
  } = options;

  // Generate or use provided example output
  let concreteExample = exampleOutput;
  if (!concreteExample) {
    debug('No example output provided, generating from schema');
    try {
      concreteExample = generateExampleFromSchema(schema);
    } catch (error) {
      debug('Failed to generate example from schema', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Generate schema description from Zod schema
  const schemaDescription = generateSchemaDescription(schema);

  // Build system prompt with schema instructions and attempt-based urgency
  const systemPrompt = buildSystemPrompt(
    schemaDescription,
    context,
    lens,
    attemptNumber,
    concreteExample
  );

  // Build user prompt with input data
  const userPrompt = buildUserPrompt(input);

  // Generate concrete examples for the examples array
  const concreteExamples =
    examples ||
    (concreteExample
      ? [`EXAMPLE OUTPUT FORMAT:\n${JSON.stringify(concreteExample, null, 2)}`]
      : getDefaultExamples());

  return {
    systemPrompt,
    userPrompt,
    examples: concreteExamples,
    additionalContext: context ?? undefined,
  };
}

/**
 * Generate human-readable schema description from Zod schema
 *
 * @param schema - Zod schema to describe
 * @returns Human-readable schema description
 */
function generateSchemaDescription(schema: z.ZodSchema<unknown>): string {
  // This is a simplified implementation - in a full implementation,
  // this would recursively traverse the Zod schema to generate comprehensive descriptions
  try {
    // Try to get schema description if available
    const description = (schema as { description?: string }).description;
    if (description) {
      return description;
    }

    // Basic type detection
    const schemaName = schema.constructor.name;
    switch (schemaName) {
      case 'ZodObject':
        return generateObjectSchemaDescription(
          schema as z.ZodObject<Record<string, z.ZodTypeAny>>
        );
      case 'ZodArray':
        return 'An array of items';
      case 'ZodString':
        return 'A string value';
      case 'ZodNumber':
        return 'A numeric value';
      case 'ZodBoolean':
        return 'A boolean value (true/false)';
      default:
        return 'A valid JSON value matching the specified schema';
    }
  } catch {
    return 'A valid JSON value matching the specified schema';
  }
}

/**
 * Generate description for Zod object schemas
 */
function generateObjectSchemaDescription(
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>
): string {
  try {
    const shape = schema.shape;
    if (!shape || typeof shape !== 'object') {
      return 'A JSON object';
    }

    const fields = Object.keys(shape);
    if (fields.length === 0) {
      return 'An empty JSON object';
    }

    const fieldDescriptions = fields
      .slice(0, 5)
      .map(field => `"${field}"`)
      .join(', ');
    const remainingCount = Math.max(0, fields.length - 5);

    if (remainingCount > 0) {
      return `A JSON object with fields: ${fieldDescriptions} and ${remainingCount} more field${remainingCount > 1 ? 's' : ''}`;
    }

    return `A JSON object with fields: ${fieldDescriptions}`;
  } catch {
    return 'A JSON object';
  }
}

/**
 * Build system prompt with schema instructions
 */
function buildSystemPrompt(
  schemaDescription: string,
  context?: string,
  lens?: string,
  attemptNumber: number = 1,
  concreteExample?: unknown
): string {
  // Progressive instruction intensity based on attempt number
  const urgencyLevel =
    attemptNumber >= 3
      ? 'CRITICAL'
      : attemptNumber >= 2
        ? 'IMPORTANT'
        : 'STANDARD';
  const urgencyEmoji =
    attemptNumber >= 3 ? '🚨 ' : attemptNumber >= 2 ? '⚠️ ' : '';

  // More explicit JSON requirements for later attempts
  const jsonInstructions =
    attemptNumber >= 3
      ? `Your response must START with "{" and END with "}". No text before or after the JSON object.`
      : attemptNumber >= 2
        ? `Output MUST be valid JSON that parses correctly. No explanatory text, only the JSON response.`
        : `Output MUST be valid JSON that parses correctly`;

  const baseInstructions = `You are a precise data extraction and transformation assistant. Your task is to process input data and return a valid JSON response that exactly matches the specified schema.

${urgencyEmoji}${urgencyLevel} REQUIREMENTS:
1. ${jsonInstructions}
2. Output MUST conform exactly to the provided schema
3. All required fields MUST be present
4. Field types MUST match exactly (string, number, boolean, etc.)
5. ${attemptNumber >= 2 ? 'Do not include any explanatory text, only the JSON response' : 'Ensure proper JSON escaping for special characters'}
6. ${attemptNumber >= 3 ? 'This is your final attempt - follow the schema exactly' : 'Ensure proper JSON escaping for special characters'}

SCHEMA REQUIREMENTS:
${schemaDescription}`;

  const contextSection = context ? `\n\nCONTEXT:\n${context}` : '';

  const lensSection = lens
    ? `\n\nPERSPECTIVE:\nProcess the input from this perspective: ${lens}`
    : '';

  // Add concrete example to demonstrate exact output format
  const exampleSection = concreteExample
    ? `\n\nEXAMPLE OUTPUT FORMAT:\nHere is an example of the exact JSON format expected:\n${JSON.stringify(concreteExample, null, 2)}\n\nYour response must follow this exact structure and formatting.`
    : '';

  return baseInstructions + contextSection + lensSection + exampleSection;
}

/**
 * Build user prompt with input data
 */
function buildUserPrompt(input: unknown): string {
  const inputString =
    typeof input === 'string' ? input : JSON.stringify(input, null, 2);

  return `Process the following input and return a JSON response matching the schema requirements:

INPUT DATA:
${inputString}

Remember: Return only valid JSON that matches the schema. No explanatory text.`;
}

/**
 * Get default examples for common patterns
 */
function getDefaultExamples(): string[] {
  return [
    'Example: {"field": "value", "number": 42, "flag": true}',
    'Example: {"items": [{"name": "item1"}, {"name": "item2"}]}',
  ];
}

/**
 * Combine prompt parts into a single string for LLM processing
 *
 * @param parts - Structured prompt parts
 * @returns Combined prompt string
 */
export function combinePromptParts(parts: PromptParts): string {
  const sections: string[] = [parts.systemPrompt];

  if (parts.examples && parts.examples.length > 0) {
    sections.push(`\nEXAMPLES:\n${parts.examples.join('\n')}`);
  }

  if (parts.errorContext) {
    sections.push(`\nPREVIOUS VALIDATION ERRORS:\n${parts.errorContext}`);
  }

  sections.push(`\n${parts.userPrompt}`);

  return sections.join('\n');
}

/**
 * Augment existing prompt parts with error feedback
 *
 * @param parts - Original prompt parts
 * @param errorFeedback - Error feedback to include
 * @returns Augmented prompt parts
 */
export function augmentPromptWithErrors(
  parts: PromptParts,
  errorFeedback: string
): PromptParts {
  return {
    ...parts,
    errorContext: errorFeedback,
    userPrompt: `${parts.userPrompt}\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${errorFeedback}\n\nPlease correct these issues and provide valid JSON matching the schema.`,
  };
}
