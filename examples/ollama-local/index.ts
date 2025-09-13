#!/usr/bin/env node --import tsx

/**
 * Ollama Local LLM Creative Writing Example
 *
 * Demonstrates using Ollama for private, local creative writing with session management.
 * Perfect for exploring creative ideas without sending data to external servers.
 */

import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import type { z } from 'zod/v4';
import { createOllamaAdapter, persuade } from '../../src/index.js';
import {
  CREATIVE_WRITER_CONTEXT,
  PRIVACY_FOCUSED_INTRO,
  SESSION_WRITING_CONTEXT,
} from './prompts/creative-writer.js';
import { type StoryPrompt, StorySchema } from './schemas/story-schema.js';

// Sample creative writing prompts
const CREATIVE_PROMPTS: StoryPrompt[] = [
  {
    prompt:
      'A person discovers an old letter in a used book that changes everything',
    preferredGenre: 'literary fiction',
    targetLength: 'medium',
    mood: 'mysterious and hopeful',
  },
  {
    prompt:
      'In a world where colors have been drained away, someone finds the last rainbow',
    preferredGenre: 'fantasy',
    targetLength: 'medium',
    mood: 'magical and uplifting',
  },
  {
    prompt:
      'A time traveler gets stuck in the wrong decade and must adapt to survive',
    preferredGenre: 'sci-fi',
    targetLength: 'short',
    mood: 'adventurous with humor',
  },
];

async function runOllamaCreativeWriting(): Promise<void> {
  console.log('🎨 Ollama Local LLM Creative Writing Demo\n');
  console.log(PRIVACY_FOCUSED_INTRO);
  console.log(`\n${'='.repeat(80)}\n`);

  try {
    // Create Ollama adapter
    console.log('🔧 Initializing Ollama adapter...');
    const ollamaProvider = createOllamaAdapter({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.2', // Default model - will auto-discover available models
      timeout: 60000, // 60 second timeout for creative generation
    });

    console.log('✅ Ollama adapter created');

    // Check if Ollama is running and available
    console.log('🏥 Checking Ollama service health...');
    const health = await ollamaProvider.getHealth();

    if (!health.healthy) {
      console.log('❌ Ollama service not available');
      console.log(`   Error: ${health.error}\n`);
      console.log('📋 To set up Ollama:');
      console.log('   1. Install Ollama: https://ollama.ai/download');
      console.log('   2. Start Ollama service: ollama serve');
      console.log('   3. Pull a model: ollama pull llama3.2');
      console.log('   4. Run this example again');
      return;
    }

    console.log('✅ Ollama service healthy');
    console.log(`   Response time: ${health.responseTimeMs}ms`);
    console.log(`   Base URL: ${health.details.baseUrl}`);
    console.log(`   Default model: ${health.details.defaultModel}`);
    console.log(`   Available models: ${health.details.availableModels}`);

    // Test available models
    console.log('\n🔍 Discovering available models...');
    const availability = await ollamaProvider.isAvailable();
    if (availability) {
      console.log('✅ Model discovery successful');
    } else {
      console.log('⚠️  Model discovery failed - using default model');
    }

    // Start creative writing session
    console.log('\n📝 Starting creative writing session...');
    console.log('   Using session for narrative continuity across stories\n');

    const sessionContext = `${CREATIVE_WRITER_CONTEXT}\n\n${SESSION_WRITING_CONTEXT}`;
    let sessionId: string | undefined;
    const generatedStories: Array<{
      promptNumber: number;
      prompt: string;
      generationTime: number;
      sessionId?: string;
      story: z.infer<typeof StorySchema>;
    }> = [];

    // Generate stories using session for continuity
    for (let i = 0; i < CREATIVE_PROMPTS.length; i++) {
      const prompt = CREATIVE_PROMPTS[i];
      const storyNumber = i + 1;

      console.log(
        `🎯 Writing Story ${storyNumber}/${CREATIVE_PROMPTS.length}:`
      );
      console.log(`   Prompt: "${prompt.prompt}"`);
      console.log(`   Genre: ${prompt.preferredGenre || 'open'}`);
      console.log(`   Mood: ${prompt.mood || "writer's choice"}`);

      const startTime = Date.now();

      try {
        const result = await persuade(
          {
            schema: StorySchema,
            input: prompt,
            context: sessionContext,
            sessionId,
            retries: 2,
            maxTokens: 2000, // Allow for longer creative outputs
            temperature: 0.8, // Higher creativity
          },
          ollamaProvider
        );

        const duration = Date.now() - startTime;

        if (result.ok) {
          sessionId = result.sessionId; // Maintain session continuity
          const story = result.value;

          console.log(`   ✅ Story generated (${duration}ms)`);
          console.log(`   📖 Title: "${story.title}"`);
          console.log(`   📊 ${story.wordCount} words, ${story.genre} genre`);
          console.log(`   🎭 Characters: ${story.characters.length}`);
          console.log(
            `   🎨 Style: ${story.writingStyle.tone}, ${story.writingStyle.perspective}`
          );

          // Add metadata for output
          generatedStories.push({
            promptNumber: storyNumber,
            prompt: prompt.prompt,
            generationTime: duration,
            sessionId: result.sessionId,
            story,
          });
        } else {
          console.log(
            `   ❌ Story generation failed: ${result.error?.message}`
          );
          console.log(
            `   🔄 This might be due to model limitations or timeout`
          );
        }
      } catch (error) {
        console.log(
          `   💥 Unexpected error: ${error instanceof Error ? error.message : error}`
        );
        console.log(
          `   💡 Try: Check Ollama service, verify model availability, or reduce complexity`
        );
      }

      if (i < CREATIVE_PROMPTS.length - 1) {
        console.log(); // Add spacing between stories
      }
    }

    // Save results
    if (generatedStories.length > 0) {
      console.log(
        `\n💾 Saving ${generatedStories.length} stories to output/stories.json...`
      );

      const outputData = {
        metadata: {
          provider: 'ollama',
          model: health.details.defaultModel,
          baseUrl: health.details.baseUrl,
          sessionId,
          totalStories: generatedStories.length,
          generatedAt: new Date().toISOString(),
          totalGenerationTime: generatedStories.reduce(
            (sum, s) => sum + s.generationTime,
            0
          ),
        },
        stories: generatedStories,
      };

      await writeFile(
        'examples/ollama-local/output/stories.json',
        JSON.stringify(outputData, null, 2)
      );

      console.log('✅ Stories saved successfully!');
      console.log('\n🎉 Creative writing session complete!');
      console.log(`   📚 Generated ${generatedStories.length} unique stories`);
      console.log(`   🔒 All data remained on your local machine`);
      console.log(`   💰 Zero API costs incurred`);
      console.log(
        `   📖 Check examples/ollama-local/output/stories.json for full stories`
      );
    } else {
      console.log('\n⚠️  No stories were successfully generated');
      console.log('   💡 Try: Ensure Ollama is running with a suitable model');
    }
  } catch (error) {
    console.log(
      '\n💥 Demo failed with error:',
      error instanceof Error ? error.message : error
    );
    console.log('\n🛠️  Troubleshooting:');
    console.log('   1. Ensure Ollama is installed and running (ollama serve)');
    console.log(
      '   2. Verify you have a model installed (ollama pull llama3.2)'
    );
    console.log('   3. Check Ollama is accessible at http://localhost:11434');
    console.log('   4. Try a different model if the current one has issues');
  }
}

// Execute the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runOllamaCreativeWriting().catch(console.error);
}
