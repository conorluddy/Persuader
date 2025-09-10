import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSchema } from '../../src/utils/schema-loader.js';

vi.mock('node:fs/promises');
vi.mock('node:path');

describe('loadSchema', () => {
  const mockFs = vi.mocked(fs);
  const mockPath = vi.mocked(path);

  beforeEach(() => {
    vi.clearAllMocks();
    mockPath.resolve.mockImplementation(p => p as string);
    mockPath.extname.mockImplementation(p => {
      const parts = p.split('.');
      return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
    });
  });

  it('throws error for TypeScript schema files', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isFile: () => true, size: 100 } as Awaited<
      ReturnType<typeof fs.stat>
    >);

    await expect(loadSchema('/test/schema.ts')).rejects.toThrow(
      'TypeScript schemas are no longer supported'
    );
  });

  it('handles missing schema file', async () => {
    mockFs.access.mockRejectedValue(new Error('ENOENT: no such file'));

    await expect(loadSchema('/nonexistent.js')).rejects.toThrow(
      'Schema file not found or not accessible'
    );
  });

  it('throws error for unsupported file extensions', async () => {
    mockFs.access.mockResolvedValue(undefined);
    mockFs.stat.mockResolvedValue({ isFile: () => true, size: 100 } as Awaited<
      ReturnType<typeof fs.stat>
    >);

    await expect(loadSchema('/schema.txt')).rejects.toThrow(
      'Unsupported schema file extension'
    );
  });
});
