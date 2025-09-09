#!/usr/bin/env node --import tsx

/**
 * Minimal Exercise Demo with Session
 *
 * Shows exercise relationship analysis using Persuader:
 * - Load exercise names from JSON files
 * - Create session with all exercise names as context
 * - Process each exercise to find relationships
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { runPersuader } from '../../src/index.js';
import {
  ExerciseRelationshipSchema,
  type ExerciseRelationships,
} from './schemas/exercise-schema.js';

/**
 * Loads exercise names from JSON files in the exercises directory
 *
 * Scans all .json files in examples/exercise/data/exercises/ and extracts the exercise names
 * from the data.name field of each file.
 *
 * @returns Array of exercise names sorted alphabetically
 * @throws Logs warnings for files that cannot be parsed but continues processing
 *
 * @example
 * ```typescript
 * const exercises = loadExerciseNames();
 * // Returns: ["Barbell Row", "Bench Press", "Deadlift", ...]
 * ```
 */
function loadExerciseNames(): string[] {
  const exerciseFiles = glob.sync(
    join(import.meta.dirname, 'data', 'exercises', '*.json')
  );
  const exerciseNames: string[] = [];

  for (const file of exerciseFiles) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      if (data.data?.name) {
        exerciseNames.push(data.data.name);
      }
    } catch (error) {
      console.log(`⚠️  Skipped ${file}: ${error}`);
    }
  }

  return exerciseNames.sort();
}

/**
 * Creates the initial session context containing all available exercise names
 *
 * This context is used for the first LLM call to establish the session with
 * knowledge of all available exercises and the types of relationships to find.
 *
 * @param exerciseNames - Array of all available exercise names
 * @returns Context string for establishing the LLM session
 *
 * @example
 * ```typescript
 * const context = createSessionContext(["Bench Press", "Push-up"]);
 * // Returns: "You are a fitness expert analyzing exercise relationships..."
 * ```
 */
function createSessionContext(exerciseNames: string[]): string {
  return `You are a fitness expert analyzing exercise relationships. 
Available exercises: ${exerciseNames.join(', ')}.

For each exercise I give you, identify relationships using ONLY exercises from the available list:
- similarMuscles: Exercises that work similar muscle groups
- variationOf: Exercises this is a variation of (e.g., incline bench press is variation of bench press)
- progressionFrom: Exercises that naturally progress to this one (e.g., push-up progresses to bench press)
- substitutableFor: Exercises that can substitute for this one in a workout

Return 2-4 exercises for each relationship type when applicable. Use empty arrays if no relationships exist.`;
}

/**
 * Processes a single exercise to find its relationships with other exercises
 *
 * Uses Persuader to send an exercise to the LLM and get back validated relationships.
 * Handles both initial session creation (with full context) and subsequent
 * calls (with minimal context) for efficiency.
 *
 * @param exerciseName - Name of the exercise to analyze
 * @param sessionContext - Full context string for session establishment
 * @param sessionId - Optional session ID for context reuse
 * @returns Promise resolving to relationship data and new session ID
 *
 * @example
 * ```typescript
 * const result = await processExercise("Bench Press", fullContext);
 * // result.relationships: { exercise: "Bench Press", similarMuscles: ["Push-up", "Dip"], ... }
 * ```
 */
async function processExercise(
  exerciseName: string,
  sessionContext: string,
  sessionId?: string
): Promise<{ relationships?: ExerciseRelationships; newSessionId?: string }> {
  console.log(`🏋️  Processing: ${exerciseName}`);

  const result = await runPersuader({
    schema: ExerciseRelationshipSchema,
    input: { currentExercise: exerciseName },
    context: sessionId
      ? `Analyze relationships for: ${exerciseName}`
      : sessionContext,
    sessionId,
  });

  if (result.ok) {
    const relationships = result.value as ExerciseRelationships;
    const totalRelationships =
      relationships.similarMuscles.length +
      relationships.variationOf.length +
      relationships.progressionFrom.length +
      relationships.substitutableFor.length;

    console.log(`✅ ${totalRelationships} total relationships found`);
    console.log(
      `   Similar muscles: ${relationships.similarMuscles.join(', ') || 'None'}`
    );
    console.log(
      `   Variation of: ${relationships.variationOf.join(', ') || 'None'}`
    );
    console.log(
      `   Progression from: ${relationships.progressionFrom.join(', ') || 'None'}`
    );
    console.log(
      `   Substitutable for: ${relationships.substitutableFor.join(', ') || 'None'}\n`
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
 * Main demonstration function coordinating the entire workflow
 *
 * Orchestrates the complete process:
 * 1. Loads exercise names from JSON files
 * 2. Creates session context with all exercise names and relationship types
 * 3. Processes each exercise individually using session for efficiency
 *
 * Demonstrates Persuader's ability to handle complex domain relationships
 * and multi-dimensional categorization tasks.
 *
 * @throws Logs errors but continues processing remaining exercises
 *
 * @example
 * ```typescript
 * await runExerciseDemo();
 * // Outputs:
 * // 🏋️  Minimal Exercise Relationship Demo
 * // 📋 Loaded 8 exercises from JSON files
 * // 🏋️  Processing: Barbell Row
 * // ✅ 12 total relationships found
 * // ...
 * ```
 */
async function runExerciseDemo(): Promise<void> {
  console.log('🏋️  Minimal Exercise Relationship Demo');

  // Step 1: Load exercise data
  const allExerciseNames = loadExerciseNames();
  console.log(
    `📋 Loaded ${allExerciseNames.length} exercises from JSON files\n`
  );

  // Step 2: Create results directory
  const resultsDir = join(import.meta.dirname, 'output');
  try {
    mkdirSync(resultsDir, { recursive: true });
  } catch {} // Ignore if exists

  // Step 3: Create session context
  const sessionContext = createSessionContext(allExerciseNames);

  // Step 4: Process each exercise
  let sessionId: string | undefined;
  const allRelationships: ExerciseRelationships[] = [];

  for (const exerciseName of allExerciseNames) {
    const result = await processExercise(
      exerciseName,
      sessionContext,
      sessionId
    );

    // Save successful results
    if (result.relationships) {
      allRelationships.push(result.relationships);

      // Save individual result file
      const filename = `${exerciseName.toLowerCase().replace(/\s+/g, '-')}-relationships.json`;
      const filepath = join(resultsDir, filename);
      writeFileSync(filepath, JSON.stringify(result.relationships, null, 2));
      console.log(`💾 Saved: ${filename}`);
    }

    // Capture session ID after first successful call
    if (!sessionId && result.newSessionId) {
      sessionId = result.newSessionId;
      console.log(`🔗 Session established for context reuse\n`);
    }
  }

  // Save summary file
  const summary = {
    timestamp: new Date().toISOString(),
    totalExercises: allExerciseNames.length,
    successfulAnalyses: allRelationships.length,
    totalRelationships: allRelationships.reduce(
      (sum, rel) =>
        sum +
        rel.similarMuscles.length +
        rel.variationOf.length +
        rel.progressionFrom.length +
        rel.substitutableFor.length,
      0
    ),
    relationships: allRelationships,
  };

  const summaryPath = join(resultsDir, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n📊 Summary saved to: ${summaryPath}`);
  console.log(`📁 All results saved to: ${resultsDir}/`);
}

// Execute the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runExerciseDemo().catch(console.error);
}
