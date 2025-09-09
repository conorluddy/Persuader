import { z } from 'zod';

/**
 * Zod schema for validating pose transition responses from the LLM
 * Ensures the response contains a 'from' pose and array of 'to' poses
 */
export const TransitionSchema = z.object({
  from: z.string().describe('Starting pose name'),
  to: z
    .array(z.string())
    .describe('Array of pose names that can be transitioned to'),
});

/**
 * TypeScript type inferred from the TransitionSchema
 * Represents a yoga pose transition with source and target poses
 */
export type PoseTransition = z.infer<typeof TransitionSchema>;
