/**
 * Tests for Enhancement Configuration Processing
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateAndNormalizeOptions, processRunnerConfiguration } from './configuration-manager.js';
import type { Options, EnhancementConfiguration } from '../../types/index.js';

describe('Enhancement Configuration', () => {
  const basicSchema = z.object({ test: z.string() });
  const basicInput = { test: 'data' };

  describe('validateAndNormalizeOptions', () => {
    it('should accept simple enhancement rounds as number', () => {
      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: 2,
      };

      const result = validateAndNormalizeOptions(options);

      expect(result.enhancement).toBe(2);
    });

    it('should accept full enhancement configuration', () => {
      const enhancementConfig: EnhancementConfiguration = {
        rounds: 3,
        strategy: 'expand-detail',
        minImprovement: 0.3,
      };

      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: enhancementConfig,
      };

      const result = validateAndNormalizeOptions(options);

      expect(result.enhancement).toEqual(enhancementConfig);
    });

    it('should reject negative enhancement rounds', () => {
      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: -1,
      };

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        'enhancement rounds must be non-negative'
      );
    });

    it('should warn about excessive enhancement rounds', () => {
      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: 10,
      };

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        'enhancement rounds should not exceed 5'
      );
    });

    it('should reject invalid enhancement strategy', () => {
      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: {
          rounds: 2,
          strategy: 'invalid-strategy' as any,
        },
      };

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        'enhancement.strategy must be one of'
      );
    });

    it('should require customPrompt for custom strategy', () => {
      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: {
          rounds: 2,
          strategy: 'custom',
        },
      };

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        'enhancement.customPrompt function is required when strategy is "custom"'
      );
    });

    it('should validate minImprovement range', () => {
      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: {
          rounds: 2,
          minImprovement: 1.5,
        },
      };

      expect(() => validateAndNormalizeOptions(options)).toThrow(
        'enhancement.minImprovement must be between 0 and 1'
      );
    });

    it('should accept valid custom configuration', () => {
      const customPrompt = (_result: unknown, round: number) => `Custom prompt ${round}`;
      const customEvaluator = (_baseline: unknown, _enhanced: unknown) => 0.8;

      const options: Options<any> = {
        schema: basicSchema,
        input: basicInput,
        enhancement: {
          rounds: 2,
          strategy: 'custom',
          minImprovement: 0.5,
          customPrompt,
          evaluateImprovement: customEvaluator,
        },
      };

      const result = validateAndNormalizeOptions(options);

      expect(result.enhancement).toEqual({
        rounds: 2,
        strategy: 'custom',
        minImprovement: 0.5,
        customPrompt,
        evaluateImprovement: customEvaluator,
      });
    });
  });

  describe('processRunnerConfiguration', () => {
    it('should process simple enhancement number with defaults', () => {
      const normalizedOptions = {
        schema: basicSchema,
        input: basicInput,
        enhancement: 3,
      };

      const result = processRunnerConfiguration(normalizedOptions);

      expect(result.enhancement).toEqual({
        rounds: 3,
        strategy: 'expand-array',
        minImprovement: 0.2,
      });
    });

    it('should process full enhancement configuration with defaults', () => {
      const normalizedOptions = {
        schema: basicSchema,
        input: basicInput,
        enhancement: {
          rounds: 2,
          strategy: 'expand-detail' as const,
        },
      };

      const result = processRunnerConfiguration(normalizedOptions);

      expect(result.enhancement).toEqual({
        rounds: 2,
        strategy: 'expand-detail',
        minImprovement: 0.2,
      });
    });

    it('should preserve custom functions in configuration', () => {
      const customPrompt = (_result: unknown, round: number) => `Round ${round}`;
      const customEvaluator = (_baseline: unknown, _enhanced: unknown) => 0.9;

      const normalizedOptions = {
        schema: basicSchema,
        input: basicInput,
        enhancement: {
          rounds: 1,
          strategy: 'custom' as const,
          customPrompt,
          evaluateImprovement: customEvaluator,
        },
      };

      const result = processRunnerConfiguration(normalizedOptions);

      expect(result.enhancement?.customPrompt).toBe(customPrompt);
      expect(result.enhancement?.evaluateImprovement).toBe(customEvaluator);
    });

    it('should not include enhancement when not provided', () => {
      const normalizedOptions = {
        schema: basicSchema,
        input: basicInput,
      };

      const result = processRunnerConfiguration(normalizedOptions);

      expect(result.enhancement).toBeUndefined();
    });

    it('should handle zero enhancement rounds', () => {
      const normalizedOptions = {
        schema: basicSchema,
        input: basicInput,
        enhancement: 0,
      };

      const result = processRunnerConfiguration(normalizedOptions);

      expect(result.enhancement).toEqual({
        rounds: 0,
        strategy: 'expand-array',
        minImprovement: 0.2,
      });
    });
  });
});