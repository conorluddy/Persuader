#!/usr/bin/env node --import tsx

/**
 * Simple OpenAI Provider Test
 *
 * Tests the new OpenAI provider integration with session support
 */

import { z } from 'zod';
import { createOpenAIAdapter, persuade } from '../../src/index.js';

// Simple schema for testing
const TestResponseSchema = z.object({
  message: z.string().describe('A simple response message'),
  timestamp: z.string().describe('Current timestamp in ISO format'),
});

// type TestResponse = z.infer<typeof TestResponseSchema>;

async function testOpenAIProvider(): Promise<void> {
  console.log('🤖 Testing OpenAI Provider Integration\n');

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not found in environment variables');
    console.log('   Please set your OpenAI API key and try again');
    process.exit(1);
  }

  try {
    // Create OpenAI adapter
    const openaiProvider = createOpenAIAdapter({
      defaultModel: 'gpt-4o-mini', // Use the cheaper model for testing
    });

    console.log('✅ OpenAI adapter created successfully');

    // Test health check
    console.log('🏥 Checking provider health...');
    const health = await openaiProvider.getHealth();
    console.log(
      `   Health status: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`
    );
    console.log(`   Response time: ${health.responseTimeMs}ms`);

    if (!health.healthy) {
      console.log(`   Error: ${health.error}`);
      return;
    }

    // Test basic persuade call (without session)
    console.log('\n🔄 Testing basic persuade call (stateless)...');
    const result1 = await persuade(
      {
        schema: TestResponseSchema,
        input: { request: 'Say hello and include current timestamp' },
        context:
          'You are a helpful assistant. Always include a timestamp in ISO format.',
        retries: 2,
      },
      openaiProvider
    );

    if (result1.ok) {
      console.log('✅ Stateless call successful:');
      console.log(`   Message: ${result1.value.message}`);
      console.log(`   Timestamp: ${result1.value.timestamp}`);
    } else {
      console.log('❌ Stateless call failed:', result1.error?.message);
    }

    // Test session-based calls
    console.log('\n🔗 Testing session-based calls...');

    // First call creates session
    const result2 = await persuade(
      {
        schema: TestResponseSchema,
        input: { request: 'Say hello and remember my name is Alice' },
        context:
          'You are a helpful assistant. Remember user names and use them in future responses.',
        retries: 2,
      },
      openaiProvider
    );

    if (result2.ok) {
      console.log('✅ Session call 1 successful:');
      console.log(`   Message: ${result2.value.message}`);
      console.log(`   Session ID: ${result2.sessionId}`);

      // Second call reuses session
      const result3 = await persuade(
        {
          schema: TestResponseSchema,
          input: { request: 'What is my name? Include timestamp.' },
          context: 'Short response please.',
          sessionId: result2.sessionId,
          retries: 2,
        },
        openaiProvider
      );

      if (result3.ok) {
        console.log('✅ Session call 2 successful:');
        console.log(`   Message: ${result3.value.message}`);
        console.log(`   Session ID: ${result3.sessionId}`);
        console.log(
          '   🎉 Session continuity working - OpenAI remembered the name!'
        );
      } else {
        console.log('❌ Session call 2 failed:', result3.error?.message);
      }
    } else {
      console.log('❌ Session call 1 failed:', result2.error?.message);
    }
  } catch (error) {
    console.log(
      '💥 Test failed with error:',
      error instanceof Error ? error.message : error
    );
  }
}

// Execute the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testOpenAIProvider().catch(console.error);
}
