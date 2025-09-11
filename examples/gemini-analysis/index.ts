#!/usr/bin/env node --import tsx

/**
 * Gemini Technical Documentation Analysis Example
 *
 * Demonstrates using Google's Gemini AI for sophisticated technical document analysis,
 * showcasing JSON mode, session management, and structured content evaluation.
 */

import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { createGeminiAdapter, persuade } from '../../src/index.js';
import {
  GEMINI_OPTIMIZED_INTRO,
  SESSION_CONTEXT_BUILDING,
  TECHNICAL_ANALYST_CONTEXT,
} from './prompts/technical-analyst.js';
import {
  type DocumentInput,
  type TechnicalAnalysis,
  TechnicalAnalysisSchema,
} from './schemas/analysis-schema.js';

async function runGeminiDocumentAnalysis(): Promise<void> {
  console.log('📊 Gemini Technical Documentation Analysis Demo\n');
  console.log(GEMINI_OPTIMIZED_INTRO);
  console.log(`\n${'='.repeat(80)}\n`);

  try {
    // Load sample documents
    console.log('📁 Loading sample technical documents...');
    const documentsData = await readFile(
      'examples/gemini-analysis/data/sample-docs.json',
      'utf-8'
    );
    const documents: DocumentInput[] = JSON.parse(documentsData);
    console.log(`✅ Loaded ${documents.length} documents for analysis`);

    // Display document overview
    console.log('\n📋 Documents to analyze:');
    documents.forEach((doc, index) => {
      console.log(
        `   ${index + 1}. "${doc.title}" (${doc.content.length} chars)`
      );
      if (doc.metadata?.tags) {
        console.log(`      Tags: ${doc.metadata.tags.join(', ')}`);
      }
    });

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      console.log('\n❌ Gemini API key not found in environment variables');
      console.log(
        '   Please copy .env.example to .env and add your Gemini API key'
      );
      console.log(
        '   Get your API key from: https://makersuite.google.com/app/apikey'
      );
      console.log(
        '   Set either GEMINI_API_KEY or GOOGLE_API_KEY in your .env file'
      );
      return;
    }

    // Create Gemini adapter
    console.log('\n🔧 Initializing Gemini adapter...');
    const geminiProvider = createGeminiAdapter({
      defaultModel: 'gemini-1.5-flash', // Fast model for analysis tasks
      apiVersion: 'v1',
    });

    console.log('✅ Gemini adapter created');

    // Test health check
    console.log('🏥 Checking Gemini API health...');
    const health = await geminiProvider.getHealth();

    if (!health.healthy) {
      console.log('❌ Gemini API not available');
      console.log(`   Error: ${health.error}\n`);
      console.log('🛠️  Troubleshooting:');
      console.log('   1. Verify your API key is correct');
      console.log(
        '   2. Check your Google Cloud project has Gemini API enabled'
      );
      console.log('   3. Ensure you have sufficient quota/credits');
      return;
    }

    console.log('✅ Gemini API healthy');
    console.log(`   Response time: ${health.responseTimeMs}ms`);
    console.log(`   Default model: ${health.details.defaultModel}`);
    console.log(`   Active sessions: ${health.details.activeSessions}`);

    // Start analysis session
    console.log('\n🔬 Starting technical analysis session...');
    console.log('   Using session for context building across documents\n');

    const sessionContext = `${TECHNICAL_ANALYST_CONTEXT}\n\n${SESSION_CONTEXT_BUILDING}`;
    let sessionId: string | undefined;
    const analyses: Array<{
      documentNumber: number;
      title: string;
      analysisTime: number;
      analysis: TechnicalAnalysis;
    }> = [];

    // Analyze each document with session continuity
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const docNumber = i + 1;

      console.log(`📄 Analyzing Document ${docNumber}/${documents.length}:`);
      console.log(`   Title: "${doc.title}"`);
      console.log(`   Length: ${doc.content.length} characters`);
      console.log(
        `   Type: ${doc.metadata?.tags?.[0] || 'untagged'} documentation`
      );

      const startTime = Date.now();

      try {
        const result = await persuade(
          {
            schema: TechnicalAnalysisSchema,
            input: {
              document: doc,
              analysisRequest:
                'Provide comprehensive technical analysis of this documentation',
            },
            context: sessionContext,
            sessionId,
            retries: 2,
            maxTokens: 2000,
            temperature: 0.3, // Lower temperature for analytical consistency
            json: true, // Enable JSON mode for structured output
          },
          geminiProvider
        );

        const duration = Date.now() - startTime;

        if (result.ok) {
          sessionId = result.sessionId; // Maintain session continuity
          const analysis = result.value;

          console.log(`   ✅ Analysis completed (${duration}ms)`);
          console.log(
            `   📊 Quality Score: ${analysis.qualityAssessment.clarity}/10 clarity, ${analysis.qualityAssessment.completeness}/10 completeness`
          );
          console.log(
            `   🎯 Audience: ${analysis.audienceAnalysis.primaryAudience} (${analysis.audienceAnalysis.skillLevel} level)`
          );
          console.log(
            `   🏷️  Topics: ${analysis.contentAnalysis.topics.slice(0, 3).join(', ')}${analysis.contentAnalysis.topics.length > 3 ? '...' : ''}`
          );
          console.log(`   📈 Complexity: ${analysis.documentInfo.complexity}`);

          analyses.push({
            documentNumber: docNumber,
            title: doc.title,
            analysisTime: duration,
            analysis,
          });
        } else {
          console.log(`   ❌ Analysis failed: ${result.error?.message}`);
          console.log(
            `   🔄 This might be due to content complexity or API limits`
          );
        }
      } catch (error) {
        console.log(
          `   💥 Unexpected error: ${error instanceof Error ? error.message : error}`
        );
        console.log(
          `   💡 Try: Check API quotas, reduce content length, or verify JSON mode support`
        );
      }

      if (i < documents.length - 1) {
        console.log(); // Add spacing between documents
      }
    }

    // Generate batch analysis summary
    if (analyses.length > 0) {
      console.log(`\n📈 Generating batch analysis summary...`);

      // Calculate summary statistics
      const totalQuality = analyses.reduce(
        (sum, a) => sum + a.analysis.qualityAssessment.clarity,
        0
      );
      const averageQuality = totalQuality / analyses.length;

      const complexityLevels = analyses.map(
        a => a.analysis.documentInfo.complexity
      );
      const mostCommonComplexity =
        complexityLevels
          .sort(
            (a, b) =>
              complexityLevels.filter(v => v === a).length -
              complexityLevels.filter(v => v === b).length
          )
          .pop() || 'intermediate';

      const allTopics = analyses.flatMap(
        a => a.analysis.contentAnalysis.topics
      );
      const topicCounts = allTopics.reduce(
        (acc, topic) => {
          acc[topic] = (acc[topic] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
      const commonTopics = Object.entries(topicCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic);

      const audiences = analyses.map(
        a => a.analysis.audienceAnalysis.primaryAudience
      );
      const mostCommonAudience =
        audiences
          .sort(
            (a, b) =>
              audiences.filter(v => v === a).length -
              audiences.filter(v => v === b).length
          )
          .pop() || 'developers';

      // Create batch analysis
      const batchAnalysis = {
        totalDocuments: analyses.length,
        analysisDate: new Date().toISOString(),
        summaryStats: {
          averageComplexity: mostCommonComplexity,
          commonTopics,
          averageQuality: Math.round(averageQuality * 10) / 10,
          recommendedAudience: mostCommonAudience,
        },
        documents: analyses.map(a => ({
          title: a.title,
          analysis: a.analysis,
        })),
      };

      // Save detailed results
      console.log('💾 Saving analysis results...');

      const outputData = {
        metadata: {
          provider: 'gemini',
          model: health.details.defaultModel,
          sessionId,
          totalDocuments: analyses.length,
          analyzedAt: new Date().toISOString(),
          totalAnalysisTime: analyses.reduce(
            (sum, a) => sum + a.analysisTime,
            0
          ),
          jsonModeEnabled: true,
        },
        batchAnalysis,
        individualAnalyses: analyses,
      };

      await writeFile(
        'examples/gemini-analysis/output/analysis.json',
        JSON.stringify(outputData, null, 2)
      );

      console.log('✅ Analysis results saved successfully!');
      console.log('\n🎯 Analysis Summary:');
      console.log(
        `   📊 Documents analyzed: ${analyses.length}/${documents.length}`
      );
      console.log(
        `   ⭐ Average quality score: ${batchAnalysis.summaryStats.averageQuality}/10`
      );
      console.log(
        `   🎓 Most common complexity: ${batchAnalysis.summaryStats.averageComplexity}`
      );
      console.log(
        `   👥 Primary audience: ${batchAnalysis.summaryStats.recommendedAudience}`
      );
      console.log(
        `   🏷️  Common topics: ${batchAnalysis.summaryStats.commonTopics.slice(0, 3).join(', ')}`
      );

      console.log('\n🎉 Technical analysis complete!');
      console.log(`   🤖 Powered by Gemini's advanced reasoning capabilities`);
      console.log(`   📋 JSON mode enabled for structured, parseable outputs`);
      console.log(
        `   🔗 Session continuity maintained across ${analyses.length} documents`
      );
      console.log(
        `   📖 Check examples/gemini-analysis/output/analysis.json for full results`
      );
    } else {
      console.log('\n⚠️  No documents were successfully analyzed');
      console.log(
        '   💡 Try: Verify API access, check document format, or reduce content complexity'
      );
    }
  } catch (error) {
    console.log(
      '\n💥 Demo failed with error:',
      error instanceof Error ? error.message : error
    );
    console.log('\n🛠️  Troubleshooting:');
    console.log(
      '   1. Verify GEMINI_API_KEY or GOOGLE_API_KEY is set correctly'
    );
    console.log('   2. Check Google Cloud project has Gemini API enabled');
    console.log('   3. Ensure sufficient API quotas and credits');
    console.log('   4. Try a smaller document set if hitting rate limits');
    console.log('   5. Verify JSON mode support for your API configuration');
  }
}

// Execute the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runGeminiDocumentAnalysis().catch(console.error);
}
