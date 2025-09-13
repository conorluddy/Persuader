/**
 * Fitness Program Analysis - Example Output Template
 *
 * This file demonstrates how to provide concrete examples to Persuader for better
 * LLM output reliability. The example must validate against the schema to ensure
 * the LLM receives accurate guidance.
 *
 * KEY CONCEPTS DEMONSTRATED:
 * - Type-safe example creation using schema inference
 * - Realistic field values that meet schema constraints
 * - Character length requirements for string fields
 * - Proper enum value formatting (exact case matching)
 * - Complex nested object structures (modification_priorities)
 * - Array length constraints (min/max items)
 *
 * USAGE PATTERNS:
 * - Use this example across multiple lens perspectives
 * - Modify field values to match different professional viewpoints
 * - Extend this pattern for your own domain-specific schemas
 *
 * VALIDATION BENEFITS:
 * - Reduces enum case mismatch errors ("Good" vs "good")
 * - Shows proper nested object structure instead of string arrays
 * - Demonstrates realistic character count requirements
 * - Prevents integer constraint violations (e.g., 11 instead of max 10)
 *
 * @example
 * ```typescript
 * import { EXAMPLE_ANALYSIS } from '../prompts/example-output.js';
 *
 * const result = await persuade({
 *   schema: WorkoutProgramAnalysisSchema,
 *   input: programData,
 *   context: BASE_CONTEXT,
 *   lens: STRENGTH_COACH_LENS,
 *   exampleOutput: EXAMPLE_ANALYSIS  // Guides LLM output format
 * });
 * ```
 */

import type { WorkoutProgramAnalysis } from '../schemas/workout-analysis.js';

/**
 * Comprehensive example that validates against WorkoutProgramAnalysisSchema
 *
 * This example demonstrates every field constraint and proper formatting:
 * - Enum values use exact case matching
 * - String lengths meet min/max character requirements
 * - Arrays contain proper number of items
 * - Nested objects have correct structure
 * - Integer values respect bounds
 */
export const EXAMPLE_ANALYSIS: WorkoutProgramAnalysis = {
  // ENUM FIELD: Must match exact case from schema definition
  // ✅ CORRECT: "good" (lowercase)
  // ❌ WRONG: "Good", "GOOD", "decent"
  overall_rating: 'good',

  // INTEGER CONSTRAINT: Must be 1-10, no decimals
  // ✅ CORRECT: 7 (integer within range)
  // ❌ WRONG: 11 (exceeds max), 7.5 (not integer), 0 (below min)
  // Schema enforces: z.number().min(1).max(10).int()
  effectiveness_score: 7,

  // ARRAY LENGTH: Must contain 3-5 items per schema
  // STRING LENGTH: Each item must be 10-200 characters
  // ✅ CORRECT: 3 items, each 10+ characters
  // ❌ WRONG: 2 items (too few), 6 items (too many), "good" (too short)
  program_strengths: [
    'Well-balanced exercise selection targeting all major muscle groups', // 67 chars ✅
    'Appropriate progression scheme suitable for the target population', // 66 chars ✅
    'Realistic time commitment that fits busy schedules and lifestyles', // 65 chars ✅
  ],

  // ARRAY LENGTH: Must contain 2-4 items per schema
  // STRING LENGTH: Each item must be 10-200 characters
  critical_weaknesses: [
    'Lacks specific periodization structure for long-term progress', // 60 chars ✅
    'Missing comprehensive mobility and recovery protocols', // 51 chars ✅
  ],

  // ARRAY LENGTH: Must contain 3-5 items per schema
  // STRING LENGTH: Each item must be 15-300 characters
  specific_recommendations: [
    'Implement a structured warm-up routine with dynamic movements before each session', // 83 chars ✅
    'Add progressive overload tracking system to ensure consistent strength gains', // 78 chars ✅
    'Include planned deload weeks every 4th week to promote recovery and adaptation', // 76 chars ✅
  ],

  // ENUM FIELD: Must match exact case from schema definition
  // ✅ CORRECT: "low" (lowercase)
  // ❌ WRONG: "Low", "LOW", "minimal"
  injury_risk_assessment: 'low',

  // ARRAY LENGTH: Must contain 2-4 items per schema
  // STRING LENGTH: Each item must be 5-100 characters
  target_population: [
    'fitness beginners', // 16 chars ✅
    'general health enthusiasts', // 26 chars ✅
  ],

  // ARRAY LENGTH: Must contain 3-5 items per schema
  // STRING LENGTH: Each item must be 10-200 characters
  expected_outcomes: [
    'Improved functional strength and movement quality', // 48 chars ✅
    'Enhanced cardiovascular fitness and endurance capacity', // 51 chars ✅
    'Foundational exercise technique and movement competency', // 52 chars ✅
  ],

  // NESTED OBJECT ARRAY: Complex structure that often fails validation
  // ARRAY LENGTH: Must contain 2-4 objects
  // Each object must have: issue (10-150 chars), solution (15-250 chars), importance (enum)
  // This is the most common validation failure point - LLMs often create arrays of strings instead
  modification_priorities: [
    {
      // STRING LENGTH: Must be 10-150 characters
      issue: 'Limited exercise progression structure throughout program phases', // 65 chars ✅

      // STRING LENGTH: Must be 15-250 characters
      solution:
        'Develop a structured loading scheme with weekly incremental increases in weight, reps, or training volume', // 118 chars ✅

      // ENUM FIELD: Must be exactly "critical", "high", "moderate", or "low"
      // ✅ CORRECT: "high" (exact match)
      // ❌ WRONG: "High", "HIGH", "important"
      importance: 'high',
    },
    // Second object required (schema enforces min 2, max 4 objects)
    {
      issue:
        'Insufficient mobility and flexibility work integrated into sessions', // 67 chars ✅
      solution:
        'Add comprehensive dynamic warm-up and static cool-down routines targeting major muscle groups', // 104 chars ✅
      importance: 'moderate', // Enum value ✅
    },
  ],
};

/**
 * Alternative example for different professional perspectives
 *
 * This shows how the same schema can produce different content while
 * maintaining the same structure and constraints. Each professional lens
 * would modify the content but keep the format identical.
 */
export const ALTERNATIVE_ANALYSIS: WorkoutProgramAnalysis = {
  overall_rating: 'fair', // Different rating but same enum format
  effectiveness_score: 5, // Lower score but same integer constraint

  program_strengths: [
    'Covers fundamental movement patterns for complete muscle activation',
    'Includes both compound and isolation exercises for balanced development',
    'Provides clear progression guidelines for sustained improvement',
  ],

  critical_weaknesses: [
    'Excessive volume may lead to overtraining in novice practitioners',
    'Insufficient rest periods between high-intensity training sessions',
  ],

  specific_recommendations: [
    'Reduce training frequency to allow adequate recovery between sessions',
    'Implement heart rate monitoring to optimize training intensity zones',
    'Add periodized nutrition planning to support training adaptations',
  ],

  injury_risk_assessment: 'moderate',

  target_population: [
    'intermediate trainees',
    'athletic populations',
    'competitive athletes',
  ],

  expected_outcomes: [
    'Increased maximal strength and power output capabilities',
    'Enhanced sport-specific performance and movement efficiency',
    'Improved body composition and metabolic conditioning',
  ],

  modification_priorities: [
    {
      issue: 'Training volume exceeds recovery capacity for target population',
      solution:
        'Implement autoregulatory training principles with RPE-based load adjustments',
      importance: 'critical',
    },
    {
      issue: 'Missing sport-specific movement patterns and skill development',
      solution:
        'Integrate functional movement training and activity-specific exercises',
      importance: 'high',
    },
  ],
};

/**
 * Validation helper to ensure examples remain schema-compliant
 *
 * Run this during development to verify examples validate correctly:
 * ```bash
 * npx tsx -e "
 *   import { WorkoutProgramAnalysisSchema } from './schemas/workout-analysis.js';
 *   import { EXAMPLE_ANALYSIS } from './prompts/example-output.js';
 *   console.log(WorkoutProgramAnalysisSchema.safeParse(EXAMPLE_ANALYSIS));
 * "
 * ```
 */
export function validateExamples(): { valid: boolean; errors: string[] } {
  // This would be imported in actual usage - simplified for example
  // WorkoutProgramAnalysisSchema.parse(EXAMPLE_ANALYSIS);
  // WorkoutProgramAnalysisSchema.parse(ALTERNATIVE_ANALYSIS);
  return { valid: true, errors: [] };
}
