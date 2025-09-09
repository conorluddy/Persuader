/**
 * Single Lens Analysis Example
 *
 * Demonstrates how to analyze a fitness program from a single professional perspective
 * using Persuader's lens feature for perspective-driven analysis.
 */

import { promises as fs, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { persuade } from '../../../src/index.js';
import { BASE_CONTEXT } from '../prompts/base-context.js';
import { PHYSICAL_THERAPIST_LENS } from '../prompts/physical-therapist-lens.js';
import { STRENGTH_COACH_LENS } from '../prompts/strength-coach-lens.js';
import { WorkoutProgramAnalysisSchema } from '../schemas/workout-analysis.js';

async function analyzeProgramWithLens(
  programPath: string,
  lensName: string,
  lensPrompt: string,
  saveToFile: boolean = true
) {
  // Load the workout program data
  const programData = JSON.parse(
    readFileSync(join(process.cwd(), programPath), 'utf-8')
  );

  console.log(
    `\n🔍 Analyzing "${programData.program_name}" from ${lensName} perspective...\n`
  );

  try {
    const result = await persuade({
      schema: WorkoutProgramAnalysisSchema,
      input: JSON.stringify(programData, null, 2),
      context: BASE_CONTEXT,
      lens: lensPrompt,
      retries: 3,
    });

    if (result.ok) {
      const analysis = result.value;

      console.log(`📊 ${lensName} Analysis Results:`);
      console.log('═'.repeat(50));
      console.log(`Overall Rating: ${analysis.overall_rating.toUpperCase()}`);
      console.log(`Effectiveness Score: ${analysis.effectiveness_score}/10`);
      console.log(
        `Injury Risk: ${analysis.injury_risk_assessment.toUpperCase()}`
      );

      console.log('\n💪 Program Strengths:');
      analysis.program_strengths.forEach((strength, i) => {
        console.log(`  ${i + 1}. ${strength}`);
      });

      console.log('\n⚠️  Critical Weaknesses:');
      analysis.critical_weaknesses.forEach((weakness, i) => {
        console.log(`  ${i + 1}. ${weakness}`);
      });

      console.log('\n🎯 Target Population:');
      analysis.target_population.forEach((population, i) => {
        console.log(`  ${i + 1}. ${population}`);
      });

      console.log('\n📈 Expected Outcomes:');
      analysis.expected_outcomes.forEach((outcome, i) => {
        console.log(`  ${i + 1}. ${outcome}`);
      });

      console.log('\n🔧 Top Modification Priorities:');
      analysis.modification_priorities.forEach((mod, i) => {
        console.log(
          `  ${i + 1}. [${mod.importance.toUpperCase()}] ${mod.issue}`
        );
      });

      console.log('\n💡 Specific Recommendations:');
      analysis.specific_recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });

      // Save results to file if requested
      if (saveToFile) {
        // Create output directory if it doesn't exist
        await fs.mkdir('output', { recursive: true });

        const safeFileName = lensName.toLowerCase().replace(/\s+/g, '-');
        const programName = programData.program_name
          .toLowerCase()
          .replace(/\s+/g, '-');
        const outputFile = `output/${programName}-${safeFileName}-analysis.json`;

        await fs.writeFile(
          outputFile,
          JSON.stringify(
            {
              program: programData,
              analysis: analysis,
              metadata: {
                completedAt: new Date().toISOString(),
                executionTimeMs: result.metadata.executionTimeMs,
                attempts: result.attempts,
                model: result.metadata.model,
                perspective: lensName,
                provider: result.metadata.provider,
              },
            },
            null,
            2
          )
        );

        console.log(`\n💾 Results saved to: ${outputFile}`);
      }

      console.log(
        `\n⏱️  Analysis completed in ${result.metadata.executionTimeMs}ms`
      );
      console.log(`🤖 Provider: ${result.metadata.provider}`);

      return analysis;
    } else {
      console.error('❌ Analysis failed:', result.error.message);
      return null;
    }
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return null;
  }
}

// Example usage - analyze beginner program from different perspectives
async function main() {
  console.log('🏋️‍♂️ Fitness Program Analysis Demo');
  console.log('=====================================');

  const programPath = 'examples/fitness-analysis/data/beginner-3day-split.json';

  // Analyze from Strength Coach perspective
  await analyzeProgramWithLens(
    programPath,
    'Strength Coach',
    STRENGTH_COACH_LENS
  );

  // Add separator
  console.log(`\n${'='.repeat(80)}\n`);

  // Analyze from Physical Therapist perspective
  await analyzeProgramWithLens(
    programPath,
    'Physical Therapist',
    PHYSICAL_THERAPIST_LENS
  );
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
