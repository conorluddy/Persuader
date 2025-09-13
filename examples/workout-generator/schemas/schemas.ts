#!/usr/bin/env node --import tsx

import { z } from 'zod/v4';

/**
 * Stage 1: Fitness Profile Assessment Schema
 * Captures user's fitness level, goals, equipment, and constraints
 */
export const FitnessProfileSchema = z.object({
  fitnessLevel: z
    .enum(['beginner', 'intermediate', 'advanced'])
    .describe('Overall fitness experience level'),
  primaryGoals: z
    .array(
      z.enum([
        'strength',
        'muscle_building',
        'endurance',
        'weight_loss',
        'mobility',
        'sport_specific',
      ])
    )
    .min(1)
    .max(3)
    .describe('1-3 primary fitness goals'),
  availableEquipment: z
    .array(
      z.enum([
        'bodyweight',
        'dumbbells',
        'barbell',
        'resistance_bands',
        'pull_up_bar',
        'kettlebells',
        'gym_access',
      ])
    )
    .min(1)
    .describe('Available equipment for workouts'),
  timePerWorkout: z
    .number()
    .min(15)
    .max(180)
    .describe('Available time per workout in minutes'),
  workoutsPerWeek: z
    .number()
    .min(1)
    .max(7)
    .describe('Desired number of workouts per week'),
  injuries: z
    .array(z.string())
    .optional()
    .describe('Current injuries or physical limitations'),
  experienceWithPrograms: z
    .boolean()
    .describe('Has experience following structured workout programs'),
});

export type FitnessProfile = z.infer<typeof FitnessProfileSchema>;

/**
 * Stage 2: Exercise Selection Schema
 * Chooses appropriate exercises based on profile and equipment
 */
export const ExerciseSelectionSchema = z.object({
  primaryExercises: z
    .array(
      z.object({
        name: z.string(),
        category: z.enum([
          'push',
          'pull',
          'legs',
          'core',
          'cardio',
          'mobility',
        ]),
        equipment: z.enum([
          'bodyweight',
          'dumbbells',
          'barbell',
          'resistance_bands',
          'pull_up_bar',
          'kettlebells',
          'gym_equipment',
        ]),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        primaryMuscles: z.array(z.string()),
        description: z.string().max(200),
      })
    )
    .min(6)
    .max(12)
    .describe('Core exercises for the program'),

  accessoryExercises: z
    .array(
      z.object({
        name: z.string(),
        category: z.enum([
          'push',
          'pull',
          'legs',
          'core',
          'cardio',
          'mobility',
        ]),
        equipment: z.enum([
          'bodyweight',
          'dumbbells',
          'barbell',
          'resistance_bands',
          'pull_up_bar',
          'kettlebells',
          'gym_equipment',
        ]),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        primaryMuscles: z.array(z.string()),
        description: z.string().max(200),
      })
    )
    .min(4)
    .max(8)
    .describe('Supporting/accessory exercises'),

  rationale: z
    .string()
    .max(500)
    .describe('Explanation for exercise selection based on user profile'),
});

export type ExerciseSelection = z.infer<typeof ExerciseSelectionSchema>;

/**
 * Stage 3: Workout Structure Schema
 * Creates weekly workout structure with sets, reps, and timing
 */
export const WorkoutStructureSchema = z.object({
  weeklySchedule: z
    .array(
      z.object({
        day: z.enum([
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ]),
        workoutType: z.enum([
          'strength',
          'cardio',
          'mobility',
          'rest',
          'active_recovery',
        ]),
        exercises: z
          .array(
            z.object({
              name: z.string(),
              sets: z.number().min(1).max(6),
              reps: z
                .string()
                .describe('Rep range (e.g., "8-12", "30 seconds", "AMRAP")'),
              restPeriod: z
                .string()
                .describe('Rest between sets (e.g., "60-90 seconds")'),
              notes: z
                .string()
                .optional()
                .describe('Special instructions or modifications'),
            })
          )
          .optional(),
        totalDuration: z
          .number()
          .describe('Expected workout duration in minutes'),
        warmup: z.string().describe('Warmup routine for this workout'),
        cooldown: z.string().describe('Cooldown routine for this workout'),
      })
    )
    .length(7)
    .describe('Complete weekly workout schedule'),

  trainingPrinciples: z.object({
    progression: z.string().describe('How to progress difficulty over time'),
    recovery: z.string().describe('Recovery and rest day guidance'),
    adaptations: z
      .string()
      .describe('How to modify workouts based on performance'),
  }),
});

export type WorkoutStructure = z.infer<typeof WorkoutStructureSchema>;

/**
 * Stage 4: Progression Planning Schema
 * Creates 4-week progression plan with weekly adjustments
 */
export const ProgressionPlanSchema = z.object({
  weeks: z
    .array(
      z.object({
        weekNumber: z.number().min(1).max(4),
        focus: z.string().describe('Primary focus for this week'),
        adjustments: z.object({
          intensity: z.string().describe('How to adjust workout intensity'),
          volume: z.string().describe('How to adjust workout volume'),
          complexity: z.string().describe('How to adjust exercise complexity'),
        }),
        progressionMetrics: z
          .array(z.string())
          .describe('What to track and improve this week'),
        expectedAdaptations: z
          .string()
          .describe('What improvements to expect this week'),
      })
    )
    .length(4)
    .describe('4-week progression plan'),

  assessmentPoints: z
    .array(
      z.object({
        week: z.number(),
        assessments: z.array(z.string()),
        adjustmentCriteria: z.string(),
      })
    )
    .describe('When and how to assess progress and make adjustments'),

  longTermProgression: z
    .string()
    .max(300)
    .describe('How to continue progressing beyond 4 weeks'),
});

export type ProgressionPlan = z.infer<typeof ProgressionPlanSchema>;

/**
 * Stage 5: Recovery Integration Schema
 * Adds recovery protocols, nutrition guidance, and lifestyle factors
 */
export const RecoveryIntegrationSchema = z.object({
  restDayActivities: z
    .array(
      z.object({
        activity: z.string(),
        duration: z.string(),
        benefits: z.string(),
        instructions: z.string(),
      })
    )
    .min(3)
    .max(6)
    .describe('Active recovery and rest day activities'),

  sleepGuidance: z
    .object({
      recommendedHours: z.string(),
      sleepHygiene: z.array(z.string()),
      recoveryImpact: z.string(),
    })
    .describe('Sleep optimization for recovery'),

  nutritionBasics: z
    .object({
      preWorkout: z.string().describe('Pre-workout nutrition guidance'),
      postWorkout: z.string().describe('Post-workout nutrition guidance'),
      hydration: z.string().describe('Hydration recommendations'),
      generalPrinciples: z.array(z.string()).min(3).max(5),
    })
    .describe('Basic nutrition guidance for workout performance'),

  recoveryProtocols: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        frequency: z.string(),
        equipment: z.array(z.string()).optional(),
      })
    )
    .min(2)
    .max(5)
    .describe('Recovery techniques and protocols'),

  stressManagement: z
    .object({
      techniques: z.array(z.string()),
      integration: z
        .string()
        .describe('How to integrate stress management with fitness routine'),
    })
    .describe('Stress management for better recovery and performance'),
});

export type RecoveryIntegration = z.infer<typeof RecoveryIntegrationSchema>;

/**
 * Complete Workout Program Schema
 * Final output combining all stages
 */
export const CompleteWorkoutProgramSchema = z.object({
  profile: FitnessProfileSchema,
  exercises: ExerciseSelectionSchema,
  structure: WorkoutStructureSchema,
  progression: ProgressionPlanSchema,
  recovery: RecoveryIntegrationSchema,
  summary: z.object({
    programName: z.string(),
    duration: z.string(),
    keyBenefits: z.array(z.string()).min(3).max(5),
    successTips: z.array(z.string()).min(3).max(5),
  }),
});

export type CompleteWorkoutProgram = z.infer<
  typeof CompleteWorkoutProgramSchema
>;
