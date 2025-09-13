import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { validateJson } from '../../src/core/validation.js';

describe('validateJson - simple tests', () => {
  const schema = z.object({
    name: z.string(),
  });

  it('validates correct JSON', () => {
    const json = JSON.stringify({ name: 'Test' });
    const result = validateJson(schema, json);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.name).toBe('Test');
    }
  });

  it('rejects invalid JSON', () => {
    const json = 'not json';
    const result = validateJson(schema, json);

    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const json = JSON.stringify({});
    const result = validateJson(schema, json);

    expect(result.success).toBe(false);
  });
});
