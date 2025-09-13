import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { persuade } from '../../src/core/runner.js';
import type { ProviderAdapter } from '../../src/types/provider.js';

describe('LLM Correction and Retry Mechanism', () => {
  const mockProvider: ProviderAdapter = {
    name: 'mock',
    supportsSession: false,
    sendPrompt: vi.fn(),
  };

  const schema = z.object({
    name: z.string(),
    age: z.number().min(0).max(120),
    email: z.string().email(),
    items: z.array(z.string()).min(1),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('corrects malformed JSON and succeeds', async () => {
    vi.mocked(mockProvider.sendPrompt)
      .mockResolvedValueOnce({
        content: 'This is not JSON at all', // First attempt: plain text
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: '{"name": "John", age: 30', // Second attempt: broken JSON
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          // Third attempt: valid JSON
          name: 'John',
          age: 30,
          email: 'john@example.com',
          items: ['item1'],
        }),
        model: 'mock',
      });

    const result = await persuade(
      {
        input: 'Generate user data',
        schema,
        retries: 5,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    expect(mockProvider.sendPrompt).toHaveBeenCalledTimes(3);

    // Check that retry prompts include correction feedback
    const secondCall = vi.mocked(mockProvider.sendPrompt).mock.calls[1];
    expect(secondCall[1]).toContain('JSON');

    if (result.ok) {
      expect(result.value.name).toBe('John');
      expect(result.attempts).toBe(3);
    }
  });

  it('corrects missing required fields progressively', async () => {
    vi.mocked(mockProvider.sendPrompt)
      .mockResolvedValueOnce({
        content: JSON.stringify({ name: 'Alice' }), // Missing age, email, items
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ name: 'Alice', age: 25 }), // Still missing email, items
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          name: 'Alice',
          age: 25,
          email: 'alice@example.com',
        }), // Still missing items
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          name: 'Alice',
          age: 25,
          email: 'alice@example.com',
          items: ['complete'],
        }),
        model: 'mock',
      });

    const result = await persuade(
      {
        input: 'Generate complete user data',
        schema,
        retries: 5,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    expect(mockProvider.sendPrompt).toHaveBeenCalledTimes(4);

    // Verify feedback mentions missing fields
    const calls = vi.mocked(mockProvider.sendPrompt).mock.calls;
    expect(calls[1][1]).toContain('age'); // Second attempt should mention missing age
    expect(calls[2][1]).toContain('email'); // Third attempt should mention missing email
    expect(calls[3][1]).toContain('items'); // Fourth attempt should mention missing items
  });

  it('corrects invalid field types', async () => {
    vi.mocked(mockProvider.sendPrompt)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          name: 123, // Wrong type: should be string
          age: '30', // Wrong type: should be number
          email: 'not-an-email', // Invalid format
          items: 'not-an-array', // Wrong type: should be array
        }),
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          name: 'Bob',
          age: 30,
          email: 'bob@example.com',
          items: ['item1', 'item2'],
        }),
        model: 'mock',
      });

    const result = await persuade(
      {
        input: 'Generate user with correct types',
        schema,
        retries: 3,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    expect(mockProvider.sendPrompt).toHaveBeenCalledTimes(2);

    // Check that feedback includes type correction hints
    const secondCall = vi.mocked(mockProvider.sendPrompt).mock.calls[1];
    expect(secondCall[1]).toContain('string');
    expect(secondCall[1]).toContain('number');
    expect(secondCall[1]).toContain('array');
  });

  it('corrects validation constraints violations', async () => {
    vi.mocked(mockProvider.sendPrompt)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          name: 'Eve',
          age: 150, // Too old (max is 120)
          email: 'eve@example.com',
          items: [], // Too few items (min is 1)
        }),
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          name: 'Eve',
          age: 35,
          email: 'eve@example.com',
          items: ['valid-item'],
        }),
        model: 'mock',
      });

    const result = await persuade(
      {
        input: 'Generate user within constraints',
        schema,
        retries: 2,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    expect(mockProvider.sendPrompt).toHaveBeenCalledTimes(2);

    // Feedback should mention constraint violations
    const secondCall = vi.mocked(mockProvider.sendPrompt).mock.calls[1];
    expect(secondCall[1]).toContain('120'); // Max age
    expect(secondCall[1]).toContain('at least 1'); // Min items
  });

  it('fails after maximum retries', async () => {
    // Always return invalid data
    vi.mocked(mockProvider.sendPrompt).mockResolvedValue({
      content: 'Never valid JSON',
      model: 'mock',
    });

    const result = await persuade(
      {
        input: 'Generate user data',
        schema,
        retries: 3,
      },
      mockProvider
    );

    expect(result.ok).toBe(false);
    expect(mockProvider.sendPrompt).toHaveBeenCalledTimes(4); // Initial + 3 retries

    if (!result.ok) {
      expect(result.error.message).toContain('JSON format');
      expect(result.attempts).toBe(4);
    }
  });

  it('handles nested object corrections', async () => {
    const nestedSchema = z.object({
      user: z.object({
        profile: z.object({
          firstName: z.string(),
          lastName: z.string(),
        }),
        settings: z.object({
          notifications: z.boolean(),
          theme: z.enum(['light', 'dark']),
        }),
      }),
    });

    vi.mocked(mockProvider.sendPrompt)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          user: {
            profile: { firstName: 'John' }, // Missing lastName
            settings: { notifications: 'yes', theme: 'blue' }, // Wrong types
          },
        }),
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          user: {
            profile: { firstName: 'John', lastName: 'Doe' },
            settings: { notifications: true, theme: 'dark' },
          },
        }),
        model: 'mock',
      });

    const result = await persuade(
      {
        input: 'Generate nested user data',
        schema: nestedSchema,
        retries: 2,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);
    expect(mockProvider.sendPrompt).toHaveBeenCalledTimes(2);

    // Verify nested path corrections
    const secondCall = vi.mocked(mockProvider.sendPrompt).mock.calls[1];
    expect(secondCall[1]).toContain('lastName');
    expect(secondCall[1]).toContain('boolean');
    expect(secondCall[1]).toContain('light');
    expect(secondCall[1]).toContain('dark');
  });

  it('accumulates and provides all errors across attempts', async () => {
    vi.mocked(mockProvider.sendPrompt)
      .mockResolvedValueOnce({
        content: '{}', // Empty object - missing all fields
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ name: 123 }), // Wrong type for name
        model: 'mock',
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          name: 'Final',
          age: 40,
          email: 'final@example.com',
          items: ['done'],
        }),
        model: 'mock',
      });

    const result = await persuade(
      {
        input: 'Generate data with error accumulation',
        schema,
        retries: 5,
      },
      mockProvider
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.attempts).toBe(3);
    }
  });
});
