import * as fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { runCommand } from '../../src/cli/commands/run.js';
import * as runner from '../../src/core/runner.js';
import * as fileIo from '../../src/utils/file-io.js';
import * as schemaLoader from '../../src/utils/schema-loader.js';

vi.mock('node:fs/promises');
vi.mock('../../src/utils/file-io.js');
vi.mock('../../src/utils/schema-loader.js');
vi.mock('../../src/core/runner.js');

// Mock process.exit to prevent tests from actually exiting
const mockExit = vi.fn();
vi.stubGlobal('process', { ...process, exit: mockExit });

describe('CLI Integration', () => {
  const mockFs = vi.mocked(fs);
  const mockFileIo = vi.mocked(fileIo);
  const mockSchemaLoader = vi.mocked(schemaLoader);
  const mockRunner = vi.mocked(runner);

  const testSchema = z.object({
    result: z.string(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit.mockClear();

    // Setup default mocks
    mockSchemaLoader.loadSchema.mockResolvedValue({
      schema: testSchema,
      exportName: 'testSchema',
      filePath: '/test/schema.ts',
      format: 'zod',
      loadTimeMs: 10,
    });
    mockFileIo.readInputs.mockResolvedValue({
      data: [{ input: 'test' }],
      files: [
        {
          filePath: 'test.json',
          format: '.json',
          size: 100,
          lastModified: new Date(),
        },
      ],
      fileCount: 1,
      totalBytes: 100,
    });
    mockRunner.persuade.mockResolvedValue({
      ok: true,
      value: { result: 'success' },
      attempts: 1,
      metadata: {
        executionTimeMs: 100,
        startedAt: new Date(),
        completedAt: new Date(),
        provider: 'mock',
        model: 'test-model',
      },
    });
    mockRunner.validateRunnerOptions.mockReturnValue({
      valid: true,
      errors: [],
    });
    mockFileIo.writeOutput.mockResolvedValue();
  });

  it('processes single file with schema', async () => {
    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
    };

    await runCommand(args);

    expect(mockSchemaLoader.loadSchema).toHaveBeenCalledWith('schema.ts', {
      verbose: false,
    });
    expect(mockFileIo.readInputs).toHaveBeenCalledWith('test.json', {
      flattenArrays: true,
      allowEmpty: false,
    });
    expect(mockRunner.persuade).toHaveBeenCalled();
    expect(mockFileIo.writeOutput).toHaveBeenCalled();
  });


  it('includes context and lens in processing', async () => {
    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
      context: 'Background info',
      lens: 'Focus on accuracy',
    };

    await runCommand(args);

    expect(mockRunner.persuade).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'Background info',
        lens: 'Focus on accuracy',
      }),
      expect.any(Object)
    );
  });

  it('handles dry run mode', async () => {
    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
      dryRun: true,
    };

    await runCommand(args);

    expect(mockRunner.persuade).not.toHaveBeenCalled();
    expect(mockFileIo.writeOutput).not.toHaveBeenCalled();
  });

  it('respects max retries configuration', async () => {
    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '5',
    };

    await runCommand(args);

    expect(mockRunner.persuade).toHaveBeenCalledWith(
      expect.objectContaining({
        retries: 5,
      }),
      expect.any(Object)
    );
  });

  it('handles processing failures gracefully', async () => {
    mockRunner.persuade.mockResolvedValue({
      ok: false,
      error: { message: 'Processing failed', type: 'validation' },
      attempts: 1,
      metadata: {
        executionTimeMs: 100,
        startedAt: new Date(),
        completedAt: new Date(),
        provider: 'mock',
      },
    });

    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
    };

    await expect(runCommand(args)).resolves.not.toThrow();
    expect(mockFileIo.writeOutput).toHaveBeenCalled();
  });


  it('creates output directory if needed', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);

    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'new/dir/output',
      retries: '3',
    };

    await runCommand(args);

    expect(mockFileIo.writeOutput).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('new/dir/output'),
      expect.any(Object)
    );
  });
});
