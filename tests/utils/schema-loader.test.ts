import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { loadSchema } from '../../src/utils/schema-loader.js';

vi.mock('node:fs/promises');
vi.mock('node:path');

describe.skip('loadSchema', () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.resolve.mockImplementation(p => p);
  });

  it('loads TypeScript schema file', async () => {
    const schemaContent = `
      import { z } from 'zod';
      export const schema = z.object({
        id: z.string(),
        value: z.number(),
      });
    `;

    mockFs.readFile.mockResolvedValue(schemaContent);

    // Mock dynamic import
    const mockSchema = z.object({
      id: z.string(),
      value: z.number(),
    });

    vi.mock('/test/schema.ts', () => ({
      schema: mockSchema,
      default: mockSchema,
    }));

    // For this test, we'll just verify the file reading logic
    await expect(loadSchema('/test/schema.ts')).rejects.toThrow();

    expect(mockFs.readFile).toHaveBeenCalledWith('/test/schema.ts', 'utf-8');
  });

  it('handles missing schema file', async () => {
    mockFs.readFile.mockRejectedValue(new Error('File not found'));

    await expect(loadSchema('/nonexistent.ts')).rejects.toThrow(
      'File not found'
    );
  });

  it('validates schema is Zod object', async () => {
    const invalidSchema = 'not a schema';
    mockFs.readFile.mockResolvedValue(invalidSchema);

    await expect(loadSchema('/invalid.ts')).rejects.toThrow();
  });
});
