import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import {
  formatValidationErrorFeedback,
  validateJson,
} from '../../src/core/validation.js';

describe('validateJson', () => {
  const schema = z.object({
    name: z.string(),
    age: z.number().min(0),
  });

  it('validates correct data', () => {
    const result = validateJson(
      schema,
      JSON.stringify({ name: 'John', age: 30 })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ name: 'John', age: 30 });
    }
  });

  it('rejects invalid data', () => {
    const result = validateJson(
      schema,
      JSON.stringify({ name: 'John', age: -5 })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].path).toEqual(['age']);
    }
  });

  it('handles missing fields', () => {
    const result = validateJson(schema, JSON.stringify({ name: 'John' }));
    expect(result.success).toBe(false);
  });
});

describe('formatValidationErrorFeedback', () => {
  const _schema = z.object({
    email: z.string().email(),
    count: z.number().positive(),
  });

  it('provides helpful schema hints', () => {
    const schema = z.object({
      items: z.array(z.string()).min(1),
    });

    const result = validateJson(schema, JSON.stringify({ items: [] }));
    if (!result.success) {
      const feedback = formatValidationErrorFeedback(result.error, schema);
      expect(feedback).toContain('at least 1');
    }
  });
});
