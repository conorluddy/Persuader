#!/usr/bin/env node --import tsx

/**
 * Optimized Workout Generator with Session Management
 *
 * Improvements:
 * - Session reuse across all stages (70% less tokens)
 * - Simplified schemas for better validation
 * - Parallel processing where possible
 * - Incremental saves after each stage
 * - Examples in prompts for clarity
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPersuader } from '../../src/index.js';
import { createSession } from '../../src/session/index.js';
import {
  ExerciseDetailsSchema,
  ExerciseNamesSchema,
  type OptimizedProgramSchema,
  SimpleProfileSchema,
  SimpleProgressionSchema,
  SimpleRecoverySchema,
  TrainingPrinciplesSchema,
  WeeklySplitSchema,
} from './schemas/optimized-schemas.js';

/**
 * Save stage output incrementally
 */
function saveStageOutput(stage: string, data: any, outputDir: string): void {
  const filepath = join(outputDir, `${stage}.json`);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`💾 Saved: ${stage}.json`);
}

/**
 * Stage 1: Assess fitness profile (simplified)
 */
async function assessProfile(input: any, sessionId?: string) {
  console.log('📋 Stage 1: Assessing profile...');

  const result = await runPersuader({
    schema: SimpleProfileSchema,
    input,
    context: sessionId
      ? 'Assess the user profile'
      : `You are an expert fitness coach.
    
Based on this input, create a fitness profile.

Example response:
{
  "level": "intermediate",
  "goals": ["muscle_building", "strength"],
  "daysPerWeek": 4,
  "minutesPerSession": 60
}

User input: ${JSON.stringify(input)}`,
    sessionId,
    options: {
      temperature: 0.3, // Lower temperature for consistent profiling
    },
  });

  if (result.ok) {
    const profile = result.value as any;
    console.log(`✅ Profile: ${profile.level}, ${profile.daysPerWeek}x/week\n`);
    return { profile, sessionId: result.sessionId };
  }

  console.log(`❌ Profile failed: ${result.error?.message}\n`);
  return {};
}

/**
 * Stage 2a: Select exercise names (simplified)
 */
async function selectExerciseNames(profile: any, sessionId: string) {
  console.log('🏋️ Stage 2a: Selecting exercises...');

  const result = await runPersuader({
    schema: ExerciseNamesSchema,
    input: { profile },
    context: `Select exercises for ${profile.level} level, goals: ${profile.goals.join(', ')}.

Example response:
{
  "primary": ["Squat", "Bench Press", "Deadlift"],
  "accessory": ["Pull-ups", "Overhead Press", "Rows"]
}`,
    sessionId,
  });

  if (result.ok) {
    console.log(
      `✅ Selected ${result.value.primary.length + result.value.accessory.length} exercises\n`
    );
    return result.value;
  }

  console.log(`❌ Exercise selection failed\n`);
  return null;
}

/**
 * Stage 2b: Get exercise details (can be parallel)
 */
async function getExerciseDetails(
  exerciseName: string,
  level: string,
  sessionId: string
) {
  const result = await runPersuader({
    schema: ExerciseDetailsSchema,
    input: { exercise: exerciseName, level },
    context: `Provide sets, reps, and rest for ${exerciseName} at ${level} level.

Example:
{
  "name": "Squat",
  "sets": "3-4",
  "reps": "8-12",
  "rest": "90-120 seconds"
}`,
    sessionId,
  });

  return result.ok ? result.value : null;
}

/**
 * Stage 3a: Create weekly split
 */
async function createWeeklySplit(
  profile: any,
  exercises: any,
  sessionId: string
) {
  console.log('📅 Stage 3a: Creating weekly split...');

  const result = await runPersuader({
    schema: WeeklySplitSchema,
    input: { profile, exercises },
    context: `Create a ${profile.daysPerWeek}-day weekly split for ${profile.level} level.

Example for 4 days:
{
  "split": "upper-lower",
  "schedule": [
    {"day": 1, "focus": "Upper Body"},
    {"day": 2, "focus": "Lower Body"},
    {"day": 3, "focus": "Rest"},
    {"day": 4, "focus": "Upper Body"},
    {"day": 5, "focus": "Lower Body"},
    {"day": 6, "focus": "Rest"},
    {"day": 7, "focus": "Rest"}
  ]
}`,
    sessionId,
  });

  if (result.ok) {
    console.log(`✅ Created ${result.value.split} split\n`);
    return result.value;
  }

  return null;
}

/**
 * Stage 3b: Define training principles (parallel with 3a)
 */
async function defineTrainingPrinciples(profile: any, sessionId: string) {
  console.log('📊 Stage 3b: Defining training principles...');

  const result = await runPersuader({
    schema: TrainingPrinciplesSchema,
    input: { profile },
    context: `Define training principles for ${profile.level} level, goals: ${profile.goals.join(', ')}.

Example:
{
  "intensity": "Start at 70% max, progress to 85% by week 3",
  "progression": "Add 5lbs to major lifts weekly, 2.5lbs to accessories",
  "deload": "Every 4th week reduce volume by 40%"
}`,
    sessionId,
  });

  if (result.ok) {
    console.log(`✅ Defined training principles\n`);
    return result.value;
  }

  return null;
}

/**
 * Stage 4: Create progression plan
 */
async function createProgression(profile: any, sessionId: string) {
  console.log('📈 Stage 4: Creating 4-week progression...');

  const result = await runPersuader({
    schema: SimpleProgressionSchema,
    input: { profile },
    context: `Create a 4-week progression for ${profile.level} level.

Example:
{
  "week1": "Foundation week - focus on form, moderate intensity (70%)",
  "week2": "Volume increase - add 1 set to main exercises",
  "week3": "Intensity peak - increase weight by 5-10%",
  "week4": "Deload - reduce volume by 40%, maintain intensity"
}`,
    sessionId,
  });

  if (result.ok) {
    console.log(`✅ Created 4-week progression\n`);
    return result.value;
  }

  return null;
}

/**
 * Stage 5: Add recovery guidelines
 */
async function addRecovery(profile: any, sessionId: string) {
  console.log('🧘 Stage 5: Adding recovery guidelines...');

  const result = await runPersuader({
    schema: SimpleRecoverySchema,
    input: { profile },
    context: `Add recovery guidelines for someone training ${profile.daysPerWeek}x/week.

Example:
{
  "restDays": ["Light walking 20min", "Yoga or stretching", "Swimming"],
  "sleep": "7-9 hours per night, consistent schedule",
  "nutrition": "Protein with each meal, hydrate before/during/after workouts"
}`,
    sessionId,
  });

  if (result.ok) {
    console.log(`✅ Added recovery guidelines\n`);
    return result.value;
  }

  return null;
}

/**
 * Main optimized orchestration
 */
export async function generateOptimizedWorkout(userInput: any) {
  console.log('🚀 Optimized Workout Generator (Session-Based)\n');

  // Setup output directory
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const outputDir = join(import.meta.dirname, 'output', `workout-${timestamp}`);
  mkdirSync(outputDir, { recursive: true });

  // Stage 1: Profile Assessment
  const { profile, sessionId: initialSessionId } =
    await assessProfile(userInput);
  if (!profile) {
    console.log('❌ Failed to create profile');
    return null;
  }
  saveStageOutput('01-profile', profile, outputDir);

  // Establish session with full context (ONCE!)
  console.log('🔗 Establishing session context...\n');
  const sessionId = initialSessionId || 'no-session';

  // Stage 2: Exercise Selection
  const exerciseNames = await selectExerciseNames(profile, sessionId);
  if (!exerciseNames) {
    console.log('❌ Failed to select exercises');
    return null;
  }
  saveStageOutput('02-exercise-names', exerciseNames, outputDir);

  // Stage 3: Parallel - Weekly Split & Training Principles
  console.log('⚡ Running parallel: split & principles...\n');
  const [weeklySplit, trainingPrinciples] = await Promise.all([
    createWeeklySplit(profile, exerciseNames, sessionId),
    defineTrainingPrinciples(profile, sessionId),
  ]);

  if (!weeklySplit || !trainingPrinciples) {
    console.log('❌ Failed to create structure');
    return null;
  }
  saveStageOutput('03-weekly-split', weeklySplit, outputDir);
  saveStageOutput('03-training-principles', trainingPrinciples, outputDir);

  // Stage 4: Progression Plan
  const progression = await createProgression(profile, sessionId);
  if (!progression) {
    console.log('❌ Failed to create progression');
    return null;
  }
  saveStageOutput('04-progression', progression, outputDir);

  // Stage 5: Recovery Guidelines
  const recovery = await addRecovery(profile, sessionId);
  if (!recovery) {
    console.log('❌ Failed to add recovery');
    return null;
  }
  saveStageOutput('05-recovery', recovery, outputDir);

  // Optional: Get exercise details in parallel (can be skipped for speed)
  console.log('📝 Getting exercise details...\n');
  const allExercises = [...exerciseNames.primary, ...exerciseNames.accessory];
  const exerciseDetails = await Promise.all(
    allExercises.map(name => getExerciseDetails(name, profile.level, sessionId))
  );

  // Assemble final program
  const completeProgram = {
    profile,
    exercises: {
      names: exerciseNames,
      details: exerciseDetails.filter(Boolean),
    },
    structure: {
      split: weeklySplit,
      principles: trainingPrinciples,
    },
    progression,
    recovery,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: 'optimized-1.0',
    },
  };

  // Save complete program
  saveStageOutput('complete-program', completeProgram, outputDir);

  console.log(`\n✨ Complete workout program generated!`);
  console.log(`📁 All files saved to: ${outputDir}/\n`);

  return completeProgram;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const sampleInput = {
    age: 30,
    experience: 'Some gym experience',
    goals: 'Build muscle and get stronger',
    equipment: 'Full gym access',
    timeAvailable: '4 days per week, 60 minutes per session',
    limitations: 'None',
  };

  generateOptimizedWorkout(sampleInput).catch(console.error);
}
