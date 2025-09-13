/**
 * Fitness Program Analysis Schema
 *
 * Demonstrates how the Persuader lens feature enables different fitness professionals
 * to analyze the same multi-day workout program from their specialized perspectives.
 */

import { z } from 'zod/v4';

export const WorkoutProgramAnalysisSchema = z
  .object({
    overall_rating: z
      .enum(['excellent', 'very_good', 'good', 'fair', 'poor'])
      .describe(
        'Overall program quality. Must be exactly one of: "excellent", "very_good", "good", "fair", "poor"'
      ),

    effectiveness_score: z
      .number()
      .min(1)
      .max(10)
      .int()
      .describe(
        'Program effectiveness rating. Must be an integer from 1 to 10 (1=very poor, 10=excellent)'
      ),

    program_strengths: z
      .array(z.string().min(10).max(200))
      .min(3)
      .max(5)
      .describe(
        'Array of exactly 3 to 5 program strengths. Each string must be 10-200 characters describing a specific strength'
      ),

    critical_weaknesses: z
      .array(z.string().min(10).max(200))
      .min(2)
      .max(4)
      .describe(
        'Array of exactly 2 to 4 critical weaknesses. Each string must be 10-200 characters describing a major flaw or gap'
      ),

    specific_recommendations: z
      .array(z.string().min(15).max(300))
      .min(3)
      .max(5)
      .describe(
        'Array of exactly 3 to 5 actionable recommendations. Each string must be 15-300 characters with specific, implementable advice'
      ),

    injury_risk_assessment: z
      .enum(['very_low', 'low', 'moderate', 'high', 'very_high'])
      .describe(
        'Injury risk level. Must be exactly one of: "very_low", "low", "moderate", "high", "very_high"'
      ),

    target_population: z
      .array(z.string().min(5).max(100))
      .min(2)
      .max(4)
      .describe(
        'Array of exactly 2 to 4 target populations. Each string must be 5-100 characters describing who should use this program'
      ),

    expected_outcomes: z
      .array(z.string().min(10).max(200))
      .min(3)
      .max(5)
      .describe(
        'Array of exactly 3 to 5 expected outcomes. Each string must be 10-200 characters describing realistic results'
      ),

    modification_priorities: z
      .array(
        z.object({
          issue: z
            .string()
            .min(10)
            .max(150)
            .describe(
              'Specific issue description. Must be 10-150 characters identifying the problem'
            ),
          solution: z
            .string()
            .min(15)
            .max(250)
            .describe(
              'Detailed solution description. Must be 15-250 characters explaining how to fix the issue'
            ),
          importance: z
            .enum(['critical', 'high', 'moderate', 'low'])
            .describe(
              'Priority level. Must be exactly one of: "critical", "high", "moderate", "low"'
            ),
        })
      )
      .min(2)
      .max(4)
      .describe(
        'Array of exactly 2 to 4 modification priorities. Each object must have issue, solution, and importance fields with exact constraints'
      ),
  })
  .describe(
    'Complete fitness program analysis. All fields are required and must meet exact constraints specified in each field description.'
  );

export type WorkoutProgramAnalysis = z.infer<
  typeof WorkoutProgramAnalysisSchema
>;
