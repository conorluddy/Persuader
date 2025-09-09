/**
 * Simple Fitness Analysis Demo
 *
 * A simplified version to test the schema and lens functionality
 * with better error handling and debugging.
 */

import { promises as fs } from 'node:fs';
import { runPersuader } from '../../../src/index.js';
import { BASE_CONTEXT } from '../prompts/base-context.js';
import { STRENGTH_COACH_LENS } from '../prompts/strength-coach-lens.js';
import { WorkoutProgramAnalysisSchema } from '../schemas/workout-analysis.js';

async function simpleDemo() {
  console.log('🏋️‍♂️ Simple Fitness Analysis Demo');
  console.log('==================================');

  // Simple workout program for testing
  const simpleProgram = {
    program_name: 'Basic 3-Day Split',
    description: 'Simple full body workout for beginners',
    duration_weeks: 6,
    frequency_per_week: 3,
    days: [
      {
        day: 'Monday',
        exercises: [
          { exercise: 'Squats', sets: 3, reps: '8-12' },
          { exercise: 'Push-ups', sets: 3, reps: '5-10' },
          { exercise: 'Bent-over rows', sets: 3, reps: '8-12' },
        ],
      },
    ],
  };

  console.log('\n📋 Analyzing simple program...\n');

  try {
    const result = await runPersuader({
      schema: WorkoutProgramAnalysisSchema,
      input: JSON.stringify(simpleProgram, null, 2),
      context: `${BASE_CONTEXT}

IMPORTANT RESPONSE FORMAT:
Return a JSON object with these exact fields and data types:

{
  "overall_rating": "good",  // Must be: "excellent", "very_good", "good", "fair", or "poor"
  "effectiveness_score": 7,  // Integer from 1-10
  "program_strengths": ["Strength 1", "Strength 2", "Strength 3"],  // 3-5 strings
  "critical_weaknesses": ["Weakness 1", "Weakness 2"],  // 2-4 strings
  "specific_recommendations": ["Rec 1", "Rec 2", "Rec 3"],  // 3-5 strings
  "injury_risk_assessment": "low",  // Must be: "very_low", "low", "moderate", "high", or "very_high"
  "target_population": ["beginners", "general fitness"],  // 2-4 strings
  "expected_outcomes": ["Outcome 1", "Outcome 2", "Outcome 3"],  // 3-5 strings
  "modification_priorities": [
    {
      "issue": "Specific issue description",
      "solution": "Detailed solution description", 
      "importance": "high"  // Must be: "critical", "high", "moderate", or "low"
    }
  ]
}`,
      lens: STRENGTH_COACH_LENS,
      retries: 3,
    });

    if (result.ok) {
      console.log('✅ Analysis successful!');
      console.log('📊 Results:');
      console.log(JSON.stringify(result.value, null, 2));

      // Create output directory if it doesn't exist
      await fs.mkdir('output', { recursive: true });

      // Save results to file
      const outputFile = 'output/simple-demo-analysis.json';
      await fs.writeFile(
        outputFile,
        JSON.stringify(
          {
            program: simpleProgram,
            analysis: result.value,
            metadata: {
              completedAt: new Date().toISOString(),
              executionTimeMs: result.metadata.executionTimeMs,
              attempts: result.attempts,
              model: result.metadata.model,
              perspective: 'Strength Coach',
            },
          },
          null,
          2
        )
      );

      console.log(`\n💾 Results saved to: ${outputFile}`);
      console.log(`⏱️  Completed in ${result.metadata.executionTimeMs}ms`);
      console.log(`🤖 Used ${result.attempts} attempts`);
    } else {
      console.error('❌ Analysis failed:', result.error.message);
      if (result.error.type === 'validation') {
        console.error('🔍 Validation issues:', result.error.issues);
      }
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleDemo().catch(console.error);
}
