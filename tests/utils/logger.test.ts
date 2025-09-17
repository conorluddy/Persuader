/**
 * Logger Truncation Tests
 * 
 * Tests the optional truncation functionality in the logger system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLogger, type LoggerConfig } from '../../src/utils/logger.js';

describe('Logger Truncation', () => {
  // Mock console.log to capture output
  const mockLog = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log
    vi.spyOn(console, 'log').mockImplementation(mockLog);
  });

  describe('truncateText behavior', () => {
    it('should show full prompts by default (truncate not set)', () => {
      const logger = createLogger({ level: 'debug' });
      const longPrompt = 'A'.repeat(2000); // 2000 character prompt
      
      logger.llmRequest({
        provider: 'test',
        prompt: longPrompt,
        requestId: 'test-1'
      });

      // Should contain the full prompt without truncation
      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM REQUEST') && call[0].includes('AAAA')
      );
      expect(logCall).toBeTruthy();
      expect(logCall[0]).toContain(longPrompt);
      expect(logCall[0]).not.toContain('(truncated)');
    });

    it('should show full prompts when truncate is explicitly false', () => {
      const logger = createLogger({ 
        level: 'debug',
        truncate: false 
      });
      const longPrompt = 'B'.repeat(2000);
      
      logger.llmRequest({
        provider: 'test',
        prompt: longPrompt,
        requestId: 'test-2'
      });

      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM REQUEST') && call[0].includes('BBBB')
      );
      expect(logCall).toBeTruthy();
      expect(logCall[0]).toContain(longPrompt);
      expect(logCall[0]).not.toContain('(truncated)');
    });

    it('should truncate prompts when truncate is true', () => {
      const logger = createLogger({ 
        level: 'debug',
        truncate: true,
        maxPromptLength: 100 
      });
      const longPrompt = 'C'.repeat(200); // 200 characters, limit is 100
      
      logger.llmRequest({
        provider: 'test',
        prompt: longPrompt,
        requestId: 'test-3'
      });

      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM REQUEST')
      );
      expect(logCall).toBeTruthy();
      expect(logCall[0]).toContain('(truncated)');
      expect(logCall[0]).toContain('C'.repeat(100) + '...');
      expect(logCall[0]).not.toContain('C'.repeat(200));
    });

    it('should truncate responses when truncate is true', () => {
      const logger = createLogger({ 
        level: 'debug',
        truncate: true,
        maxResponseLength: 50 
      });
      const longResponse = 'D'.repeat(100); // 100 characters, limit is 50
      
      logger.llmResponse({
        provider: 'test',
        response: longResponse,
        requestId: 'test-4'
      });

      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM RESPONSE')
      );
      expect(logCall).toBeTruthy();
      expect(logCall[0]).toContain('(truncated)');
      expect(logCall[0]).toContain('D'.repeat(50) + '...');
      expect(logCall[0]).not.toContain('D'.repeat(100));
    });

    it('should not truncate short content even when truncate is true', () => {
      const logger = createLogger({ 
        level: 'debug',
        truncate: true,
        maxPromptLength: 1000 
      });
      const shortPrompt = 'Short prompt';
      
      logger.llmRequest({
        provider: 'test',
        prompt: shortPrompt,
        requestId: 'test-5'
      });

      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM REQUEST')
      );
      expect(logCall).toBeTruthy();
      expect(logCall[0]).toContain(shortPrompt);
      expect(logCall[0]).not.toContain('(truncated)');
    });

    it('should handle undefined/null text gracefully', () => {
      const logger = createLogger({ 
        level: 'debug',
        truncate: true 
      });
      
      expect(() => {
        logger.llmRequest({
          provider: 'test',
          prompt: '',
          requestId: 'test-6'
        });
      }).not.toThrow();

      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM REQUEST')
      );
      expect(logCall).toBeTruthy();
    });
  });

  describe('backward compatibility', () => {
    it('should maintain existing behavior for legacy logger configurations', () => {
      // Old configuration without truncate parameter
      const legacyConfig: LoggerConfig = {
        level: 'debug',
        maxPromptLength: 1000,
        maxResponseLength: 1000
      };
      
      const logger = createLogger(legacyConfig);
      const longPrompt = 'E'.repeat(2000);
      
      logger.llmRequest({
        provider: 'test',
        prompt: longPrompt,
        requestId: 'legacy-test'
      });

      // Should show full prompt (improved behavior)
      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM REQUEST')
      );
      expect(logCall).toBeTruthy();
      expect(logCall[0]).toContain(longPrompt);
      expect(logCall[0]).not.toContain('(truncated)');
    });
  });

  describe('edge cases', () => {
    it('should handle very large prompts without memory issues', () => {
      const logger = createLogger({ level: 'debug' });
      const veryLongPrompt = 'X'.repeat(100000); // 100KB prompt
      
      expect(() => {
        logger.llmRequest({
          provider: 'test',
          prompt: veryLongPrompt,
          requestId: 'large-test'
        });
      }).not.toThrow();
    });

    it('should respect custom maxPromptLength when truncating', () => {
      const customLength = 42;
      const logger = createLogger({ 
        level: 'debug',
        truncate: true,
        maxPromptLength: customLength
      });
      const longPrompt = 'Y'.repeat(100);
      
      logger.llmRequest({
        provider: 'test',
        prompt: longPrompt,
        requestId: 'custom-length-test'
      });

      const logCall = mockLog.mock.calls.find(call => 
        call[0].includes('LLM REQUEST')
      );
      expect(logCall).toBeTruthy();
      expect(logCall[0]).toContain('Y'.repeat(customLength) + '...');
    });
  });
});