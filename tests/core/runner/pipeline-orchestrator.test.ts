/**
 * Tests for Pipeline Orchestrator
 *
 * Comprehensive tests for the main pipeline orchestration flow including
 * configuration processing, session coordination, execution, and result processing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { orchestratePipeline } from '../../../src/core/runner/pipeline-orchestrator.js';
import type { Options, ProviderAdapter, Result, ValidationError, ProviderError } from '../../../src/types/index.js';

// Mock all dependencies
vi.mock('../../../src/adapters/claude-cli.js');
vi.mock('../../../src/utils/logger.js');
vi.mock('../../../src/core/runner/configuration-manager.js');
vi.mock('../../../src/core/runner/session-coordinator.js');
vi.mock('../../../src/core/runner/execution-engine.js');
vi.mock('../../../src/core/runner/result-processor.js');

// Import mocked modules
import * as claudeCliModule from '../../../src/adapters/claude-cli.js';
import * as loggerModule from '../../../src/utils/logger.js';
import * as configManagerModule from '../../../src/core/runner/configuration-manager.js';
import * as sessionCoordinatorModule from '../../../src/core/runner/session-coordinator.js';
import * as executionEngineModule from '../../../src/core/runner/execution-engine.js';
import * as resultProcessorModule from '../../../src/core/runner/result-processor.js';

const createClaudeCLIAdapter = vi.mocked(claudeCliModule.createClaudeCLIAdapter);
const createLogger = vi.mocked(loggerModule.createLogger);
const setGlobalLogLevel = vi.mocked(loggerModule.setGlobalLogLevel);
const setGlobalLogger = vi.mocked(loggerModule.setGlobalLogger);
const processConfiguration = vi.mocked(configManagerModule.processConfiguration);
const coordinateSession = vi.mocked(sessionCoordinatorModule.coordinateSession);
const executeWithRetry = vi.mocked(executionEngineModule.executeWithRetry);
const processResult = vi.mocked(resultProcessorModule.processResult);

// Test fixtures
const testSchema = z.object({
  name: z.string(),
  age: z.number(),
});

type TestOutput = z.infer<typeof testSchema>;

const createMockOptions = (overrides: Partial<Options<TestOutput>> = {}): Options<TestOutput> => ({
  schema: testSchema,
  input: 'test input',
  ...overrides,
});

const createMockProvider = (overrides: Partial<ProviderAdapter> = {}): ProviderAdapter => ({
  name: 'test-provider',
  supportsSession: false,
  sendPrompt: vi.fn(),
  ...overrides,
});

const createMockProcessedConfig = () => ({
  schema: testSchema,
  input: 'test input',
  retries: 3,
  model: 'test-model',
  providerOptions: {
    maxTokens: 1000,
    temperature: 0.7,
  },
});

const createMockSuccessResult = (): Result<TestOutput> => ({
  ok: true,
  value: { name: 'John', age: 30 },
  attempts: 2,
  metadata: {
    executionTimeMs: 1500,
    startedAt: new Date(),
    completedAt: new Date(),
    provider: 'test-provider',
  },
  sessionId: 'session-123',
});

const createMockErrorResult = (): Result<TestOutput> => ({
  ok: false,
  error: {
    type: 'validation',
    code: 'schema_mismatch',
    message: 'Schema validation failed',
    timestamp: new Date(),
    retryable: false,
    issues: [],
    rawValue: '{"invalid": true}',
    suggestions: [],
    failureMode: 'schema_confusion',
    retryStrategy: 'session_reset',
    structuredFeedback: {
      problemSummary: 'Schema mismatch',
      specificIssues: [],
      correctionInstructions: [],
    },
  },
  attempts: 3,
  metadata: {
    executionTimeMs: 2000,
    startedAt: new Date(),
    completedAt: new Date(),
    provider: 'test-provider',
  },
});

describe('orchestratePipeline', () => {
  let mockProvider: ProviderAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock setup
    mockProvider = createMockProvider();
    createClaudeCLIAdapter.mockReturnValue(mockProvider);
    
    processConfiguration.mockReturnValue(createMockProcessedConfig());
    
    coordinateSession.mockResolvedValue({
      success: true,
      sessionId: 'session-123',
    });
    
    executeWithRetry.mockResolvedValue({
      success: true,
      value: { name: 'John', age: 30 },
      attempts: 2,
    });
    
    processResult.mockReturnValue(createMockSuccessResult());
    
    // Mock logger functions
    createLogger.mockReturnValue({} as any);
    setGlobalLogLevel.mockImplementation(() => {});
    setGlobalLogger.mockImplementation(() => {});
  });

  describe('successful pipeline execution', () => {
    it('should execute complete pipeline successfully with default provider', async () => {
      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(true);
      expect(result.value).toEqual({ name: 'John', age: 30 });
      expect(result.attempts).toBe(2);
      expect(result.sessionId).toBe('session-123');
      
      // Verify all steps were called
      expect(processConfiguration).toHaveBeenCalledWith(options);
      expect(coordinateSession).toHaveBeenCalledWith(
        createMockProcessedConfig(),
        mockProvider
      );
      expect(executeWithRetry).toHaveBeenCalledWith(
        createMockProcessedConfig(),
        mockProvider,
        'session-123',
        expect.any(Object) // sessionManager parameter
      );
      expect(processResult).toHaveBeenCalled();
    });

    it('should execute pipeline with custom provider', async () => {
      const customProvider = createMockProvider({ name: 'custom-provider' });
      const options = createMockOptions();

      await orchestratePipeline(options, customProvider);

      expect(createClaudeCLIAdapter).not.toHaveBeenCalled();
      expect(coordinateSession).toHaveBeenCalledWith(
        createMockProcessedConfig(),
        customProvider
      );
    });

    it('should execute pipeline without session', async () => {
      coordinateSession.mockResolvedValue({
        success: true,
      });

      const options = createMockOptions();

      await orchestratePipeline(options);

      expect(executeWithRetry).toHaveBeenCalledWith(
        createMockProcessedConfig(),
        mockProvider,
        undefined,
        expect.any(Object) // sessionManager parameter
      );
    });
  });

  describe('logging configuration', () => {
    it('should configure logging when logLevel is provided', async () => {
      const options = createMockOptions({ logLevel: 'info' });

      await orchestratePipeline(options);

      expect(setGlobalLogLevel).toHaveBeenCalledWith('info');
      expect(createLogger).not.toHaveBeenCalled(); // Only for debug level
    });

    it('should enable JSONL logging for debug level', async () => {
      const mockLogger = { debug: vi.fn(), info: vi.fn() } as any;
      createLogger.mockReturnValue(mockLogger);
      
      const options = createMockOptions({ logLevel: 'debug' });

      await orchestratePipeline(options);

      expect(setGlobalLogLevel).toHaveBeenCalledWith('debug');
      expect(createLogger).toHaveBeenCalledWith({
        level: 'debug',
        jsonlLogging: true,
        logsDirectory: './logs',
      });
      expect(setGlobalLogger).toHaveBeenCalledWith(mockLogger);
    });

    it('should not configure logging when logLevel is not provided', async () => {
      const options = createMockOptions();

      await orchestratePipeline(options);

      expect(setGlobalLogLevel).not.toHaveBeenCalled();
      expect(createLogger).not.toHaveBeenCalled();
    });
  });

  describe('session coordination failures', () => {
    it('should handle session coordination failure', async () => {
      const sessionError: ProviderError = {
        type: 'provider',
        code: 'session_creation_failed',
        message: 'Failed to create session',
        provider: 'test-provider',
        timestamp: new Date(),
        retryable: false,
        details: {},
      };

      coordinateSession.mockResolvedValue({
        success: false,
        error: sessionError,
      });

      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(false);
      expect(result.error).toEqual(sessionError);
      expect(result.attempts).toBe(0);
      
      // Should not proceed to execution
      expect(executeWithRetry).not.toHaveBeenCalled();
    });

    it('should handle session coordination failure without error object', async () => {
      coordinateSession.mockResolvedValue({
        success: false,
      });

      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('session_coordination_failed');
      expect(result.error?.message).toContain('Session coordination failed without specific error');
    });
  });

  describe('execution failures', () => {
    it('should handle execution failure and return processed error result', async () => {
      const executionError: ValidationError = {
        type: 'validation',
        code: 'schema_mismatch',
        message: 'Validation failed',
        timestamp: new Date(),
        retryable: false,
        issues: [],
        rawValue: 'invalid',
        suggestions: [],
        failureMode: 'schema_confusion',
        retryStrategy: 'session_reset',
        structuredFeedback: {
          problemSummary: 'Schema mismatch',
          specificIssues: [],
          correctionInstructions: [],
        },
      };

      executeWithRetry.mockResolvedValue({
        success: false,
        error: executionError,
        attempts: 3,
      });

      const errorResult = createMockErrorResult();
      processResult.mockReturnValue(errorResult);

      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('validation');
      expect(result.attempts).toBe(3);
    });
  });

  describe('configuration processing failures', () => {
    it('should handle configuration processing errors', async () => {
      const configError = new Error('Invalid schema configuration');
      processConfiguration.mockImplementation(() => {
        throw configError;
      });

      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('orchestration_failed');
      expect(result.error?.message).toContain('Invalid schema configuration');
      expect(result.attempts).toBe(0);
    });
  });

  describe('unexpected orchestration errors', () => {
    it('should handle unexpected errors during orchestration', async () => {
      const unexpectedError = new Error('Unexpected system failure');
      executeWithRetry.mockRejectedValue(unexpectedError);

      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('orchestration_failed');
      expect(result.error?.message).toContain('Unexpected system failure');
    });

    it('should handle non-Error thrown objects', async () => {
      executeWithRetry.mockRejectedValue('String error');

      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(false);
      expect(result.error?.type).toBe('provider');
      expect(result.error?.code).toBe('orchestration_failed');
      expect(result.error?.message).toContain('Unknown error');
    });

    it('should handle null/undefined thrown values', async () => {
      executeWithRetry.mockRejectedValue(null);

      const options = createMockOptions();

      const result = await orchestratePipeline(options);

      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain('Unknown error');
    });
  });

  describe('metadata and timing', () => {
    it('should measure and include execution time', async () => {
      const startTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => startTime);

      const options = createMockOptions();

      // Mock time progression
      let callCount = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        if (callCount === 0) {
          callCount++;
          return startTime;
        }
        return startTime + 1500; // 1.5 seconds later
      });

      const result = await orchestratePipeline(options);

      expect(result.metadata.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.startedAt).toBeDefined();
      expect(result.metadata.completedAt).toBeDefined();
      expect(result.metadata.provider).toBe('test-provider');
    });

    it('should handle provider metadata correctly', async () => {
      const customProvider = createMockProvider({
        name: 'custom-provider-v2',
      });

      const options = createMockOptions();

      await orchestratePipeline(options, customProvider);

      const processResultCall = processResult.mock.calls[0];
      expect(processResultCall[3]).toBe(customProvider); // Provider passed to processResult
    });
  });

  describe('option validation and processing', () => {
    it('should process options with all optional fields', async () => {
      const options = createMockOptions({
        context: 'Test context',
        lens: 'Test lens',
        sessionId: 'provided-session',
        output: 'output.json',
        retries: 5,
        model: 'custom-model',
        logLevel: 'warn',
        providerOptions: { customParam: 'value' },
      });

      await orchestratePipeline(options);

      expect(processConfiguration).toHaveBeenCalledWith({
        schema: testSchema,
        input: 'test input',
        context: 'Test context',
        lens: 'Test lens',
        sessionId: 'provided-session',
        output: 'output.json',
        retries: 5,
        model: 'custom-model',
        logLevel: 'warn',
        providerOptions: { customParam: 'value' },
      });
    });
  });

  describe('integration flow verification', () => {
    it('should call all pipeline steps in correct order', async () => {
      const options = createMockOptions();
      const mockProvider = createMockProvider();

      await orchestratePipeline(options, mockProvider);

      // Verify call order by checking mock call indices
      expect(processConfiguration).toHaveBeenCalledBefore(coordinateSession as any);
      expect(coordinateSession).toHaveBeenCalledBefore(executeWithRetry as any);
      expect(executeWithRetry).toHaveBeenCalledBefore(processResult as any);
    });

    it('should pass data correctly between pipeline steps', async () => {
      const mockConfig = createMockProcessedConfig();
      processConfiguration.mockReturnValue(mockConfig);

      const sessionResult = { success: true, sessionId: 'flow-session' };
      coordinateSession.mockResolvedValue(sessionResult);

      const executionResult = {
        success: true,
        value: { name: 'Flow', age: 25 },
        attempts: 1,
      };
      executeWithRetry.mockResolvedValue(executionResult);

      const options = createMockOptions();
      const mockProvider = createMockProvider();

      await orchestratePipeline(options, mockProvider);

      // Verify data flow
      expect(coordinateSession).toHaveBeenCalledWith(mockConfig, mockProvider);
      expect(executeWithRetry).toHaveBeenCalledWith(
        mockConfig,
        mockProvider,
        'flow-session',
        expect.any(Object) // sessionManager parameter
      );
      expect(processResult).toHaveBeenCalledWith(
        executionResult,
        'flow-session',
        expect.any(Number), // startTime
        mockProvider
      );
    });
  });
});