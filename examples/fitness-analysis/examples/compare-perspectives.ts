/**
 * Multi-Perspective Comparison Example
 *
 * Demonstrates how different professional lenses can analyze the same fitness program
 * and produce varying insights based on their specialized perspectives.
 */

import { promises as fs, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { persuade } from '../../../src/index.js';
import { BASE_CONTEXT } from '../prompts/base-context.js';
import { BODYBUILDER_LENS } from '../prompts/bodybuilder-lens.js';
import { ENDURANCE_COACH_LENS } from '../prompts/endurance-coach-lens.js';
import { PHYSICAL_THERAPIST_LENS } from '../prompts/physical-therapist-lens.js';
import { STRENGTH_COACH_LENS } from '../prompts/strength-coach-lens.js';
import {
  type WorkoutProgramAnalysis,
  WorkoutProgramAnalysisSchema,
} from '../schemas/workout-analysis.js';

interface ProfessionalLens {
  name: string;
  prompt: string;
  emoji: string;
}

const PROFESSIONAL_LENSES: ProfessionalLens[] = [
  { name: 'Strength Coach', prompt: STRENGTH_COACH_LENS, emoji: '💪' },
  { name: 'Endurance Coach', prompt: ENDURANCE_COACH_LENS, emoji: '🏃' },
  { name: 'Physical Therapist', prompt: PHYSICAL_THERAPIST_LENS, emoji: '🩺' },
  { name: 'Bodybuilder', prompt: BODYBUILDER_LENS, emoji: '🏆' },
];

async function compareAllPerspectives(
  programPath: string,
  saveToFile: boolean = true
) {
  // Load the workout program
  const programData = JSON.parse(
    readFileSync(join(process.cwd(), programPath), 'utf-8')
  );

  console.log(
    `\n🔍 Multi-Perspective Analysis of "${programData.program_name}"`
  );
  console.log('='.repeat(80));

  const analyses: Array<{
    perspective: string;
    analysis: WorkoutProgramAnalysis;
    emoji: string;
  }> = [];

  // Analyze from each professional perspective
  for (const lens of PROFESSIONAL_LENSES) {
    console.log(`\n${lens.emoji} Analyzing from ${lens.name} perspective...`);

    try {
      const result = await persuade({
        schema: WorkoutProgramAnalysisSchema,
        input: JSON.stringify(programData, null, 2),
        context: BASE_CONTEXT,
        lens: lens.prompt,
        retries: 3,
      });

      if (result.ok) {
        analyses.push({
          perspective: lens.name,
          analysis: result.value,
          emoji: lens.emoji,
        });
        console.log(
          `✅ ${lens.name} analysis completed (${result.metadata.executionTimeMs}ms)`
        );
      } else {
        console.log(`❌ ${lens.name} analysis failed: ${result.error.message}`);
      }
    } catch (error) {
      console.log(`💥 ${lens.name} analysis error:`, error);
    }
  }

  // Display comparative results
  console.log('\n📊 COMPARATIVE ANALYSIS RESULTS');
  console.log('='.repeat(80));

  // Overall ratings comparison
  console.log('\n🎯 Overall Ratings:');
  analyses.forEach(({ perspective, analysis, emoji }) => {
    console.log(
      `${emoji} ${perspective.padEnd(20)} ${analysis.overall_rating.padEnd(12)} (${analysis.effectiveness_score}/10)`
    );
  });

  // Injury risk comparison
  console.log('\n⚠️  Injury Risk Assessment:');
  analyses.forEach(({ perspective, analysis, emoji }) => {
    console.log(
      `${emoji} ${perspective.padEnd(20)} ${analysis.injury_risk_assessment.toUpperCase()}`
    );
  });

  // Top strengths from each perspective
  console.log('\n💪 Top Strength Identified by Each Professional:');
  analyses.forEach(({ perspective, analysis, emoji }) => {
    const topStrength =
      analysis.program_strengths[0] || 'No strengths identified';
    console.log(`${emoji} ${perspective}:`);
    console.log(`   "${topStrength}"`);
  });

  // Critical concerns from each perspective
  console.log('\n🚨 Primary Concern from Each Professional:');
  analyses.forEach(({ perspective, analysis, emoji }) => {
    const topWeakness = analysis.critical_weaknesses[0] || 'No major concerns';
    console.log(`${emoji} ${perspective}:`);
    console.log(`   "${topWeakness}"`);
  });

  // Target population consensus
  console.log('\n👥 Target Population Recommendations:');
  const allTargets = analyses.flatMap(a => a.analysis.target_population);
  const targetCounts = allTargets.reduce(
    (acc: Record<string, number>, target: string) => {
      acc[target] = (acc[target] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  Object.entries(targetCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([target, count]) => {
      const consensus =
        count === analyses.length
          ? '🟢 CONSENSUS'
          : count >= 2
            ? '🟡 MAJORITY'
            : '🔴 MINORITY';
      console.log(
        `${consensus} ${target} (${count}/${analyses.length} professionals)`
      );
    });

  // Modification priority comparison
  console.log('\n🔧 Critical Modifications Needed:');
  analyses.forEach(({ perspective, analysis, emoji }) => {
    const criticalMods = analysis.modification_priorities.filter(
      mod => mod.importance === 'critical' || mod.importance === 'high'
    );

    if (criticalMods.length > 0) {
      console.log(`${emoji} ${perspective}:`);
      criticalMods.forEach(mod => {
        console.log(`   [${mod.importance.toUpperCase()}] ${mod.issue}`);
      });
    }
  });

  // Save comparative results to file if requested
  if (saveToFile) {
    // Create output directory if it doesn't exist
    await fs.mkdir('../output', { recursive: true });

    const programName = programData.program_name
      .toLowerCase()
      .replace(/\s+/g, '-');
    const outputFile = `../output/${programName}-multi-perspective-comparison.json`;

    await fs.writeFile(
      outputFile,
      JSON.stringify(
        {
          program: programData,
          comparativeAnalysis: {
            perspectives: analyses.map(a => ({
              perspective: a.perspective,
              analysis: a.analysis,
              emoji: a.emoji,
            })),
            summary: {
              totalPerspectives: analyses.length,
              ratingDistribution: analyses.reduce(
                (acc: Record<string, number>, a) => {
                  acc[a.analysis.overall_rating] =
                    (acc[a.analysis.overall_rating] || 0) + 1;
                  return acc;
                },
                {}
              ),
              averageEffectivenessScore: Math.round(
                analyses.reduce(
                  (sum, a) => sum + a.analysis.effectiveness_score,
                  0
                ) / analyses.length
              ),
              consensusTargetPopulation: Object.entries(
                analyses
                  .flatMap(a => a.analysis.target_population)
                  .reduce((acc: Record<string, number>, target: string) => {
                    acc[target] = (acc[target] || 0) + 1;
                    return acc;
                  }, {})
              )
                .filter(([, count]) => count >= 2)
                .map(([target]) => target),
            },
          },
          metadata: {
            completedAt: new Date().toISOString(),
            analysisType: 'multi-perspective-comparison',
          },
        },
        null,
        2
      )
    );

    console.log(`\n💾 Comparative analysis saved to: ${outputFile}`);
  }

  return analyses;
}

// Analyze different programs for comparison
async function main() {
  console.log('🏋️‍♂️ Multi-Perspective Fitness Program Analysis');
  console.log('================================================');

  // Compare beginner program across perspectives
  console.log('\n📋 BEGINNER PROGRAM ANALYSIS:');
  await compareAllPerspectives(
    'examples/fitness-analysis/data/beginner-3day-split.json'
  );

  console.log(`\n\n${'='.repeat(100)}\n`);

  // Compare advanced program across perspectives
  console.log('📋 ADVANCED PROGRAM ANALYSIS:');
  await compareAllPerspectives(
    'examples/fitness-analysis/data/advanced-ppl-split.json'
  );

  console.log('\n\n🎉 Analysis Complete!');
  console.log(
    'Notice how the same programs receive different ratings and recommendations'
  );
  console.log(
    "based on each professional's specialized perspective and priorities."
  );
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
