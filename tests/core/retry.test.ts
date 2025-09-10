import { describe, expect, it, vi } from 'vitest';
import { retryWithFeedback } from '../../src/core/retry.js';

describe('retryWithFeedback', () => {
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
      .mockResolvedValueOnce({ success: false, error: { type: 'validation', code: 'test', message: 'First failure', timestamp: new Date(), retryable: true, details: {} } })
      .mockResolvedValueOnce({ success: false, error: { type: 'validation', code: 'test', message: 'Second failure', timestamp: new Date(), retryable: true, details: {} } })
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
      .mockResolvedValue({ success: false, error: { type: 'provider', code: 'test', message: 'Persistent failure', provider: 'test', timestamp: new Date(), retryable: true, details: {} } });

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
    const firstError = { type: 'validation', code: 'test', message: 'Validation error', timestamp: new Date(), retryable: true, details: {} };
    const operation = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: firstError })
      .mockResolvedValue({ success: true, value: 'fixed' });

    const result = await retryWithFeedback({
      operation,
      maxAttempts: 2,
      baseDelay: 10,
    });

    expect(result.success).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
    // Second call should have the error from the first attempt
    expect(operation).toHaveBeenNthCalledWith(2, 2, firstError);
  });

  it('accumulates errors across attempts', async () => {
    const errors = ['Error 1', 'Error 2', 'Error 3'];
    const operation = vi.fn();
    errors.forEach(err => {
      operation.mockResolvedValueOnce({ success: false, error: { type: 'validation', code: 'test', message: err, timestamp: new Date(), retryable: true, details: {} } });
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
