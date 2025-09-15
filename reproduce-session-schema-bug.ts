/**
 * Reproduction Script for Issue #33: Session ID Lookup Fails with Schema
 * 
 * This script reproduces the exact bug described in GitHub issue #33
 * where sessions work without schema but fail with schema parameter.
 */

import { 
  createSessionManager, 
  createClaudeCLIAdapter, 
  createProviderSessionManager,
  persuade 
} from './src/index.js';
import { z } from 'zod';

async function reproduceSessionBug() {
  console.log('=== Reproducing Session Schema Bug (Issue #33) ===\n');
  
  const sessionManager = createSessionManager();
  const provider = createClaudeCLIAdapter();
  const providerSessionManager = createProviderSessionManager(sessionManager, provider);
  
  try {
    // Step 1: Create session using ProviderSessionManager (which calls the provider)
    console.log('Step 1: Creating session with provider integration...');
    const sessionResult = await providerSessionManager.ensureSession(
      'You are a helpful assistant that provides accurate answers.',
      undefined, // No existing session ID
      { model: 'haiku' }
    );
    console.log(`✅ Session created: ${sessionResult.sessionId}`);
    
    // Verify the session has the provider session ID  
    const providerSessionId = await providerSessionManager.getProviderSessionId(sessionResult.sessionId);
    console.log(`✅ Provider session ID: ${providerSessionId}`);
    console.log();
    
    // Step 2: Use WITHOUT schema - Should WORK (Note: schema is now required in v0.4+)
    console.log('Step 2: Testing session WITHOUT schema (will be skipped as schema is required)...');
    console.log('⚠️ Skipping test without schema as it\'s now required in current API version');
    
    /*
    const resultWithoutSchema = await persuade({
      input: 'What is 2+2?',
      sessionId: session.id,
    }, provider);
    
    if (resultWithoutSchema.ok) {
      console.log('✅ Without schema: SUCCESS');
      console.log(`Response: ${resultWithoutSchema.value}`);
    } else {
      console.log('❌ Without schema: FAILED unexpectedly');
      console.log(`Error: ${resultWithoutSchema.error?.message}`);
    }
    */
    console.log();
    
    // Step 3: Use WITH schema - Expected to FAIL in v0.3.0  
    console.log('Step 3: Testing session WITH schema...');
    console.log(`Using SessionManager ID: ${sessionResult.sessionId}`);
    
    // Check that the session has proper provider data
    const retrievedSession = await sessionManager.getSession(sessionResult.sessionId);
    if (retrievedSession) {
      console.log(`Session found in SessionManager:`);
      console.log(`- Provider: ${retrievedSession.metadata.provider}`);
      console.log(`- Has providerData: ${Boolean(retrievedSession.providerData)}`);
      console.log(`- providerSessionId: ${retrievedSession.providerData?.providerSessionId || 'NOT FOUND'}`);
    } else {
      console.log('❌ Session not found in SessionManager!');
    }
    console.log();
    
    const testSchema = z.object({
      answer: z.string().describe('The numerical answer'),
      confidence: z.number().min(0).max(1).describe('Confidence level between 0 and 1'),
    });
    
    try {
      const resultWithSchema = await persuade({
        schema: testSchema,  // ← Adding this breaks session lookup
        input: 'What is 3+3? Provide your confidence in the answer.',
        sessionId: sessionResult.sessionId,
        logLevel: 'debug', // Enable debug logging to see session translation
      }, provider);
      
      if (resultWithSchema.ok) {
        console.log('✅ With schema: SUCCESS (Bug is fixed!)');
        console.log(`Response:`, resultWithSchema.value);
      } else {
        console.log('❌ With schema: FAILED as expected in v0.3.0');
        console.log(`Error: ${resultWithSchema.error?.message}`);
        console.log(`Error Type: ${resultWithSchema.error?.type}`);
        console.log(`Error Code: ${resultWithSchema.error?.code}`);
      }
    } catch (error) {
      console.log('❌ With schema: FAILED with exception');
      console.log(`Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Check if it's the specific session ID lookup error
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('No conversation found with session ID')) {
        console.log('🎯 CONFIRMED: This is the exact bug described in issue #33');
      }
    }
    
  } catch (error) {
    console.log('❌ Failed during setup:');
    console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  console.log('\n=== Reproduction Complete ===');
}

// Run the reproduction
reproduceSessionBug().catch(console.error);