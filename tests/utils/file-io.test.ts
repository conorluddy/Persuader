import * as fs from 'node:fs/promises';
import * as glob from 'fast-glob';
import { describe, expect, it, vi } from 'vitest';
import {
  fileExists,
  parseFileContent,
  readInputs,
  writeOutput,
} from '../../src/utils/file-io.js';

vi.mock('node:fs/promises');
vi.mock('fast-glob');

describe.skip('file-io utilities', () => {
  const mockFs = vi.mocked(fs);
  const mockGlob = vi.mocked(glob);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fileExists', () => {
    it('returns true for existing files', async () => {
      mockFs.access.mockResolvedValue();

      const exists = await fileExists('/test.json');

      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalled();
    });

    it('returns false for non-existent files', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const exists = await fileExists('/missing.json');
      expect(exists).toBe(false);
    });
  });

  describe('parseFileContent', () => {
    it('parses JSON content', () => {
      const content = '{"key": "value"}';
      const result = parseFileContent(content, '.json');

      expect(result.data).toEqual({ key: 'value' });
      expect(result.wasParsed).toBe(true);
    });

    it('parses YAML content', () => {
      const content = 'key: value\ncount: 42';
      const result = parseFileContent(content, '.yaml');

      expect(result.data).toEqual({ key: 'value', count: 42 });
      expect(result.wasParsed).toBe(true);
    });

    it('returns raw content for unknown formats', () => {
      const content = 'plain text';
      const result = parseFileContent(content, '.txt');

      expect(result.data).toBe('plain text');
      expect(result.wasParsed).toBe(false);
    });
  });

  describe('readInputs', () => {
    it('reads files matching glob pattern', async () => {
      mockGlob.default.mockResolvedValue(['/file1.json', '/file2.json']);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ id: 1 }))
        .mockResolvedValueOnce(JSON.stringify({ id: 2 }));

      const results = await readInputs(['*.json']);

      expect(results).toHaveLength(2);
      expect(results[0].content).toEqual({ id: 1 });
      expect(results[1].content).toEqual({ id: 2 });
    });

    it('handles empty glob results', async () => {
      mockGlob.default.mockResolvedValue([]);

      const results = await readInputs(['*.nonexistent']);

      expect(results).toHaveLength(0);
    });
  });

  describe('writeOutput', () => {
    it('writes JSON output', async () => {
      const data = { result: 'success' };
      mockFs.writeFile.mockResolvedValue();

      await writeOutput('/output.json', data, '.json');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/output.json',
        JSON.stringify(data, null, 2)
      );
    });

    it('creates directory if needed', async () => {
      mockFs.mkdir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();

      await writeOutput('/new/dir/output.json', {}, '.json');

      expect(mockFs.mkdir).toHaveBeenCalled();
    });
  });
});
