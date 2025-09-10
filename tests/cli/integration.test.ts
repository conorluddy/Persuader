import * as fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runCommand } from '../../src/cli/commands/run.js';
import * as workflowOrchestrator from '../../src/cli/utilities/workflow-orchestrator.js';

vi.mock('node:fs/promises');
vi.mock('../../src/cli/utilities/workflow-orchestrator.js');

// Mock process.exit to prevent tests from actually exiting
const mockExit = vi.fn();
vi.stubGlobal('process', { ...process, exit: mockExit });

describe('CLI Integration', () => {
  const mockFs = vi.mocked(fs);
  const mockWorkflowOrchestrator = vi.mocked(workflowOrchestrator);

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit.mockClear();

    // Mock the workflow orchestrator to return successful workflow result
    mockWorkflowOrchestrator.executeRunWorkflow.mockResolvedValue({
      success: true,
      pipelineResult: {
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
      },
      totalExecutionTime: 100,
      stepResults: {},
    });
  });

  it('processes single file with schema', async () => {
    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
    };

    await runCommand(args);

    expect(mockWorkflowOrchestrator.executeRunWorkflow).toHaveBeenCalledWith(
      args
    );
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

    expect(mockWorkflowOrchestrator.executeRunWorkflow).toHaveBeenCalledWith({
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
      context: 'Background info',
      lens: 'Focus on accuracy',
    });
  });

  it('handles dry run mode', async () => {
    // Mock dry run result (no pipeline execution)
    mockWorkflowOrchestrator.executeRunWorkflow.mockResolvedValue({
      success: true,
      totalExecutionTime: 50,
      stepResults: {
        'dry-run': {
          success: true,
          executionTime: 50,
          warnings: [],
        },
      },
    });

    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
      dryRun: true,
    };

    await runCommand(args);

    expect(mockWorkflowOrchestrator.executeRunWorkflow).toHaveBeenCalledWith(
      args
    );
  });

  it('respects max retries configuration', async () => {
    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '5',
    };

    await runCommand(args);

    expect(mockWorkflowOrchestrator.executeRunWorkflow).toHaveBeenCalledWith({
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '5',
    });
  });

  it('handles processing failures gracefully', async () => {
    mockWorkflowOrchestrator.executeRunWorkflow.mockResolvedValue({
      success: false,
      error: new Error('Processing failed'),
      totalExecutionTime: 100,
      stepResults: {
        'pipeline-execution': {
          success: false,
          error: new Error('Processing failed'),
          executionTime: 100,
          warnings: [],
        },
      },
    });

    const args = {
      input: 'test.json',
      schema: 'schema.ts',
      output: 'output',
      retries: '3',
    };

    await expect(runCommand(args)).resolves.not.toThrow();
    expect(mockWorkflowOrchestrator.executeRunWorkflow).toHaveBeenCalledWith(
      args
    );
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

    expect(mockWorkflowOrchestrator.executeRunWorkflow).toHaveBeenCalledWith({
      input: 'test.json',
      schema: 'schema.ts',
      output: 'new/dir/output',
      retries: '3',
    });
  });
});
