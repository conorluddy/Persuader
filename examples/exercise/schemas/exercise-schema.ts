import { z } from 'zod';

/**
 * Zod schema for validating exercise relationship responses
 * Captures 4 types of relationships between strength training exercises
 */
export const ExerciseRelationshipSchema = z.object({
  exercise: z.string().describe('Starting exercise name'),
  similarMuscles: z
    .array(z.string())
    .describe('Exercises targeting the same muscle groups'),
  variationOf: z
    .array(z.string())
    .describe('Variations of the same movement pattern'),
  progressionFrom: z
    .array(z.string())
    .describe('Harder progressions from this exercise'),
  substitutableFor: z
    .array(z.string())
    .describe('Exercises that can replace this one in a workout'),
});

/**
 * TypeScript type for exercise relationships
 */
export type ExerciseRelationships = z.infer<typeof ExerciseRelationshipSchema>;
