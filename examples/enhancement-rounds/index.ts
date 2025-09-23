#!/usr/bin/env tsx
/**
 * Enhancement Rounds Example
 * 
 * Demonstrates how Enhancement Rounds automatically improve initial valid results
 * through additional LLM calls with encouraging prompts. This bridges the gap
 * between "acceptable" and "excellent" results while maintaining reliability.
 * 
 * Run: npm run example:enhancement
 */

import { z } from 'zod';
import { persuade, createClaudeCLIAdapter } from '../../src/index.js';

// Schema for BJJ transitions - minimum 3 required, but enhancement can improve
const BJJTransitionsSchema = z.object({
  position: z.string(),
  transitions: z.array(z.object({
    name: z.string(),
    description: z.string().min(20),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    setup: z.string(),
    execution: z.string(),
    commonMistakes: z.array(z.string()).optional(),
    variations: z.array(z.string()).optional()
  })).min(3), // Hard minimum for schema validation
  notes: z.string().optional()
});

// Schema for content analysis - enhancement improves depth
const ContentAnalysisSchema = z.object({
  summary: z.string().min(50),
  keyPoints: z.array(z.string()).min(3),
  insights: z.array(z.object({
    category: z.string(),
    observation: z.string(),
    significance: z.string()
  })).min(2),
  recommendations: z.array(z.string()).min(2)
});

async function runEnhancementExamples() {
  console.log('🎯 Enhancement Rounds Examples');
  console.log('=====================================\n');

  const provider = createClaudeCLIAdapter();

  // Example 1: Simple Enhancement (expand-array strategy)
  console.log('📝 Example 1: Simple Enhancement - BJJ Transitions');
  console.log('Strategy: expand-array (default)');
  console.log('Goal: Get minimum 3 transitions, enhance to 10-15 comprehensive ones\n');

  try {
    const bjjResult = await persuade({
      schema: BJJTransitionsSchema,
      input: 'Generate transitions from side control position in Brazilian Jiu-Jitsu',
      context: 'You are a world-class BJJ black belt instructor with deep knowledge of position transitions',
      enhancement: 2, // Simple: try 2 enhancement rounds
    }, provider);

    if (bjjResult.ok) {
      console.log('✅ BJJ Transitions Result:');
      console.log(`📊 Attempts: ${bjjResult.attempts}`);
      console.log(`🎯 Position: ${bjjResult.value.position}`);
      console.log(`🔢 Transitions Generated: ${bjjResult.value.transitions.length}`);
      console.log(`⏱️  Execution Time: ${bjjResult.metadata.executionTimeMs}ms`);
      
      console.log('\n🔍 Sample Transitions:');
      bjjResult.value.transitions.slice(0, 3).forEach((transition, i) => {
        console.log(`${i + 1}. ${transition.name} (${transition.difficulty})`);
        console.log(`   Setup: ${transition.setup}`);
        console.log(`   Execution: ${transition.execution.substring(0, 100)}...`);
      });
      
      if (bjjResult.value.transitions.length > 3) {
        console.log(`\n💡 Enhancement Success! Expanded from minimum 3 to ${bjjResult.value.transitions.length} transitions`);
      }
    } else {
      console.log('❌ BJJ example failed:', bjjResult.error);
    }
  } catch (error) {
    console.log('❌ BJJ example error:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Example 2: Advanced Enhancement Configuration (expand-detail strategy)
  console.log('📝 Example 2: Advanced Enhancement - Content Analysis');
  console.log('Strategy: expand-detail');
  console.log('Goal: Get basic analysis, enhance for depth and comprehensiveness\n');

  try {
    const analysisResult = await persuade({
      schema: ContentAnalysisSchema,
      input: `Analyze this market trend: "Remote work adoption has accelerated by 5 years in just 6 months. 
              Companies that were resistant to remote work pre-2020 are now fully distributed. 
              Traditional office spaces are being reimagined. Employee expectations have permanently shifted."`,
      context: 'You are a senior business analyst with expertise in workplace trends and organizational behavior',
      enhancement: {
        rounds: 1,
        strategy: 'expand-detail',
        minImprovement: 0.25, // Require 25% improvement to accept enhancement
        customPrompt: (_currentResult, _round) => 
          `Excellent analysis! Can you expand this with more detailed insights, specific examples, 
           and deeper implications for different stakeholder groups? Add more nuanced observations 
           and actionable recommendations.`
      }
    }, provider);

    if (analysisResult.ok) {
      console.log('✅ Content Analysis Result:');
      console.log(`📊 Attempts: ${analysisResult.attempts}`);
      console.log(`📝 Summary Length: ${analysisResult.value.summary.length} characters`);
      console.log(`🎯 Key Points: ${analysisResult.value.keyPoints.length}`);
      console.log(`💡 Insights: ${analysisResult.value.insights.length}`);
      console.log(`🎯 Recommendations: ${analysisResult.value.recommendations.length}`);
      console.log(`⏱️  Execution Time: ${analysisResult.metadata.executionTimeMs}ms`);

      console.log('\n📋 Analysis Summary:');
      console.log(analysisResult.value.summary);

      console.log('\n🔍 Key Insights:');
      analysisResult.value.insights.forEach((insight, i) => {
        console.log(`${i + 1}. ${insight.category}: ${insight.observation}`);
        console.log(`   Significance: ${insight.significance.substring(0, 100)}...`);
      });
    } else {
      console.log('❌ Analysis example failed:', analysisResult.error);
    }
  } catch (error) {
    console.log('❌ Analysis example error:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Example 3: Custom Enhancement Strategy
  console.log('📝 Example 3: Custom Enhancement Strategy');
  console.log('Strategy: custom');
  console.log('Goal: Domain-specific improvement with custom scoring\n');

  try {
    // Custom evaluation function for BJJ transitions
    const customEvaluateImprovement = (baseline: unknown, enhanced: unknown): number => {
      const baselineObj = baseline as { transitions?: Array<{ description?: string; setup?: string; execution?: string }> };
      const enhancedObj = enhanced as { transitions?: Array<{ description?: string; setup?: string; execution?: string; commonMistakes?: string[]; variations?: string[] }> };
      
      const baselineTransitions = baselineObj.transitions || [];
      const enhancedTransitions = enhancedObj.transitions || [];
      
      // Score based on quantity, detail, and completeness
      const quantityScore = Math.min(enhancedTransitions.length / (baselineTransitions.length || 1), 2) * 0.4;
      const detailScore = enhancedTransitions.reduce((acc: number, t) => 
        acc + (t.description?.length || 0) + (t.setup?.length || 0) + (t.execution?.length || 0), 0) / 
        Math.max(baselineTransitions.reduce((acc: number, t) => 
          acc + (t.description?.length || 0) + (t.setup?.length || 0) + (t.execution?.length || 0), 0), 1) * 0.4;
      const completenessScore = enhancedTransitions.filter((t) => 
        t.commonMistakes?.length && t.variations?.length).length / enhancedTransitions.length * 0.2;
      
      return Math.min(quantityScore + detailScore + completenessScore, 1);
    };

    const customResult = await persuade({
      schema: BJJTransitionsSchema,
      input: 'Generate comprehensive transitions from mount position with detailed instruction',
      context: 'You are a BJJ world champion with deep understanding of position mechanics and teaching methodology',
      enhancement: {
        rounds: 1,
        strategy: 'custom',
        minImprovement: 0.3,
        customPrompt: (_currentResult, _round) => 
          `Outstanding work! Now let's make this truly comprehensive for serious BJJ students. 
           Please expand each transition with:
           - More detailed setup instructions
           - Common mistakes beginners make
           - Variations for different body types
           - Competition-level execution tips
           - Connection to other positions
           Make this a masterclass-level resource.`,
        evaluateImprovement: customEvaluateImprovement
      }
    }, provider);

    if (customResult.ok) {
      console.log('✅ Custom Enhancement Result:');
      console.log(`📊 Attempts: ${customResult.attempts}`);
      console.log(`🎯 Position: ${customResult.value.position}`);
      console.log(`🔢 Transitions: ${customResult.value.transitions.length}`);
      
      const transitionsWithExtras = customResult.value.transitions.filter(t => 
        t.commonMistakes?.length || t.variations?.length);
      console.log(`💎 Enhanced Transitions (with extras): ${transitionsWithExtras.length}`);
      console.log(`⏱️  Execution Time: ${customResult.metadata.executionTimeMs}ms`);

      if (transitionsWithExtras.length > 0) {
        console.log('\n🏆 Sample Enhanced Transition:');
        const enhanced = transitionsWithExtras[0];
        console.log(`Name: ${enhanced.name}`);
        console.log(`Description: ${enhanced.description}`);
        if (enhanced.commonMistakes?.length) {
          console.log(`Common Mistakes: ${enhanced.commonMistakes.join(', ')}`);
        }
        if (enhanced.variations?.length) {
          console.log(`Variations: ${enhanced.variations.join(', ')}`);
        }
      }
    } else {
      console.log('❌ Custom enhancement failed:', customResult.error);
    }
  } catch (error) {
    console.log('❌ Custom enhancement error:', error);
  }

  console.log('\n🎯 Enhancement Rounds Summary');
  console.log('============================');
  console.log('✅ Demonstrated all enhancement strategies:');
  console.log('   - expand-array: Increase quantity of items');
  console.log('   - expand-detail: Enhance depth and comprehensiveness');
  console.log('   - custom: Domain-specific improvements with custom scoring');
  console.log('');
  console.log('🔑 Key Benefits:');
  console.log('   - Risk-free: Never compromises initial valid results');
  console.log('   - Automatic: Improves results without manual intervention');
  console.log('   - Configurable: Fine-tune strategy and thresholds');
  console.log('   - Measurable: Quantitative improvement scoring');
  console.log('');
  console.log('🎯 Perfect for bridging the gap between "acceptable" and "excellent" LLM outputs!');
}

// Run the examples
runEnhancementExamples().catch(console.error);