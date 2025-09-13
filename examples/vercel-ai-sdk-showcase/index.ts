#!/usr/bin/env node --import tsx

/**
 * Vercel AI SDK Multi-Provider Showcase
 *
 * Demonstrates the unique capabilities of the Vercel AI SDK provider:
 * - Multi-provider support (OpenAI, Anthropic, Google, etc.)
 * - Native Zod schema validation
 * - Session management across different models
 * - Provider switching and comparison
 * - Advanced error handling with detailed feedback
 */

import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { createVercelAISDKAdapter, persuade } from '../../src/index.js';
import {
  BUSINESS_ANALYST_CONTEXT,
  MULTI_PROVIDER_INTRO,
  PROVIDER_PERSONALITIES,
} from './prompts/business-analyst.js';
import {
  type BusinessStrategy,
  BusinessStrategySchema,
  CompetitiveComparisonSchema,
  type ProductAnalysis,
  ProductAnalysisSchema,
  type ProductInput,
} from './schemas/business-analysis.js';

// Sample product data for analysis
const SAMPLE_PRODUCTS: ProductInput[] = [
  {
    name: 'EcoClean Pro',
    category: 'Cleaning Supplies',
    description:
      'Biodegradable all-purpose cleaner made from plant-based ingredients',
    targetMarket: 'Environmentally conscious households',
    pricePoint: 'premium',
    keyFeatures: [
      '100% biodegradable',
      'Non-toxic',
      'Concentrated formula',
      'Refillable packaging',
    ],
  },
  {
    name: 'CodeMentor AI',
    category: 'SaaS/EdTech',
    description:
      'AI-powered coding tutor that provides personalized programming lessons',
    targetMarket: 'Students and junior developers',
    pricePoint: 'mid-range',
    keyFeatures: [
      'Personalized learning paths',
      'Real-time code feedback',
      'Multi-language support',
      'Progress tracking',
    ],
  },
];

async function runVercelAISDKShowcase(): Promise<void> {
  console.log('🚀 Vercel AI SDK Multi-Provider Showcase\n');
  console.log(MULTI_PROVIDER_INTRO);
  console.log(`\n${'='.repeat(80)}\n`);

  try {
    // Check environment variables
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
    ];

    const missingKeys = requiredEnvVars.filter(key => !process.env[key]);
    if (missingKeys.length > 0) {
      console.log('⚠️  Some API keys are missing from environment variables:');
      for (const key of missingKeys) {
        console.log(`   ❌ ${key}`);
      }
      console.log('\n   💡 This demo will skip providers with missing keys');
      console.log(
        '   📝 Copy .env.example to .env and add your API keys for full experience'
      );
    }

    // Configure multiple providers with different personalities
    const providers = [];

    if (process.env.OPENAI_API_KEY) {
      providers.push({
        name: 'OpenAI GPT-4',
        adapter: createVercelAISDKAdapter({
          model: openai('gpt-4-turbo'),
          modelId: 'gpt-4-turbo',
          temperature: 0.7,
          systemPrompt: PROVIDER_PERSONALITIES.openai,
        }),
        specialty: 'Technical and analytical perspective',
        color: '🟦',
      });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      providers.push({
        name: 'Claude 3.5 Sonnet',
        adapter: createVercelAISDKAdapter({
          model: anthropic('claude-3-5-sonnet-20241022'),
          modelId: 'claude-3-5-sonnet',
          temperature: 0.8,
          systemPrompt: PROVIDER_PERSONALITIES.anthropic,
        }),
        specialty: 'Strategic thinking and ethical considerations',
        color: '🟧',
      });
    }

    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      providers.push({
        name: 'Gemini Pro',
        adapter: createVercelAISDKAdapter({
          model: google('gemini-pro'),
          modelId: 'gemini-pro',
          temperature: 0.6,
          systemPrompt: PROVIDER_PERSONALITIES.google,
        }),
        specialty: 'Data-driven insights and innovation',
        color: '🟨',
      });
    }

    if (providers.length === 0) {
      console.log(
        '❌ No API keys configured. Please set up at least one provider.'
      );
      console.log(
        '   Required: OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY'
      );
      return;
    }

    console.log(`🎯 Configured ${providers.length} AI providers:`);
    providers.forEach(p => {
      console.log(`   ${p.color} ${p.name} - ${p.specialty}`);
    });

    // Health check all providers
    console.log('\n🏥 Running health checks...');
    for (const provider of providers) {
      const health = await provider.adapter.getHealth();
      const status = health.healthy ? '✅' : '❌';
      console.log(`   ${status} ${provider.name}: ${health.responseTimeMs}ms`);
      if (!health.healthy) {
        console.log(`      Error: ${health.error}`);
      }
    }

    // Demonstrate multi-provider analysis
    console.log('\n📊 Starting multi-provider business analysis...');
    console.log(
      '   🔄 Each product will be analyzed by all available providers'
    );
    console.log('   📈 Showcasing different perspectives and expertise\n');

    const allAnalyses: Array<{
      product: ProductInput;
      providerResults: Array<{
        providerName: string;
        analysis?: ProductAnalysis;
        error?: string;
        processingTime: number;
      }>;
    }> = [];

    // Analyze each product with all providers
    for (
      let productIndex = 0;
      productIndex < SAMPLE_PRODUCTS.length;
      productIndex++
    ) {
      const product = SAMPLE_PRODUCTS[productIndex];
      console.log(
        `🎯 Product ${productIndex + 1}/${SAMPLE_PRODUCTS.length}: "${product.name}"`
      );
      console.log(
        `   📱 ${product.category} | 💰 ${product.pricePoint} pricing`
      );
      console.log(`   🎯 Target: ${product.targetMarket}`);

      const productResults = {
        product,
        providerResults: [] as Array<{
          provider: string;
          analysis: ProductAnalysis | BusinessStrategy;
          error?: string;
        }>,
      };

      // Create sessions for each provider to maintain context
      const sessions = new Map<string, string>();
      for (const provider of providers) {
        try {
          const sessionId = await provider.adapter.createSession(
            BUSINESS_ANALYST_CONTEXT,
            { temperature: 0.7 }
          );
          sessions.set(provider.name, sessionId);
        } catch {
          console.log(`   ⚠️  Failed to create session for ${provider.name}`);
        }
      }

      // Analyze with each provider
      for (const provider of providers) {
        console.log(
          `\n   ${provider.color} Analyzing with ${provider.name}...`
        );
        const startTime = Date.now();

        try {
          const sessionId = sessions.get(provider.name);
          const result = await persuade(
            {
              schema: ProductAnalysisSchema,
              input: {
                product,
                analysisRequest: `Provide a comprehensive business analysis for this product, highlighting unique opportunities and potential challenges.`,
              },
              context: `${BUSINESS_ANALYST_CONTEXT}\n\nProvider Context: ${provider.specialty}`,
              sessionId,
              retries: 2,
              maxTokens: 3000,
              temperature: 0.7,
            },
            provider.adapter
          );

          const processingTime = Date.now() - startTime;

          if (result.ok) {
            const analysis = result.value;
            console.log(`      ✅ Analysis completed (${processingTime}ms)`);
            console.log(
              `      📊 Market Score: ${analysis.marketAnalysis.marketScore}/10`
            );
            console.log(
              `      🎯 Opportunities: ${analysis.opportunities.length}`
            );
            console.log(`      ⚠️  Risks: ${analysis.risks.length}`);

            productResults.providerResults.push({
              providerName: provider.name,
              analysis,
              processingTime,
            });
          } else {
            console.log(`      ❌ Analysis failed: ${result.error?.message}`);
            productResults.providerResults.push({
              providerName: provider.name,
              error: result.error?.message || 'Unknown error',
              processingTime,
            });
          }
        } catch (error) {
          const processingTime = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(`      💥 Unexpected error: ${errorMessage}`);
          productResults.providerResults.push({
            providerName: provider.name,
            error: errorMessage,
            processingTime,
          });
        }

        // Brief pause between providers
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      allAnalyses.push(productResults);

      // Clean up sessions
      for (const [providerName, sessionId] of sessions) {
        const provider = providers.find(p => p.name === providerName);
        if (provider) {
          try {
            await provider.adapter.destroySession(sessionId);
          } catch {
            console.log(`   ⚠️  Failed to destroy session for ${providerName}`);
          }
        }
      }
    }

    // Demonstrate competitive comparison across providers
    console.log('\n🔍 Generating competitive comparison analysis...');
    console.log('   📈 Comparing insights from different AI providers\n');

    const competitiveAnalyses = [];
    const primaryProvider = providers[0]; // Use first available provider

    for (let i = 0; i < allAnalyses.length; i++) {
      const productAnalysis = allAnalyses[i];

      if (productAnalysis.providerResults.some(r => r.analysis)) {
        console.log(
          `🎯 Competitive analysis for "${productAnalysis.product.name}"...`
        );

        const startTime = Date.now();
        const sessionId = await primaryProvider.adapter.createSession(
          `${BUSINESS_ANALYST_CONTEXT}\n\nYou are tasked with synthesizing multiple AI perspectives into a comprehensive competitive analysis.`,
          { temperature: 0.6 }
        );

        try {
          const competitiveResult = await persuade(
            {
              schema: CompetitiveComparisonSchema,
              input: {
                product: productAnalysis.product,
                multiProviderInsights: productAnalysis.providerResults
                  .filter(r => r.analysis)
                  .map(r => ({
                    provider: r.providerName,
                    analysis: r.analysis,
                  })),
              },
              sessionId,
              retries: 2,
              maxTokens: 2500,
              temperature: 0.6,
            },
            primaryProvider.adapter
          );

          const processingTime = Date.now() - startTime;

          if (competitiveResult.ok) {
            const competitive = competitiveResult.value;
            console.log(
              `   ✅ Competitive analysis completed (${processingTime}ms)`
            );
            console.log(
              `   🏆 Competitive Score: ${competitive.competitiveScore}/10`
            );
            console.log(
              `   🎯 Key Differentiators: ${competitive.keyDifferentiators.length}`
            );
            console.log(`   📊 Market Position: ${competitive.marketPosition}`);

            competitiveAnalyses.push({
              product: productAnalysis.product,
              competitive,
              processingTime,
            });
          } else {
            console.log(
              `   ❌ Competitive analysis failed: ${competitiveResult.error?.message}`
            );
          }
        } finally {
          await primaryProvider.adapter.destroySession(sessionId);
        }
      }
    }

    // Generate final business strategy synthesis
    console.log('\n🎯 Synthesizing final business strategy...');
    console.log(
      '   🧠 Leveraging multi-provider insights for strategic recommendations\n'
    );

    const strategyStartTime = Date.now();
    const strategySessionId = await primaryProvider.adapter.createSession(
      `${BUSINESS_ANALYST_CONTEXT}\n\nYou are the lead strategic advisor synthesizing insights from multiple AI perspectives and competitive analyses to provide actionable business strategies.`,
      { temperature: 0.7 }
    );

    let finalStrategy: BusinessStrategy | null = null;
    try {
      const strategyResult = await persuade(
        {
          schema: BusinessStrategySchema,
          input: {
            allAnalyses,
            competitiveAnalyses,
            marketContext:
              'Current competitive landscape with emphasis on AI-driven insights',
          },
          sessionId: strategySessionId,
          retries: 3,
          maxTokens: 4000,
          temperature: 0.7,
        },
        primaryProvider.adapter
      );

      const strategyProcessingTime = Date.now() - strategyStartTime;

      if (strategyResult.ok) {
        finalStrategy = strategyResult.value;
        console.log(
          `✅ Business strategy synthesis completed (${strategyProcessingTime}ms)`
        );
        console.log(
          `🎯 Strategic Recommendations: ${finalStrategy.strategicRecommendations.length}`
        );
        console.log(
          `📈 Implementation Timeline: ${finalStrategy.implementationTimeline.phases.length} phases`
        );
        console.log(
          `💰 Investment Level: ${finalStrategy.investmentRequirements.totalBudgetRange}`
        );
      } else {
        console.log(
          `❌ Strategy synthesis failed: ${strategyResult.error?.message}`
        );
      }
    } finally {
      await primaryProvider.adapter.destroySession(strategySessionId);
    }

    // Save comprehensive results
    console.log('\n💾 Saving comprehensive analysis results...');

    const showcase = {
      metadata: {
        demoType: 'vercel-ai-sdk-showcase',
        providersUsed: providers.map(p => ({
          name: p.name,
          modelId: p.adapter.supportedModels[0],
          specialty: p.specialty,
        })),
        productsAnalyzed: SAMPLE_PRODUCTS.length,
        totalProviderCalls: allAnalyses.reduce(
          (sum, analysis) => sum + analysis.providerResults.length,
          0
        ),
        executionDate: new Date().toISOString(),
        uniqueCapabilities: [
          'Multi-provider analysis',
          'Native schema validation',
          'Session management',
          'Provider personality differentiation',
          'Competitive synthesis',
        ],
      },
      productAnalyses: allAnalyses,
      competitiveAnalyses,
      finalStrategy,
      providerPerformance: providers.map(provider => ({
        name: provider.name,
        successful: allAnalyses.reduce(
          (count, analysis) =>
            count +
            analysis.providerResults.filter(
              r => r.providerName === provider.name && r.analysis
            ).length,
          0
        ),
        failed: allAnalyses.reduce(
          (count, analysis) =>
            count +
            analysis.providerResults.filter(
              r => r.providerName === provider.name && r.error
            ).length,
          0
        ),
        avgProcessingTime: Math.round(
          allAnalyses.reduce((sum, analysis) => {
            const results = analysis.providerResults.filter(
              r => r.providerName === provider.name
            );
            return sum + results.reduce((s, r) => s + r.processingTime, 0);
          }, 0) /
            Math.max(
              allAnalyses.reduce(
                (count, analysis) =>
                  count +
                  analysis.providerResults.filter(
                    r => r.providerName === provider.name
                  ).length,
                0
              ),
              1
            )
        ),
      })),
    };

    await writeFile(
      'examples/vercel-ai-sdk-showcase/output/multi-provider-analysis.json',
      JSON.stringify(showcase, null, 2)
    );

    console.log('✅ Results saved successfully!');

    // Display final summary
    console.log('\n🎉 Vercel AI SDK Showcase Complete!');
    console.log(`\n📊 Analysis Summary:`);
    console.log(`   🎯 Products analyzed: ${SAMPLE_PRODUCTS.length}`);
    console.log(`   🤖 Providers used: ${providers.length}`);
    console.log(
      `   📈 Total analyses: ${showcase.metadata.totalProviderCalls}`
    );
    console.log(
      `   ✅ Successful: ${showcase.providerPerformance.reduce((sum, p) => sum + p.successful, 0)}`
    );
    console.log(
      `   ❌ Failed: ${showcase.providerPerformance.reduce((sum, p) => sum + p.failed, 0)}`
    );

    console.log('\n🚀 Unique AI SDK Capabilities Demonstrated:');
    console.log('   ✨ Multi-provider support with unified interface');
    console.log(
      '   🔒 Native Zod schema validation with detailed error feedback'
    );
    console.log('   🔄 Session management across different models');
    console.log('   🎭 Provider personality differentiation');
    console.log('   🧠 Cross-provider insight synthesis');
    console.log('   ⚡ Intelligent error handling and retry logic');

    console.log('\n📈 Provider Performance:');
    showcase.providerPerformance.forEach(perf => {
      const successRate = Math.round(
        (perf.successful / (perf.successful + perf.failed)) * 100
      );
      console.log(
        `   ${providers.find(p => p.name === perf.name)?.color} ${perf.name}: ${successRate}% success, ${perf.avgProcessingTime}ms avg`
      );
    });

    if (finalStrategy) {
      console.log('\n🎯 Key Strategic Insight:');
      console.log(
        `   "${finalStrategy.executiveSummary.substring(0, 150)}..."`
      );
    }

    console.log(
      '\n📖 View complete analysis: examples/vercel-ai-sdk-showcase/output/multi-provider-analysis.json'
    );
  } catch (error) {
    console.log(
      '\n💥 Showcase failed with error:',
      error instanceof Error ? error.message : error
    );
    console.log('\n🛠️  Troubleshooting:');
    console.log('   1. Verify all API keys are set correctly in .env');
    console.log('   2. Check API quotas and account status');
    console.log('   3. Ensure model access permissions');
    console.log('   4. Verify network connectivity');
    console.log('   5. Try running with single provider first');
  }
}

// Execute the showcase
if (import.meta.url === `file://${process.argv[1]}`) {
  runVercelAISDKShowcase().catch(console.error);
}
