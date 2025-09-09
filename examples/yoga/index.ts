#!/usr/bin/env node --import tsx

/**
 * Minimal Persuader Demo with Session
 *
 * Shows minimal session-based processing:
 * - Load pose names from JSON files
 * - Create session with all pose names as context
 * - Process each pose individually using the session
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { persuade } from '../../src/index.js';
import { createYogaSessionContext } from './prompts/session-context.js';
import {
  type PoseTransition,
  TransitionSchema,
} from './schemas/transition-schema.js';

/**
 * Loads yoga pose names from JSON files in the poses directory
 *
 * Scans all .json files in examples/yoga/data/poses/ and extracts the pose names
 * from the data.currentPose.name field of each file.
 *
 * @returns Array of pose names sorted alphabetically
 * @throws Logs warnings for files that cannot be parsed but continues processing
 *
 * @example
 * ```typescript
 * const poses = loadPoseNames();
 * // Returns: ["Boat Pose", "Bridge Pose", "Mountain Pose", ...]
 * ```
 */
function loadPoseNames(): string[] {
  const poseFiles = glob.sync(join(import.meta.dirname, 'data', '*.json'));
  const poseNames: string[] = [];

  for (const file of poseFiles) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      if (data.name) {
        poseNames.push(data.name);
      }
    } catch (error) {
      console.log(`⚠️  Skipped ${file}: ${error}`);
    }
  }

  return poseNames.sort();
}

/**
 * Processes a single yoga pose to find its natural transitions
 *
 * Uses Persuader to send a pose to the LLM and get back validated transitions.
 * Handles both initial session creation (with full context) and subsequent
 * calls (with minimal context) for efficiency.
 *
 * @param poseName - Name of the pose to analyze
 * @param sessionContext - Full context string for session establishment
 * @param sessionId - Optional session ID for context reuse
 * @returns Promise resolving to transition data and new session ID
 *
 * @example
 * ```typescript
 * const result = await processPose("Mountain Pose", fullContext);
 * // result.transition: { from: "Mountain Pose", to: ["Tree Pose", "Forward Fold"] }
 * // result.newSessionId: "session-123-abc"
 * ```
 */
async function processPose(
  poseName: string,
  sessionContext: string,
  sessionId?: string
): Promise<{ transition?: PoseTransition; newSessionId?: string }> {
  console.log(`🔄 Processing: ${poseName}`);

  const result = await persuade({
    schema: TransitionSchema,
    input: { currentPose: poseName },
    context: sessionId
      ? `Analyze transitions for: ${poseName}`
      : sessionContext,
    sessionId,
  });

  if (result.ok) {
    const transition = result.value as PoseTransition;
    console.log(`✅ ${transition.to.length} transitions found`);
    console.log(`   → ${transition.to.join(', ')}\n`);

    return {
      transition,
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
 * 1. Loads pose names from JSON files
 * 2. Creates session context with all pose names
 * 3. Processes each pose individually using session for efficiency
 *
 * Demonstrates Persuader's session functionality for batch processing
 * where context is established once and reused across multiple calls.
 *
 * @throws Logs errors but continues processing remaining poses
 *
 * @example
 * ```typescript
 * await runMinimalDemo();
 * // Outputs:
 * // 🧘‍♀️ Minimal Persuader Session Demo
 * // 📋 Loaded 50 poses from JSON files
 * // 🔄 Processing: Boat Pose
 * // ✅ 4 transitions found
 * // ...
 * ```
 */
async function runMinimalDemo(): Promise<void> {
  console.log('🧘‍♀️ Minimal Persuader Session Demo');

  // Step 1: Load pose data
  const allPoseNames = loadPoseNames();
  console.log(`📋 Loaded ${allPoseNames.length} poses from JSON files\n`);

  // Step 2: Create results directory
  const resultsDir = join(import.meta.dirname, 'output');
  try {
    mkdirSync(resultsDir, { recursive: true });
  } catch {} // Ignore if exists

  // Step 3: Create session context
  const sessionContext = createYogaSessionContext(allPoseNames);

  // Step 4: Process each pose
  let sessionId: string | undefined;
  const allTransitions: PoseTransition[] = [];

  for (const poseName of allPoseNames) {
    const result = await processPose(poseName, sessionContext, sessionId);

    // Save successful results
    if (result.transition) {
      allTransitions.push(result.transition);

      // Save individual result file
      const filename = `${poseName.toLowerCase().replace(/\s+/g, '-')}-transitions.json`;
      const filepath = join(resultsDir, filename);
      writeFileSync(filepath, JSON.stringify(result.transition, null, 2));
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
    totalPoses: allPoseNames.length,
    successfulTransitions: allTransitions.length,
    totalTransitionEdges: allTransitions.reduce(
      (sum, t) => sum + t.to.length,
      0
    ),
    transitions: allTransitions,
  };

  const summaryPath = join(resultsDir, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n📊 Summary saved to: ${summaryPath}`);
  console.log(`📁 All results saved to: ${resultsDir}/`);
}

// Execute the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runMinimalDemo().catch(console.error);
}
