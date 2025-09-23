/**
 * Enhancement Utilities for Runner Pipeline
 * 
 * Provides functions for building enhancement prompts and evaluating
 * improvements between baseline and enhanced results. Supports multiple
 * strategies for encouraging better LLM outputs.
 */

import type { ProcessedEnhancementConfiguration } from './configuration-manager.js';
import { debug, info } from '../../utils/logger.js';

/**
 * Build an enhancement prompt based on the configured strategy
 * 
 * @param config Enhancement configuration
 * @param currentResult The current valid result to improve upon
 * @param round Current enhancement round (1-based)
 * @returns Enhancement prompt string
 */
export function buildEnhancementPrompt(
  config: ProcessedEnhancementConfiguration,
  currentResult: unknown,
  round: number
): string {
  debug('Building enhancement prompt', {
    strategy: config.strategy,
    round,
    hasCustomPrompt: Boolean(config.customPrompt),
  });

  // Use custom prompt if provided
  if (config.customPrompt) {
    return config.customPrompt(currentResult, round);
  }

  // Build strategy-based prompt
  const baselineInfo = analyzeResult(currentResult);
  
  switch (config.strategy) {
    case 'expand-array':
      return buildArrayExpansionPrompt(baselineInfo, round);
    
    case 'expand-detail':
      return buildDetailExpansionPrompt(baselineInfo, round);
    
    case 'expand-variety':
      return buildVarietyExpansionPrompt(baselineInfo, round);
    
    case 'custom':
      // Should not reach here if validation is correct
      throw new Error('Custom strategy requires customPrompt function');
    
    default:
      return buildArrayExpansionPrompt(baselineInfo, round);
  }
}

/**
 * Evaluate improvement between baseline and enhanced result
 * 
 * @param config Enhancement configuration
 * @param baseline The original valid result
 * @param enhanced The potentially improved result
 * @returns Improvement score between 0 and 1
 */
export function evaluateImprovement(
  config: ProcessedEnhancementConfiguration,
  baseline: unknown,
  enhanced: unknown
): number {
  debug('Evaluating improvement between results', {
    strategy: config.strategy,
    hasCustomEvaluator: Boolean(config.evaluateImprovement),
  });

  // Use custom evaluator if provided
  if (config.evaluateImprovement) {
    return config.evaluateImprovement(baseline, enhanced);
  }

  // Strategy-based evaluation
  const baselineInfo = analyzeResult(baseline);
  const enhancedInfo = analyzeResult(enhanced);
  
  let improvementScore = 0;
  
  switch (config.strategy) {
    case 'expand-array':
      improvementScore = evaluateArrayExpansion(baselineInfo, enhancedInfo);
      break;
    
    case 'expand-detail':
      improvementScore = evaluateDetailExpansion(baselineInfo, enhancedInfo);
      break;
    
    case 'expand-variety':
      improvementScore = evaluateVarietyExpansion(baselineInfo, enhancedInfo);
      break;
    
    default:
      improvementScore = evaluateArrayExpansion(baselineInfo, enhancedInfo);
  }

  info('Improvement evaluation complete', {
    strategy: config.strategy,
    improvementScore,
    meetsThreshold: improvementScore >= config.minImprovement,
    threshold: config.minImprovement,
  });

  return improvementScore;
}

/**
 * Result analysis information
 */
interface ResultInfo {
  arrayCount: number;
  totalItems: number;
  totalStringLength: number;
  uniqueValues: number;
  depth: number;
  hasArrays: boolean;
  hasStrings: boolean;
  hasObjects: boolean;
}

/**
 * Analyze a result to extract metrics for comparison
 * 
 * @param result The result to analyze
 * @returns Analysis information
 */
function analyzeResult(result: unknown): ResultInfo {
  const info: ResultInfo = {
    arrayCount: 0,
    totalItems: 0,
    totalStringLength: 0,
    uniqueValues: 0,
    depth: 0,
    hasArrays: false,
    hasStrings: false,
    hasObjects: false,
  };

  const uniqueSet = new Set<string>();

  function traverse(obj: unknown, currentDepth: number = 0): void {
    info.depth = Math.max(info.depth, currentDepth);

    if (Array.isArray(obj)) {
      info.hasArrays = true;
      info.arrayCount++;
      info.totalItems += obj.length;
      
      for (const item of obj) {
        uniqueSet.add(JSON.stringify(item));
        traverse(item, currentDepth + 1);
      }
    } else if (typeof obj === 'object' && obj !== null) {
      info.hasObjects = true;
      const values = Object.values(obj);
      info.totalItems += values.length;
      
      for (const value of values) {
        traverse(value, currentDepth + 1);
      }
    } else if (typeof obj === 'string') {
      info.hasStrings = true;
      info.totalStringLength += obj.length;
      uniqueSet.add(obj);
    }
  }

  traverse(result);
  info.uniqueValues = uniqueSet.size;

  return info;
}

/**
 * Build prompt for array expansion strategy
 */
function buildArrayExpansionPrompt(info: ResultInfo, round: number): string {
  const encouragements = [
    'Great start! Could you expand this with more comprehensive examples?',
    'Excellent foundation! Let\'s add more diverse items to make this even better.',
    'Good work! Can you provide additional entries to create a more complete set?',
  ];

  const encouragement = encouragements[Math.min(round - 1, encouragements.length - 1)];

  if (info.hasArrays) {
    const currentCount = info.totalItems;
    const suggestedMore = Math.max(5, Math.floor(currentCount * 0.5));
    
    return `${encouragement}

You provided ${currentCount} items, which is good. Could you add approximately ${suggestedMore} more items to create a more comprehensive collection? 

Focus on:
- Adding diverse and unique examples
- Maintaining the same quality and structure
- Avoiding repetition or redundancy

Please provide the complete enhanced result including both the original items and the new additions.`;
  } else {
    return `${encouragement}

Could you expand your response with more items or examples? Aim for a comprehensive collection that thoroughly covers the topic.`;
  }
}

/**
 * Build prompt for detail expansion strategy
 */
function buildDetailExpansionPrompt(info: ResultInfo, round: number): string {
  const encouragements = [
    'Good response! Let\'s enhance it with more detailed information.',
    'Nice work! Could you elaborate further with additional depth?',
    'Great foundation! Please add more comprehensive details.',
  ];

  const encouragement = encouragements[Math.min(round - 1, encouragements.length - 1)];

  const avgStringLength = info.totalStringLength / Math.max(1, info.totalItems);
  const isDetailLight = avgStringLength < 50;

  return `${encouragement}

${isDetailLight ? 'The current descriptions are quite brief.' : 'Good level of detail so far.'} Please enhance the result by:

- Adding more descriptive information to each item
- Including relevant context and explanations
- Providing specific examples where applicable
- Expanding on key points with additional insights

Maintain the same structure while enriching the content quality.`;
}

/**
 * Build prompt for variety expansion strategy
 */
function buildVarietyExpansionPrompt(info: ResultInfo, round: number): string {
  const encouragements = [
    'Good variety! Let\'s add more diverse perspectives.',
    'Nice range! Could you include additional unique variations?',
    'Great diversity! Please add more distinct examples.',
  ];

  const encouragement = encouragements[Math.min(round - 1, encouragements.length - 1)];

  const uniquenessRatio = info.uniqueValues / Math.max(1, info.totalItems);
  const needsMoreVariety = uniquenessRatio < 0.8;

  return `${encouragement}

${needsMoreVariety ? 'Some items appear similar.' : 'Good variety so far.'} Please enhance the result by:

- Adding more unique and distinctive items
- Exploring different angles or perspectives
- Avoiding repetition or similar patterns
- Including edge cases or less common examples

Focus on maximizing diversity while maintaining quality and relevance.`;
}

/**
 * Evaluate improvement for array expansion strategy
 */
function evaluateArrayExpansion(baseline: ResultInfo, enhanced: ResultInfo): number {
  if (baseline.totalItems === 0) {
    return enhanced.totalItems > 0 ? 1 : 0;
  }

  const itemIncrease = (enhanced.totalItems - baseline.totalItems) / baseline.totalItems;
  const diversityScore = enhanced.uniqueValues / Math.max(1, enhanced.totalItems);
  
  // Weight: 70% for quantity increase, 30% for maintaining diversity
  const score = (itemIncrease * 0.7) + (diversityScore * 0.3);
  
  // Normalize to 0-1 range
  return Math.min(1, Math.max(0, score));
}

/**
 * Evaluate improvement for detail expansion strategy
 */
function evaluateDetailExpansion(baseline: ResultInfo, enhanced: ResultInfo): number {
  const baselineAvgLength = baseline.totalStringLength / Math.max(1, baseline.totalItems);
  const enhancedAvgLength = enhanced.totalStringLength / Math.max(1, enhanced.totalItems);
  
  if (baselineAvgLength === 0) {
    return enhancedAvgLength > 0 ? 1 : 0;
  }

  const lengthIncrease = (enhancedAvgLength - baselineAvgLength) / baselineAvgLength;
  const depthIncrease = enhanced.depth > baseline.depth ? 0.2 : 0;
  
  // Weight: 80% for detail increase, 20% for structural depth
  const score = (lengthIncrease * 0.8) + depthIncrease;
  
  // Normalize to 0-1 range
  return Math.min(1, Math.max(0, score));
}

/**
 * Evaluate improvement for variety expansion strategy
 */
function evaluateVarietyExpansion(baseline: ResultInfo, enhanced: ResultInfo): number {
  if (baseline.uniqueValues === 0) {
    return enhanced.uniqueValues > 0 ? 1 : 0;
  }

  const uniqueIncrease = (enhanced.uniqueValues - baseline.uniqueValues) / baseline.uniqueValues;
  const diversityRatio = enhanced.uniqueValues / Math.max(1, enhanced.totalItems);
  
  // Weight: 60% for unique value increase, 40% for diversity ratio
  const score = (uniqueIncrease * 0.6) + (diversityRatio * 0.4);
  
  // Normalize to 0-1 range
  return Math.min(1, Math.max(0, score));
}