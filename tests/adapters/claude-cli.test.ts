import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClaudeCLIAdapter } from '../../src/adapters/claude-cli.js';

// Create hoisted mocks
const mockExecAsync = vi.hoisted(() => vi.fn());

// Mock the entire child_process and util modules
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: () => mockExecAsync,
}));

describe.skip('ClaudeCliAdapter', () => {
  let adapter: ReturnType<typeof createClaudeCLIAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createClaudeCLIAdapter();
  });

  it('sends prompt and parses JSON response', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: JSON.stringify({
        content: 'Test response',
        model: 'claude-3-haiku',
        stop_reason: 'end_turn',
      }),
      stderr: '',
    });

    const result = await adapter.sendPrompt(null, 'Test prompt', {
      model: 'claude-3-haiku',
    });

    expect(result.content).toBe('Test response');
    expect(result.model).toBe('claude-3-haiku');
    expect(mockExecAsync).toHaveBeenCalled();
  });

  it('handles CLI errors gracefully', async () => {
    mockExecAsync.mockRejectedValue(new Error('Command failed'));

    await expect(
      adapter.sendPrompt(null, 'Test', { model: 'claude-3-haiku' })
    ).rejects.toThrow();
  });

  it('handles non-JSON responses', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: 'Plain text response',
      stderr: '',
    });

    const result = await adapter.sendPrompt(null, 'Test prompt', {
      model: 'claude-3-haiku',
    });

    expect(result.content).toBe('Plain text response');
  });

  it('includes model in options', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: JSON.stringify({ content: 'Test response' }),
      stderr: '',
    });

    await adapter.sendPrompt(null, 'Test prompt', { model: 'claude-3-sonnet' });

    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('claude-3-sonnet'),
      expect.any(Object)
    );
  });

  it('checks availability correctly', async () => {
    mockExecAsync.mockResolvedValue({
      stdout: '/usr/local/bin/claude',
      stderr: '',
    });

    const available = await adapter.isAvailable();

    expect(available).toBe(true);
  });
});
