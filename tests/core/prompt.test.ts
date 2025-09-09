import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildPrompt, combinePromptParts } from '../../src/core/prompt.js';

describe('buildPrompt', () => {
  const schema = z.object({
    name: z.string().describe('User name'),
    age: z.number().min(0).describe('User age'),
    email: z.string().email().describe('Email address'),
  });

  it('builds basic prompt with schema', () => {
    const parts = buildPrompt({
      input: 'Generate user data',
      schema,
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('Generate user data');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('name');
    expect(prompt).toContain('age');
    expect(prompt).toContain('email');
  });

  it('includes context when provided', () => {
    const parts = buildPrompt({
      input: 'Generate user',
      schema,
      context: 'This is for a test application',
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('This is for a test application');
    expect(prompt).toContain('Generate user');
  });

  it('includes lens for focusing output', () => {
    const parts = buildPrompt({
      input: 'Generate user',
      schema,
      lens: 'Focus on realistic data',
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('Focus on realistic data');
  });

  it.skip('includes examples when provided', () => {
    const parts = buildPrompt({
      input: 'Generate user',
      schema,
      examples: [
        {
          input: 'young adult',
          output: { name: 'Alice', age: 25, email: 'alice@example.com' },
        },
      ],
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('Alice');
    expect(prompt).toContain('25');
    expect(prompt).toContain('example');
  });

  it.skip('adds progressive enhancement for retries', () => {
    const firstParts = buildPrompt({
      input: 'Generate user',
      schema,
      attemptNumber: 1,
    });
    const firstPrompt = combinePromptParts(firstParts);

    const retryParts = buildPrompt({
      input: 'Generate user',
      schema,
      attemptNumber: 2,
      previousError: 'Missing required field: email',
    });
    const retryPrompt = combinePromptParts(retryParts);

    expect(retryPrompt).toContain('Missing required field: email');
    expect(retryPrompt.length).toBeGreaterThan(firstPrompt.length);
  });

  it.skip('includes schema introspection details', () => {
    const complexSchema = z.object({
      user: z.object({
        profile: z.object({
          firstName: z.string(),
          lastName: z.string(),
        }),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
        }),
      }),
    });

    const parts = buildPrompt({
      input: 'Generate user data',
      schema: complexSchema,
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('firstName');
    expect(prompt).toContain('lastName');
    expect(prompt).toContain('light');
    expect(prompt).toContain('dark');
  });

  it('handles optional fields in schema', () => {
    const schemaWithOptional = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const parts = buildPrompt({
      input: 'Generate data',
      schema: schemaWithOptional,
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('required');
    expect(prompt).toContain('optional');
  });

  it.skip('formats validation feedback for retries', () => {
    const validationError = {
      issues: [
        { path: ['age'], message: 'Number must be positive' },
        { path: ['email'], message: 'Invalid email format' },
      ],
    };

    const parts = buildPrompt({
      input: 'Generate user',
      schema,
      attemptNumber: 3,
      previousError: JSON.stringify(validationError),
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('positive');
    expect(prompt).toContain('email');
  });
});
