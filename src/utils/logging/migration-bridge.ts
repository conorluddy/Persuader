/**
 * Migration Bridge Module
 * 
 * Provides backward compatibility for existing logger usage while internally
 * using the new category-based logging system. Maps traditional log levels
 * and specialized methods to appropriate categories.
 */

import type { 
  LogLevel
} from '../logger.js';
import { 
  CategoryManager, 
  LogCategory, 
  CategoryPresets 
} from '../category-manager.js';

/**
 * Maps traditional log levels to category combinations
 */
const LEVEL_TO_CATEGORIES: Record<LogLevel, number> = {
  none: LogCategory.NONE,
  error: CategoryPresets.LEVEL_ERROR,
  warn: CategoryPresets.LEVEL_WARN,
  info: CategoryPresets.LEVEL_INFO,
  debug: CategoryPresets.LEVEL_DEBUG,
  prompts: CategoryPresets.LEVEL_DEBUG | CategoryPresets.LLM_ALL,
  verboseDebug: CategoryPresets.DEV_FULL,
};

/**
 * Migration bridge that translates old logger calls to new category system
 */
export class LoggerMigrationBridge {
  private categoryManager: CategoryManager;
  private currentLevel: LogLevel;
  
  constructor(level: LogLevel = 'info') {
    this.currentLevel = level;
    this.categoryManager = new CategoryManager(LEVEL_TO_CATEGORIES[level]);
  }
  
  /**
   * Set log level and update categories accordingly
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
    this.categoryManager.setCategories(LEVEL_TO_CATEGORIES[level]);
  }
  
  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }
  
  /**
   * Check if should log based on level (maps to category check)
   */
  shouldLog(level: LogLevel): boolean {
    const requiredCategories = LEVEL_TO_CATEGORIES[level];
    
    // For 'none' level, nothing should log
    if (requiredCategories === LogCategory.NONE) {
      return this.categoryManager.getCategories() !== LogCategory.NONE;
    }
    
    // Check if any of the required categories are enabled
    return (this.categoryManager.getCategories() & requiredCategories) !== 0;
  }
  
  /**
   * Map error() calls to ERROR category
   */
  shouldLogError(): boolean {
    return this.categoryManager.isEnabled(LogCategory.ERROR);
  }
  
  /**
   * Map warn() calls to WARN category
   */
  shouldLogWarn(): boolean {
    return this.categoryManager.isEnabled(LogCategory.WARN);
  }
  
  /**
   * Map info() calls to INFO category
   */
  shouldLogInfo(): boolean {
    return this.categoryManager.isEnabled(LogCategory.INFO);
  }
  
  /**
   * Map debug() calls to DEBUG category
   */
  shouldLogDebug(): boolean {
    return this.categoryManager.isEnabled(LogCategory.DEBUG);
  }
  
  /**
   * Map LLM request logging to appropriate categories
   */
  shouldLogLLMRequest(isFullPrompt: boolean = false): boolean {
    if (isFullPrompt && this.currentLevel === 'verboseDebug') {
      return this.categoryManager.isEnabled(LogCategory.LLM_REQUEST);
    }
    
    if (this.currentLevel === 'prompts') {
      return true; // Special prompts mode always shows LLM I/O
    }
    
    return this.categoryManager.isEnabled(LogCategory.LLM_REQUEST);
  }
  
  /**
   * Map LLM response logging to appropriate categories
   */
  shouldLogLLMResponse(isRawResponse: boolean = false): boolean {
    if (isRawResponse && this.currentLevel === 'verboseDebug') {
      return this.categoryManager.isEnabled(LogCategory.LLM_RESPONSE);
    }
    
    if (this.currentLevel === 'prompts') {
      return true; // Special prompts mode always shows LLM I/O
    }
    
    return this.categoryManager.isEnabled(LogCategory.LLM_RESPONSE);
  }
  
  /**
   * Map LLM error logging to appropriate category
   */
  shouldLogLLMError(): boolean {
    return this.categoryManager.isEnabled(LogCategory.LLM_ERROR);
  }
  
  /**
   * Map validation logging to appropriate categories
   */
  shouldLogValidation(success: boolean): boolean {
    if (success) {
      return this.categoryManager.isEnabled(LogCategory.VALIDATION_SUCCESS);
    } else {
      return this.categoryManager.isEnabled(LogCategory.VALIDATION_FAILURE);
    }
  }
  
  /**
   * Map detailed validation error logging
   */
  shouldLogDetailedValidation(): boolean {
    return this.categoryManager.isEnabled(LogCategory.VALIDATION_DETAIL);
  }
  
  /**
   * Map performance logging to appropriate category
   */
  shouldLogPerformance(): boolean {
    return this.categoryManager.isEnabled(LogCategory.PERF_TIMING);
  }
  
  /**
   * Get the underlying category manager for advanced usage
   */
  getCategoryManager(): CategoryManager {
    return this.categoryManager;
  }
  
  /**
   * Enable additional categories beyond the base level
   */
  enableAdditionalCategories(...categories: LogCategory[]): void {
    this.categoryManager.enable(...categories);
  }
  
  /**
   * Disable specific categories
   */
  disableCategories(...categories: LogCategory[]): void {
    this.categoryManager.disable(...categories);
  }
  
  /**
   * Set context-specific overrides
   */
  setContextOverride(context: string, level: LogLevel): void {
    const categories = LEVEL_TO_CATEGORIES[level];
    this.categoryManager.setOverride(context, categories);
  }
  
  /**
   * Clear context-specific override
   */
  clearContextOverride(context: string): void {
    this.categoryManager.clearOverride(context);
  }
  
  /**
   * Map old config to new category-based config
   */
  static mapConfig(oldConfig: {
    level?: LogLevel;
    fullPromptLogging?: boolean;
    rawResponseLogging?: boolean;
    detailedValidationErrors?: boolean;
  }): number {
    let categories = LEVEL_TO_CATEGORIES[oldConfig.level || 'info'];
    
    if (oldConfig.fullPromptLogging) {
      categories |= LogCategory.LLM_REQUEST;
    }
    
    if (oldConfig.rawResponseLogging) {
      categories |= LogCategory.LLM_RESPONSE;
    }
    
    if (oldConfig.detailedValidationErrors) {
      categories |= LogCategory.VALIDATION_DETAIL | LogCategory.VALIDATION_DIFF;
    }
    
    return categories;
  }
  
  /**
   * Create a summary of current configuration
   */
  getConfigSummary(): {
    level: LogLevel;
    categories: string;
    enabledFeatures: string[];
  } {
    const summary = this.categoryManager.getSummary();
    
    const enabledFeatures: string[] = [];
    if (this.categoryManager.isEnabled(LogCategory.LLM_REQUEST)) {
      enabledFeatures.push('LLM Requests');
    }
    if (this.categoryManager.isEnabled(LogCategory.LLM_RESPONSE)) {
      enabledFeatures.push('LLM Responses');
    }
    if (this.categoryManager.isEnabled(LogCategory.VALIDATION_DETAIL)) {
      enabledFeatures.push('Detailed Validation');
    }
    if (this.categoryManager.isEnabled(LogCategory.PERF_TIMING)) {
      enabledFeatures.push('Performance Tracking');
    }
    
    return {
      level: this.currentLevel,
      categories: summary.enabledCategories.join(', '),
      enabledFeatures,
    };
  }
}

/**
 * Global migration bridge instance
 */
let globalBridge: LoggerMigrationBridge | null = null;

/**
 * Get or create the global migration bridge
 */
export function getGlobalMigrationBridge(): LoggerMigrationBridge {
  if (!globalBridge) {
    globalBridge = new LoggerMigrationBridge();
  }
  return globalBridge;
}

/**
 * Set the global migration bridge
 */
export function setGlobalMigrationBridge(bridge: LoggerMigrationBridge): void {
  globalBridge = bridge;
}

/**
 * Helper to check if should log based on traditional level
 */
export function shouldLogLevel(level: LogLevel): boolean {
  return getGlobalMigrationBridge().shouldLog(level);
}

/**
 * Helper to migrate old logger config to new system
 */
export function migrateLoggerConfig(oldConfig: unknown): CategoryManager {
  // Type guard to ensure oldConfig matches expected shape
  const typedConfig = oldConfig as {
    level?: LogLevel;
    fullPromptLogging?: boolean;
    rawResponseLogging?: boolean;
    detailedValidationErrors?: boolean;
  };
  const categories = LoggerMigrationBridge.mapConfig(typedConfig);
  return new CategoryManager(categories);
}