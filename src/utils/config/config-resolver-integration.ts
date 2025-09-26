/**
 * Configuration Resolver Integration
 * 
 * Bridges the new .persuader configuration file system with the existing 
 * ConfigResolver to create a unified 4-layer configuration cascade:
 * 
 * 1. .persuader File Configuration - File-based defaults and environment/pipeline overrides
 * 2. Global Configuration - Programmatic global settings
 * 3. Session Configuration - Session-specific overrides
 * 4. Request Configuration - Individual request settings
 */

import { 
  ConfigResolver, 
  LoggingConfig,
  setGlobalConfigResolver
} from '../logging/config-resolver.js';
import { LogCategory, CategoryPresets } from '../category-manager.js';
import { 
  loadConfig, 
  type PersuaderConfig,
  type LoggingConfig as FileLoggingConfig,
  type LoggingPreset,
  type PrivacyLevel 
} from './index.js';
import type { LogLevel } from '../logger.js';

/**
 * Enhanced configuration resolver that integrates .persuader config files
 */
export class EnhancedConfigResolver extends ConfigResolver {
  private fileConfig: PersuaderConfig | null = null;
  private fileConfigLoadTime: number = 0;
  private fileConfigTTL = 5 * 60 * 1000; // 5 minutes cache
  
  constructor(
    initialCategories: number = CategoryPresets.DEV_BASIC,
    private loadConfigOptions?: {
      environment?: string;
      pipeline?: string;
      configPath?: string;
    }
  ) {
    super(initialCategories);
    this.loadFileConfiguration();
  }
  
  /**
   * Load configuration from .persuader files
   */
  private async loadFileConfiguration(): Promise<void> {
    try {
      const loadOptions: any = {
        mergeWithDefaults: true,
        cache: true
      };
      
      if (this.loadConfigOptions?.environment) {
        loadOptions.environment = this.loadConfigOptions.environment;
      }
      if (this.loadConfigOptions?.pipeline) {
        loadOptions.pipeline = this.loadConfigOptions.pipeline;
      }
      if (this.loadConfigOptions?.configPath) {
        loadOptions.configPath = this.loadConfigOptions.configPath;
      }
      
      const result = await loadConfig(loadOptions);
      
      if (result.config) {
        this.fileConfig = result.config;
        this.fileConfigLoadTime = Date.now();
        
        // Apply file configuration to global layer
        this.applyFileConfigToGlobal(result.config);
      }
    } catch (error) {
      // Gracefully handle missing config files - continue with defaults
      console.warn(`Failed to load .persuader configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Apply file configuration to the global config layer
   */
  private applyFileConfigToGlobal(config: PersuaderConfig): void {
    if (!config.logging) return;
    
    const globalMetadata = this.buildMetadataFromFileConfig(config.logging);
    const categories = this.convertPresetToCategories(config.logging.preset);
    
    this.setGlobalConfig(categories, globalMetadata);
  }
  
  /**
   * Convert logging preset to category flags
   */
  private convertPresetToCategories(preset?: LoggingPreset): number {
    if (!preset) return CategoryPresets.DEV_BASIC;
    
    const presetMap: Record<LoggingPreset, number> = {
      LOCAL_DEV: CategoryPresets.DEV_FULL,
      DEBUG_FULL: CategoryPresets.DEV_FULL,
      LLM_DEBUG: CategoryPresets.DEV_BASIC | CategoryPresets.LLM_ALL,
      PRODUCTION: CategoryPresets.LEVEL_INFO,
      PROD_OBSERVABILITY: CategoryPresets.LEVEL_INFO | CategoryPresets.PERFORMANCE_ALL,
      PROD_MINIMAL: CategoryPresets.LEVEL_ERROR | CategoryPresets.LEVEL_WARN,
      GDPR_COMPLIANT: CategoryPresets.LEVEL_INFO, // Use basic info level for GDPR compliance
      SECURITY_AUDIT: CategoryPresets.LEVEL_WARN, // Focus on warnings for security
      PERFORMANCE_FOCUS: CategoryPresets.LEVEL_INFO | CategoryPresets.PERFORMANCE_ALL,
      TOKEN_MONITORING: CategoryPresets.LEVEL_INFO | CategoryPresets.LLM_ALL, // Monitor all LLM activity
      TEST_RUNNER: CategoryPresets.LEVEL_ERROR | CategoryPresets.LEVEL_WARN,
      CI_PIPELINE: CategoryPresets.LEVEL_WARN | CategoryPresets.PERFORMANCE_ALL
    };
    
    return presetMap[preset] || CategoryPresets.DEV_BASIC;
  }
  
  /**
   * Build metadata object from file logging config
   */
  private buildMetadataFromFileConfig(loggingConfig: FileLoggingConfig): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Formatting settings
    const formatting: Record<string, any> = {};
    if (loggingConfig.colors !== undefined) formatting.colors = loggingConfig.colors;
    if (loggingConfig.timestamp !== undefined) formatting.timestamp = loggingConfig.timestamp;
    if (loggingConfig.prefix !== undefined) formatting.prefix = loggingConfig.prefix;
    if (loggingConfig.maxPromptLength !== undefined) formatting.maxPromptLength = loggingConfig.maxPromptLength;
    if (loggingConfig.maxResponseLength !== undefined) formatting.maxResponseLength = loggingConfig.maxResponseLength;
    if (Object.keys(formatting).length > 0) metadata.formatting = formatting;
    
    // Output settings
    if (loggingConfig.jsonl) {
      const output: Record<string, any> = {
        console: true, // Always keep console output
        jsonl: loggingConfig.jsonl.enabled,
        logsDirectory: loggingConfig.jsonl.directory,
        maxFileSize: this.parseFileSize(loggingConfig.jsonl.maxFileSize),
        maxFiles: loggingConfig.jsonl.maxFiles
      };
      metadata.output = output;
    }
    
    // Privacy settings
    if (loggingConfig.privacy) {
      const privacy: Record<string, any> = {};
      privacy.maskSensitiveData = this.shouldMaskSensitiveData(loggingConfig.privacy.level);
      
      if (loggingConfig.privacy.customPatterns) {
        privacy.sensitivePatterns = loggingConfig.privacy.customPatterns.map(pattern => new RegExp(pattern, 'gi'));
      }
      
      if (loggingConfig.privacy.redactedFields) {
        privacy.redactFields = loggingConfig.privacy.redactedFields;
      }
      
      metadata.privacy = privacy;
    }
    
    // Performance settings
    if (loggingConfig.performance) {
      const performance: Record<string, any> = {
        trackMetrics: loggingConfig.performance.enabled,
        slowThreshold: this.parseDuration(loggingConfig.performance.slowThreshold)
      };
      
      if (loggingConfig.performance.sampleRate !== undefined) {
        // Store sample rate for potential use in performance monitoring
        performance.sampleRate = loggingConfig.performance.sampleRate;
      }
      
      metadata.performance = performance;
    }
    
    return metadata;
  }
  
  /**
   * Determine if sensitive data should be masked based on privacy level
   */
  private shouldMaskSensitiveData(level: PrivacyLevel): boolean {
    const levelMap: Record<PrivacyLevel, boolean> = {
      minimal: false,
      standard: true,
      strict: true,
      paranoid: true
    };
    return levelMap[level] ?? true;
  }
  
  /**
   * Parse file size string to bytes
   */
  private parseFileSize(size: string | number): number {
    if (typeof size === 'number') return size;
    
    const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) return 10485760; // 10MB default
    
    const [, num, unit] = match;
    const value = parseFloat(num ?? '0');
    
    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };
    
    return Math.floor(value * (multipliers[unit?.toUpperCase() ?? 'MB'] ?? 1024 * 1024));
  }
  
  /**
   * Parse duration string to milliseconds
   */
  private parseDuration(duration: string | number): number {
    if (typeof duration === 'number') return duration;
    
    const match = duration.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/i);
    if (!match) return 5000; // 5s default
    
    const [, num, unit] = match;
    const value = parseFloat(num ?? '0');
    
    const multipliers: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000
    };
    
    return Math.floor(value * (multipliers[unit?.toLowerCase() ?? 's'] ?? 1000));
  }
  
  /**
   * Create environment-specific configuration
   */
  public async createEnvironmentConfig(environment: string): Promise<boolean> {
    try {
      const loadOptions: any = {
        environment,
        mergeWithDefaults: true,
        cache: true
      };
      
      if (this.loadConfigOptions?.pipeline) {
        loadOptions.pipeline = this.loadConfigOptions.pipeline;
      }
      if (this.loadConfigOptions?.configPath) {
        loadOptions.configPath = this.loadConfigOptions.configPath;
      }
      
      const result = await loadConfig(loadOptions);
      
      if (result.config?.logging) {
        const categories = this.convertPresetToCategories(result.config.logging.preset);
        const metadata = this.buildMetadataFromFileConfig(result.config.logging);
        this.setGlobalConfig(categories, metadata);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn(`Failed to load environment configuration '${environment}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Create pipeline-specific session configuration
   */
  public async createPipelineSessionConfig(
    sessionId: string, 
    pipeline: string
  ): Promise<boolean> {
    try {
      const loadOptions: any = {
        pipeline,
        mergeWithDefaults: true,
        cache: true
      };
      
      if (this.loadConfigOptions?.environment) {
        loadOptions.environment = this.loadConfigOptions.environment;
      }
      if (this.loadConfigOptions?.configPath) {
        loadOptions.configPath = this.loadConfigOptions.configPath;
      }
      
      const result = await loadConfig(loadOptions);
      
      if (result.config?.pipelines?.[pipeline]?.logging) {
        const pipelineLogging = result.config.pipelines[pipeline].logging!;
        const categories = this.convertPresetToCategories(pipelineLogging.preset);
        const metadata = this.buildMetadataFromFileConfig(pipelineLogging);
        
        this.createSessionConfig(sessionId, categories, metadata);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn(`Failed to load pipeline configuration '${pipeline}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Refresh configuration from files if TTL expired
   */
  private async refreshConfigIfNeeded(): Promise<void> {
    if (Date.now() - this.fileConfigLoadTime > this.fileConfigTTL) {
      await this.loadFileConfiguration();
    }
  }
  
  /**
   * Get effective configuration with file-based defaults
   */
  public override getEffectiveConfig(): LoggingConfig {
    // Ensure config is fresh
    this.refreshConfigIfNeeded();
    
    return super.getEffectiveConfig();
  }
  
  /**
   * Get the loaded file configuration
   */
  public getFileConfig(): PersuaderConfig | null {
    return this.fileConfig;
  }
  
  /**
   * Get configuration loading details
   */
  public getLoadStatus(): {
    hasFileConfig: boolean;
    configAge: number;
    environment?: string;
    pipeline?: string;
    configPath?: string;
  } {
    const result: {
      hasFileConfig: boolean;
      configAge: number;
      environment?: string;
      pipeline?: string;
      configPath?: string;
    } = {
      hasFileConfig: this.fileConfig !== null,
      configAge: Date.now() - this.fileConfigLoadTime
    };
    
    if (this.loadConfigOptions?.environment) {
      result.environment = this.loadConfigOptions.environment;
    }
    if (this.loadConfigOptions?.pipeline) {
      result.pipeline = this.loadConfigOptions.pipeline;
    }
    if (this.loadConfigOptions?.configPath) {
      result.configPath = this.loadConfigOptions.configPath;
    }
    
    return result;
  }
}

/**
 * Global enhanced configuration resolver instance
 */
let globalEnhancedResolver: EnhancedConfigResolver | null = null;

/**
 * Initialize the global enhanced configuration resolver
 */
export function initializeGlobalConfigResolver(options?: {
  environment?: string;
  pipeline?: string;
  configPath?: string;
  initialCategories?: number;
}): EnhancedConfigResolver {
  const loadConfigOptions: any = {};
  
  if (options?.environment) {
    loadConfigOptions.environment = options.environment;
  }
  if (options?.pipeline) {
    loadConfigOptions.pipeline = options.pipeline;
  }
  if (options?.configPath) {
    loadConfigOptions.configPath = options.configPath;
  }
  
  globalEnhancedResolver = new EnhancedConfigResolver(
    options?.initialCategories || CategoryPresets.DEV_BASIC,
    loadConfigOptions
  );
  
  // Replace the original global resolver
  setGlobalConfigResolver(globalEnhancedResolver);
  
  return globalEnhancedResolver;
}

/**
 * Get the global enhanced configuration resolver
 */
export function getGlobalEnhancedConfigResolver(): EnhancedConfigResolver {
  if (!globalEnhancedResolver) {
    globalEnhancedResolver = new EnhancedConfigResolver();
  }
  return globalEnhancedResolver;
}

/**
 * Get the global configuration resolver (maintains compatibility)
 */
export function getGlobalConfigResolver(): ConfigResolver {
  return getGlobalEnhancedConfigResolver();
}

/**
 * Helper to create environment-aware session logging
 */
export async function createEnvironmentSessionLogging(
  sessionId: string,
  environment?: string,
  level?: LogLevel,
  additionalCategories?: number
): Promise<void> {
  const resolver = getGlobalEnhancedConfigResolver();
  
  // Load environment-specific configuration if specified
  if (environment) {
    await resolver.createEnvironmentConfig(environment);
  }
  
  // Create session config with level override
  let categories = resolver.getEffectiveCategories();
  
  if (level) {
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
 * Helper to create pipeline-aware session logging
 */
export async function createPipelineSessionLogging(
  sessionId: string,
  pipeline: string,
  additionalCategories?: number
): Promise<boolean> {
  const resolver = getGlobalEnhancedConfigResolver();
  
  const success = await resolver.createPipelineSessionConfig(sessionId, pipeline);
  
  if (success && additionalCategories) {
    // Merge additional categories
    const existingConfig = resolver['sessionConfigs'].get(sessionId);
    if (existingConfig) {
      existingConfig.categories |= additionalCategories;
    }
  }
  
  return success;
}

/**
 * Migration helper - gradually replace usage of original getGlobalConfigResolver
 */
export function migrateToEnhancedResolver(): void {
  // Get or create enhanced resolver
  const enhancedResolver = getGlobalEnhancedConfigResolver();
  
  // Replace the original global resolver reference
  setGlobalConfigResolver(enhancedResolver);
  
  console.log('✅ Migrated to enhanced configuration resolver with .persuader file support');
}