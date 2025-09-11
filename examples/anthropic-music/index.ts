#!/usr/bin/env node --import tsx

/**
 * Anthropic SDK Music Composition Example
 *
 * Demonstrates using Anthropic's language models for sophisticated music composition,
 * showcasing stateless design, creative reasoning, and comprehensive song creation.
 */

import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { createAnthropicAdapter, persuade } from '../../src/index.js';
import {
  ANTHROPIC_MUSIC_INTRO,
  MUSIC_COMPOSER_CONTEXT,
  STATELESS_COMPOSITION_GUIDANCE,
} from './prompts/music-composer.js';
import {
  type SongComposition,
  SongCompositionSchema,
  type SongThemeInput,
} from './schemas/song-schema.js';

async function runAnthropicMusicComposition(): Promise<void> {
  console.log('🎵 Anthropic SDK Music Composition Studio\n');
  console.log(ANTHROPIC_MUSIC_INTRO);
  console.log(`\n${'='.repeat(80)}\n`);

  try {
    // Load song themes for composition
    console.log('🎼 Loading song themes for composition...');
    const themesData = await readFile(
      'examples/anthropic-music/input/song-themes.json',
      'utf-8'
    );
    const themes: SongThemeInput[] = JSON.parse(themesData);
    console.log(`✅ Loaded ${themes.length} song themes for composition`);

    // Display themes overview
    console.log('\n🎭 Song themes to compose:');
    themes.forEach((theme, index) => {
      console.log(`   ${index + 1}. "${theme.theme}"`);
      console.log(`      Genre: ${theme.genre} | Mood: ${theme.mood}`);
      if (theme.keyElements && theme.keyElements.length > 0) {
        console.log(`      Elements: ${theme.keyElements.join(', ')}`);
      }
    });

    // Check if Anthropic API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('\n❌ Anthropic API key not found in environment variables');
      console.log(
        '   Please copy .env.example to .env and add your Anthropic API key'
      );
      console.log('   Get your API key from: https://console.anthropic.com/');
      console.log('   Set ANTHROPIC_API_KEY in your .env file');
      return;
    }

    // Create Anthropic adapter
    console.log('\n🔧 Initializing Anthropic SDK adapter...');
    const anthropicProvider = createAnthropicAdapter({
      defaultModel: 'claude-3-5-sonnet-20241022', // Latest model for creative tasks
      maxTokens: 4000, // Generous tokens for detailed compositions
    });

    console.log('✅ Anthropic adapter created');

    // Test health check
    console.log('🏥 Checking Anthropic API health...');
    const health = await anthropicProvider.getHealth();

    if (!health.healthy) {
      console.log('❌ Anthropic API not available');
      console.log(`   Error: ${health.error}\n`);
      console.log('🛠️  Troubleshooting:');
      console.log('   1. Verify your API key is correct');
      console.log('   2. Check your Anthropic account has sufficient credits');
      console.log('   3. Ensure you have access to the specified model');
      return;
    }

    console.log('✅ Anthropic API healthy');
    console.log(`   Response time: ${health.responseTimeMs}ms`);
    console.log(`   Default model: ${health.details.defaultModel}`);

    // Compose songs (stateless approach)
    console.log('\n🎵 Starting music composition process...');
    console.log(
      '   Using stateless design for independent creative projects\n'
    );

    const compositionContext = `${MUSIC_COMPOSER_CONTEXT}\n\n${STATELESS_COMPOSITION_GUIDANCE}`;
    const compositions: Array<{
      themeNumber: number;
      theme: SongThemeInput;
      compositionTime: number;
      composition: SongComposition;
    }> = [];

    // Compose each song independently (showcasing stateless design)
    for (let i = 0; i < themes.length; i++) {
      const theme = themes[i];
      const themeNumber = i + 1;

      console.log(`🎼 Composing Song ${themeNumber}/${themes.length}:`);
      console.log(`   Theme: "${theme.theme}"`);
      console.log(`   Genre: ${theme.genre} | Mood: ${theme.mood}`);

      const startTime = Date.now();

      try {
        const result = await persuade(
          {
            schema: SongCompositionSchema,
            input: {
              theme,
              compositionRequest:
                'Create a complete, professional-quality song composition based on this theme',
            },
            context: compositionContext,
            // Note: No sessionId - demonstrating stateless approach
            retries: 2,
            maxTokens: 4000,
            temperature: 0.8, // Higher temperature for creative output
          },
          anthropicProvider
        );

        const duration = Date.now() - startTime;

        if (result.ok) {
          const composition = result.value;

          console.log(`   ✅ Composition completed (${duration}ms)`);
          console.log(`   🎵 Song: "${composition.metadata.title}"`);
          console.log(
            `   🎸 Key: ${composition.metadata.key} | Duration: ${composition.metadata.estimatedDuration}`
          );
          console.log(
            `   🎭 Genre: ${composition.metadata.genre} | Difficulty: ${composition.metadata.difficulty}`
          );
          console.log(
            `   📝 Sections: ${composition.structure.sections.length} | Instruments: ${composition.instrumentation.lead.concat(composition.instrumentation.rhythm).length}`
          );

          compositions.push({
            themeNumber,
            theme,
            compositionTime: duration,
            composition,
          });
        } else {
          console.log(`   ❌ Composition failed: ${result.error?.message}`);
          console.log(
            `   🔄 This might be due to theme complexity or API limits`
          );
        }
      } catch (error) {
        console.log(
          `   💥 Unexpected error: ${error instanceof Error ? error.message : error}`
        );
        console.log(
          `   💡 Try: Check API quotas, simplify theme, or verify model access`
        );
      }

      if (i < themes.length - 1) {
        console.log(); // Add spacing between compositions
      }
    }

    // Generate album/collection summary
    if (compositions.length > 0) {
      console.log(`\n🎼 Generating collection summary...`);

      // Calculate summary statistics
      const genres = compositions.map(c => c.composition.metadata.genre);
      const mostCommonGenre =
        genres
          .sort(
            (a, b) =>
              genres.filter(v => v === a).length -
              genres.filter(v => v === b).length
          )
          .pop() || 'Various';

      const allInstruments = compositions.flatMap(c => [
        ...c.composition.instrumentation.lead,
        ...c.composition.instrumentation.rhythm,
      ]);
      const instrumentCounts = allInstruments.reduce(
        (acc, instrument) => {
          acc[instrument] = (acc[instrument] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      const commonInstruments = Object.entries(instrumentCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([instrument]) => instrument);

      const difficulties = compositions.map(
        c => c.composition.metadata.difficulty
      );
      const mostCommonDifficulty =
        difficulties
          .sort(
            (a, b) =>
              difficulties.filter(v => v === a).length -
              difficulties.filter(v => v === b).length
          )
          .pop() || 'intermediate';

      // Create batch composition result
      const batchComposition = {
        totalSongs: compositions.length,
        compositionDate: new Date().toISOString(),
        albumConcept: `A diverse collection of ${compositions.length} original compositions showcasing various moods and genres, created through AI-assisted songwriting with Anthropic's advanced language models.`,
        songs: compositions.map(c => ({
          themeInput: c.theme,
          composition: c.composition,
        })),
        collectionNotes: `This collection demonstrates the versatility of AI-assisted music composition across genres including ${mostCommonGenre} and others. Common instrumentation includes ${commonInstruments.slice(0, 3).join(', ')}, with compositions generally at ${mostCommonDifficulty} difficulty level.`,
      };

      // Save detailed results
      console.log('💾 Saving composition results...');

      const outputData = {
        metadata: {
          provider: 'anthropic',
          model: health.details.defaultModel,
          totalCompositions: compositions.length,
          composedAt: new Date().toISOString(),
          totalCompositionTime: compositions.reduce(
            (sum, c) => sum + c.compositionTime,
            0
          ),
          statelessDesign: true,
        },
        batchComposition,
        individualCompositions: compositions,
      };

      await writeFile(
        'examples/anthropic-music/output/compositions.json',
        JSON.stringify(outputData, null, 2)
      );

      console.log('✅ Composition results saved successfully!');
      console.log('\n🎯 Composition Summary:');
      console.log(
        `   🎵 Songs composed: ${compositions.length}/${themes.length}`
      );
      console.log(`   🎸 Most common genre: ${mostCommonGenre}`);
      console.log(
        `   🎹 Common instruments: ${commonInstruments.slice(0, 3).join(', ')}`
      );
      console.log(`   📈 Typical difficulty: ${mostCommonDifficulty}`);
      console.log(
        `   ⏱️  Average composition time: ${Math.round(compositions.reduce((sum, c) => sum + c.compositionTime, 0) / compositions.length)}ms`
      );

      console.log('\n🎉 Music composition complete!');
      console.log(`   🤖 Powered by Anthropic's advanced creative reasoning`);
      console.log(
        `   🎼 Stateless design enabling independent artistic projects`
      );
      console.log(
        `   🎭 Professional-quality compositions with full arrangements`
      );
      console.log(
        `   📖 Check examples/anthropic-music/output/compositions.json for complete songs`
      );

      // Display one example composition summary
      if (compositions.length > 0) {
        const example = compositions[0].composition;
        console.log(`\n🌟 Example: "${example.metadata.title}"`);
        console.log(`   ${example.inspiration.substring(0, 100)}...`);
        console.log(`   Structure: ${example.structure.sections.join(' → ')}`);
        console.log(
          `   Key elements: ${example.instrumentation.lead.join(', ')}`
        );
      }
    } else {
      console.log('\n⚠️  No songs were successfully composed');
      console.log(
        '   💡 Try: Verify API access, check theme complexity, or reduce theme count'
      );
    }
  } catch (error) {
    console.log(
      '\n💥 Demo failed with error:',
      error instanceof Error ? error.message : error
    );
    console.log('\n🛠️  Troubleshooting:');
    console.log('   1. Verify ANTHROPIC_API_KEY is set correctly');
    console.log('   2. Check Anthropic account has sufficient credits');
    console.log('   3. Ensure access to Claude 3.5 Sonnet model');
    console.log('   4. Try simpler themes if compositions are too complex');
    console.log('   5. Verify network connectivity to Anthropic API');
  }
}

// Execute the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runAnthropicMusicComposition().catch(console.error);
}
