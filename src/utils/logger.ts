/**
 * Persuader Framework Logger
 *
 * Centralized logging system for the framework with configurable levels,
 * structured output for debugging and monitoring, and specialized LLM I/O logging.
 */

import chalk from 'chalk';
import type { TokenUsage } from '../types/pipeline.js';
import {
  createJsonlWriter,
  type JsonlLogEntry,
  type JsonlWriter,
} from './jsonl-writer.js';

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug' | 'prompts' | 'verboseDebug';

export interface LogContext {
  [key: string]: unknown;
}

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  colors?: boolean;
  timestamp?: boolean;
  maxPromptLength?: number;
  maxResponseLength?: number;

  // Debug visibility options
  fullPromptLogging?: boolean;
  rawResponseLogging?: boolean;
  detailedValidationErrors?: boolean;

  // JSONL logging options
  jsonlLogging?: boolean;
  logsDirectory?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export interface LLMRequestLogData {
  provider: string;
  model?: string;
  prompt: string;
  fullPrompt?: string; // Complete prompt when debug mode enabled
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  sessionId?: string | null;
  attemptNumber?: number;
  requestId?: string;
}

export interface LLMResponseLogData {
  provider: string;
  model?: string;
  response: string;
  rawResponse?: string; // Unprocessed response when debug mode enabled
  tokenUsage?: TokenUsage;
  cost?: number;
  durationMs?: number;
  sessionId?: string;
  requestId?: string;
  truncated?: boolean;
  stopReason?: string;
}

export interface LLMErrorLogData {
  provider: string;
  model?: string;
  error: string;
  attemptNumber?: number;
  requestId?: string;
  isRetryable?: boolean;
}

export interface DetailedValidationErrorData {
  field: string;
  actualValue: unknown;
  expectedType: string;
  validOptions?: unknown[];
  closestMatches?: string[];
  suggestions?: string[];
  errorCode: string;
  message: string;
}

class PersuaderLogger {
  private config: LoggerConfig;
  private readonly levels = {
    none: -1,
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    prompts: 4,
    verboseDebug: 5,
  };
  private jsonlWriter: JsonlWriter | null = null;

  constructor(config: LoggerConfig = { level: 'info' }) {
    this.config = {
      colors: true,
      timestamp: true,
      prefix: 'Persuader',
      maxPromptLength: 1000,
      maxResponseLength: 1000,
      fullPromptLogging: false,
      rawResponseLogging: false,
      detailedValidationErrors: false,
      jsonlLogging: false,
      logsDirectory: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      ...config,
    };

    // Initialize JSONL writer if enabled
    if (this.config.jsonlLogging) {
      this.initializeJsonlWriter();
    }
  }

  /**
   * Initialize the JSONL writer
   */
  private async initializeJsonlWriter(): Promise<void> {
    try {
      this.jsonlWriter = createJsonlWriter({
        logsDirectory: this.config.logsDirectory ?? './logs',
        maxFileSize: this.config.maxFileSize ?? 10485760,
        maxFiles: this.config.maxFiles ?? 10,
      });
      await this.jsonlWriter.initialize();
    } catch (error) {
      console.error('Failed to initialize JSONL writer:', error);
      this.jsonlWriter = null;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const configLevel = this.levels[this.config.level];
    const messageLevel = this.levels[level];
    return messageLevel <= configLevel && configLevel >= 0;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    let output = '';

    // Add timestamp if enabled
    if (this.config.timestamp) {
      const timestamp = new Date().toISOString();
      output += this.config.colors
        ? chalk.dim(`[${timestamp}] `)
        : `[${timestamp}] `;
    }

    // Add prefix if configured
    if (this.config.prefix) {
      output += this.config.colors
        ? chalk.magenta(`[${this.config.prefix}] `)
        : `[${this.config.prefix}] `;
    }

    // Add level with color
    if (this.config.colors) {
      const levelFormatters = {
        error: chalk.red,
        warn: chalk.yellow,
        info: chalk.blue,
        debug: chalk.dim,
        prompts: chalk.magenta,
        verboseDebug: chalk.cyan.dim,
        none: chalk.reset,
      } as const;
      output += levelFormatters[level](`[${level.toUpperCase()}] `);
    } else {
      output += `[${level.toUpperCase()}] `;
    }

    // Add message
    output += message;

    // Add context data if provided
    if (context && Object.keys(context).length > 0) {
      const contextStr = this.formatContextData(context);
      output += this.config.colors
        ? `\n${chalk.dim(contextStr)}`
        : `\n${contextStr}`;
    }

    return output;
  }

  private formatContextData(context: LogContext): string {
    const entries = Object.entries(context);
    if (entries.length === 0) return '';

    const formatted = entries
      .map(([key, value]) => {
        let formattedValue: string;

        if (typeof value === 'object' && value !== null) {
          formattedValue = JSON.stringify(value, null, 2);
        } else {
          formattedValue = String(value);
        }

        return `  ${key}: ${formattedValue}`;
      })
      .join('\n');

    return formatted;
  }

  private truncateText(
    text: string,
    maxLength: number
  ): { text: string; wasTruncated: boolean } {
    if (text.length <= maxLength) {
      return { text, wasTruncated: false };
    }

    const truncated = `${text.substring(0, maxLength)}...`;
    return { text: truncated, wasTruncated: true };
  }

  public log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    // Always log to console
    const formatted = this.formatMessage(level, message, context);
    console.log(formatted);

    // Log to JSONL if enabled
    if (this.jsonlWriter) {
      this.writeToJsonl(level, message, context);
    }
  }

  /**
   * Write log entry to JSONL file
   */
  private async writeToJsonl(
    level: LogLevel,
    message: string,
    context?: LogContext,
    source?: string
  ): Promise<void> {
    if (!this.jsonlWriter) return;

    const entry: JsonlLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context ? { context } : {}),
      ...(context?.requestId ? { requestId: context.requestId as string } : {}),
      ...(context?.sessionId ? { sessionId: context.sessionId as string } : {}),
      ...(source ? { source } : {}),
    };

    try {
      await this.jsonlWriter.writeEntry(entry);
    } catch (error) {
      // Silently fail to avoid logging loops
      console.warn('Failed to write JSONL log entry:', error);
    }
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  verboseDebug(message: string, context?: LogContext): void {
    this.log('verboseDebug', message, context);
  }

  /**
   * Log LLM request with formatted prompt and metadata
   */
  llmRequest(data: LLMRequestLogData): void {
    // For 'prompts' level, show full prompts without truncation and with special formatting
    if (this.config.level === 'prompts') {
      this.logPromptRequest(data);
      return;
    }

    // For verboseDebug level with fullPromptLogging, show complete prompt
    if (this.shouldLog('verboseDebug') && this.config.fullPromptLogging && data.fullPrompt) {
      const message = this.config.colors
        ? `${chalk.cyan('🔍 FULL LLM REQUEST')} ${chalk.bold(data.provider)}${data.model ? ` (${data.model})` : ''}`
        : `🔍 FULL LLM REQUEST ${data.provider}${data.model ? ` (${data.model})` : ''}`;

      const context: LogContext = {
        ...(data.requestId && { requestId: data.requestId }),
        ...(data.attemptNumber && { attempt: data.attemptNumber }),
        ...(data.sessionId && { sessionId: data.sessionId }),
        ...(data.temperature !== undefined && { temperature: data.temperature }),
        ...(data.maxTokens && { maxTokens: data.maxTokens }),
        fullPrompt: this.config.colors
          ? `${chalk.cyan('┌─ COMPLETE PROMPT')}\n${this.formatMultilineText(data.fullPrompt)}\n${chalk.cyan('└─ END COMPLETE PROMPT')}`
          : `COMPLETE PROMPT:\n${data.fullPrompt}`,
        promptLength: data.fullPrompt.length,
      };

      this.log('verboseDebug', message, context);
    }

    if (!this.shouldLog('debug')) return;

    const { text: promptText, wasTruncated } = this.truncateText(
      data.prompt,
      this.config.maxPromptLength || 1000
    );

    const message = this.config.colors
      ? `${chalk.cyan('🚀 LLM REQUEST')} ${chalk.bold(data.provider)}${data.model ? ` (${data.model})` : ''}`
      : `🚀 LLM REQUEST ${data.provider}${data.model ? ` (${data.model})` : ''}`;

    const context: LogContext = {
      ...(data.requestId && { requestId: data.requestId }),
      ...(data.attemptNumber && { attempt: data.attemptNumber }),
      ...(data.sessionId && { sessionId: data.sessionId }),
      ...(data.temperature !== undefined && { temperature: data.temperature }),
      ...(data.maxTokens && { maxTokens: data.maxTokens }),
      prompt: this.config.colors
        ? `${chalk.cyan('┌─ PROMPT')}\n${this.formatMultilineText(promptText)}\n${chalk.cyan('└─ END PROMPT')}${wasTruncated ? chalk.yellow(' (truncated)') : ''}`
        : `PROMPT:\n${promptText}${wasTruncated ? ' (truncated)' : ''}`,
    };

    this.log('debug', message, context);

    // Enhanced JSONL logging for LLM requests
    if (this.jsonlWriter) {
      this.writeToJsonl(
        'debug',
        'LLM_REQUEST',
        {
          ...context,
          llmProvider: data.provider,
          llmModel: data.model,
          promptLength: data.prompt.length,
          fullPrompt: data.fullPrompt || data.prompt, // Store full prompt in JSONL when available
          wasTruncated,
        },
        'llm'
      );
    }
  }

  /**
   * Log LLM response with formatted content and metadata
   */
  llmResponse(data: LLMResponseLogData): void {
    // For 'prompts' level, show full responses without truncation and with special formatting
    if (this.config.level === 'prompts') {
      this.logPromptResponse(data);
      return;
    }

    // For verboseDebug level with rawResponseLogging, show raw response
    if (this.shouldLog('verboseDebug') && this.config.rawResponseLogging && data.rawResponse) {
      const message = this.config.colors
        ? `${chalk.green('🔍 RAW LLM RESPONSE')} ${chalk.bold(data.provider)}${data.model ? ` (${data.model})` : ''}`
        : `🔍 RAW LLM RESPONSE ${data.provider}${data.model ? ` (${data.model})` : ''}`;

      const context: LogContext = {
        ...(data.requestId && { requestId: data.requestId }),
        ...(data.sessionId && { sessionId: data.sessionId }),
        ...(data.durationMs && { durationMs: data.durationMs }),
        ...(data.tokenUsage && {
          tokens: `${data.tokenUsage.inputTokens}→${data.tokenUsage.outputTokens} (${data.tokenUsage.totalTokens} total)`,
        }),
        rawResponse: this.config.colors
          ? `${chalk.green('┌─ RAW RESPONSE')}\n${this.formatMultilineText(data.rawResponse)}\n${chalk.green('└─ END RAW RESPONSE')}`
          : `RAW RESPONSE:\n${data.rawResponse}`,
        rawResponseLength: data.rawResponse.length,
      };

      this.log('verboseDebug', message, context);
    }

    if (!this.shouldLog('debug')) return;

    const { text: responseText, wasTruncated } = this.truncateText(
      data.response,
      this.config.maxResponseLength || 1000
    );

    const message = this.config.colors
      ? `${chalk.green('✅ LLM RESPONSE')} ${chalk.bold(data.provider)}${data.model ? ` (${data.model})` : ''}`
      : `✅ LLM RESPONSE ${data.provider}${data.model ? ` (${data.model})` : ''}`;

    const context: LogContext = {
      ...(data.requestId && { requestId: data.requestId }),
      ...(data.sessionId && { sessionId: data.sessionId }),
      ...(data.durationMs && { durationMs: data.durationMs }),
      ...(data.cost && { costUSD: data.cost }),
      ...(data.tokenUsage && {
        tokens: `${data.tokenUsage.inputTokens}→${data.tokenUsage.outputTokens} (${data.tokenUsage.totalTokens} total)`,
      }),
      ...(data.stopReason && { stopReason: data.stopReason }),
      ...(data.truncated && { truncated: data.truncated }),
      response: this.config.colors
        ? `${chalk.green('┌─ RESPONSE')}\n${this.formatMultilineText(responseText)}\n${chalk.green('└─ END RESPONSE')}${wasTruncated ? chalk.yellow(' (truncated)') : ''}`
        : `RESPONSE:\n${responseText}${wasTruncated ? ' (truncated)' : ''}`,
    };

    this.log('debug', message, context);

    // Enhanced JSONL logging for LLM responses
    if (this.jsonlWriter) {
      this.writeToJsonl(
        'debug',
        'LLM_RESPONSE',
        {
          ...context,
          llmProvider: data.provider,
          llmModel: data.model,
          responseLength: data.response.length,
          fullResponse: data.rawResponse || data.response, // Store raw response in JSONL when available
          tokenUsage: data.tokenUsage,
          wasTruncated,
        },
        'llm'
      );
    }
  }

  /**
   * Log LLM error with context and retry information
   */
  llmError(data: LLMErrorLogData): void {
    if (!this.shouldLog('error')) return;

    const message = this.config.colors
      ? `${chalk.red('❌ LLM ERROR')} ${chalk.bold(data.provider)}${data.model ? ` (${data.model})` : ''}`
      : `❌ LLM ERROR ${data.provider}${data.model ? ` (${data.model})` : ''}`;

    const context: LogContext = {
      ...(data.requestId && { requestId: data.requestId }),
      ...(data.attemptNumber && { attempt: data.attemptNumber }),
      ...(data.isRetryable !== undefined && { retryable: data.isRetryable }),
      error: data.error,
    };

    this.log('error', message, context);
  }

  /**
   * Log structured JSON data with syntax highlighting
   */
  json(level: LogLevel, label: string, data: unknown): void {
    if (!this.shouldLog(level)) return;

    const jsonStr = JSON.stringify(data, null, 2);
    const message = this.config.colors
      ? `${chalk.cyan('📋 JSON')} ${label}`
      : `📋 JSON ${label}`;

    const context: LogContext = {
      json: this.config.colors
        ? `${chalk.cyan('┌─ JSON DATA')}\n${this.formatJsonText(jsonStr)}\n${chalk.cyan('└─ END JSON')}`
        : `JSON DATA:\n${jsonStr}`,
    };

    this.log('debug', message, context);
  }

  /**
   * Log performance metrics with timing information
   */
  performance(
    operation: string,
    durationMs: number,
    metadata?: LogContext
  ): void {
    if (!this.shouldLog('info')) return;

    const durationColor = this.config.colors
      ? durationMs > 5000
        ? chalk.red
        : durationMs > 2000
          ? chalk.yellow
          : chalk.green
      : (text: string) => text;

    const message = this.config.colors
      ? `${chalk.magenta('⏱️  PERFORMANCE')} ${operation} ${durationColor(`${durationMs}ms`)}`
      : `⏱️  PERFORMANCE ${operation} ${durationMs}ms`;

    this.log('info', message, metadata);
  }

  /**
   * Log validation results with schema information
   */
  validation(
    success: boolean,
    schemaName?: string,
    issues?: string[],
    metadata?: LogContext
  ): void {
    if (!this.shouldLog(success ? 'info' : 'warn')) return;

    const emoji = success ? '✅' : '⚠️';
    const status = success ? 'PASSED' : 'FAILED';
    const color = this.config.colors
      ? success
        ? chalk.green
        : chalk.yellow
      : (text: string) => text;

    const message = color(
      `${emoji} VALIDATION ${status}${schemaName ? ` (${schemaName})` : ''}`
    );

    const context: LogContext = {
      ...metadata,
      ...(issues && issues.length > 0 && { issues }),
    };

    this.log(success ? 'info' : 'warn', message, context);
  }

  /**
   * Log detailed validation error with enhanced debugging information
   */
  detailedValidationError(data: DetailedValidationErrorData): void {
    if (!this.shouldLog('verboseDebug') || !this.config.detailedValidationErrors) return;

    const message = this.config.colors
      ? `${chalk.red('🔍 DETAILED VALIDATION ERROR')} ${chalk.bold(data.field)}`
      : `🔍 DETAILED VALIDATION ERROR ${data.field}`;

    const context: LogContext = {
      field: data.field,
      actualValue: data.actualValue,
      expectedType: data.expectedType,
      errorCode: data.errorCode,
      message: data.message,
      ...(data.validOptions && { 
        validOptionsCount: data.validOptions.length,
        validOptionsSample: data.validOptions.slice(0, 5), // Show first 5 options
      }),
      ...(data.closestMatches && data.closestMatches.length > 0 && {
        closestMatches: data.closestMatches,
      }),
      ...(data.suggestions && data.suggestions.length > 0 && {
        suggestions: data.suggestions,
      }),
    };

    this.log('verboseDebug', message, context);

    // Enhanced JSONL logging for detailed validation errors
    if (this.jsonlWriter) {
      this.writeToJsonl(
        'verboseDebug',
        'DETAILED_VALIDATION_ERROR',
        {
          ...context,
          allValidOptions: data.validOptions, // Store complete list in JSONL
        },
        'validation'
      );
    }
  }

  private formatMultilineText(text: string): string {
    return text
      .split('\n')
      .map(line => `  ${line}`)
      .join('\n');
  }

  private formatJsonText(jsonStr: string): string {
    if (!this.config.colors) return this.formatMultilineText(jsonStr);

    // Basic JSON syntax highlighting
    return jsonStr
      .split('\n')
      .map(line => {
        let formatted = line;
        // Highlight strings
        formatted = formatted.replace(/"([^"]*)"/g, chalk.green('"$1"'));
        // Highlight numbers
        formatted = formatted.replace(/(\d+)/g, chalk.cyan('$1'));
        // Highlight booleans and null
        formatted = formatted.replace(
          /\b(true|false|null)\b/g,
          chalk.yellow('$1')
        );
        return `  ${formatted}`;
      })
      .join('\n');
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Special prompt-only logging for LLM requests with beautiful formatting
   */
  private logPromptRequest(data: LLMRequestLogData): void {
    if (!this.config.colors) {
      console.log(
        `\n🚀 PROMPT → ${data.provider}${data.model ? ` (${data.model})` : ''}`
      );
      console.log(data.prompt);
      console.log('─'.repeat(80));
      return;
    }

    // Create beautiful header
    const header = chalk.bold.cyan('🚀 PROMPT');
    const provider = chalk.bold.white(data.provider);
    const model = data.model ? chalk.dim.gray(` (${data.model})`) : '';
    const arrow = chalk.dim.cyan(' → ');

    console.log(`\n${header}${arrow}${provider}${model}`);

    // Add metadata line if available
    const metadata = [];
    if (data.requestId)
      metadata.push(chalk.dim.gray(`ID: ${data.requestId.slice(-8)}`));
    if (data.attemptNumber)
      metadata.push(chalk.dim.yellow(`Attempt: ${data.attemptNumber}`));
    if (data.temperature !== undefined)
      metadata.push(chalk.dim.blue(`T: ${data.temperature}`));
    if (data.maxTokens)
      metadata.push(chalk.dim.green(`Max: ${data.maxTokens}`));

    if (metadata.length > 0) {
      console.log(chalk.dim('  '), metadata.join(chalk.dim.gray(' • ')));
    }

    // Beautiful prompt box with gradient border
    const topBorder =
      chalk.cyan('┏') + chalk.cyan('━'.repeat(78)) + chalk.cyan('┓');
    const bottomBorder =
      chalk.cyan('┗') + chalk.cyan('━'.repeat(78)) + chalk.cyan('┛');

    console.log(topBorder);

    // Format prompt content with syntax highlighting
    const lines = data.prompt.split('\n');
    lines.forEach(line => {
      let formattedLine = line;

      // Highlight JSON-like structures
      formattedLine = formattedLine.replace(/"{.*?"/g, chalk.green('$&'));
      // Highlight schema fields
      formattedLine = formattedLine.replace(
        /"(\w+)":/g,
        chalk.yellow('"$1"') + chalk.dim(':')
      );
      // Highlight numbers
      formattedLine = formattedLine.replace(/\b\d+\b/g, chalk.cyan('$&'));
      // Highlight boolean values
      formattedLine = formattedLine.replace(
        /\b(true|false|null)\b/g,
        chalk.magenta('$1')
      );

      console.log(
        `${chalk.cyan('┃')} ${formattedLine.padEnd(77)}${chalk.cyan('┃')}`
      );
    });

    console.log(bottomBorder);
  }

  /**
   * Special prompt-only logging for LLM responses with beautiful formatting
   */
  private logPromptResponse(data: LLMResponseLogData): void {
    if (!this.config.colors) {
      console.log(
        `\n✅ RESPONSE ← ${data.provider}${data.model ? ` (${data.model})` : ''}`
      );
      console.log(data.response);
      console.log('─'.repeat(80));
      return;
    }

    // Create beautiful header
    const header = chalk.bold.green('✅ RESPONSE');
    const provider = chalk.bold.white(data.provider);
    const model = data.model ? chalk.dim.gray(` (${data.model})`) : '';
    const arrow = chalk.dim.green(' ← ');

    console.log(`\n${header}${arrow}${provider}${model}`);

    // Add performance metadata line
    const metadata = [];
    if (data.requestId)
      metadata.push(chalk.dim.gray(`ID: ${data.requestId.slice(-8)}`));
    if (data.durationMs) metadata.push(chalk.dim.cyan(`${data.durationMs}ms`));
    if (data.cost) metadata.push(chalk.dim.green(`$${data.cost.toFixed(6)}`));
    if (data.tokenUsage) {
      const tokens = `${data.tokenUsage.inputTokens}→${data.tokenUsage.outputTokens}`;
      metadata.push(chalk.dim.blue(`${tokens} tokens`));
    }
    if (data.stopReason) metadata.push(chalk.dim.yellow(data.stopReason));

    if (metadata.length > 0) {
      console.log(chalk.dim('  '), metadata.join(chalk.dim.gray(' • ')));
    }

    // Beautiful response box with gradient border
    const topBorder =
      chalk.green('┏') + chalk.green('━'.repeat(78)) + chalk.green('┓');
    const bottomBorder =
      chalk.green('┗') + chalk.green('━'.repeat(78)) + chalk.green('┛');

    console.log(topBorder);

    // Format response content with JSON syntax highlighting
    const lines = data.response.split('\n');
    lines.forEach(line => {
      let formattedLine = line;

      // Enhanced JSON syntax highlighting
      formattedLine = formattedLine.replace(
        /"([^"]*?)":/g,
        chalk.yellow('"$1"') + chalk.dim(':')
      );
      formattedLine = formattedLine.replace(
        /:\s*"([^"]*?)"/g,
        `: ${chalk.green('"$1"')}`
      );
      formattedLine = formattedLine.replace(
        /:\s*(\d+(?:\.\d+)?)/g,
        `: ${chalk.cyan('$1')}`
      );
      formattedLine = formattedLine.replace(
        /:\s*(true|false|null)/g,
        `: ${chalk.magenta('$1')}`
      );
      formattedLine = formattedLine.replace(/[[\]{}]/g, chalk.dim.white('$&'));
      formattedLine = formattedLine.replace(/,$/g, chalk.dim(','));

      console.log(
        `${chalk.green('┃')} ${formattedLine.padEnd(77)}${chalk.green('┃')}`
      );
    });

    console.log(bottomBorder);
  }

  /**
   * Close the logger and cleanup JSONL writer
   */
  async close(): Promise<void> {
    if (this.jsonlWriter) {
      await this.jsonlWriter.close();
      this.jsonlWriter = null;
    }
  }
}

// Global logger instance
let globalLogger = new PersuaderLogger();

// Export functions for framework use
export function createLogger(config?: LoggerConfig): PersuaderLogger {
  return new PersuaderLogger(config);
}

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogger.setLevel(level);
}

export function setGlobalLogger(logger: PersuaderLogger): void {
  globalLogger = logger;
}

export function getGlobalLogger(): PersuaderLogger {
  return globalLogger;
}

// Convenience functions that use the global logger
export function log(
  level: LogLevel,
  message: string,
  context?: LogContext
): void {
  globalLogger.log(level, message, context);
}

export function error(message: string, context?: LogContext): void {
  globalLogger.error(message, context);
}

export function warn(message: string, context?: LogContext): void {
  globalLogger.warn(message, context);
}

export function info(message: string, context?: LogContext): void {
  globalLogger.info(message, context);
}

export function debug(message: string, context?: LogContext): void {
  globalLogger.debug(message, context);
}

export function verboseDebug(message: string, context?: LogContext): void {
  globalLogger.verboseDebug(message, context);
}

// LLM-specific logging functions
export function llmRequest(data: LLMRequestLogData): void {
  globalLogger.llmRequest(data);
}

export function llmResponse(data: LLMResponseLogData): void {
  globalLogger.llmResponse(data);
}

export function llmError(data: LLMErrorLogData): void {
  globalLogger.llmError(data);
}

export function logJson(level: LogLevel, label: string, data: unknown): void {
  globalLogger.json(level, label, data);
}

export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: LogContext
): void {
  globalLogger.performance(operation, durationMs, metadata);
}

export function logValidation(
  success: boolean,
  schemaName?: string,
  issues?: string[],
  metadata?: LogContext
): void {
  globalLogger.validation(success, schemaName, issues, metadata);
}

export function logDetailedValidationError(data: DetailedValidationErrorData): void {
  globalLogger.detailedValidationError(data);
}

export { PersuaderLogger };
