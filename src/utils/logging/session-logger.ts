/**
 * Session and Request Scoped Logger Module
 * 
 * Provides context-aware logging with automatic scope management,
 * type-safe context propagation, and hierarchical configuration.
 */

import { LogCategory, CategoryManager } from '../category-manager.js';
import { ConfigResolver } from './config-resolver.js';
import { getGlobalPerformanceMonitor, type PerformanceMonitor } from './performance-monitor.js';
import { PrivacyFilter, type PrivacyConfig, type JsonValue } from './privacy-filter.js';
import { JSONLRotationWriter } from './jsonl-rotation.js';
import type { LogLevel } from '../logger.js';

/**
 * Branded type for Session IDs to ensure type safety
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Branded type for Request IDs to ensure type safety
 */
export type RequestId = string & { readonly __brand: 'RequestId' };

/**
 * Helper to create a branded SessionId
 */
export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

/**
 * Helper to create a branded RequestId
 */
export function createRequestId(id: string): RequestId {
  return id as RequestId;
}

/**
 * Context metadata with strict typing
 */
export interface LogContext<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly sessionId?: SessionId;
  readonly requestId?: RequestId;
  readonly operationId?: string;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly correlationId?: string;
  readonly parentSpanId?: string;
  readonly spanId?: string;
  readonly metadata: T;
}

/**
 * Log entry with full context and metadata
 */
export interface ContextualLogEntry<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly category: LogCategory;
  readonly message: string;
  readonly context: LogContext<T>;
  readonly data?: unknown;
  readonly error?: Error;
  readonly duration?: number;
  readonly tags?: ReadonlyArray<string>;
}

/**
 * Session configuration with lifecycle management
 */
export interface SessionConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly sessionId: SessionId;
  readonly userId?: string;
  readonly tenantId?: string;
  readonly categories?: number;
  readonly metadata?: T;
  readonly ttl?: number;
  readonly parentSessionId?: SessionId;
  readonly privacyOverride?: Partial<PrivacyConfig>;
}

/**
 * Request configuration with automatic cleanup
 */
export interface RequestConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly requestId: RequestId;
  readonly sessionId: SessionId;
  readonly correlationId?: string;
  readonly categories?: number;
  readonly metadata?: T;
  readonly timeout?: number;
  readonly autoCleanup?: boolean;
}

/**
 * Log method signature with generics for type safety
 */
type LogMethod<T extends Record<string, unknown> = Record<string, unknown>> = 
  (message: string, data?: unknown, metadata?: T) => void;

/**
 * Session-scoped logger with full type safety
 */
export class SessionScopedLogger<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly sessionId: SessionId;
  private readonly configResolver: ConfigResolver;
  private readonly performanceMonitor: PerformanceMonitor;
  private readonly privacyFilter: PrivacyFilter;
  private readonly jsonlManager?: JSONLRotationWriter;
  private readonly categoryManager: CategoryManager;
  private readonly context: LogContext<T>;
  private readonly children: Map<RequestId, RequestScopedLogger<T>>;
  private operationStack: string[] = [];
  
  constructor(config: SessionConfig<T>, resolver?: ConfigResolver) {
    this.sessionId = config.sessionId;
    this.configResolver = resolver ?? new ConfigResolver();
    this.performanceMonitor = getGlobalPerformanceMonitor();
    
    // Create session configuration
    this.configResolver.createSessionConfig(
      this.sessionId,
      config.categories,
      config.metadata as Record<string, any>
    );
    
    // Set as active session
    this.configResolver.setActiveSession(this.sessionId);
    
    // Get effective configuration
    const effectiveConfig = this.configResolver.getEffectiveConfig();
    this.categoryManager = new CategoryManager(effectiveConfig.categories);
    
    // Initialize privacy filter
    this.privacyFilter = new PrivacyFilter({
      ...effectiveConfig.privacy,
      ...config.privacyOverride,
    } as PrivacyConfig);
    
    // Initialize JSONL manager if needed
    if (effectiveConfig.output?.jsonl) {
      this.jsonlManager = new JSONLRotationWriter({
        logsDirectory: effectiveConfig.output.logsDirectory ?? './logs',
        maxFileSize: effectiveConfig.output.maxFileSize ?? 10485760, // Default 10MB
        maxFiles: effectiveConfig.output.maxFiles ?? 10, // Default 10 files
        maxAge: 30, // Default 30 days
        compress: false, // Default no compression
      });
    }
    
    // Build context
    this.context = {
      sessionId: this.sessionId,
      userId: config.userId ?? undefined,
      tenantId: config.tenantId ?? undefined,
      metadata: config.metadata ?? {} as T,
    } as LogContext<T>;
    
    this.children = new Map();
    
    // Set up TTL cleanup if specified
    if (config.ttl) {
      setTimeout(() => this.cleanup(), config.ttl);
    }
  }
  
  /**
   * Create a request-scoped logger
   */
  createRequestLogger(config: Omit<RequestConfig<T>, 'sessionId'>): RequestScopedLogger<T> {
    const requestConfig: RequestConfig<T> = {
      ...config,
      sessionId: this.sessionId,
    };
    
    const requestLogger = new RequestScopedLogger(requestConfig, this);
    this.children.set(config.requestId, requestLogger);
    
    return requestLogger;
  }
  
  /**
   * Start a timed operation
   */
  startOperation(name: string, tags?: Record<string, string>): string {
    const operationId = this.performanceMonitor.startOperation(name, {
      ...tags,
      sessionId: this.sessionId,
    });
    
    this.operationStack.push(operationId);
    return operationId;
  }
  
  /**
   * End a timed operation
   */
  endOperation(operationId?: string, metadata?: Record<string, any>): void {
    const id = operationId ?? this.operationStack.pop();
    if (!id) return;
    
    this.performanceMonitor.endOperation(id, {
      ...metadata,
      sessionId: this.sessionId,
    });
  }
  
  /**
   * Log with a specific category
   */
  log(
    category: LogCategory,
    level: LogLevel,
    message: string,
    data?: unknown,
    metadata?: Partial<T>
  ): void {
    if (!this.categoryManager.isEnabled(category)) {
      return;
    }
    
    const entry: ContextualLogEntry<T> = {
      timestamp: new Date(),
      level,
      category,
      message: this.privacyFilter.filterString(message),
      context: {
        ...this.context,
        metadata: { ...this.context.metadata, ...metadata } as T,
      },
      data: data ? this.privacyFilter.filterObject(data as JsonValue) : undefined,
    };
    
    this.writeLog(entry);
  }
  
  /**
   * Convenience logging methods with type safety
   */
  readonly error: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.ERROR, 'error', message, data, metadata);
    
  readonly warn: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.WARN, 'warn', message, data, metadata);
    
  readonly info: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.INFO, 'info', message, data, metadata);
    
  readonly debug: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.DEBUG, 'debug', message, data, metadata);
  
  /**
   * Log validation details
   */
  logValidation(
    success: boolean,
    details: {
      schema?: string;
      errors?: Array<{ path: string; message: string }>;
      suggestions?: string[];
      data?: unknown;
    },
    metadata?: Partial<T>
  ): void {
    const category = success 
      ? LogCategory.VALIDATION_SUCCESS 
      : LogCategory.VALIDATION_FAILURE;
    
    const level: LogLevel = success ? 'info' : 'warn';
    const message = success 
      ? `Validation succeeded for ${details.schema ?? 'unknown schema'}`
      : `Validation failed for ${details.schema ?? 'unknown schema'}`;
    
    this.log(category, level, message, details, metadata);
  }
  
  /**
   * Log LLM interaction
   */
  logLLM(
    type: 'request' | 'response' | 'error',
    provider: string,
    model: string,
    content: unknown,
    metadata?: Partial<T> & {
      tokenUsage?: { input: number; output: number; total: number };
      duration?: number;
      temperature?: number;
    }
  ): void {
    const category = type === 'request' 
      ? LogCategory.LLM_REQUEST
      : type === 'response'
      ? LogCategory.LLM_RESPONSE
      : LogCategory.LLM_ERROR;
    
    const level: LogLevel = type === 'error' ? 'error' : 'debug';
    const message = `LLM ${type}: ${provider}/${model}`;
    
    this.log(category, level, message, content, metadata);
    
    // Record token usage if provided
    if (metadata?.tokenUsage) {
      this.performanceMonitor.recordTokenUsage(
        provider,
        model,
        metadata.tokenUsage.input,
        metadata.tokenUsage.output,
        metadata.tokenUsage.total
      );
    }
  }
  
  /**
   * Write log entry to outputs
   */
  private writeLog(entry: ContextualLogEntry<T>): void {
    const config = this.configResolver.getEffectiveConfig();
    
    // Console output
    if (config.output?.console) {
      this.writeToConsole(entry);
    }
    
    // JSONL output
    if (this.jsonlManager) {
      // Convert entry to LogEntry format with string types
      const logEntry = {
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        category: LogCategory[entry.category] ?? String(entry.category),
        message: entry.message,
        context: entry.context as Record<string, any>,
        sessionId: this.sessionId,
        data: entry.data,
      };
      this.jsonlManager.writeEntry(logEntry).catch((error: unknown) => {
        console.error('Failed to write to JSONL:', error);
      });
    }
  }
  
  /**
   * Format and write to console
   */
  private writeToConsole(entry: ContextualLogEntry<T>): void {
    const prefix = `[${entry.context.sessionId}]`;
    const timestamp = entry.timestamp.toISOString();
    
    const levelMap: Record<LogLevel, typeof console.log> = {
      none: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
      prompts: console.debug,
      verboseDebug: console.debug,
    };
    
    const logFn = levelMap[entry.level] ?? console.log;
    
    logFn(
      `${timestamp} ${prefix} ${entry.level.toUpperCase()}: ${entry.message}`,
      entry.data ? entry.data : ''
    );
  }
  
  /**
   * Update session metadata
   */
  updateMetadata(metadata: Partial<T>): void {
    Object.assign(this.context.metadata, metadata);
    this.configResolver.updateSessionConfig(
      this.sessionId,
      this.categoryManager.getCategories(),
      metadata as Record<string, any>
    );
  }
  
  /**
   * Get session metrics
   */
  getMetrics(): {
    sessionId: SessionId;
    requestCount: number;
    operationCount: number;
    errorCount: number;
    context: LogContext<T>;
  } {
    const errorCount = this.performanceMonitor
      .getRecentMetrics()
      .filter(m => m.tags?.sessionId === this.sessionId && m.name === 'error')
      .length;
    
    return {
      sessionId: this.sessionId,
      requestCount: this.children.size,
      operationCount: this.operationStack.length,
      errorCount,
      context: this.context,
    };
  }
  
  /**
   * Cleanup session resources
   */
  cleanup(): void {
    // Clean up child requests
    for (const child of this.children.values()) {
      child.cleanup();
    }
    this.children.clear();
    
    // Close JSONL manager
    if (this.jsonlManager) {
      this.jsonlManager.close().catch((error: unknown) => {
        console.error('Error closing JSONL manager:', error);
      });
    }
    
    // Remove session configuration
    this.configResolver.removeSessionConfig(this.sessionId);
  }
}

/**
 * Request-scoped logger with automatic cleanup
 */
export class RequestScopedLogger<T extends Record<string, unknown> = Record<string, unknown>> {
  private readonly requestId: RequestId;
  private readonly sessionLogger: SessionScopedLogger<T>;
  private readonly context: LogContext<T>;
  private readonly categoryManager: CategoryManager;
  private readonly privacyFilter: PrivacyFilter;
  private cleanupTimer?: NodeJS.Timeout;
  
  constructor(config: RequestConfig<T>, sessionLogger: SessionScopedLogger<T>) {
    this.requestId = config.requestId;
    this.sessionLogger = sessionLogger;
    
    // Create request configuration
    const resolver = sessionLogger['configResolver'];
    resolver.createRequestConfig(
      this.requestId,
      config.categories,
      config.metadata as Record<string, any>,
      config.timeout
    );
    
    // Set as active request
    resolver.setActiveRequest(this.requestId);
    
    // Get effective configuration
    const effectiveConfig = resolver.getEffectiveConfig();
    this.categoryManager = new CategoryManager(effectiveConfig.categories);
    this.privacyFilter = sessionLogger['privacyFilter'];
    
    // Build context
    this.context = {
      ...sessionLogger['context'],
      requestId: this.requestId,
      correlationId: config.correlationId ?? undefined,
      metadata: {
        ...sessionLogger['context'].metadata,
        ...config.metadata,
      } as T,
    } as LogContext<T>;
    
    // Set up auto-cleanup if specified
    if (config.autoCleanup && config.timeout) {
      this.cleanupTimer = setTimeout(() => this.cleanup(), config.timeout);
    }
  }
  
  /**
   * Log with request context
   */
  log(
    category: LogCategory,
    level: LogLevel,
    message: string,
    data?: unknown,
    metadata?: Partial<T>
  ): void {
    if (!this.categoryManager.isEnabled(category)) {
      return;
    }
    
    const entry: ContextualLogEntry<T> = {
      timestamp: new Date(),
      level,
      category,
      message: this.privacyFilter.filterString(message),
      context: {
        ...this.context,
        metadata: { ...this.context.metadata, ...metadata } as T,
      },
      data: data ? this.privacyFilter.filterObject(data as JsonValue) : undefined,
    };
    
    // Delegate to session logger for writing
    this.sessionLogger['writeLog'](entry);
  }
  
  /**
   * Convenience logging methods
   */
  readonly error: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.ERROR, 'error', message, data, metadata);
    
  readonly warn: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.WARN, 'warn', message, data, metadata);
    
  readonly info: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.INFO, 'info', message, data, metadata);
    
  readonly debug: LogMethod<T> = (message, data, metadata) => 
    this.log(LogCategory.DEBUG, 'debug', message, data, metadata);
  
  /**
   * Start a timed operation with request context
   */
  startOperation(name: string, tags?: Record<string, string>): string {
    return this.sessionLogger.startOperation(name, {
      ...tags,
      requestId: this.requestId,
    });
  }
  
  /**
   * End a timed operation
   */
  endOperation(operationId?: string, metadata?: Record<string, any>): void {
    this.sessionLogger.endOperation(operationId, {
      ...metadata,
      requestId: this.requestId,
    });
  }
  
  /**
   * Get request context
   */
  getContext(): LogContext<T> {
    return { ...this.context };
  }
  
  /**
   * Cleanup request resources
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = undefined as any;
    }
    
    // Remove request configuration
    const resolver = this.sessionLogger['configResolver'];
    resolver.removeRequestConfig(this.requestId);
  }
}

/**
 * Factory functions for creating scoped loggers
 */
export function createSessionLogger<T extends Record<string, unknown> = Record<string, unknown>>(
  config: Omit<SessionConfig<T>, 'sessionId'> & { sessionId?: string }
): SessionScopedLogger<T> {
  const sessionId = createSessionId(config.sessionId ?? generateId('session'));
  return new SessionScopedLogger({ ...config, sessionId });
}

export function createRequestLogger<T extends Record<string, unknown> = Record<string, unknown>>(
  sessionLogger: SessionScopedLogger<T>,
  config: Omit<RequestConfig<T>, 'sessionId' | 'requestId'> & { requestId?: string }
): RequestScopedLogger<T> {
  const requestId = createRequestId(config.requestId ?? generateId('request'));
  return sessionLogger.createRequestLogger({ ...config, requestId });
}

/**
 * Helper to generate unique IDs
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}