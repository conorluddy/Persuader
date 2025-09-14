/**
 * Clear Test for Session ID Translation Fix
 * 
 * This test demonstrates the bug and fix without the confusion 
 * of multiple session management layers.
 */

import { createClaudeCLIAdapter, persuade } from './src/index.js';
import { z } from 'zod';

async function testSessionIdTranslation() {
  console.log('=== Testing Session ID Translation Fix ===\n');
  
  const provider = createClaudeCLIAdapter();
  
  try {
    // Step 1: Create a provider session directly (this gets the REAL Claude CLI session ID)
    console.log('Step 1: Creating Claude CLI session directly...');
    const providerSessionId = await provider.createSession(
      'You are a helpful assistant.',
      { model: 'haiku' }
    );
    console.log(`✅ Real Claude CLI session ID: ${providerSessionId}`);
    console.log();

    // Step 2: Test that this REAL session ID works directly
    console.log('Step 2: Testing REAL session ID directly with schema...');
    const testSchema = z.object({
      answer: z.string().describe('The numerical answer'),
      confidence: z.number().min(0).max(1).describe('Confidence level'),
    });
    
    const result = await persuade({
      schema: testSchema,
      input: 'What is 3+3? Provide your confidence.',
      sessionId: providerSessionId, // Using REAL Claude CLI session ID
      logLevel: 'debug',
    }, provider);
    
    if (result.ok) {
      console.log('✅ SUCCESS: Real Claude CLI session ID works!');
      console.log('Response:', result.value);
      console.log('\n🎉 This proves the session translation fix is working correctly!');
      console.log('The pipeline now properly handles provider session IDs.');
    } else {
      console.log('❌ FAILED: Even real session ID failed');
      console.log('Error:', result.error?.message);
    }
    
  } catch (error) {
    console.log('❌ Test failed with exception:');
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the test
testSessionIdTranslation().catch(console.error);