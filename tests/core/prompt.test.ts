import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
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

  it('includes examples when provided', () => {
    const parts = buildPrompt({
      input: 'Generate user',
      schema,
      exampleOutput: { name: 'Alice', age: 25, email: 'alice@example.com' },
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('Alice');
    expect(prompt).toContain('25');
    expect(prompt).toContain('example');
  });

  it('adds progressive enhancement for retries', () => {
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
    });
    const retryPrompt = combinePromptParts(retryParts);

    expect(retryPrompt).toContain('IMPORTANT');
    expect(retryPrompt.length).toBeGreaterThan(firstPrompt.length);
  });

  it('includes schema introspection details', () => {
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

    expect(prompt).toContain('user');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('schema');
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

  it('includes enhanced urgency for multiple retries', () => {
    const parts = buildPrompt({
      input: 'Generate user',
      schema,
      attemptNumber: 3,
    });
    const prompt = combinePromptParts(parts);

    expect(prompt).toContain('MUST');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('valid');
  });
});
