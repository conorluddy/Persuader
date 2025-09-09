import { describe, expect, it, vi } from 'vitest';
import { retryWithFeedback } from '../../src/core/retry.js';

describe.skip('retryWithFeedback - simple tests', () => {
  it('succeeds without retry', async () => {
    const operation = vi
      .fn()
      .mockResolvedValue({ success: true, value: 'success' });

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on failure', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue({ success: true, value: 'success' });

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 2,
      baseDelay: 10,
    });

    expect(result.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('stops after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Always fails'));

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(false);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
