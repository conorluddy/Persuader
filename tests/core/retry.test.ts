import { describe, expect, it, vi } from 'vitest';
import { retryWithFeedback } from '../../src/core/retry.js';

describe.skip('retryWithFeedback', () => {
  it('succeeds on first attempt', async () => {
    const operation = vi
      .fn()
      .mockResolvedValue({ success: true, value: 'result' });

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('result');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(operation).toHaveBeenCalledWith(1, undefined);
  });

  it('retries on failure and eventually succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue({ success: true, value: 'success' });

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('fails after max retries', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error('Persistent failure'));

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('includes feedback in retry attempts', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Validation error'))
      .mockResolvedValue({ success: true, value: 'fixed' });

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 2,
      baseDelay: 10,
    });

    expect(result.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
    // Second call should have the error from the first attempt
    expect(operation).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('accumulates errors across attempts', async () => {
    const errors = ['Error 1', 'Error 2', 'Error 3'];
    const operation = vi.fn();
    errors.forEach(err => {
      operation.mockRejectedValueOnce(new Error(err));
    });

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 3,
      baseDelay: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.allErrors).toHaveLength(3);
  });
});
