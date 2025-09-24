/**
 * Configuration Resolver Module
 * 
 * Implements a 3-layer configuration cascade system:
 * 1. Global Configuration - Base settings for entire application
 * 2. Session Configuration - Settings for a specific session
 * 3. Request Configuration - Settings for a specific request/operation
 * 
 * Each layer can override settings from the layer above.
 */

import { CategoryManager, LogCategory, CategoryPresets } from '../category-manager.js';
import type { LogLevel } from '../logger.js';

/**
 * Configuration layer with metadata
 */
export interface ConfigLayer {
  id: string;
  name: string;
  priority: number; // Higher priority overrides lower
  categories: number;
  metadata?: Record<string, any> | undefined;
  createdAt: Date;
  expiresAt?: Date | undefined;
}

/**
 * Full configuration with all settings
 */
export interface LoggingConfig {
  categories: number;
  formatting?: {
    colors?: boolean;
    timestamp?: boolean;
    prefix?: string;
    maxPromptLength?: number;
    maxResponseLength?: number;
  };
  output?: {
    console?: boolean;
    jsonl?: boolean;
    logsDirectory?: string;
    maxFileSize?: number;
    maxFiles?: number;
  };
  privacy?: {
    maskSensitiveData?: boolean;
    sensitivePatterns?: RegExp[];
    redactFields?: string[];
  };
  performance?: {
    trackMetrics?: boolean;
    metricsInterval?: number;
    slowThreshold?: number;
  };
}

/**
 * Configuration resolver that manages multi-layer configuration
 */
export class ConfigResolver {
  private globalConfig: ConfigLayer;
  private sessionConfigs: Map<string, ConfigLayer>;
  private requestConfigs: Map<string, ConfigLayer>;
  private activeSessionId?: string | undefined;
  private activeRequestId?: string | undefined;
  
  constructor(initialCategories: number = CategoryPresets.DEV_BASIC) {
    this.globalConfig = {
      id: 'global',
      name: 'Global Configuration',
      priority: 0,
      categories: initialCategories,
      createdAt: new Date(),
    };
    
    this.sessionConfigs = new Map();
    this.requestConfigs = new Map();
  }
  
  /**
   * Set global configuration
   */
  setGlobalConfig(categories: number, metadata?: Record<string, any>): void {
    this.globalConfig = {
      ...this.globalConfig,
      categories,
      metadata: metadata ? { ...this.globalConfig.metadata, ...metadata } : this.globalConfig.metadata,
    };
  }
  
  /**
   * Create a session-scoped configuration
   */
  createSessionConfig(
    sessionId: string,
    categories?: number,
    metadata?: Record<string, any>
  ): void {
    const config: ConfigLayer = {
      id: sessionId,
      name: `Session ${sessionId}`,
      priority: 10,
      categories: categories ?? this.globalConfig.categories,
      createdAt: new Date(),
    };
    
    if (metadata) {
      config.metadata = metadata;
    }
    
    this.sessionConfigs.set(sessionId, config);
  }
  
  /**
   * Update session configuration
   */
  updateSessionConfig(
    sessionId: string,
    categories: number,
    metadata?: Record<string, any>
  ): void {
    const existing = this.sessionConfigs.get(sessionId);
    if (existing) {
      existing.categories = categories;
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
    } else {
      this.createSessionConfig(sessionId, categories, metadata);
    }
  }
  
  /**
   * Create a request-scoped configuration
   */
  createRequestConfig(
    requestId: string,
    categories?: number,
    metadata?: Record<string, any>,
    ttlMs?: number
  ): void {
    const config: ConfigLayer = {
      id: requestId,
      name: `Request ${requestId}`,
      priority: 20,
      categories: categories ?? this.getEffectiveCategories(),
      metadata,
      createdAt: new Date(),
    };
    
    if (ttlMs) {
      config.expiresAt = new Date(Date.now() + ttlMs);
    }
    
    this.requestConfigs.set(requestId, config);
  }
  
  /**
   * Set active session
   */
  setActiveSession(sessionId?: string): void {
    this.activeSessionId = sessionId;
  }
  
  /**
   * Set active request
   */
  setActiveRequest(requestId?: string): void {
    this.activeRequestId = requestId;
  }
  
  /**
   * Get effective categories based on cascade
   */
  getEffectiveCategories(): number {
    // Start with global
    let categories = this.globalConfig.categories;
    
    // Apply session override if active
    if (this.activeSessionId) {
      const sessionConfig = this.sessionConfigs.get(this.activeSessionId);
      if (sessionConfig) {
        categories = this.mergeCategories(categories, sessionConfig.categories);
      }
    }
    
    // Apply request override if active
    if (this.activeRequestId) {
      const requestConfig = this.requestConfigs.get(this.activeRequestId);
      if (requestConfig && (!requestConfig.expiresAt || requestConfig.expiresAt > new Date())) {
        categories = this.mergeCategories(categories, requestConfig.categories);
      }
    }
    
    return categories;
  }
  
  /**
   * Merge categories using OR operation (additive)
   */
  private mergeCategories(base: number, override: number): number {
    // Use OR to combine categories (additive approach)
    // This means lower levels can only add categories, not remove them
    return base | override;
  }
  
  /**
   * Get effective configuration with all settings
   */
  getEffectiveConfig(): LoggingConfig {
    const config: LoggingConfig = {
      categories: this.getEffectiveCategories(),
    };
    
    const formatting = this.getEffectiveFormatting();
    if (formatting && Object.keys(formatting).length > 0) {
      config.formatting = formatting;
    }
    
    const output = this.getEffectiveOutput();
    if (output && Object.keys(output).length > 0) {
      config.output = output;
    }
    
    const privacy = this.getEffectivePrivacy();
    if (privacy && Object.keys(privacy).length > 0) {
      config.privacy = privacy;
    }
    
    const performance = this.getEffectivePerformance();
    if (performance && Object.keys(performance).length > 0) {
      config.performance = performance;
    }
    
    return config;
  }
  
  /**
   * Get effective formatting settings
   */
  private getEffectiveFormatting(): LoggingConfig['formatting'] {
    const formatting: LoggingConfig['formatting'] = {};
    
    // Merge from all layers
    const layers = this.getActiveLayers();
    for (const layer of layers) {
      if (layer.metadata?.formatting) {
        Object.assign(formatting, layer.metadata.formatting);
      }
    }
    
    // Apply defaults if not set
    return {
      colors: formatting.colors ?? true,
      timestamp: formatting.timestamp ?? true,
      prefix: formatting.prefix ?? 'Persuader',
      maxPromptLength: formatting.maxPromptLength ?? 1000,
      maxResponseLength: formatting.maxResponseLength ?? 1000,
    };
  }
  
  /**
   * Get effective output settings
   */
  private getEffectiveOutput(): LoggingConfig['output'] {
    const output: LoggingConfig['output'] = {};
    
    const layers = this.getActiveLayers();
    for (const layer of layers) {
      if (layer.metadata?.output) {
        Object.assign(output, layer.metadata.output);
      }
    }
    
    return {
      console: output.console ?? true,
      jsonl: output.jsonl ?? false,
      logsDirectory: output.logsDirectory ?? './logs',
      maxFileSize: output.maxFileSize ?? 10485760, // 10MB
      maxFiles: output.maxFiles ?? 10,
    };
  }
  
  /**
   * Get effective privacy settings
   */
  private getEffectivePrivacy(): LoggingConfig['privacy'] {
    const privacy: LoggingConfig['privacy'] = {};
    
    const layers = this.getActiveLayers();
    for (const layer of layers) {
      if (layer.metadata?.privacy) {
        // Privacy settings should be cumulative for safety
        if (layer.metadata.privacy.maskSensitiveData !== undefined) {
          privacy.maskSensitiveData = privacy.maskSensitiveData || layer.metadata.privacy.maskSensitiveData;
        }
        
        if (layer.metadata.privacy.sensitivePatterns) {
          privacy.sensitivePatterns = [
            ...(privacy.sensitivePatterns || []),
            ...layer.metadata.privacy.sensitivePatterns,
          ];
        }
        
        if (layer.metadata.privacy.redactFields) {
          privacy.redactFields = [
            ...(privacy.redactFields || []),
            ...layer.metadata.privacy.redactFields,
          ];
        }
      }
    }
    
    return privacy;
  }
  
  /**
   * Get effective performance settings
   */
  private getEffectivePerformance(): LoggingConfig['performance'] {
    const performance: LoggingConfig['performance'] = {};
    
    const layers = this.getActiveLayers();
    for (const layer of layers) {
      if (layer.metadata?.performance) {
        Object.assign(performance, layer.metadata.performance);
      }
    }
    
    return {
      trackMetrics: performance.trackMetrics ?? false,
      metricsInterval: performance.metricsInterval ?? 60000, // 1 minute
      slowThreshold: performance.slowThreshold ?? 5000, // 5 seconds
    };
  }
  
  /**
   * Get active configuration layers in priority order
   */
  private getActiveLayers(): ConfigLayer[] {
    const layers: ConfigLayer[] = [this.globalConfig];
    
    if (this.activeSessionId) {
      const sessionConfig = this.sessionConfigs.get(this.activeSessionId);
      if (sessionConfig) {
        layers.push(sessionConfig);
      }
    }
    
    if (this.activeRequestId) {
      const requestConfig = this.requestConfigs.get(this.activeRequestId);
      if (requestConfig && (!requestConfig.expiresAt || requestConfig.expiresAt > new Date())) {
        layers.push(requestConfig);
      }
    }
    
    return layers.sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Clean up expired configurations
   */
  cleanupExpired(): void {
    const now = new Date();
    
    for (const [id, config] of this.requestConfigs) {
      if (config.expiresAt && config.expiresAt <= now) {
        this.requestConfigs.delete(id);
        if (this.activeRequestId === id) {
          this.activeRequestId = undefined;
        }
      }
    }
  }
  
  /**
   * Remove session configuration
   */
  removeSessionConfig(sessionId: string): void {
    this.sessionConfigs.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = undefined;
    }
  }
  
  /**
   * Remove request configuration
   */
  removeRequestConfig(requestId: string): void {
    this.requestConfigs.delete(requestId);
    if (this.activeRequestId === requestId) {
      this.activeRequestId = undefined;
    }
  }
  
  /**
   * Get configuration summary
   */
  getSummary(): {
    global: ConfigLayer;
    sessions: ConfigLayer[];
    requests: ConfigLayer[];
    effective: {
      categories: string[];
      activeSession?: string;
      activeRequest?: string;
    };
  } {
    const categoryManager = new CategoryManager(this.getEffectiveCategories());
    
    return {
      global: this.globalConfig,
      sessions: Array.from(this.sessionConfigs.values()),
      requests: Array.from(this.requestConfigs.values()),
      effective: {
        categories: categoryManager.getSummary().enabledCategories,
        ...(this.activeSessionId && { activeSession: this.activeSessionId }),
        ...(this.activeRequestId && { activeRequest: this.activeRequestId }),
      },
    };
  }
  
  /**
   * Create a scoped logger for a specific context
   */
  createScopedLogger(context: {
    sessionId?: string;
    requestId?: string;
    additionalCategories?: number;
  }): ScopedLogger {
    return new ScopedLogger(this, context);
  }
}

/**
 * Scoped logger that automatically applies context
 */
export class ScopedLogger {
  constructor(
    private resolver: ConfigResolver,
    private context: {
      sessionId?: string;
      requestId?: string;
      additionalCategories?: number;
    }
  ) {}
  
  /**
   * Check if a category is enabled in this scope
   */
  isEnabled(category: LogCategory): boolean {
    // Temporarily set context
    const prevSession = this.resolver['activeSessionId'];
    const prevRequest = this.resolver['activeRequestId'];
    
    if (this.context.sessionId) {
      this.resolver.setActiveSession(this.context.sessionId);
    }
    if (this.context.requestId) {
      this.resolver.setActiveRequest(this.context.requestId);
    }
    
    let categories = this.resolver.getEffectiveCategories();
    if (this.context.additionalCategories) {
      categories |= this.context.additionalCategories;
    }
    
    const result = (categories & category) !== 0;
    
    // Restore previous context
    if (prevSession !== undefined) {
      this.resolver.setActiveSession(prevSession);
    } else {
      this.resolver.setActiveSession();
    }
    
    if (prevRequest !== undefined) {
      this.resolver.setActiveRequest(prevRequest);
    } else {
      this.resolver.setActiveRequest();
    }
    
    return result;
  }
  
  /**
   * Get effective configuration for this scope
   */
  getConfig(): LoggingConfig {
    // Temporarily set context
    const prevSession = this.resolver['activeSessionId'];
    const prevRequest = this.resolver['activeRequestId'];
    
    if (this.context.sessionId) {
      this.resolver.setActiveSession(this.context.sessionId);
    }
    if (this.context.requestId) {
      this.resolver.setActiveRequest(this.context.requestId);
    }
    
    const config = this.resolver.getEffectiveConfig();
    
    // Apply additional categories if specified
    if (this.context.additionalCategories) {
      config.categories |= this.context.additionalCategories;
    }
    
    // Restore previous context
    if (prevSession !== undefined) {
      this.resolver.setActiveSession(prevSession);
    } else {
      this.resolver.setActiveSession();
    }
    
    if (prevRequest !== undefined) {
      this.resolver.setActiveRequest(prevRequest);
    } else {
      this.resolver.setActiveRequest();
    }
    
    return config;
  }
}

/**
 * Global configuration resolver instance
 */
let globalResolver: ConfigResolver | null = null;

/**
 * Get the global configuration resolver
 */
export function getGlobalConfigResolver(): ConfigResolver {
  if (!globalResolver) {
    globalResolver = new ConfigResolver();
  }
  return globalResolver;
}

/**
 * Set the global configuration resolver
 */
export function setGlobalConfigResolver(resolver: ConfigResolver): void {
  globalResolver = resolver;
}

/**
 * Helper to create a session configuration
 */
export function createSessionLogging(
  sessionId: string,
  level?: LogLevel,
  additionalCategories?: number
): void {
  const resolver = getGlobalConfigResolver();
  let categories = CategoryPresets.DEV_BASIC;
  
  if (level) {
    // Map level to categories (using migration bridge logic)
    const levelMap: Record<LogLevel, number> = {
      none: LogCategory.NONE,
      error: CategoryPresets.LEVEL_ERROR,
      warn: CategoryPresets.LEVEL_WARN,
      info: CategoryPresets.LEVEL_INFO,
      debug: CategoryPresets.LEVEL_DEBUG,
      prompts: CategoryPresets.LEVEL_DEBUG | CategoryPresets.LLM_ALL,
      verboseDebug: CategoryPresets.DEV_FULL,
    };
    categories = levelMap[level];
  }
  
  if (additionalCategories) {
    categories |= additionalCategories;
  }
  
  resolver.createSessionConfig(sessionId, categories);
}

/**
 * Helper to create a request configuration
 */
export function createRequestLogging(
  requestId: string,
  categories?: number,
  ttlMs: number = 300000 // 5 minutes default
): void {
  const resolver = getGlobalConfigResolver();
  resolver.createRequestConfig(requestId, categories, undefined, ttlMs);
}