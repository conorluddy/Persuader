/**
 * Regression test for Issue #33: Session ID confusion when using schemas
 * 
 * This test ensures that session IDs are correctly preserved through the
 * entire pipeline, especially when schemas and success feedback are used.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { coordinateSession } from '../../src/core/runner/session-coordinator.js';
import { orchestratePipeline } from '../../src/core/runner/pipeline-orchestrator.js';
import type { Options } from '../../src/types/pipeline.js';
import type { ProviderAdapter } from '../../src/types/provider.js';

describe('Issue #33 Regression: Session ID preservation', () => {
  let mockProvider: ProviderAdapter;
  let mockSessionManager: any;
  const testSessionId = 'test-session-123';
  const testSchema = z.object({
    result: z.string(),
    value: z.number(),
  });

  beforeEach(() => {
    mockProvider = {
      name: 'test-provider',
      supportsSession: true,
      sendPrompt: vi.fn().mockResolvedValue({
        content: '{"result": "success", "value": 42}',
        tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      }),
      createSession: vi.fn().mockResolvedValue(testSessionId),
      sendSuccessFeedback: vi.fn().mockResolvedValue(undefined),
    };

    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({
        id: testSessionId,
        context: 'test context',
        metadata: { provider: 'test-provider' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getSession: vi.fn().mockResolvedValue({
        id: testSessionId,
        context: 'test context',
        metadata: { provider: 'test-provider' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      updateSession: vi.fn(),
      addSuccessFeedback: vi.fn().mockResolvedValue({
        id: testSessionId,
        successFeedback: [{ message: 'test', timestamp: new Date() }],
      }),
      getSuccessFeedback: vi.fn().mockResolvedValue([]),
    };
  });

  it('should preserve session ID when using schema WITHOUT success feedback', async () => {
    const options: Options<typeof testSchema> = {
      schema: testSchema,
      input: 'test input',
      sessionId: testSessionId,
      maxRetries: 3,
    };

    const result = await orchestratePipeline(options, mockProvider, mockSessionManager);
    
    // Verify session ID is preserved
    expect(result.sessionId).toBe(testSessionId);
    
    // Verify provider was called with correct session ID
    expect(mockProvider.sendPrompt).toHaveBeenCalledWith(
      testSessionId,
      expect.any(String),
      expect.any(Object)
    );
  });

  it('should preserve session ID when using schema WITH success feedback', async () => {
    const options: Options<typeof testSchema> = {
      schema: testSchema,
      input: 'test input',
      sessionId: testSessionId,
      successMessage: 'Great job!', // Adding success feedback
      maxRetries: 3,
    };

    const result = await orchestratePipeline(options, mockProvider, mockSessionManager);
    
    // Verify session ID is preserved
    expect(result.sessionId).toBe(testSessionId);
    
    // Verify provider was called with correct session ID
    expect(mockProvider.sendPrompt).toHaveBeenCalledWith(
      testSessionId,
      expect.any(String),
      expect.any(Object)
    );
    
    // Verify success feedback preserved session ID if called
    if (mockProvider.sendSuccessFeedback) {
      const calls = vi.mocked(mockProvider.sendSuccessFeedback).mock.calls;
      if (calls.length > 0) {
        expect(calls[0][0]).toBe(testSessionId);
      }
    }
  });

  it('should handle session coordination correctly with schemas', async () => {
    const result = await coordinateSession(
      {
        schema: testSchema,
        input: 'test input',
        sessionId: testSessionId, // Existing session ID
        context: 'test context',
      } as any,
      mockProvider
    );

    // Should use existing session ID, not create new one
    expect(result.sessionId).toBe(testSessionId);
    expect(mockProvider.createSession).not.toHaveBeenCalled();
  });

  it('should not confuse session IDs between different pipeline stages', async () => {
    // Simulate multiple retries to ensure session ID is stable
    mockProvider.sendPrompt = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce({
        content: '{"result": "success", "value": 42}',
        tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

    const options: Options<typeof testSchema> = {
      schema: testSchema,
      input: 'test input',
      sessionId: testSessionId,
      successMessage: 'Well done!',
      maxRetries: 3,
    };

    const result = await orchestratePipeline(options, mockProvider, mockSessionManager);
    
    // Session ID should remain consistent
    expect(result.sessionId).toBe(testSessionId);
    
    // All calls should use same session ID
    const sendPromptCalls = vi.mocked(mockProvider.sendPrompt).mock.calls;
    for (const call of sendPromptCalls) {
      expect(call[0]).toBe(testSessionId);
    }
  });
});