import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { persuade } from '../../src/core/runner.js';
import type { ProviderAdapter } from '../../src/types/provider.js';

describe('persuade', () => {
  const mockProvider: ProviderAdapter = {
    name: 'mock',
    supportsSession: false,
    sendPrompt: vi.fn(),
  };

  const schema = z.object({
    result: z.string(),
    score: z.number(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs complete pipeline successfully', async () => {
    vi.mocked(mockProvider.sendPrompt).mockResolvedValue({
      content: JSON.stringify({ result: 'success', score: 95 }),
      model: 'mock',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const result = await persuade(
      {
        input: 'Test prompt',
        schema,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ result: 'success', score: 95 });
      expect(result.attempts).toBe(1);
    }
  });

  it('retries on validation failure', async () => {
    vi.mocked(mockProvider.sendPrompt)
      .mockResolvedValueOnce({
        content: JSON.stringify({ result: 'invalid' }), // missing score
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ result: 'success', score: 90 }),
        model: 'mock',
      });

    const result = await persuade(
      {
        input: 'Test prompt',
        schema,
        retries: 2,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    expect(mockProvider.sendPrompt).toHaveBeenCalledTimes(2);
    if (result.ok) {
      expect(result.attempts).toBe(2);
    }
  });

  it('includes context and lens in prompt', async () => {
    vi.mocked(mockProvider.sendPrompt).mockResolvedValue({
      content: JSON.stringify({ result: 'test', score: 100 }),
      model: 'mock',
    });

    await persuade(
      {
        input: 'Main prompt',
        schema,
        context: 'Background context',
        lens: 'Focus on accuracy',
      },
      mockProvider
    );

    const call = vi.mocked(mockProvider.sendPrompt).mock.calls[0];
    expect(call[1]).toContain('Background context');
    expect(call[1]).toContain('Focus on accuracy');
    expect(call[1]).toContain('Main prompt');
  });

  it('handles provider errors gracefully', async () => {
    vi.mocked(mockProvider.sendPrompt).mockRejectedValue(
      new Error('Provider unavailable')
    );

    const result = await persuade(
      {
        input: 'Test prompt',
        schema,
        retries: 1,
      },
      mockProvider
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Provider unavailable');
    }
  });

  it('uses session when available', async () => {
    const sessionProvider: ProviderAdapter = {
      name: 'session-mock',
      supportsSession: true,
      sendPrompt: vi.fn(),
      createSession: vi.fn().mockResolvedValue('session-123'),
    };

    vi.mocked(sessionProvider.sendPrompt).mockResolvedValue({
      content: JSON.stringify({ result: 'with-session', score: 85 }),
      model: 'mock',
    });

    const result = await persuade(
      {
        input: 'Test prompt',
        schema,
        context: 'Session context',
      },
      sessionProvider
    );

    expect(sessionProvider.createSession).toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});
