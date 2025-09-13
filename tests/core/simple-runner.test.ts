import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { persuade } from '../../src/core/runner.js';

describe('persuade - simple tests', () => {
  const mockProvider = {
    name: 'mock',
    supportsSession: false,
    sendPrompt: vi.fn(),
  };

  const schema = z.object({
    result: z.string(),
  });

  it('processes valid response correctly', async () => {
    mockProvider.sendPrompt.mockResolvedValue({
      content: JSON.stringify({ result: 'success' }),
      model: 'mock',
    });

    const result = await persuade(
      {
        input: 'Test',
        schema,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toBe('success');
    }
  });

  it('handles provider errors', async () => {
    mockProvider.sendPrompt.mockRejectedValue(new Error('Provider error'));

    const result = await persuade(
      {
        input: 'Test',
        schema,
        retries: 0,
      },
      mockProvider
    );

    expect(result.ok).toBe(false);
  });
});
