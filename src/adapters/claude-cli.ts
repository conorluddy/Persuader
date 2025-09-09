/**
 * Claude CLI Provider Adapter
 *
 * Simple integration with Claude CLI using documented commands.
 * Uses `claude -p` for prompts and `--output-format json` for structured responses.
 */

import { exec, spawn } from 'node:child_process';
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
} from '../shared/constants/index.js';
import type {
  ProviderAdapter,
  ProviderHealth,
  ProviderPromptOptions,
  ProviderResponse,
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
 * - Session-based conversations for token efficiency
 * - JSON mode for structured output
 * - Proper shell argument escaping
 * - Comprehensive error handling and CLI-specific error messages
 * - Health monitoring and availability checks
 */
export class ClaudeCLIAdapter implements ProviderAdapter {
  readonly name = 'claude-cli';
  readonly version = '2.0.0';
  readonly supportsSession = false; // Simplified - Claude CLI manages sessions automatically
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

  // No createSession method - Claude CLI manages sessions automatically

  /**
   * Execute Claude CLI with stdin for prompt input to avoid shell argument length limits
   */
  private async spawnWithStdin(
    args: string[],
    input: string
  ): Promise<{ stdout: string; stderr: string }> {
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
      child.on('close', code => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);

          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(
              new Error(
                `Claude CLI command failed with exit code ${code}: ${stderr || 'No error output'}`
              )
            );
          }
        }
      });

      // Handle process error
      child.on('error', error => {
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
    _sessionId: string | null, // Ignored - Claude manages sessions automatically
    prompt: string,
    options: ProviderPromptOptions
  ): Promise<ProviderResponse> {
    const requestId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Log the incoming request with full details
    llmRequest({
      provider: this.name,
      model: options.model || 'default',
      prompt,
      temperature: options.temperature ?? undefined,
      maxTokens: options.maxTokens ?? undefined,
      sessionId: _sessionId,
      requestId,
    });

    debug('Claude CLI sendPrompt called', {
      requestId,
      promptLength: prompt.length,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      sessionId: _sessionId,
    });

    try {
      const args: string[] = [];

      // Always use JSON output for structured parsing
      args.push('--output-format', 'json');

      // Add model if specified
      if (options.model) {
        args.push('--model', options.model);
      }

      // Add max tokens if specified
      if (options.maxTokens) {
        args.push('--max-turns', String(Math.ceil(options.maxTokens / 1000))); // Rough approximation
      }

      // Construct command without prompt (will use stdin)
      const command = `${this.binary} ${args.join(' ')}`;

      debug('Executing Claude CLI command with stdin', {
        requestId,
        binary: this.binary,
        command, // No need to hide content since prompt goes via stdin
        argsCount: args.length,
        promptLength: prompt.length,
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
      const content = extractContentFromResponse(claudeResponse);
      const tokenUsage = getTokenUsage(claudeResponse);
      const totalDuration = Date.now() - startTime;

      // Log the successful response with full details
      llmResponse({
        provider: this.name,
        model: options.model || 'default',
        response: content,
        tokenUsage,
        cost: claudeResponse.total_cost_usd,
        durationMs: totalDuration,
        sessionId: claudeResponse.session_id,
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
   * Destroy a Claude CLI session (optional - CLI manages sessions internally)
   */
  async destroySession(_sessionId: string): Promise<void> {
    // Claude CLI doesn't have an explicit session destroy command
    // Sessions are managed automatically by the CLI
    // This is a no-op but kept for interface compliance
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
      message.includes('429') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
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
      originalMessage.includes('429')
    ) {
      return new Error(
        `${context}: Claude API rate limit exceeded. Please wait and try again.`
      );
    }

    if (
      originalMessage.includes('unauthorized') ||
      originalMessage.includes('authentication') ||
      originalMessage.includes('401')
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
