/**
 * Regression tests for Session ID Translation Fix (GitHub Issue #33)
 * 
 * Tests the session coordinator's ability to translate SessionManager IDs
 * to provider session IDs, ensuring sessions work with schemas.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { coordinateSession } from '../session-coordinator.js';
import type { ProcessedConfiguration } from '../configuration-manager.js';
import type { ProviderAdapter } from '../../../types/index.js';
import { z } from 'zod';

// Mock session manager
const mockSessionManager = {
  getSession: vi.fn(),
};

// Mock the session manager import
vi.mock('../../../session/manager.js', () => ({
  createSessionManager: () => mockSessionManager,
}));

// Test schema for consistency
const testSchema = z.object({
  answer: z.string(),
  confidence: z.number(),
});

// Mock provider adapter
const createMockProvider = (name: string = 'test-provider'): ProviderAdapter => ({
  name,
  supportsSession: true,
  sendPrompt: vi.fn(),
  createSession: vi.fn(),
});

// Mock configuration
const createMockConfig = <T>(sessionId?: string): ProcessedConfiguration<T> => ({
  schema: testSchema as z.ZodSchema<unknown>,
  input: 'test input',
  sessionId,
  context: undefined,
  lens: undefined,
  exampleOutput: undefined,
  retries: 3,
  model: 'test-model',
  providerOptions: {
    maxTokens: 1000,
    temperature: 0.7,
  },
});

describe('Session Coordinator - Session ID Translation Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('coordinateSession', () => {
    it('should translate SessionManager ID to provider session ID', async () => {
      const provider = createMockProvider('claude-cli');
      const sessionManagerId = 'session-mgr-123';
      const providerSessionId = 'claude-session-456';
      const config = createMockConfig(sessionManagerId);

      // Mock session exists in SessionManager with provider session ID
      mockSessionManager.getSession.mockResolvedValue({
        id: sessionManagerId,
        metadata: { provider: 'claude-cli' },
        providerData: { providerSessionId },
      });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(providerSessionId); // Should return provider session ID
      expect(mockSessionManager.getSession).toHaveBeenCalledWith(sessionManagerId);
    });

    it('should use original ID when session not found in SessionManager', async () => {
      const provider = createMockProvider('claude-cli');
      const directProviderSessionId = 'claude-direct-789';
      const config = createMockConfig(directProviderSessionId);

      // Mock session not found in SessionManager
      mockSessionManager.getSession.mockResolvedValue(null);

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(directProviderSessionId); // Should use original ID
    });

    it('should handle provider mismatch gracefully', async () => {
      const provider = createMockProvider('openai');
      const sessionManagerId = 'session-mgr-456';
      const config = createMockConfig(sessionManagerId);

      // Mock session exists but for different provider
      mockSessionManager.getSession.mockResolvedValue({
        id: sessionManagerId,
        metadata: { provider: 'claude-cli' }, // Different provider
        providerData: { providerSessionId: 'claude-session-789' },
      });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionManagerId); // Should fallback to original ID
    });

    it('should handle missing provider session ID', async () => {
      const provider = createMockProvider('claude-cli');
      const sessionManagerId = 'session-mgr-789';
      const config = createMockConfig(sessionManagerId);

      // Mock session exists but no provider session ID
      mockSessionManager.getSession.mockResolvedValue({
        id: sessionManagerId,
        metadata: { provider: 'claude-cli' },
        providerData: {}, // No providerSessionId
      });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionManagerId); // Should fallback to original ID
    });

    it('should proceed without session when no session ID provided', async () => {
      const provider = createMockProvider('test-provider');
      provider.supportsSession = false;
      const config = createMockConfig(); // No sessionId

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeUndefined();
      expect(mockSessionManager.getSession).not.toHaveBeenCalled();
    });

    it('should handle session manager errors gracefully', async () => {
      const provider = createMockProvider('claude-cli');
      const sessionManagerId = 'session-mgr-error';
      const config = createMockConfig(sessionManagerId);

      // Mock session manager throws error
      mockSessionManager.getSession.mockRejectedValue(new Error('Session storage error'));

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionManagerId); // Should fallback to original ID
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null providerData gracefully', async () => {
      const provider = createMockProvider('claude-cli');
      const sessionManagerId = 'session-mgr-null-data';
      const config = createMockConfig(sessionManagerId);

      mockSessionManager.getSession.mockResolvedValue({
        id: sessionManagerId,
        metadata: { provider: 'claude-cli' },
        providerData: null, // Null provider data
      });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionManagerId);
    });

    it('should handle undefined providerData gracefully', async () => {
      const provider = createMockProvider('claude-cli');
      const sessionManagerId = 'session-mgr-undef-data';
      const config = createMockConfig(sessionManagerId);

      mockSessionManager.getSession.mockResolvedValue({
        id: sessionManagerId,
        metadata: { provider: 'claude-cli' },
        // providerData is undefined
      });

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionManagerId);
    });
  });

  describe('Schema Compatibility (GitHub Issue #33)', () => {
    it('should work correctly when schema is present', async () => {
      const provider = createMockProvider('claude-cli');
      const sessionManagerId = 'session-with-schema';
      const providerSessionId = 'claude-session-with-schema';
      
      // Configuration with schema (the original bug scenario)
      const configWithSchema = createMockConfig(sessionManagerId);
      expect(configWithSchema.schema).toBeDefined();

      mockSessionManager.getSession.mockResolvedValue({
        id: sessionManagerId,
        metadata: { provider: 'claude-cli' },
        providerData: { providerSessionId },
      });

      const result = await coordinateSession(configWithSchema, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(providerSessionId);
      // This test passing means the fix for GitHub Issue #33 is working
    });

    it('should maintain backwards compatibility for direct provider sessions', async () => {
      const provider = createMockProvider('claude-cli');
      const directProviderSessionId = 'direct-claude-session-123';
      const config = createMockConfig(directProviderSessionId);

      // Mock session not found in SessionManager (direct provider session)
      mockSessionManager.getSession.mockResolvedValue(null);

      const result = await coordinateSession(config, provider);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(directProviderSessionId);
      // Direct provider sessions should continue to work
    });
  });
});