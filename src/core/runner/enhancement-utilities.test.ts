/**
 * Tests for Enhancement Utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { buildEnhancementPrompt, evaluateImprovement } from './enhancement-utilities.js';
import type { ProcessedEnhancementConfiguration } from './configuration-manager.js';

describe('Enhancement Utilities', () => {
  describe('buildEnhancementPrompt', () => {
    it('should use custom prompt when provided', () => {
      const customPrompt = vi.fn((result, round) => `Custom prompt for round ${round}`);
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'custom',
        minImprovement: 0.2,
        customPrompt,
      };

      const result = buildEnhancementPrompt(config, { test: 'data' }, 1);

      expect(customPrompt).toHaveBeenCalledWith({ test: 'data' }, 1);
      expect(result).toBe('Custom prompt for round 1');
    });

    it('should build array expansion prompt for array data', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-array',
        minImprovement: 0.2,
      };

      const currentResult = {
        items: ['item1', 'item2', 'item3'],
      };

      const prompt = buildEnhancementPrompt(config, currentResult, 1);

      expect(prompt).toContain('Great start!');
      expect(prompt).toContain('4 items'); // The analysis counts all items in nested structures
      expect(prompt).toContain('more items');
      expect(prompt).toContain('comprehensive collection');
    });

    it('should build detail expansion prompt', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-detail',
        minImprovement: 0.2,
      };

      const currentResult = {
        description: 'Short text',
        items: ['a', 'b'],
      };

      const prompt = buildEnhancementPrompt(config, currentResult, 1);

      expect(prompt).toContain('Good response!');
      expect(prompt).toContain('more detailed information');
      expect(prompt).toContain('descriptive information');
    });

    it('should build variety expansion prompt', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-variety',
        minImprovement: 0.2,
      };

      const currentResult = {
        options: ['option1', 'option1', 'option2'],
      };

      const prompt = buildEnhancementPrompt(config, currentResult, 1);

      expect(prompt).toContain('Good variety!');
      expect(prompt).toContain('diverse perspectives');
      expect(prompt).toContain('unique and distinctive');
    });

    it('should handle different round numbers with different encouragements', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 3,
        strategy: 'expand-array',
        minImprovement: 0.2,
      };

      const result = { items: [] };

      const prompt1 = buildEnhancementPrompt(config, result, 1);
      const prompt2 = buildEnhancementPrompt(config, result, 2);
      const prompt3 = buildEnhancementPrompt(config, result, 3);

      expect(prompt1).toContain('Great start!');
      expect(prompt2).toContain('Excellent foundation!');
      expect(prompt3).toContain('Good work!');
    });
  });

  describe('evaluateImprovement', () => {
    it('should use custom evaluator when provided', () => {
      const customEvaluator = vi.fn((_baseline, _enhanced) => 0.75);
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'custom',
        minImprovement: 0.2,
        evaluateImprovement: customEvaluator,
      };

      const baseline = { test: 'baseline' };
      const enhanced = { test: 'enhanced' };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(customEvaluator).toHaveBeenCalledWith(baseline, enhanced);
      expect(score).toBe(0.75);
    });

    it('should evaluate array expansion improvement', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-array',
        minImprovement: 0.2,
      };

      const baseline = {
        items: ['a', 'b', 'c'],
      };

      const enhanced = {
        items: ['a', 'b', 'c', 'd', 'e', 'f'],
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      // 100% increase in items = 0.7 weight, plus diversity score
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should evaluate detail expansion improvement', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-detail',
        minImprovement: 0.2,
      };

      const baseline = {
        description: 'Short',
        details: 'Brief',
      };

      const enhanced = {
        description: 'Much longer and more detailed description',
        details: 'Extensive details with lots of information',
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should evaluate variety expansion improvement', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-variety',
        minImprovement: 0.2,
      };

      const baseline = {
        options: ['a', 'a', 'b'],
      };

      const enhanced = {
        options: ['a', 'b', 'c', 'd', 'e'],
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return low score for minimal improvement', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-array',
        minImprovement: 0.2,
      };

      const baseline = {
        items: ['a', 'b', 'c'],
      };

      const enhanced = {
        items: ['a', 'b', 'c'], // Same items - no quantity improvement, some diversity scoring
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.6); // Should be low but not zero due to diversity scoring
    });

    it('should handle empty baseline correctly', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-array',
        minImprovement: 0.2,
      };

      const baseline = {
        items: [],
      };

      const enhanced = {
        items: ['a', 'b', 'c'],
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(score).toBe(1); // Maximum improvement from empty
    });

    it('should cap improvement score at 1', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 2,
        strategy: 'expand-array',
        minImprovement: 0.2,
      };

      const baseline = {
        items: ['a'],
      };

      const enhanced = {
        items: Array(100).fill('item'), // Massive expansion
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('Result Analysis', () => {
    it('should handle nested structures correctly', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 1,
        strategy: 'expand-array',
        minImprovement: 0.2,
      };

      const baseline = {
        level1: {
          level2: {
            items: ['a', 'b'],
          },
        },
      };

      const enhanced = {
        level1: {
          level2: {
            items: ['a', 'b', 'c', 'd'],
          },
        },
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(score).toBeGreaterThan(0);
    });

    it('should handle mixed data types', () => {
      const config: ProcessedEnhancementConfiguration = {
        rounds: 1,
        strategy: 'expand-variety',
        minImprovement: 0.2,
      };

      const baseline = {
        strings: ['a', 'b'],
        numbers: [1, 2],
        objects: [{ id: 1 }, { id: 2 }],
      };

      const enhanced = {
        strings: ['a', 'b', 'c', 'd'],
        numbers: [1, 2, 3, 4],
        objects: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      };

      const score = evaluateImprovement(config, baseline, enhanced);

      expect(score).toBeGreaterThan(0);
    });
  });
});