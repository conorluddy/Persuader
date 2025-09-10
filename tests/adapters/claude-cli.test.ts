import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClaudeCLIAdapter, _setExecAsync, _resetExecAsync } from '../../src/adapters/claude-cli.js';

// Mock child process module first
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Import the mocked functions after the mock
import { spawn } from 'node:child_process';
const mockSpawn = vi.mocked(spawn);
const mockExecAsync = vi.fn();

// Helper to create a mock child process
const createMockChildProcess = (stdout: string, stderr: string = '', exitCode: number = 0) => {
  const mockChild = {
    stdout: {
      on: vi.fn((event, callback) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(stdout)), 0);
        }
      }),
    },
    stderr: {
      on: vi.fn((event, callback) => {
        if (event === 'data' && stderr) {
          setTimeout(() => callback(Buffer.from(stderr)), 0);
        }
      }),
    },
    stdin: {
      write: vi.fn(),
      end: vi.fn(),
    },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(exitCode), 10);
      }
    }),
  };
  return mockChild;
};

describe('ClaudeCliAdapter', () => {
  let adapter: ReturnType<typeof createClaudeCLIAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up the mock using the adapter's testing interface
    _setExecAsync(mockExecAsync);
    adapter = createClaudeCLIAdapter();
  });

  afterEach(() => {
    // Reset to default implementation
    _resetExecAsync();
  });

  it('sends prompt and parses JSON response', async () => {
    // Mock spawn for command execution with correct Claude CLI response format
    const mockResponseData = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 1000,
      duration_api_ms: 800,
      num_turns: 1,
      result: 'Test response',
      session_id: 'test-session',
      total_cost_usd: 0.001,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
      },
      uuid: 'test-uuid-123',
    };
    
    mockSpawn.mockReturnValue(createMockChildProcess(JSON.stringify(mockResponseData)));

    const result = await adapter.sendPrompt(null, 'Test prompt', {
      model: 'claude-3-haiku',
    });

    expect(result.content).toBe('Test response');
    expect(result.metadata?.model).toBe('claude-3-haiku');
    expect(mockSpawn).toHaveBeenCalled();
  });

  it('handles CLI errors gracefully', async () => {
    // Mock spawn to return a failing child process
    mockSpawn.mockReturnValue(createMockChildProcess('', 'Command failed', 1));

    await expect(
      adapter.sendPrompt(null, 'Test', { model: 'claude-3-haiku' })
    ).rejects.toThrow();
  });

  it('handles non-JSON responses by throwing error', async () => {
    // Mock spawn for plain text response (should fail since adapter expects JSON)
    mockSpawn.mockReturnValue(createMockChildProcess('Plain text response'));

    await expect(
      adapter.sendPrompt(null, 'Test prompt', {
        model: 'claude-3-haiku',
      })
    ).rejects.toThrow('Unexpected token');
  });

  it('includes model in options', async () => {
    // Mock spawn with minimal valid response
    const mockResponseData = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 100,
      duration_api_ms: 80,
      num_turns: 1,
      result: 'Test response',
      session_id: 'test-session',
      total_cost_usd: 0,
      usage: {
        input_tokens: 5,
        output_tokens: 10,
      },
      uuid: 'test-uuid-456',
    };
    
    mockSpawn.mockReturnValue(createMockChildProcess(JSON.stringify(mockResponseData)));

    await adapter.sendPrompt(null, 'Test prompt', { model: 'claude-3-sonnet' });

    // Verify spawn was called with correct arguments (model should be in args)
    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--model', 'claude-3-sonnet']),
      expect.any(Object)
    );
  });

  it('checks availability correctly', async () => {
    // Mock execAsync for availability checks (used by isAvailable method)
    mockExecAsync
      .mockResolvedValueOnce({
        stdout: '/usr/local/bin/claude',
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: 'claude 1.0.0',
        stderr: '',
      });

    const available = await adapter.isAvailable();

    expect(available).toBe(true);
    expect(mockExecAsync).toHaveBeenCalledTimes(2);
  });
});
