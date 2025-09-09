#!/usr/bin/env node --import tsx

/**
 * Multi-Stage Workout Generator Demo
 *
 * Demonstrates Persuader's session-based multi-stage orchestration:
 * 1. Fitness Profile Assessment
 * 2. Exercise Selection
 * 3. Workout Structure Creation
 * 4. Progression Planning
 * 5. Recovery Integration
 *
 * Each stage builds on previous results using session context for efficiency.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runPersuader } from '../../src/index.js';
import { COACH_CONTEXT } from './prompts/coach-context.js';
import {
  type CompleteWorkoutProgram,
  type ExerciseSelection,
  ExerciseSelectionSchema,
  type FitnessProfile,
  FitnessProfileSchema,
  type ProgressionPlan,
  ProgressionPlanSchema,
  type RecoveryIntegration,
  RecoveryIntegrationSchema,
  type WorkoutStructure,
  WorkoutStructureSchema,
} from './schemas/schemas.js';

/**
 * Sample user inputs for demonstration
 */
interface UserInput {
  age: number;
  experience: string;
  goals: string;
  equipment: string;
  timeAvailable: string;
  limitations: string;
}

/**
 * Creates the initial session context for the fitness coach persona
 */
function createCoachContext(): string {
  return COACH_CONTEXT;
}

/**
 * Stage 1: Assess fitness profile and create foundation
 */
async function assessFitnessProfile(
  userInput: UserInput,
  sessionContext: string,
  sessionId?: string
): Promise<{ profile?: FitnessProfile; sessionId?: string }> {
  console.log('🏃 Stage 1: Assessing fitness profile...');

  const prompt = sessionId
    ? `Based on this user information, create a comprehensive fitness profile assessment:
       
       Age: ${userInput.age}
       Experience: ${userInput.experience}
       Goals: ${userInput.goals}
       Available Equipment: ${userInput.equipment}
       Time Available: ${userInput.timeAvailable}
       Limitations/Injuries: ${userInput.limitations}
       
       Analyze this information and create a detailed fitness profile.`
    : `${sessionContext}
    
Your first task is to analyze this user and create a comprehensive fitness profile:

Age: ${userInput.age}
Experience: ${userInput.experience}  
Goals: ${userInput.goals}
Available Equipment: ${userInput.equipment}
Time Available: ${userInput.timeAvailable}
Limitations/Injuries: ${userInput.limitations}

Create a detailed assessment that will guide the entire program design.`;

  const result = await runPersuader({
    schema: FitnessProfileSchema,
    input: userInput,
    context: prompt,
    sessionId,
  });

  if (result.ok) {
    const profile = result.value as FitnessProfile;
    console.log(
      `✅ Profile: ${profile.fitnessLevel} level, ${profile.workoutsPerWeek}x/week, ${profile.timePerWorkout}min sessions`
    );
    console.log(`   Goals: ${profile.primaryGoals.join(', ')}`);
    console.log(`   Equipment: ${profile.availableEquipment.join(', ')}\n`);

    return { profile, sessionId: result.sessionId };
  } else {
    console.log(`❌ Profile assessment failed: ${result.error?.message}\n`);
    return {};
  }
}

/**
 * Stage 2: Select appropriate exercises based on profile
 */
async function selectExercises(
  profile: FitnessProfile,
  sessionId?: string
): Promise<{ exercises?: ExerciseSelection; sessionId?: string }> {
  console.log('🏋️ Stage 2: Selecting exercises...');

  const result = await runPersuader({
    schema: ExerciseSelectionSchema,
    input: { profile },
    context: `Based on the fitness profile we just created, select the most appropriate exercises for this user's program.

Consider:
- Fitness level: ${profile.fitnessLevel}
- Goals: ${profile.primaryGoals.join(', ')}
- Equipment: ${profile.availableEquipment.join(', ')}
- Time per workout: ${profile.timePerWorkout} minutes
- Experience level: ${profile.experienceWithPrograms ? 'Has program experience' : 'New to structured programs'}
${profile.injuries?.length ? `- Injuries/limitations: ${profile.injuries.join(', ')}` : ''}

Select exercises that are safe, effective, and appropriate for this specific user.`,
    sessionId,
  });

  if (result.ok) {
    const exercises = result.value as ExerciseSelection;
    console.log(
      `✅ Selected ${exercises.primaryExercises.length} primary + ${exercises.accessoryExercises.length} accessory exercises`
    );
    console.log(
      `   Categories: ${[...new Set([...exercises.primaryExercises, ...exercises.accessoryExercises].map(e => e.category))].join(', ')}\n`
    );

    return { exercises, sessionId: result.sessionId };
  } else {
    console.log(`❌ Exercise selection failed: ${result.error?.message}\n`);
    return {};
  }
}

/**
 * Stage 3: Create weekly workout structure
 */
async function createWorkoutStructure(
  profile: FitnessProfile,
  exercises: ExerciseSelection,
  sessionId?: string
): Promise<{ structure?: WorkoutStructure; sessionId?: string }> {
  console.log('📅 Stage 3: Creating workout structure...');

  const result = await runPersuader({
    schema: WorkoutStructureSchema,
    input: { profile, exercises },
    context: `Now create a complete weekly workout structure using the selected exercises.

The user wants ${profile.workoutsPerWeek} workouts per week, ${profile.timePerWorkout} minutes each.
Organize the exercises we selected into an effective weekly schedule with proper sets, reps, and rest periods.

Consider:
- Recovery time between similar muscle groups
- Balancing intensity throughout the week  
- Progressive challenge appropriate for ${profile.fitnessLevel} level
- Time constraints and equipment availability
- Primary goals: ${profile.primaryGoals.join(', ')}`,
    sessionId,
  });

  if (result.ok) {
    const structure = result.value as WorkoutStructure;
    const workoutDays = structure.weeklySchedule.filter(
      d => d.workoutType !== 'rest'
    );
    console.log(
      `✅ Created weekly structure: ${workoutDays.length} workout days`
    );
    console.log(
      `   Workout types: ${[...new Set(workoutDays.map(d => d.workoutType))].join(', ')}\n`
    );

    return { structure, sessionId: result.sessionId };
  } else {
    console.log(
      `❌ Workout structure creation failed: ${result.error?.message}\n`
    );
    return {};
  }
}

/**
 * Stage 4: Create 4-week progression plan
 */
async function createProgressionPlan(
  profile: FitnessProfile,
  structure: WorkoutStructure,
  sessionId?: string
): Promise<{ progression?: ProgressionPlan; sessionId?: string }> {
  console.log('📈 Stage 4: Creating progression plan...');

  const result = await runPersuader({
    schema: ProgressionPlanSchema,
    input: { profile, structure },
    context: `Create a 4-week progression plan that gradually increases the challenge and effectiveness of the workout program.

For a ${profile.fitnessLevel} level person with goals of ${profile.primaryGoals.join(', ')}, design weekly progressions that:
- Start conservatively to build confidence and form
- Gradually increase intensity/volume/complexity 
- Include assessment points to track progress
- Provide clear guidance on when and how to advance
- Account for individual variation in adaptation rates`,
    sessionId,
  });

  if (result.ok) {
    const progression = result.value as ProgressionPlan;
    console.log(`✅ Created 4-week progression plan`);
    console.log(
      `   Assessment points: ${progression.assessmentPoints.length} scheduled`
    );
    console.log(
      `   Weekly focuses: ${progression.weeks.map(w => w.focus).join(' → ')}\n`
    );

    return { progression, sessionId: result.sessionId };
  } else {
    console.log(
      `❌ Progression plan creation failed: ${result.error?.message}\n`
    );
    return {};
  }
}

/**
 * Stage 5: Integrate recovery and lifestyle factors
 */
async function integrateRecovery(
  profile: FitnessProfile,
  structure: WorkoutStructure,
  sessionId?: string
): Promise<{ recovery?: RecoveryIntegration; sessionId?: string }> {
  console.log('😴 Stage 5: Integrating recovery protocols...');

  const result = await runPersuader({
    schema: RecoveryIntegrationSchema,
    input: { profile, structure },
    context: `Complete the workout program by adding comprehensive recovery and lifestyle guidance.

For this ${profile.fitnessLevel} level person training ${profile.workoutsPerWeek}x per week, provide:
- Appropriate recovery activities for rest days
- Sleep optimization strategies  
- Basic nutrition guidance for workout performance
- Recovery protocols and stress management
- Practical advice that fits their lifestyle and goals

Focus on evidence-based recommendations that support their primary goals: ${profile.primaryGoals.join(', ')}`,
    sessionId,
  });

  if (result.ok) {
    const recovery = result.value as RecoveryIntegration;
    console.log(`✅ Added recovery integration`);
    console.log(`   Rest day activities: ${recovery.restDayActivities.length}`);
    console.log(`   Recovery protocols: ${recovery.recoveryProtocols.length}`);
    console.log(
      `   Sleep target: ${recovery.sleepGuidance.recommendedHours}\n`
    );

    return { recovery, sessionId: result.sessionId };
  } else {
    console.log(`❌ Recovery integration failed: ${result.error?.message}\n`);
    return {};
  }
}

/**
 * Combine all stages into complete program
 */
function createCompleteProgram(
  profile: FitnessProfile,
  exercises: ExerciseSelection,
  structure: WorkoutStructure,
  progression: ProgressionPlan,
  recovery: RecoveryIntegration
): CompleteWorkoutProgram {
  const goalMap: Record<string, string> = {
    strength: 'Strength',
    muscle_building: 'Muscle Building',
    endurance: 'Endurance',
    weight_loss: 'Weight Loss',
    mobility: 'Mobility',
    sport_specific: 'Sport Performance',
  };

  const programName = `${goalMap[profile.primaryGoals[0]] || 'Custom'} ${profile.fitnessLevel.charAt(0).toUpperCase() + profile.fitnessLevel.slice(1)} Program`;

  return {
    profile,
    exercises,
    structure,
    progression,
    recovery,
    summary: {
      programName,
      duration: '4 weeks (repeatable with progressions)',
      keyBenefits: [
        `Tailored for ${profile.fitnessLevel} fitness level`,
        `Optimized for ${profile.primaryGoals.join(' and ')} goals`,
        `Fits ${profile.timePerWorkout}-minute workout windows`,
        'Progressive difficulty with built-in assessments',
        'Complete recovery and lifestyle integration',
      ],
      successTips: [
        'Start conservatively and focus on proper form',
        'Track your progress at scheduled assessment points',
        'Listen to your body and adjust intensity as needed',
        'Prioritize sleep and recovery for best results',
        'Stay consistent - small daily actions compound over time',
      ],
    },
  };
}

/**
 * Main orchestration function running all 5 stages
 */
export async function generateWorkoutProgram(
  userInput: UserInput
): Promise<CompleteWorkoutProgram | null> {
  console.log('🚀 Multi-Stage Workout Program Generator\n');

  // Setup
  const resultsDir = join(import.meta.dirname, 'output');
  mkdirSync(resultsDir, { recursive: true });

  const sessionContext = createCoachContext();
  let sessionId: string | undefined;

  // Stage 1: Fitness Profile
  const { profile, sessionId: newSessionId1 } = await assessFitnessProfile(
    userInput,
    sessionContext,
    sessionId
  );
  if (!profile) return null;
  sessionId = newSessionId1;

  // Stage 2: Exercise Selection
  const { exercises, sessionId: newSessionId2 } = await selectExercises(
    profile,
    sessionId
  );
  if (!exercises) return null;
  sessionId = newSessionId2;

  // Stage 3: Workout Structure
  const { structure, sessionId: newSessionId3 } = await createWorkoutStructure(
    profile,
    exercises,
    sessionId
  );
  if (!structure) return null;
  sessionId = newSessionId3;

  // Stage 4: Progression Plan
  const { progression, sessionId: newSessionId4 } = await createProgressionPlan(
    profile,
    structure,
    sessionId
  );
  if (!progression) return null;
  sessionId = newSessionId4;

  // Stage 5: Recovery Integration
  const { recovery } = await integrateRecovery(profile, structure, sessionId);
  if (!recovery) return null;

  // Final Assembly
  console.log('🎯 Assembling complete program...');
  const completeProgram = createCompleteProgram(
    profile,
    exercises,
    structure,
    progression,
    recovery
  );

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `workout-program-${timestamp}.json`;
  const filepath = join(resultsDir, filename);

  writeFileSync(filepath, JSON.stringify(completeProgram, null, 2));

  console.log(`\n🎉 Complete workout program generated!`);
  console.log(`📋 Program: ${completeProgram.summary.programName}`);
  console.log(`⏱️  Duration: ${completeProgram.summary.duration}`);
  console.log(`💾 Saved to: ${filepath}`);
  console.log(
    `\n🔗 Session ID: ${sessionId || 'N/A'} (context preserved across all 5 stages)`
  );

  return completeProgram;
}

/**
 * Demo runner with sample user data
 */
async function runDemo(): Promise<void> {
  // Sample user input for demonstration
  const demoUser: UserInput = {
    age: 32,
    experience:
      "I've been going to the gym on and off for about 2 years, but never followed a structured program. I can do basic exercises like push-ups, squats, and some weight lifting.",
    goals:
      'I want to build muscle and get stronger, but I also want to improve my overall fitness and lose some body fat.',
    equipment:
      'I have a home gym setup with dumbbells (5-50lbs), a pull-up bar, resistance bands, and yoga mat. I also have access to a regular gym 2-3 times per week.',
    timeAvailable:
      "I can commit to 45-60 minutes per workout, and I'd like to work out 4-5 times per week.",
    limitations:
      "I have some lower back sensitivity from sitting at a desk all day, so I need to be careful with heavy lifting and make sure I'm using good form.",
  };

  await generateWorkoutProgram(demoUser);
}

// Execute demo if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}
