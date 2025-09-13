/**
 * Simple Fitness Analysis Demo
 *
 * A simplified version to test the schema and lens functionality
 * with better error handling and debugging.
 */

import { promises as fs } from 'node:fs';
import type { z } from 'zod/v4';
import { persuade } from '../../src/index.js';
import { BASE_CONTEXT } from './prompts/base-context.js';
import { STRENGTH_COACH_LENS } from './prompts/strength-coach-lens.js';
import { WorkoutProgramAnalysisSchema } from './schemas/workout-analysis.js';

// Infer the TypeScript type from the Zod schema
type WorkoutAnalysis = z.infer<typeof WorkoutProgramAnalysisSchema>;

interface ProgramResult {
  program: Record<string, unknown>;
  analysis: WorkoutAnalysis;
  metadata: {
    completedAt: string;
    sessionId?: string;
  };
}

async function simpleDemo() {
  console.log('🏋️‍♂️ Session-Based Fitness Analysis Demo');
  console.log('==========================================');

  // Multiple workout programs for session-based analysis
  const programs = [
    {
      name: 'Basic 3-Day Split',
      data: {
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
      },
    },
    {
      name: 'Advanced PPL',
      data: {
        program_name: 'Push/Pull/Legs Advanced',
        description:
          'High-intensity push/pull/legs split for experienced lifters',
        duration_weeks: 8,
        frequency_per_week: 6,
        days: [
          {
            day: 'Monday - Push',
            exercises: [
              { exercise: 'Barbell Bench Press', sets: 4, reps: '6-8' },
              { exercise: 'Overhead Press', sets: 4, reps: '8-10' },
              { exercise: 'Dips', sets: 3, reps: '10-12' },
              { exercise: 'Close-Grip Bench Press', sets: 3, reps: '8-10' },
            ],
          },
        ],
      },
    },
    {
      name: 'Cardio Focus',
      data: {
        program_name: 'Cardio Endurance Program',
        description: 'Cardio-focused program with minimal strength training',
        duration_weeks: 4,
        frequency_per_week: 5,
        days: [
          {
            day: 'Monday',
            exercises: [
              { exercise: 'Running', sets: 1, reps: '30 minutes' },
              { exercise: 'Burpees', sets: 3, reps: '10' },
              { exercise: 'Mountain Climbers', sets: 3, reps: '20' },
            ],
          },
        ],
      },
    },
  ];

  const sessionContext = `${BASE_CONTEXT}

IMPORTANT RESPONSE FORMAT:
You are analyzing workout programs from a strength coach perspective. For each program, return a JSON object with these exact fields and data types:

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
}

Maintain consistency in your evaluation approach across all programs.`;

  console.log(
    `\n📋 Analyzing ${programs.length} programs with session reuse...\n`
  );

  let sessionId: string | undefined;
  const results: ProgramResult[] = [];

  try {
    // Create output directory if it doesn't exist
    await fs.mkdir('./output', { recursive: true });

    for (const [index, program] of programs.entries()) {
      console.log(`🏋️‍♂️ Program ${index + 1}/3: ${program.name}`);

      const result = await persuade({
        schema: WorkoutProgramAnalysisSchema,
        input: JSON.stringify(program.data, null, 2),
        context: sessionId
          ? `Analyze this workout program: ${program.name}` // Shorter context for session reuse
          : sessionContext, // Full context for first call
        lens: STRENGTH_COACH_LENS,
        sessionId, // Reuse session if we have one
        retries: 3,
      });

      if (result.ok) {
        console.log('✅ Analysis successful!');
        console.log(
          `📊 Rating: ${result.value.overall_rating}, Score: ${result.value.effectiveness_score}/10`
        );

        // Capture session for reuse
        if (result.sessionId && !sessionId) {
          sessionId = result.sessionId;
          console.log(
            `🔗 Session established: ${sessionId.substring(0, 8)}...`
          );
        } else if (result.sessionId && sessionId) {
          console.log(
            `🔗 Session reused: ${result.sessionId.substring(0, 8)}...`
          );
        }

        // Store result
        results.push({
          program: program.data,
          analysis: result.value,
          metadata: {
            completedAt: new Date().toISOString(),
            executionTimeMs: result.metadata.executionTimeMs,
            attempts: result.attempts,
            model: result.metadata.model,
            perspective: 'Strength Coach',
            sessionId: result.sessionId,
          },
        });

        // Save individual result
        const outputFile = `./output/session-demo-${program.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
        await fs.writeFile(
          outputFile,
          JSON.stringify(results[results.length - 1], null, 2)
        );
        console.log(`💾 Saved: ${outputFile}`);
      } else {
        console.error(
          `❌ Analysis failed for ${program.name}:`,
          result.error.message
        );
        if (result.error.type === 'validation') {
          console.error('🔍 Validation issues:', result.error.issues);
        }
      }

      console.log(); // Add spacing
    }

    // Save combined results
    const combinedOutputFile = './output/session-demo-combined.json';
    await fs.writeFile(
      combinedOutputFile,
      JSON.stringify(
        {
          summary: {
            totalPrograms: programs.length,
            successfulAnalyses: results.length,
            sessionId: sessionId,
            completedAt: new Date().toISOString(),
          },
          results,
        },
        null,
        2
      )
    );

    console.log(`\n🎉 Session-based analysis complete!`);
    console.log(
      `📊 Successfully analyzed ${results.length}/${programs.length} programs`
    );
    console.log(
      `🔗 Session calls: ${results.length} (1 creation + ${results.length - 1} reuses)`
    );
    console.log(`💾 Combined results: ${combinedOutputFile}`);
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleDemo().catch(console.error);
}
