#!/usr/bin/env node --import tsx

/**
 * Advanced Yoga Demo with Rich Pose Analysis
 *
 * Demonstrates advanced multi-dimensional relationship analysis using
 * the rich pose dataset from examples/yoga/poses/. Shows how Persuader
 * can handle complex domain knowledge and deep relationship extraction.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { persuade } from '../../src/index.js';
import {
  AdvancedYogaRelationshipSchema,
  type AdvancedYogaRelationships,
  type RichPoseData,
} from './schemas/advanced-yoga-schema.js';

/**
 * Loads rich yoga pose data from the detailed JSON files
 *
 * Extracts comprehensive pose information including anatomical focus,
 * energy states, practitioner profiles, and environmental considerations.
 *
 * @returns Array of rich pose data objects
 * @throws Logs warnings for files that cannot be parsed but continues processing
 */
function loadRichPoseData(): RichPoseData[] {
  const poseFiles = glob.sync(join(import.meta.dirname, 'data', '*.json'));
  const richPoses: RichPoseData[] = [];

  for (const file of poseFiles) {
    try {
      const fileData = JSON.parse(readFileSync(file, 'utf8'));
      if (fileData.data?.currentPose) {
        richPoses.push(fileData.data.currentPose);
      }
    } catch (error) {
      console.log(`⚠️  Skipped ${file}: ${error}`);
    }
  }

  return richPoses.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Creates advanced session context with comprehensive pose knowledge
 *
 * Establishes deep domain understanding including anatomical focus,
 * energy systems, difficulty progressions, and therapeutic considerations.
 *
 * @param poses - Array of rich pose data
 * @returns Advanced context string for complex relationship analysis
 */
function createAdvancedSessionContext(poses: RichPoseData[]): string {
  const poseNames = poses.map(p => p.name).join(', ');

  return `You are an expert yoga teacher and anatomist analyzing advanced pose relationships.

Available poses: ${poseNames}

For each pose, identify sophisticated relationships using ONLY poses from the available list:

1. **anatomicalProgression**: Poses targeting same muscle groups but with increased difficulty/complexity
2. **energeticFlow**: Poses with compatible energy states (grounding→centering→uplifting, etc.)
3. **therapeuticAlternatives**: Gentler modifications for physical limitations or injuries
4. **counterPoses**: Essential balancing poses (backbends after forward folds, twists after backbends)
5. **preparatorySequence**: Poses that warm up and prepare the body for the target pose
6. **integrationOptions**: Neutral poses for rest and integration after intense poses

Consider: muscle engagement, joint actions, energy qualities, breathing patterns, difficulty levels, anatomical safety, and therapeutic applications.

Return 1-4 poses for each category when applicable. Use empty arrays if no relationships exist.`;
}

/**
 * Processes a single pose for advanced multi-dimensional relationship analysis
 *
 * Uses rich pose data to inform sophisticated relationship detection including
 * anatomical progressions, energetic flows, and therapeutic considerations.
 *
 * @param pose - Rich pose data object to analyze
 * @param sessionContext - Advanced context string with domain expertise
 * @param sessionId - Optional session ID for context reuse
 * @returns Promise resolving to relationship data and session ID
 */
async function processAdvancedPose(
  pose: RichPoseData,
  sessionContext: string,
  sessionId?: string
): Promise<{
  relationships?: AdvancedYogaRelationships;
  newSessionId?: string;
}> {
  console.log(`🧘‍♀️ Analyzing: ${pose.name} (${pose.sanskritName})`);
  console.log(
    `   Difficulty: ${pose.practiceContext?.difficulty || 'Unknown'} | Energy: ${pose.practiceContext?.energyState || 'Unknown'}`
  );

  // Create rich input with comprehensive pose details (using optional chaining for safety)
  const richInput = {
    currentPose: pose.name,
    sanskritName: pose.sanskritName,
    difficulty: pose.practiceContext?.difficulty || 'Unknown',
    energyState: pose.practiceContext?.energyState || 'Unknown',
    sequencePhase: pose.practiceContext?.sequencePhase || 'Unknown',
    primaryMuscles: pose.anatomicalFocus?.primaryMuscles || [],
    jointActions: pose.anatomicalFocus?.jointActions || [],
    energeticEffect: pose.anatomicalFocus?.energeticEffect || 'Unknown',
    physicalConsiderations:
      pose.practitionerProfile?.physicalConsiderations || 'None specified',
    specificNeeds: pose.practitionerProfile?.specificNeeds || [],
  };

  const result = await persuade({
    schema: AdvancedYogaRelationshipSchema,
    input: richInput,
    context: sessionId
      ? `Analyze advanced relationships for: ${pose.name}`
      : sessionContext,
    sessionId,
  });

  if (result.ok) {
    const relationships = result.value as AdvancedYogaRelationships;
    const totalRelationships =
      relationships.anatomicalProgression.length +
      relationships.energeticFlow.length +
      relationships.therapeuticAlternatives.length +
      relationships.counterPoses.length +
      relationships.preparatorySequence.length +
      relationships.integrationOptions.length;

    console.log(`✅ ${totalRelationships} total relationships found`);
    console.log(
      `   Progression: ${relationships.anatomicalProgression.join(', ') || 'None'}`
    );
    console.log(
      `   Energy flow: ${relationships.energeticFlow.join(', ') || 'None'}`
    );
    console.log(
      `   Therapeutic: ${relationships.therapeuticAlternatives.join(', ') || 'None'}`
    );
    console.log(
      `   Counter-poses: ${relationships.counterPoses.join(', ') || 'None'}`
    );
    console.log(
      `   Preparation: ${relationships.preparatorySequence.join(', ') || 'None'}`
    );
    console.log(
      `   Integration: ${relationships.integrationOptions.join(', ') || 'None'}\n`
    );

    return {
      relationships,
      newSessionId: result.sessionId,
    };
  } else {
    console.log(`❌ Failed: ${result.error?.message}\n`);
    return {};
  }
}

/**
 * Main demonstration function for advanced yoga relationship analysis
 *
 * Orchestrates comprehensive pose analysis using rich dataset:
 * 1. Loads detailed pose data with anatomical and energetic information
 * 2. Creates advanced session context with deep domain knowledge
 * 3. Processes poses for sophisticated multi-dimensional relationships
 * 4. Saves detailed analysis results with comprehensive metadata
 *
 * Demonstrates Persuader's ability to handle complex domain expertise
 * and extract sophisticated relationships from rich data structures.
 */
async function runAdvancedYogaDemo(): Promise<void> {
  console.log('🧘‍♀️ Advanced Yoga Relationship Analysis Demo');
  console.log(
    'Using rich pose dataset for sophisticated relationship extraction\n'
  );

  // Step 1: Load rich pose data
  const allPoses = loadRichPoseData();
  console.log(
    `📋 Loaded ${allPoses.length} poses with rich anatomical and energetic data\n`
  );

  // Step 2: Create results directory
  const resultsDir = join(import.meta.dirname, 'output');
  try {
    mkdirSync(resultsDir, { recursive: true });
  } catch {} // Ignore if exists

  // Step 3: Create advanced session context
  const sessionContext = createAdvancedSessionContext(allPoses);

  // Step 4: Process each pose for advanced analysis
  let sessionId: string | undefined;
  const allRelationships: AdvancedYogaRelationships[] = [];

  // Process a subset for demo (first 10 poses)
  const demoPoses = allPoses.slice(0, 10);
  console.log(
    `🎯 Processing first ${demoPoses.length} poses for advanced analysis\n`
  );

  for (const pose of demoPoses) {
    const result = await processAdvancedPose(pose, sessionContext, sessionId);

    // Save successful results
    if (result.relationships) {
      allRelationships.push(result.relationships);

      // Save individual result file with rich metadata
      const filename = `${pose.name.toLowerCase().replace(/\s+/g, '-')}-advanced-relationships.json`;
      const filepath = join(resultsDir, filename);

      const richResult = {
        ...result.relationships,
        sourceData: {
          sanskritName: pose.sanskritName,
          difficulty: pose.practiceContext?.difficulty || 'Unknown',
          energyState: pose.practiceContext?.energyState || 'Unknown',
          primaryMuscles: pose.anatomicalFocus?.primaryMuscles || [],
          energeticEffect: pose.anatomicalFocus?.energeticEffect || 'Unknown',
        },
        analysisTimestamp: new Date().toISOString(),
      };

      writeFileSync(filepath, JSON.stringify(richResult, null, 2));
      console.log(`💾 Saved: ${filename}`);
    }

    // Capture session ID after first successful call
    if (!sessionId && result.newSessionId) {
      sessionId = result.newSessionId;
      console.log(`🔗 Advanced session established for context reuse\n`);
    }
  }

  // Save comprehensive summary
  const summary = {
    timestamp: new Date().toISOString(),
    analysisType: 'Advanced Multi-Dimensional Yoga Relationships',
    totalPosesAnalyzed: demoPoses.length,
    successfulAnalyses: allRelationships.length,
    relationshipDimensions: 6,
    totalRelationshipConnections: allRelationships.reduce(
      (sum, rel) =>
        sum +
        rel.anatomicalProgression.length +
        rel.energeticFlow.length +
        rel.therapeuticAlternatives.length +
        rel.counterPoses.length +
        rel.preparatorySequence.length +
        rel.integrationOptions.length,
      0
    ),
    dimensionBreakdown: {
      anatomicalProgressions: allRelationships.reduce(
        (sum, rel) => sum + rel.anatomicalProgression.length,
        0
      ),
      energeticFlows: allRelationships.reduce(
        (sum, rel) => sum + rel.energeticFlow.length,
        0
      ),
      therapeuticAlternatives: allRelationships.reduce(
        (sum, rel) => sum + rel.therapeuticAlternatives.length,
        0
      ),
      counterPoses: allRelationships.reduce(
        (sum, rel) => sum + rel.counterPoses.length,
        0
      ),
      preparatorySequences: allRelationships.reduce(
        (sum, rel) => sum + rel.preparatorySequence.length,
        0
      ),
      integrationOptions: allRelationships.reduce(
        (sum, rel) => sum + rel.integrationOptions.length,
        0
      ),
    },
    relationships: allRelationships,
  };

  const summaryPath = join(resultsDir, 'advanced-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\n📊 Advanced Analysis Complete:`);
  console.log(
    `   Total relationships found: ${summary.totalRelationshipConnections}`
  );
  console.log(
    `   Anatomical progressions: ${summary.dimensionBreakdown.anatomicalProgressions}`
  );
  console.log(
    `   Energetic flows: ${summary.dimensionBreakdown.energeticFlows}`
  );
  console.log(
    `   Therapeutic alternatives: ${summary.dimensionBreakdown.therapeuticAlternatives}`
  );
  console.log(`   Counter-poses: ${summary.dimensionBreakdown.counterPoses}`);
  console.log(
    `   Preparatory sequences: ${summary.dimensionBreakdown.preparatorySequences}`
  );
  console.log(
    `   Integration options: ${summary.dimensionBreakdown.integrationOptions}`
  );
  console.log(`\n📁 Advanced results saved to: ${resultsDir}/`);
}

// Execute the advanced demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runAdvancedYogaDemo().catch(console.error);
}
