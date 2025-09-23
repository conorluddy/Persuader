/**
 * Claude CLI Provider Adapter
 *
 * Simple integration with Claude CLI using documented commands.
 * Uses `claude -p` for prompts and `--output-format json` for structured responses.
 */

import { exec, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import {
  extractContentFromResponse,
  getTokenUsage,
  parseClaudeCLIResponse,
} from '../schemas/claude-cli-response.js';
import {
  CLAUDE_CLI_BINARY,
  CLAUDE_CLI_MAX_BUFFER,
  DEFAULT_MODEL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HTTP_BAD_GATEWAY,
  HTTP_GATEWAY_TIMEOUT,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_TOO_MANY_REQUESTS,
  HTTP_UNAUTHORIZED,
} from '../shared/constants/index.js';
import type {
  ProviderAdapter,
  ProviderHealth,
  ProviderPromptOptions,
  ProviderResponse,
  ProviderSessionOptions,
} from '../types/index.js';
import {
  debug,
  info,
  llmError,
  llmRequest,
  llmResponse,
  error as logError,
  logPerformance,
  warn,
} from '../utils/logger.js';

// Create execAsync function - can be overridden for testing
let execAsync = promisify(exec);

/**
 * Configuration options for Claude CLI adapter
 */
export interface ClaudeCLIAdapterConfig {
  /** Path to Claude CLI binary (defaults to 'claude') */
  readonly binary?: string;

  /** Timeout for CLI operations in milliseconds */
  readonly timeout?: number;

  /** Maximum buffer size for CLI output */
  readonly maxBuffer?: number;

  /** Whether to use JSON mode by default */
  readonly defaultJsonMode?: boolean;
}

/**
 * Claude CLI adapter for Persuader framework
 *
 * Provides integration with Anthropic's Claude CLI tool, supporting:
 * - JSON mode for structured output
 * - Proper shell argument escaping
 * - Comprehensive error handling and CLI-specific error messages
 * - Health monitoring and availability checks
 *
 * Session reuse is supported via Claude CLI's --resume flag, which allows
 * continuing conversations using the session_id returned from previous calls.
 */
export class ClaudeCLIAdapter implements ProviderAdapter {
  readonly name = 'claude-cli';
  readonly version = '2.0.0';
  // Claude CLI supports session reuse via --resume flag
  readonly supportsSession = true;
  readonly supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    // Aliases that Claude CLI supports
    'sonnet',
    'haiku',
    'opus',
  ] as const;

  private readonly binary: string;
  private readonly timeout: number;
  private readonly maxBuffer: number;
  constructor(config: ClaudeCLIAdapterConfig = {}) {
    this.binary = config.binary || CLAUDE_CLI_BINARY;
    this.timeout = config.timeout || DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxBuffer = config.maxBuffer || CLAUDE_CLI_MAX_BUFFER;
  }

  /**
   * Check if Claude CLI is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`which ${this.binary}`, {
        timeout: 5000,
      });

      if (!stdout.trim()) {
        return false;
      }

      // Try to run claude --version to verify it's working
      const { stdout: versionOutput } = await execAsync(
        `${this.binary} --version`,
        { timeout: 5000 }
      );

      return (
        versionOutput.toLowerCase().includes('claude') ||
        versionOutput.includes('Claude')
      );
    } catch {
      return false;
    }
  }

  /**
   * Get health status of the Claude CLI adapter
   */
  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const available = await this.isAvailable();
      const responseTime = Date.now() - startTime;

      if (!available) {
        return {
          healthy: false,
          checkedAt: new Date(),
          responseTimeMs: responseTime,
          error: 'Claude CLI not found or not responding',
          details: {
            binary: this.binary,
            timeout: this.timeout,
          },
        };
      }

      // Try a simple test call
      const testResponse = await this.sendPrompt(null, 'Say "OK"', {
        maxTokens: 10,
        temperature: 0,
      });

      return {
        healthy: true,
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        details: {
          binary: this.binary,
          testResponse: testResponse.content.substring(0, 100),
        },
      };
    } catch (error) {
      return {
        healthy: false,
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          binary: this.binary,
          error,
        },
      };
    }
  }

  /**
   * Create a new session with Claude CLI using a specific session ID
   *
   * Establishes a conversation context that can be reused across multiple
   * sendPrompt calls, enabling efficient retry loops and context preservation.
   *
   * @param context - Initial context/system prompt for the session
   * @param options - Session configuration options
   * @returns Promise resolving to session ID for use in subsequent calls
   */
  async createSession(
    context: string,
    options: ProviderSessionOptions = {}
  ): Promise<string> {
    const sessionId = randomUUID();
    const startTime = Date.now();

    info('🔗 SESSION_LIFECYCLE: Creating new Claude CLI session', {
      sessionId,
      contextLength: context.length,
      contextPreview:
        context.substring(0, 200) + (context.length > 200 ? '...' : ''),
      model: options.model || DEFAULT_MODEL,
      temperature: options.temperature,
      provider: this.name,
      timestamp: new Date().toISOString(),
    });

    debug('Creating Claude CLI session', {
      sessionId,
      contextLength: context.length,
      model: options.model,
      temperature: options.temperature,
    });

    try {
      const args: string[] = [];

      // Use JSON output for structured parsing
      args.push('--output-format', 'json');

      // Add model if specified
      if (options.model) {
        args.push('--model', options.model);
      }

      // Add temperature via system prompt appendage if specified
      let contextWithOptions = context;
      if (options.temperature !== undefined) {
        contextWithOptions += `\n\nPlease use a temperature of ${options.temperature} for your responses.`;
      }

      // Initialize session with context
      const { stdout, stderr } = await this.spawnWithStdin(
        args,
        contextWithOptions
      );

      const sessionDuration = Date.now() - startTime;

      debug('Claude CLI session created successfully', {
        sessionId,
        stdoutLength: stdout?.length || 0,
        stderrLength: stderr?.length || 0,
        sessionDurationMs: sessionDuration,
      });

      // Handle warnings but not errors
      if (stderr && !this.isWarning(stderr)) {
        warn('Claude CLI session creation stderr output', {
          sessionId,
          stderr,
        });
      } else if (stderr) {
        debug('Claude CLI session creation warning output', {
          sessionId,
          stderr,
        });
      }

      // Parse the response to ensure session was established
      const claudeResponse = parseClaudeCLIResponse(stdout);

      // Handle error responses during session creation
      if (claudeResponse.is_error) {
        const errorContent = extractContentFromResponse(claudeResponse);
        throw new Error(`Failed to create session: ${errorContent}`);
      }

      info(
        '✅ SESSION_LIFECYCLE: Claude CLI session established successfully',
        {
          sessionId,
          cost: claudeResponse.total_cost_usd,
          contextLength: context.length,
          durationMs: sessionDuration,
          model: options.model || DEFAULT_MODEL,
          provider: this.name,
          timestamp: new Date().toISOString(),
        }
      );

      info('✅ SESSION_LIFECYCLE: Claude CLI session ready for use', {
        sessionId: `${sessionId.substring(0, 8)}...`,
        readyForUse: true,
        timestamp: new Date().toISOString(),
      });

      // Return the actual session_id from Claude CLI, not our generated UUID
      return claudeResponse.session_id;
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logError('❌ SESSION_LIFECYCLE: Claude CLI session creation failed', {
        sessionId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        contextLength: context.length,
        failureDurationMs: errorDuration,
        provider: this.name,
        timestamp: new Date().toISOString(),
      });

      throw this.enhanceError(error, 'Failed to create Claude CLI session');
    }
  }

  /**
   * Execute Claude CLI with stdin for prompt input to avoid shell argument length limits
   */
  private async spawnWithStdin(
    args: string[],
    input: string
  ): Promise<{ stdout: string; stderr: string }> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          child.kill();
          reject(
            new Error(`Claude CLI command timed out after ${this.timeout}ms`)
          );
        }
      }, this.timeout);

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      child.on('close', (code) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);

          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            // Enhanced error context for exit code failures
            const errorDetails = {
              exitCode: code,
              stderr: stderr || 'No error output',
              stdout: stdout ? stdout.substring(0, 500) : 'No output',
              commandDuration: Date.now() - startTime,
            };

            // Log detailed error context for debugging
            logError(
              'Claude CLI process failed with detailed context',
              errorDetails
            );

            // Provide enhanced error message with potential causes and recommendations
            let errorMessage = `Claude CLI command failed with exit code ${code}`;
            if (code === 1) {
              // Detect likely context length issues
              const inputLength = input?.length || 0;
              if (inputLength > 10000) {
                errorMessage += ` (likely cause: context length exceeded with ${inputLength} character prompt - consider using Claude Sonnet instead of Haiku for large prompts)`;
              } else {
                errorMessage +=
                  ' (possible causes: session corruption, rate limiting, or API authentication issues)';
              }
            }
            errorMessage += `: ${stderr || 'No error output'}`;

            reject(new Error(errorMessage));
          }
        }
      });

      // Handle process error
      child.on('error', (error) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      // Send input via stdin and close it
      if (child.stdin) {
        child.stdin.write(input);
        child.stdin.end();
      } else {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          reject(new Error('Failed to access stdin of Claude CLI process'));
        }
      }
    });
  }

  /**
   * Send a prompt to Claude CLI using documented API
   */
  async sendPrompt(
    sessionId: string | null, // Use session ID for conversation continuity
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse> {
    const requestId = `claude-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    // Log the incoming request with full details
    llmRequest({
      provider: this.name,
      model: options.model || 'default',
      prompt,
      fullPrompt: prompt, // Always include full prompt for JSONL logging
      temperature: options.temperature ?? undefined,
      maxTokens: options.maxTokens ?? undefined,
      sessionId: sessionId,
      requestId,
    });

    info('🔗 SESSION_LIFECYCLE: Using Claude CLI session for prompt', {
      requestId,
      sessionId: sessionId || 'none',
      usingSession: Boolean(sessionId),
      sessionReuse: sessionId ? 'REUSING_EXISTING' : 'NO_SESSION',
      promptLength: prompt.length,
      promptPreview:
        prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
      model: options.model,
      provider: this.name,
      timestamp: new Date().toISOString(),
    });

    debug('Claude CLI sendPrompt called', {
      requestId,
      promptLength: prompt.length,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      sessionId: sessionId,
      usingSession: Boolean(sessionId),
    });

    try {
      const args: string[] = [];

      // Always use JSON output for structured parsing
      args.push('--output-format', 'json');

      // Remove default turn limit to allow unlimited conversation turns
      args.push('--max-turns', '0');

      // Resume session if provided (for conversation continuity)
      // Note: If this is a retry after a session corruption error, sessionId will be null
      if (sessionId) {
        args.push('--resume', sessionId);
      }

      // Add model if specified (only for new sessions)
      if (options.model && !sessionId) {
        args.push('--model', options.model);
      }

      // Add max tokens if specified
      // disabled: hitting errors running into max-turns issues when using this in the wild
      // maxTokens mapping to maxTurns seems wonky.
      // if (options.maxTokens) {
      //   args.push('--max-turns', String(Math.ceil(options.maxTokens / 1000))); // Rough approximation
      // }

      // Construct command without prompt (will use stdin)
      const command = `${this.binary} ${args.join(' ')}`;

      // Get model recommendation for this prompt size
      const modelRec = ClaudeCLIAdapter.getModelRecommendation(prompt.length);

      debug('Executing Claude CLI command with stdin', {
        requestId,
        binary: this.binary,
        command, // No need to hide content since prompt goes via stdin
        argsCount: args.length,
        promptLength: prompt.length,
        estimatedTokens: modelRec.estimatedTokens,
        recommendedModel: modelRec.recommendedModel,
        modelRecommendationReason: modelRec.reason,
        currentModel: options.model,
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
      });

      // Use spawn with stdin for prompt to avoid shell argument length limits
      const { stdout, stderr } = await this.spawnWithStdin(args, prompt);

      const commandDuration = Date.now() - startTime;

      debug('Claude CLI command executed', {
        requestId,
        stdoutLength: stdout?.length || 0,
        stderrLength: stderr?.length || 0,
        hasStdout: Boolean(stdout),
        hasStderr: Boolean(stderr),
        commandDurationMs: commandDuration,
      });

      // Handle warnings but not errors
      if (stderr && !this.isWarning(stderr)) {
        warn('Claude CLI stderr output', { stderr });
      } else if (stderr) {
        debug('Claude CLI warning output', { stderr });
      }

      // Parse structured JSON response
      debug('Parsing Claude CLI response', {
        requestId,
        stdoutLength: stdout?.length || 0,
        responsePreview: stdout?.substring(0, 200),
      });

      const claudeResponse = parseClaudeCLIResponse(stdout);

      // Handle error responses from Claude CLI
      if (claudeResponse.is_error) {
        const errorContent = extractContentFromResponse(claudeResponse);
        const errorDuration = Date.now() - startTime;

        llmError({
          provider: this.name,
          model: options.model || 'default',
          error: errorContent,
          requestId,
          isRetryable: this.isRetryableError(new Error(errorContent)),
        });

        logError('Claude CLI returned error response', {
          requestId,
          errorMessage: errorContent,
          sessionId: claudeResponse.session_id,
          cost: claudeResponse.total_cost_usd || 0,
          failureDurationMs: errorDuration,
          retryable: this.isRetryableError(new Error(errorContent)),
        });

        throw new Error(`Claude CLI error: ${errorContent}`);
      }

      const content = extractContentFromResponse(claudeResponse);
      const tokenUsage = getTokenUsage(claudeResponse);
      const totalDuration = Date.now() - startTime;

      // Log the successful response with full details
      llmResponse({
        provider: this.name,
        model: options.model || 'default',
        response: content,
        rawResponse: stdout, // Include raw Claude CLI response for debugging
        tokenUsage,
        cost: claudeResponse.total_cost_usd,
        durationMs: totalDuration,
        ...(claudeResponse.session_id && {
          sessionId: claudeResponse.session_id,
        }),
        requestId,
        stopReason: 'end_turn', // Claude CLI doesn't provide this explicitly
      });

      // Log performance metrics
      logPerformance('Claude CLI Request', totalDuration, {
        requestId,
        apiDurationMs: claudeResponse.duration_api_ms,
        commandDurationMs: commandDuration,
        tokenThroughput: tokenUsage.totalTokens / (totalDuration / 1000), // tokens per second
        cost: claudeResponse.total_cost_usd,
        efficiency: `${tokenUsage.totalTokens}/${totalDuration}ms`,
      });

      info('✅ SESSION_LIFECYCLE: Claude CLI prompt completed successfully', {
        requestId,
        contentLength: content?.length || 0,
        sessionId: claudeResponse.session_id,
        sessionMatches: sessionId === claudeResponse.session_id,
        cost: claudeResponse.total_cost_usd,
        tokenUsage,
        numTurns: claudeResponse.num_turns,
        durationMs: claudeResponse.duration_ms,
        totalDurationMs: totalDuration,
        provider: this.name,
        timestamp: new Date().toISOString(),
      });

      info('Claude CLI response parsed successfully', {
        requestId,
        contentLength: content?.length || 0,
        sessionId: claudeResponse.session_id,
        cost: claudeResponse.total_cost_usd,
        tokenUsage,
        numTurns: claudeResponse.num_turns,
        durationMs: claudeResponse.duration_ms,
        totalDurationMs: totalDuration,
      });

      return {
        content,
        tokenUsage,
        metadata: {
          sessionId: claudeResponse.session_id,
          model: options.model || DEFAULT_MODEL,
          jsonMode: true,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          cost: claudeResponse.total_cost_usd,
          rawResponse: claudeResponse,
        },
        truncated: false, // Claude handles this internally
        stopReason: 'end_turn',
      };
    } catch (error) {
      const errorDuration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Log the error with LLM-specific context
      llmError({
        provider: this.name,
        model: options.model || 'default',
        error: errorMessage,
        requestId,
        isRetryable: this.isRetryableError(error),
      });

      logError('Claude CLI sendPrompt failed', {
        requestId,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        binary: this.binary,
        promptLength: prompt.length,
        failureDurationMs: errorDuration,
        retryable: this.isRetryableError(error),
      });

      throw this.enhanceError(error, 'Failed to send prompt to Claude CLI');
    }
  }

  /**
   * Validate that a session is still functional
   *
   * Sends a minimal test prompt to verify the session works.
   * This helps detect session expiration or corruption issues.
   *
   * @param sessionId - Session ID to validate
   * @returns Promise resolving to validation result
   */
  async validateSession(sessionId: string): Promise<{
    valid: boolean;
    error?: string;
    responseTime?: number;
  }> {
    const startTime = Date.now();

    info('🔍 SESSION_VALIDATION: Testing session health', {
      sessionId: `${sessionId.substring(0, 8)}...`,
      provider: this.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const testResponse = await this.sendPrompt(
        sessionId,
        'Respond with just "OK" to confirm session is working.',
        {
          maxTokens: 10,
          temperature: 0,
        }
      );

      const responseTime = Date.now() - startTime;
      const isValid = testResponse.content.toLowerCase().includes('ok');

      info(
        `${isValid ? '✅' : '❌'} SESSION_VALIDATION: Session ${isValid ? 'valid' : 'invalid'}`,
        {
          sessionId: `${sessionId.substring(0, 8)}...`,
          responseTime,
          response: testResponse.content.substring(0, 50),
          provider: this.name,
          timestamp: new Date().toISOString(),
        }
      );

      return {
        valid: isValid,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      logError('❌ SESSION_VALIDATION: Session validation failed', {
        sessionId: `${sessionId.substring(0, 8)}...`,
        errorMessage,
        responseTime,
        provider: this.name,
        timestamp: new Date().toISOString(),
      });

      return {
        valid: false,
        error: errorMessage,
        responseTime,
      };
    }
  }

  /**
   * Destroy a Claude CLI session to clean up resources
   *
   * While Claude CLI doesn't have an explicit session destroy command,
   * this method provides logging and potential future cleanup capabilities.
   *
   * @param sessionId - Session ID to clean up
   */
  async destroySession(sessionId: string): Promise<void> {
    debug('Destroying Claude CLI session', { sessionId });

    // Note: Claude CLI automatically manages session lifecycle
    // Sessions expire naturally or can be manually cleaned up in the CLI
    // This method is primarily for logging and future extensibility

    info('Claude CLI session destroyed', {
      sessionId,
      note: 'Session will expire naturally in Claude CLI',
    });

    // Future enhancement: Could potentially use claude config or other CLI commands
    // to explicitly clean up sessions if such functionality becomes available
  }

  /**
   * Send success feedback to the Claude CLI session
   *
   * Provides positive reinforcement after successful validation to help the LLM
   * learn and maintain successful patterns in session-based workflows.
   *
   * @param sessionId - Session ID to send feedback to
   * @param successMessage - Positive feedback message
   * @param metadata - Optional metadata about the success
   */
  async sendSuccessFeedback(
    sessionId: string,
    successMessage: string,
    metadata?: {
      readonly attemptNumber?: number;
      readonly validatedOutput?: unknown;
      readonly timestamp?: Date;
      readonly tokenUsage?: import('../types/pipeline.js').TokenUsage;
      readonly executionTimeMs?: number;
    }
  ): Promise<void> {
    const requestId = `success-feedback-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    debug('Sending success feedback to Claude CLI session', {
      requestId,
      sessionId,
      messageLength: successMessage.length,
      attemptNumber: metadata?.attemptNumber,
      timestamp: metadata?.timestamp?.toISOString(),
    });

    try {
      // Send the success feedback as a simple prompt to reinforce the pattern
      const feedbackPrompt = `${successMessage}\n\nPlease acknowledge this feedback briefly and remember this successful approach for future similar requests.`;

      await this.sendPrompt(sessionId, feedbackPrompt, {
        maxTokens: 30, // Reduced to 30 tokens for brief acknowledgments
        temperature: 0.1, // Low temperature for consistent acknowledgment
      });

      const duration = Date.now() - startTime;

      info('Success feedback sent to Claude CLI session', {
        requestId,
        sessionId,
        messageLength: successMessage.length,
        duration,
        attemptNumber: metadata?.attemptNumber,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logError('Failed to send success feedback to Claude CLI session', {
        requestId,
        sessionId,
        errorMessage,
        messageLength: successMessage.length,
        duration,
        attemptNumber: metadata?.attemptNumber,
      });

      // Re-throw the error to let the caller handle it
      throw new Error(`Failed to send success feedback: ${errorMessage}`);
    }
  }

  // Helper methods removed - using schema-based parsing instead

  /**
   * Check if stderr output is just a warning
   */
  private isWarning(stderr: string): boolean {
    const lowerStderr = stderr.toLowerCase();
    return (
      lowerStderr.includes('warning') ||
      lowerStderr.includes('deprecated') ||
      lowerStderr.includes('notice')
    );
  }


  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes(HTTP_TOO_MANY_REQUESTS.toString()) ||
      message.includes(HTTP_BAD_GATEWAY.toString()) ||
      message.includes(HTTP_SERVICE_UNAVAILABLE.toString()) ||
      message.includes(HTTP_GATEWAY_TIMEOUT.toString()) ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      // Exit code 1 failures are often retryable (session issues, temp API problems)
      message.includes('exit code 1') ||
      message.includes('session corruption') ||
      message.includes('context length exceeded')
    );
  }

  /**
   * Enhance errors with Claude CLI specific context
   */
  private enhanceError(error: unknown, context: string): Error {
    const originalMessage =
      error instanceof Error ? error.message : String(error);

    // Check for specific error patterns and provide helpful messages
    if (originalMessage.includes('command not found')) {
      return new Error(
        `${context}: Claude CLI not found. Please install it with: npm install -g @anthropic-ai/claude-cli`
      );
    }

    if (
      originalMessage.includes('ETIMEDOUT') ||
      originalMessage.includes('timed out')
    ) {
      return new Error(
        `${context}: Claude CLI timed out after ${this.timeout}ms. The request may be too complex or the service may be slow.`
      );
    }

    if (
      originalMessage.includes('rate limit') ||
      originalMessage.includes(HTTP_TOO_MANY_REQUESTS.toString())
    ) {
      return new Error(
        `${context}: Claude API rate limit exceeded. Please wait and try again.`
      );
    }

    if (
      originalMessage.includes('unauthorized') ||
      originalMessage.includes('authentication') ||
      originalMessage.includes(HTTP_UNAUTHORIZED.toString())
    ) {
      return new Error(
        `${context}: Claude CLI authentication failed. Please run: claude auth login`
      );
    }

    if (
      originalMessage.includes('session') &&
      originalMessage.includes('not found')
    ) {
      return new Error(
        `${context}: Session expired or not found. A new session will be created automatically.`
      );
    }

    // Session-related errors should no longer occur with --resume flag

    if (
      originalMessage.includes('model') &&
      originalMessage.includes('not found')
    ) {
      return new Error(
        `${context}: Invalid model specified. Supported models: ${Array.from(this.supportedModels).join(', ')}`
      );
    }

    if (
      originalMessage.includes('ENOBUFS') ||
      originalMessage.includes('maxBuffer')
    ) {
      return new Error(
        `${context}: Response too large (exceeds ${this.maxBuffer} bytes). Try reducing max_tokens or splitting the request.`
      );
    }

    // Generic error with context
    return new Error(`${context}: ${originalMessage}`);
  }

  /**
   * Estimate token count and recommend optimal model for prompt size
   */
  static getModelRecommendation(promptLength: number): {
    estimatedTokens: number;
    recommendedModel: string;
    reason: string;
  } {
    // Rough token estimation: ~4 chars per token for English text
    const estimatedTokens = Math.ceil(promptLength / 4);

    if (estimatedTokens > 50000) {
      return {
        estimatedTokens,
        recommendedModel: 'claude-3-5-sonnet-20241022',
        reason: 'Large prompt requires Sonnet for reliable processing',
      };
    } else if (estimatedTokens > 20000) {
      return {
        estimatedTokens,
        recommendedModel: 'claude-3-5-sonnet-20241022',
        reason: 'Medium-large prompt works better with Sonnet than Haiku',
      };
    } else {
      return {
        estimatedTokens,
        recommendedModel: 'claude-3-5-haiku-20241022',
        reason: 'Small prompt suitable for efficient Haiku model',
      };
    }
  }

  /**
   * Static utility methods for external use
   */
  static escapeShellArgument(arg: string): string {
    // Use single quotes and escape any single quotes within
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  static extractResponseFromOutput(
    output: string,
    isJsonMode: boolean
  ): string {
    const trimmedOutput = output.trim();

    if (isJsonMode) {
      // In JSON mode, look for JSON content between specific markers or clean JSON
      const jsonMatch = trimmedOutput.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      return jsonMatch ? jsonMatch[0] : trimmedOutput;
    }

    // In regular mode, return the output as-is but cleaned
    return trimmedOutput;
  }

  static parseJsonResponseSafely(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  static createEnhancedError(error: unknown, context: string): Error {
    const originalMessage =
      error instanceof Error ? error.message : String(error);
    return new Error(`${context}: ${originalMessage}`);
  }
}

/**
 * Factory function to create a Claude CLI adapter
 */
export function createClaudeCLIAdapter(
  config?: ClaudeCLIAdapterConfig
): ProviderAdapter {
  return new ClaudeCLIAdapter(config);
}

/**
 * Type guard to check if an adapter is a Claude CLI adapter
 */
export function isClaudeCLIAdapter(
  adapter: ProviderAdapter
): adapter is ClaudeCLIAdapter {
  return adapter.name === 'claude-cli';
}

/**
 * Set execAsync function for testing
 */
export function _setExecAsync(mockExecAsync: typeof execAsync): void {
  execAsync = mockExecAsync;
}

/**
 * Reset execAsync to default implementation
 */
export function _resetExecAsync(): void {
  execAsync = promisify(exec);
}

/**
 * Exported for testing purposes
 */
export const _testing = {
  setExecAsync: _setExecAsync,
  resetExecAsync: _resetExecAsync,
  escapeShellArg: (arg: string) => {
    return ClaudeCLIAdapter.escapeShellArgument(arg);
  },
  extractResponse: (output: string, isJsonMode: boolean) => {
    return ClaudeCLIAdapter.extractResponseFromOutput(output, isJsonMode);
  },
  parseJsonResponse: (jsonString: string) => {
    return ClaudeCLIAdapter.parseJsonResponseSafely(jsonString);
  },
  enhanceError: (error: unknown, context: string) => {
    return ClaudeCLIAdapter.createEnhancedError(error, context);
  },
};
