import { z } from 'zod/v4';

/**
 * Optimized schemas for workout generation
 * Simplified and focused for better LLM performance
 */

// Stage 1: Basic profile (simplified)
export const SimpleProfileSchema = z.object({
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  goals: z.array(z.string()).max(2).describe('Top 2 goals'),
  daysPerWeek: z.number().min(2).max(6),
  minutesPerSession: z.number().min(20).max(90),
});

// Stage 2a: Just exercise names (simplified)
export const ExerciseNamesSchema = z.object({
  primary: z.array(z.string()).length(3).describe('3 main compound exercises'),
  accessory: z.array(z.string()).length(3).describe('3 supporting exercises'),
});

// Stage 2b: Exercise details (separate call)
export const ExerciseDetailsSchema = z.object({
  name: z.string(),
  sets: z.string().describe('e.g., "3-4"'),
  reps: z.string().describe('e.g., "8-12"'),
  rest: z.string().describe('e.g., "60-90 seconds"'),
});

// Stage 3a: Weekly split (simplified)
export const WeeklySplitSchema = z.object({
  split: z.enum(['upper-lower', 'push-pull-legs', 'full-body', 'body-part']),
  schedule: z.array(
    z.object({
      day: z.number().min(1).max(7),
      focus: z.string().describe('e.g., "Upper Body" or "Rest"'),
    })
  ),
});

// Stage 3b: Training principles (parallel)
export const TrainingPrinciplesSchema = z.object({
  intensity: z.string().describe('General intensity approach'),
  progression: z.string().describe('How to progress over time'),
  deload: z.string().describe('When to reduce intensity'),
});

// Stage 4: Simple progression (4 weeks)
export const SimpleProgressionSchema = z.object({
  week1: z.string().describe('Week 1 focus and adjustments'),
  week2: z.string().describe('Week 2 focus and adjustments'),
  week3: z.string().describe('Week 3 focus and adjustments'),
  week4: z.string().describe('Week 4 focus and adjustments'),
});

// Stage 5: Recovery basics
export const SimpleRecoverySchema = z.object({
  restDays: z.array(z.string()).max(3).describe('3 rest day activities'),
  sleep: z.string().describe('Sleep recommendation'),
  nutrition: z.string().describe('Basic nutrition tip'),
});

// Final combined program (assembled from parts)
export const OptimizedProgramSchema = z.object({
  profile: SimpleProfileSchema,
  exercises: z.object({
    names: ExerciseNamesSchema,
    details: z.array(ExerciseDetailsSchema).optional(),
  }),
  structure: z.object({
    split: WeeklySplitSchema,
    principles: TrainingPrinciplesSchema,
  }),
  progression: SimpleProgressionSchema,
  recovery: SimpleRecoverySchema,
  metadata: z.object({
    generatedAt: z.string(),
    version: z.string(),
  }),
});
