/**
 * Example: Session-based workflow with initSession()
 * 
 * This example demonstrates the new initSession() function for schema-free
 * session initialization, enabling flexible workflows that mix raw and
 * validated responses while optimizing for cost through context reuse.
 */

import { z } from 'zod';
import { initSession, persuade } from '../src/index.js';

// Define a schema for validated responses
const YogaPoseAnalysisSchema = z.object({
  poseName: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  benefits: z.array(z.string()),
  precautions: z.array(z.string()),
  holdTime: z.number().min(5).max(300), // seconds
});

type YogaPoseAnalysis = z.infer<typeof YogaPoseAnalysisSchema>;

async function sessionBasedWorkflow() {
  console.log('🧘 Session-based Yoga Pose Analysis Workflow\n');

  try {
    // Step 1: Initialize session with context (no schema required)
    console.log('Step 1: Initializing session with yoga instructor context...');
    const { sessionId, response } = await initSession({
      context: 'You are a certified yoga instructor with 10 years of experience specializing in pose analysis and safety guidance.',
      initialPrompt: 'Introduce yourself and explain your teaching philosophy in a friendly, conversational way.'
    });

    console.log('✅ Session created:', sessionId);
    console.log('📝 Introduction:', response);
    console.log();

    // Step 2: Continue with validated calls using the same session
    console.log('Step 2: Analyzing downward-facing dog pose with validation...');
    const dogPoseAnalysis: YogaPoseAnalysis = await persuade({
      schema: YogaPoseAnalysisSchema,
      input: 'Analyze the downward-facing dog yoga pose. Include benefits, precautions, and recommended hold time.',
      sessionId, // Continue same conversation context
    });

    console.log('✅ Validated analysis received:');
    console.log('📋 Pose:', dogPoseAnalysis.poseName);
    console.log('🎯 Difficulty:', dogPoseAnalysis.difficulty);
    console.log('💪 Benefits:', dogPoseAnalysis.benefits.join(', '));
    console.log('⚠️  Precautions:', dogPoseAnalysis.precautions.join(', '));
    console.log('⏱️  Hold time:', dogPoseAnalysis.holdTime, 'seconds');
    console.log();

    // Step 3: Another validated call with complex pose
    console.log('Step 3: Analyzing advanced warrior III pose...');
    const warriorPoseAnalysis = await persuade({
      schema: YogaPoseAnalysisSchema,
      input: 'Analyze the Warrior III (Virabhadrasana III) pose, focusing on balance and alignment.',
      sessionId, // Context from previous conversations maintained
    });

    console.log('✅ Advanced pose analysis:');
    console.log('📋 Pose:', warriorPoseAnalysis.poseName);
    console.log('🎯 Difficulty:', warriorPoseAnalysis.difficulty);
    console.log('💪 Benefits:', warriorPoseAnalysis.benefits.slice(0, 3).join(', '));
    console.log('⚠️  Key precautions:', warriorPoseAnalysis.precautions.slice(0, 2).join(', '));
    console.log();

    // Step 4: Raw follow-up question (no schema)
    console.log('Step 4: Follow-up question with raw response...');
    const { response: followUpResponse } = await initSession({
      context: '', // Context already established in session
      sessionId, // Reuse existing session
      initialPrompt: 'Based on our discussion, what would be a good 15-minute sequence starting with these poses?'
    });

    console.log('✅ Sequence recommendation:');
    console.log('📝', followUpResponse);
    console.log();

    console.log('🎉 Session workflow completed successfully!');
    console.log('💡 Benefits demonstrated:');
    console.log('   • Context reuse across multiple interactions');
    console.log('   • Mix of raw and validated responses');
    console.log('   • Cost optimization through session persistence');
    console.log('   • Flexible workflow without schema constraints');

  } catch (error) {
    console.error('❌ Error in session workflow:', error);
  }
}

// Demonstration of cost-optimized batch processing
async function costOptimizedBatchProcessing() {
  console.log('\n💰 Cost-Optimized Batch Processing Example\n');

  const poses = [
    'Mountain Pose (Tadasana)',
    'Tree Pose (Vrikshasana)', 
    'Child\'s Pose (Balasana)'
  ];

  try {
    // Initialize session once with shared context
    console.log('Initializing shared session for batch processing...');
    const { sessionId } = await initSession({
      context: 'You are a yoga instructor. Analyze poses focusing on beginner-friendly benefits and safety.'
    });

    console.log('✅ Shared session created:', sessionId.substring(0, 8) + '...');
    console.log();

    // Process multiple poses using the same context (saves tokens!)
    for (const pose of poses) {
      console.log(`Analyzing: ${pose}`);
      
      const analysis = await persuade({
        schema: YogaPoseAnalysisSchema,
        input: `Analyze ${pose} for a beginner yoga class.`,
        sessionId // Reuses context, saves tokens
      });

      console.log(`✅ ${analysis.poseName} - ${analysis.difficulty} level`);
      console.log(`   Benefits: ${analysis.benefits.slice(0, 2).join(', ')}`);
      console.log();
    }

    console.log('💡 Cost optimization achieved through context reuse!');

  } catch (error) {
    console.error('❌ Error in batch processing:', error);
  }
}

// Compare atomic vs session-based approaches
async function comparisonDemo() {
  console.log('\n🔄 Atomic vs Session-based Comparison\n');

  try {
    console.log('Atomic approach (each call is independent):');
    const atomicResult = await persuade({
      schema: YogaPoseAnalysisSchema,
      input: 'Analyze tree pose for beginners',
      context: 'You are a certified yoga instructor...' // Context repeated each time
    });
    console.log('✅ Atomic result:', atomicResult.poseName);

    console.log('\nSession-based approach (context reused):');
    const { sessionId } = await initSession({
      context: 'You are a certified yoga instructor...' // Context set once
    });
    
    const sessionResult = await persuade({
      schema: YogaPoseAnalysisSchema,
      input: 'Analyze tree pose for beginners',
      sessionId // No context repetition needed
    });
    console.log('✅ Session result:', sessionResult.poseName);

    console.log('\n💡 Key differences:');
    console.log('   • Atomic: Simple, stateless, higher token cost');
    console.log('   • Session: Context reuse, conversation continuity, cost efficient');

  } catch (error) {
    console.error('❌ Error in comparison demo:', error);
  }
}

// Run the examples
async function main() {
  console.log('🚀 initSession() Function Examples\n');
  console.log('This demonstrates the new schema-free session initialization');
  console.log('capability that enables flexible workflows and cost optimization.\n');
  
  await sessionBasedWorkflow();
  await costOptimizedBatchProcessing();
  await comparisonDemo();
  
  console.log('\n✨ All examples completed!');
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  sessionBasedWorkflow,
  costOptimizedBatchProcessing,
  comparisonDemo
};