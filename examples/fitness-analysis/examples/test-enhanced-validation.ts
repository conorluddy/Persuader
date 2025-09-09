/**
 * Test Enhanced Validation System
 *
 * This script tests the new automatic example generation and enhanced validation
 * features to verify they improve LLM output reliability.
 */

import { runPersuader } from '../../../src/index.js';
import { BASE_CONTEXT } from '../prompts/base-context.js';
import { EXAMPLE_ANALYSIS } from '../prompts/example-output.js';
import { STRENGTH_COACH_LENS } from '../prompts/strength-coach-lens.js';
import { WorkoutProgramAnalysisSchema } from '../schemas/workout-analysis.js';

async function testEnhancedValidation() {
  console.log('🧪 Testing Enhanced Persuader Validation System');
  console.log('='.repeat(60));

  // Simple workout program for testing
  const testProgram = {
    program_name: 'Test 3-Day Program',
    description: 'Simple test program',
    duration_weeks: 4,
    frequency_per_week: 3,
    days: [
      {
        day: 'Monday',
        exercises: [
          { exercise: 'Squats', sets: 3, reps: '8-12' },
          { exercise: 'Push-ups', sets: 3, reps: '10-15' },
        ],
      },
    ],
  };

  console.log('\n📋 Test Program:');
  console.log(JSON.stringify(testProgram, null, 2));

  // Test 1: Auto-generated examples (no exampleOutput provided)
  console.log('\n🔬 TEST 1: Auto-Generated Examples');
  console.log('-'.repeat(40));

  try {
    const result1 = await runPersuader({
      schema: WorkoutProgramAnalysisSchema,
      input: JSON.stringify(testProgram, null, 2),
      context: BASE_CONTEXT,
      lens: STRENGTH_COACH_LENS,
      retries: 2, // Reduced retries for faster testing
    });

    if (result1.ok) {
      console.log('✅ SUCCESS: Auto-generated examples worked!');
      console.log(`⏱️  Time: ${result1.metadata.executionTimeMs}ms`);
      console.log(`🔁 Attempts: ${result1.attempts}`);
      console.log(`📊 Rating: ${result1.value.overall_rating}`);
      console.log(`📈 Score: ${result1.value.effectiveness_score}/10`);
    } else {
      console.log('❌ FAILED: Auto-generated examples');
      console.log(`Error: ${result1.error.message}`);
      console.log(`Attempts: ${result1.attempts}`);
    }
  } catch (error) {
    console.log('💥 ERROR in test 1:', error);
  }

  // Test 2: User-provided concrete examples
  console.log('\n🔬 TEST 2: User-Provided Concrete Example');
  console.log('-'.repeat(40));

  try {
    const result2 = await runPersuader({
      schema: WorkoutProgramAnalysisSchema,
      input: JSON.stringify(testProgram, null, 2),
      context: BASE_CONTEXT,
      lens: STRENGTH_COACH_LENS,
      exampleOutput: EXAMPLE_ANALYSIS, // Use our concrete example
      retries: 2,
    });

    if (result2.ok) {
      console.log('✅ SUCCESS: User-provided example worked!');
      console.log(`⏱️  Time: ${result2.metadata.executionTimeMs}ms`);
      console.log(`🔁 Attempts: ${result2.attempts}`);
      console.log(`📊 Rating: ${result2.value.overall_rating}`);
      console.log(`📈 Score: ${result2.value.effectiveness_score}/10`);
      console.log(`🎯 Strengths: ${result2.value.program_strengths.length}`);
      console.log(`⚠️  Weaknesses: ${result2.value.critical_weaknesses.length}`);
      console.log(
        `🔧 Modifications: ${result2.value.modification_priorities.length}`
      );
    } else {
      console.log('❌ FAILED: User-provided example');
      console.log(`Error: ${result2.error.message}`);
      console.log(`Attempts: ${result2.attempts}`);
    }
  } catch (error) {
    console.log('💥 ERROR in test 2:', error);
  }

  // Test 3: Invalid user example (should fail fast)
  console.log('\n🔬 TEST 3: Invalid User Example (Should Fail Fast)');
  console.log('-'.repeat(40));

  try {
    const invalidExample = {
      overall_rating: 'INVALID_ENUM', // Wrong enum value
      effectiveness_score: 15, // Exceeds max
      // Missing required fields...
    };

    const result3 = await runPersuader({
      schema: WorkoutProgramAnalysisSchema,
      input: JSON.stringify(testProgram, null, 2),
      context: BASE_CONTEXT,
      lens: STRENGTH_COACH_LENS,
      exampleOutput: invalidExample,
      retries: 2,
    });

    if (result3.ok) {
      console.log('❌ UNEXPECTED: Invalid example should have failed');
    } else {
      console.log('✅ SUCCESS: Invalid example failed fast (as expected)');
      console.log(`Error: ${result3.error.message}`);
      console.log(`Attempts: ${result3.attempts} (should be 0)`);
    }
  } catch (error) {
    console.log('💥 ERROR in test 3:', error);
  }

  console.log('\n🎉 Enhanced Validation Testing Complete!');
  console.log('\nKey Improvements:');
  console.log('- Auto-generated examples guide LLM output format');
  console.log('- User examples are pre-validated for schema compliance');
  console.log('- Concrete examples reduce enum/structure validation failures');
  console.log('- Fail-fast validation prevents expensive invalid LLM calls');
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testEnhancedValidation().catch(console.error);
}
