/**
 * Category Manager Module
 * 
 * Provides efficient category-based logging with bit flag optimization.
 * Allows fine-grained control over what gets logged based on categories
 * rather than traditional log levels.
 */

/**
 * Logging categories as bit flags for efficient filtering
 * Each category is a power of 2 to allow bitwise operations
 */
export enum LogCategory {
  // Core categories (0-7)
  NONE = 0,
  ERROR = 1 << 0,        // 1 - Critical errors
  WARN = 1 << 1,         // 2 - Warnings
  INFO = 1 << 2,         // 4 - General info
  DEBUG = 1 << 3,        // 8 - Debug information
  
  // LLM categories (8-15)
  LLM_REQUEST = 1 << 8,  // 256 - LLM requests
  LLM_RESPONSE = 1 << 9, // 512 - LLM responses
  LLM_ERROR = 1 << 10,   // 1024 - LLM errors
  LLM_TOKEN = 1 << 11,   // 2048 - Token usage
  
  // Validation categories (16-23)
  VALIDATION_SUCCESS = 1 << 16,  // 65536 - Successful validations
  VALIDATION_FAILURE = 1 << 17,  // 131072 - Failed validations
  VALIDATION_DETAIL = 1 << 18,   // 262144 - Detailed validation info
  VALIDATION_DIFF = 1 << 19,     // 524288 - Validation diffs
  
  // Performance categories (24-27)
  PERF_TIMING = 1 << 24,    // 16777216 - Timing metrics
  PERF_MEMORY = 1 << 25,    // 33554432 - Memory usage
  PERF_COST = 1 << 26,      // 67108864 - Cost tracking
  
  // Session categories (28-31)
  SESSION_CREATE = 1 << 28,    // 268435456 - Session creation
  SESSION_UPDATE = 1 << 29,    // 536870912 - Session updates
  SESSION_METRICS = 1 << 30,   // 1073741824 - Session metrics
}

/**
 * Predefined category combinations for common use cases
 */
export const CategoryPresets = {
  // Traditional log levels mapped to categories
  LEVEL_ERROR: LogCategory.ERROR,
  LEVEL_WARN: LogCategory.ERROR | LogCategory.WARN,
  LEVEL_INFO: LogCategory.ERROR | LogCategory.WARN | LogCategory.INFO,
  LEVEL_DEBUG: LogCategory.ERROR | LogCategory.WARN | LogCategory.INFO | LogCategory.DEBUG,
  
  // Functional presets
  LLM_ALL: LogCategory.LLM_REQUEST | LogCategory.LLM_RESPONSE | LogCategory.LLM_ERROR | LogCategory.LLM_TOKEN,
  VALIDATION_ALL: LogCategory.VALIDATION_SUCCESS | LogCategory.VALIDATION_FAILURE | LogCategory.VALIDATION_DETAIL | LogCategory.VALIDATION_DIFF,
  PERFORMANCE_ALL: LogCategory.PERF_TIMING | LogCategory.PERF_MEMORY | LogCategory.PERF_COST,
  SESSION_ALL: LogCategory.SESSION_CREATE | LogCategory.SESSION_UPDATE | LogCategory.SESSION_METRICS,
  
  // Development presets
  DEV_BASIC: LogCategory.ERROR | LogCategory.WARN | LogCategory.INFO | LogCategory.LLM_ERROR | LogCategory.VALIDATION_FAILURE,
  DEV_VERBOSE: LogCategory.ERROR | LogCategory.WARN | LogCategory.INFO | LogCategory.DEBUG | 
               LogCategory.LLM_REQUEST | LogCategory.LLM_RESPONSE | LogCategory.LLM_ERROR | 
               LogCategory.VALIDATION_FAILURE | LogCategory.VALIDATION_DETAIL,
  DEV_FULL: ~LogCategory.NONE, // All categories
  
  // Production presets
  PROD_MINIMAL: LogCategory.ERROR,
  PROD_STANDARD: LogCategory.ERROR | LogCategory.WARN | LogCategory.PERF_COST,
  PROD_MONITORING: LogCategory.ERROR | LogCategory.WARN | LogCategory.INFO | 
                   LogCategory.PERF_TIMING | LogCategory.PERF_COST | LogCategory.SESSION_METRICS,
} as const;

/**
 * Category manager for efficient category-based logging
 */
export class CategoryManager {
  private activeCategories: number;
  private categoryOverrides: Map<string, number>;
  
  constructor(initialCategories: number = CategoryPresets.DEV_BASIC) {
    this.activeCategories = initialCategories;
    this.categoryOverrides = new Map();
  }
  
  /**
   * Check if a category is enabled
   */
  isEnabled(category: LogCategory): boolean {
    return (this.activeCategories & category) !== 0;
  }
  
  /**
   * Check if any of the given categories are enabled
   */
  isAnyEnabled(...categories: LogCategory[]): boolean {
    const combined = categories.reduce((acc, cat) => acc | cat, 0);
    return (this.activeCategories & combined) !== 0;
  }
  
  /**
   * Check if all of the given categories are enabled
   */
  areAllEnabled(...categories: LogCategory[]): boolean {
    const combined = categories.reduce((acc, cat) => acc | cat, 0);
    return (this.activeCategories & combined) === combined;
  }
  
  /**
   * Enable one or more categories
   */
  enable(...categories: LogCategory[]): void {
    categories.forEach(cat => {
      this.activeCategories |= cat;
    });
  }
  
  /**
   * Disable one or more categories
   */
  disable(...categories: LogCategory[]): void {
    categories.forEach(cat => {
      this.activeCategories &= ~cat;
    });
  }
  
  /**
   * Toggle one or more categories
   */
  toggle(...categories: LogCategory[]): void {
    categories.forEach(cat => {
      this.activeCategories ^= cat;
    });
  }
  
  /**
   * Set active categories using a preset or custom combination
   */
  setCategories(categories: number): void {
    this.activeCategories = categories;
  }
  
  /**
   * Get current active categories
   */
  getCategories(): number {
    return this.activeCategories;
  }
  
  /**
   * Set a context-specific override for categories
   * Useful for enabling detailed logging for specific operations
   */
  setOverride(context: string, categories: number): void {
    this.categoryOverrides.set(context, categories);
  }
  
  /**
   * Remove a context-specific override
   */
  clearOverride(context: string): void {
    this.categoryOverrides.delete(context);
  }
  
  /**
   * Get effective categories for a given context
   */
  getEffectiveCategories(context?: string): number {
    if (context && this.categoryOverrides.has(context)) {
      return this.categoryOverrides.get(context)!;
    }
    return this.activeCategories;
  }
  
  /**
   * Check if a category is enabled in a specific context
   */
  isEnabledInContext(category: LogCategory, context?: string): boolean {
    const effective = this.getEffectiveCategories(context);
    return (effective & category) !== 0;
  }
  
  /**
   * Convert categories to human-readable string
   */
  toString(): string {
    const enabled: string[] = [];
    
    Object.entries(LogCategory).forEach(([name, value]) => {
      if (typeof value === 'number' && value !== 0 && this.isEnabled(value)) {
        enabled.push(name);
      }
    });
    
    return enabled.join(', ');
  }
  
  /**
   * Parse category string into bit flags
   * Example: "ERROR,WARN,LLM_REQUEST" -> corresponding bit flags
   */
  static parse(categoryString: string): number {
    const parts = categoryString.split(',').map(s => s.trim().toUpperCase());
    let result = 0;
    
    parts.forEach(part => {
      // Check if it's a preset
      if (part in CategoryPresets) {
        result |= CategoryPresets[part as keyof typeof CategoryPresets];
      } 
      // Check if it's a category
      else if (part in LogCategory) {
        result |= LogCategory[part as keyof typeof LogCategory];
      }
      // Check for level shortcuts
      else if (part.startsWith('LEVEL_')) {
        const levelKey = part as keyof typeof CategoryPresets;
        if (levelKey in CategoryPresets) {
          result |= CategoryPresets[levelKey];
        }
      }
    });
    
    return result;
  }
  
  /**
   * Create a summary of active categories
   */
  getSummary(): {
    totalCategories: number;
    enabledCategories: string[];
    disabledCategories: string[];
    overrides: Map<string, string[]>;
  } {
    const enabled: string[] = [];
    const disabled: string[] = [];
    
    Object.entries(LogCategory).forEach(([name, value]) => {
      if (typeof value === 'number' && value !== 0) {
        if (this.isEnabled(value)) {
          enabled.push(name);
        } else {
          disabled.push(name);
        }
      }
    });
    
    const overrides = new Map<string, string[]>();
    this.categoryOverrides.forEach((categories, context) => {
      const manager = new CategoryManager(categories);
      overrides.set(context, manager.toString().split(', '));
    });
    
    return {
      totalCategories: enabled.length + disabled.length,
      enabledCategories: enabled,
      disabledCategories: disabled,
      overrides,
    };
  }
}

/**
 * Global category manager instance
 */
let globalCategoryManager: CategoryManager | null = null;

/**
 * Get the global category manager
 */
export function getGlobalCategoryManager(): CategoryManager {
  if (!globalCategoryManager) {
    globalCategoryManager = new CategoryManager();
  }
  return globalCategoryManager;
}

/**
 * Set the global category manager
 */
export function setGlobalCategoryManager(manager: CategoryManager): void {
  globalCategoryManager = manager;
}

/**
 * Helper function to check if a category should be logged
 */
export function shouldLogCategory(category: LogCategory, context?: string): boolean {
  return getGlobalCategoryManager().isEnabledInContext(category, context);
}

/**
 * Helper to enable categories globally
 */
export function enableCategories(...categories: LogCategory[]): void {
  getGlobalCategoryManager().enable(...categories);
}

/**
 * Helper to disable categories globally
 */
export function disableCategories(...categories: LogCategory[]): void {
  getGlobalCategoryManager().disable(...categories);
}

/**
 * Helper to set categories using preset
 */
export function setCategoryPreset(preset: keyof typeof CategoryPresets): void {
  getGlobalCategoryManager().setCategories(CategoryPresets[preset]);
}