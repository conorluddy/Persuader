/**
 * Logging Presets Module
 * 
 * Provides comprehensive preset configurations for different
 * development scenarios, environments, and debugging needs.
 */

import { LogCategory, CategoryPresets } from '../category-manager.js';
import { PrivacyLevel } from './privacy-filter.js';
import type { LoggingConfig } from './config-resolver.js';

/**
 * Environment-specific presets
 */
export const EnvironmentPresets = {
  /**
   * Local development with full visibility
   */
  LOCAL_DEV: {
    categories: CategoryPresets.DEV_VERBOSE,
    formatting: {
      colors: true,
      timestamp: true,
      prefix: 'Persuader-Dev',
      maxPromptLength: 2000,
      maxResponseLength: 2000,
    },
    output: {
      console: true,
      jsonl: true,
      logsDirectory: './logs/dev',
    },
    privacy: {
      maskSensitiveData: false,
      level: PrivacyLevel.OFF,
    },
    performance: {
      enabled: true,
      sampleRate: 1.0,
      slowThreshold: 3000,
    },
  },
  
  /**
   * Testing environment with focused logging
   */
  TEST: {
    categories: LogCategory.ERROR | LogCategory.WARN | LogCategory.VALIDATION_FAILURE,
    formatting: {
      colors: false,
      timestamp: true,
      prefix: 'Test',
      maxPromptLength: 500,
      maxResponseLength: 500,
    },
    output: {
      console: false,
      jsonl: true,
      logsDirectory: './logs/test',
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.STANDARD,
    },
    performance: {
      enabled: true,
      sampleRate: 0.1,
      slowThreshold: 1000,
    },
  },
  
  /**
   * CI/CD pipeline optimized
   */
  CI: {
    categories: LogCategory.ERROR | LogCategory.WARN | LogCategory.INFO,
    formatting: {
      colors: false,
      timestamp: true,
      prefix: 'CI',
      maxPromptLength: 200,
      maxResponseLength: 200,
    },
    output: {
      console: true,
      jsonl: false,
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.STRICT,
    },
    performance: {
      trackMetrics: false,
    },
  },
  
  /**
   * Production with minimal overhead
   */
  PRODUCTION: {
    categories: CategoryPresets.PROD_STANDARD,
    formatting: {
      colors: false,
      timestamp: true,
      prefix: 'Prod',
      maxPromptLength: 100,
      maxResponseLength: 100,
    },
    output: {
      console: true,
      jsonl: true,
      logsDirectory: '/var/log/persuader',
      maxFileSize: 52428800, // 50MB
      maxFiles: 30,
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.STRICT,
      redactFields: ['apiKey', 'token', 'password', 'secret'],
    },
    performance: {
      enabled: true,
      sampleRate: 0.01,
      slowThreshold: 10000,
      exportInterval: 300000,
    },
  },
  
  /**
   * Staging environment
   */
  STAGING: {
    categories: CategoryPresets.PROD_MONITORING,
    formatting: {
      colors: false,
      timestamp: true,
      prefix: 'Stage',
      maxPromptLength: 500,
      maxResponseLength: 500,
    },
    output: {
      console: true,
      jsonl: true,
      logsDirectory: './logs/staging',
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.STANDARD,
    },
    performance: {
      enabled: true,
      sampleRate: 0.5,
      slowThreshold: 7000,
    },
  },
};

/**
 * Debugging-focused presets
 */
export const DebugPresets = {
  /**
   * LLM interaction debugging
   */
  LLM_DEBUG: {
    categories: CategoryPresets.LLM_ALL | LogCategory.DEBUG,
    formatting: {
      colors: true,
      timestamp: true,
      maxPromptLength: 10000,
      maxResponseLength: 10000,
    },
    output: {
      console: true,
      jsonl: true,
      logsDirectory: './logs/llm-debug',
    },
    privacy: {
      maskSensitiveData: false,
      level: PrivacyLevel.OFF,
    },
  },
  
  /**
   * Validation debugging
   */
  VALIDATION_DEBUG: {
    categories: CategoryPresets.VALIDATION_ALL | LogCategory.DEBUG,
    formatting: {
      colors: true,
      timestamp: true,
    },
    output: {
      console: true,
      jsonl: true,
      logsDirectory: './logs/validation-debug',
    },
  },
  
  /**
   * Performance profiling
   */
  PERFORMANCE_PROFILE: {
    categories: CategoryPresets.PERFORMANCE_ALL | LogCategory.INFO,
    formatting: {
      colors: true,
      timestamp: true,
    },
    output: {
      console: true,
      jsonl: true,
      logsDirectory: './logs/performance',
    },
    performance: {
      enabled: true,
      sampleRate: 1.0,
      slowThreshold: 100,
      memoryCheckInterval: 1000,
      aggregationInterval: 10000,
    },
  },
  
  /**
   * Session debugging
   */
  SESSION_DEBUG: {
    categories: CategoryPresets.SESSION_ALL | LogCategory.DEBUG,
    formatting: {
      colors: true,
      timestamp: true,
    },
    output: {
      console: true,
      jsonl: true,
      logsDirectory: './logs/session-debug',
    },
  },
  
  /**
   * Memory leak detection
   */
  MEMORY_DEBUG: {
    categories: LogCategory.PERF_MEMORY | LogCategory.ERROR | LogCategory.WARN,
    performance: {
      trackMetrics: true,
      metricsInterval: 30000,
      slowThreshold: 100,
    },
  },
};

/**
 * Use-case specific presets
 */
export const UseCasePresets = {
  /**
   * Interactive CLI usage
   */
  CLI_INTERACTIVE: {
    categories: LogCategory.ERROR | LogCategory.WARN | LogCategory.INFO,
    formatting: {
      colors: true,
      timestamp: false,
      prefix: '',
      maxPromptLength: 500,
      maxResponseLength: 1000,
    },
    output: {
      console: true,
      jsonl: false,
    },
  },
  
  /**
   * API server mode
   */
  API_SERVER: {
    categories: CategoryPresets.PROD_MONITORING,
    formatting: {
      colors: false,
      timestamp: true,
    },
    output: {
      console: true,
      jsonl: true,
    },
    performance: {
      trackMetrics: true,
      metricsInterval: 60000,
      slowThreshold: 5000,
    },
  },
  
  /**
   * Batch processing
   */
  BATCH_PROCESSING: {
    categories: LogCategory.ERROR | LogCategory.WARN | LogCategory.PERF_TIMING,
    formatting: {
      colors: false,
      timestamp: true,
      maxPromptLength: 100,
      maxResponseLength: 100,
    },
    output: {
      console: false,
      jsonl: true,
      maxFileSize: 104857600, // 100MB
    },
    performance: {
      trackMetrics: true,
      metricsInterval: 60000,
      slowThreshold: 5000,
    },
  },
  
  /**
   * Data processing pipeline
   */
  DATA_PIPELINE: {
    categories: LogCategory.ERROR | LogCategory.VALIDATION_FAILURE | LogCategory.PERF_TIMING,
    formatting: {
      timestamp: true,
    },
    output: {
      jsonl: true,
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.STANDARD,
    },
  },
  
  /**
   * Cost optimization mode
   */
  COST_TRACKING: {
    categories: LogCategory.LLM_TOKEN | LogCategory.PERF_COST | LogCategory.ERROR,
    formatting: {
      timestamp: true,
    },
    output: {
      jsonl: true,
      logsDirectory: './logs/costs',
    },
    performance: {
      trackMetrics: true,
      metricsInterval: 60000,
      slowThreshold: 5000,
    },
  },
};

/**
 * Security-focused presets
 */
export const SecurityPresets = {
  /**
   * Maximum privacy protection
   */
  PARANOID: {
    categories: LogCategory.ERROR,
    formatting: {
      maxPromptLength: 0,
      maxResponseLength: 0,
    },
    output: {
      console: true,
      jsonl: false,
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.PARANOID,
      redactFields: ['*'],
    },
  },
  
  /**
   * GDPR compliance mode
   */
  GDPR_COMPLIANT: {
    categories: CategoryPresets.PROD_MINIMAL,
    formatting: {
      maxPromptLength: 50,
      maxResponseLength: 50,
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.STRICT,
      sensitivePatterns: [
        /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Names
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IPs
      ],
      redactFields: [
        'email', 'phone', 'name', 'address',
        'ssn', 'dob', 'username', 'userId',
      ],
    },
  },
  
  /**
   * Audit logging mode
   */
  AUDIT: {
    categories: LogCategory.ERROR | LogCategory.WARN | LogCategory.SESSION_CREATE | LogCategory.LLM_REQUEST,
    formatting: {
      timestamp: true,
      prefix: 'AUDIT',
    },
    output: {
      console: false,
      jsonl: true,
      logsDirectory: './logs/audit',
      maxFileSize: 104857600, // 100MB
      maxFiles: 365, // 1 year
    },
    privacy: {
      maskSensitiveData: true,
      level: PrivacyLevel.STANDARD,
    },
  },
};

/**
 * Combined preset type
 */
export type LoggingPreset = 
  | keyof typeof EnvironmentPresets
  | keyof typeof DebugPresets
  | keyof typeof UseCasePresets
  | keyof typeof SecurityPresets;

/**
 * Get a preset configuration
 */
export function getPreset(name: LoggingPreset): Partial<LoggingConfig> {
  // Check each preset collection
  if (name in EnvironmentPresets) {
    return EnvironmentPresets[name as keyof typeof EnvironmentPresets];
  }
  
  if (name in DebugPresets) {
    return DebugPresets[name as keyof typeof DebugPresets];
  }
  
  if (name in UseCasePresets) {
    return UseCasePresets[name as keyof typeof UseCasePresets];
  }
  
  if (name in SecurityPresets) {
    return SecurityPresets[name as keyof typeof SecurityPresets];
  }
  
  throw new Error(`Unknown preset: ${name}`);
}

/**
 * Get all available preset names
 */
export function getPresetNames(): string[] {
  return [
    ...Object.keys(EnvironmentPresets),
    ...Object.keys(DebugPresets),
    ...Object.keys(UseCasePresets),
    ...Object.keys(SecurityPresets),
  ];
}

/**
 * Combine multiple presets
 */
export function combinePresets(...presets: LoggingPreset[]): Partial<LoggingConfig> {
  const combined: Partial<LoggingConfig> = {
    categories: 0,
    formatting: {},
    output: {},
    privacy: {},
    performance: {},
  };
  
  for (const presetName of presets) {
    const preset = getPreset(presetName);
    
    // Combine categories with OR
    if (preset.categories !== undefined && combined.categories !== undefined) {
      combined.categories |= preset.categories;
    }
    
    // Merge other settings
    if (preset.formatting) {
      Object.assign(combined.formatting!, preset.formatting);
    }
    
    if (preset.output) {
      Object.assign(combined.output!, preset.output);
    }
    
    if (preset.privacy) {
      Object.assign(combined.privacy!, preset.privacy);
    }
    
    if (preset.performance) {
      Object.assign(combined.performance!, preset.performance);
    }
  }
  
  return combined;
}

/**
 * Create a custom preset builder
 */
export class PresetBuilder {
  private config: Partial<LoggingConfig> = {
    categories: 0,
    formatting: {},
    output: {},
    privacy: {},
    performance: {},
  };
  
  /**
   * Start from an existing preset
   */
  fromPreset(preset: LoggingPreset): this {
    this.config = { ...getPreset(preset) };
    return this;
  }
  
  /**
   * Add categories
   */
  withCategories(...categories: LogCategory[]): this {
    this.config.categories = categories.reduce((acc, cat) => acc | cat, this.config.categories || 0);
    return this;
  }
  
  /**
   * Set privacy level
   */
  withPrivacy(level: PrivacyLevel): this {
    this.config.privacy = {
      ...this.config.privacy,
      maskSensitiveData: level > PrivacyLevel.OFF,
    };
    return this;
  }
  
  /**
   * Enable performance tracking
   */
  withPerformance(_sampleRate: number = 1.0): this {
    this.config.performance = {
      ...this.config.performance,
      trackMetrics: true,
      metricsInterval: 60000,
      slowThreshold: 5000,
    };
    return this;
  }
  
  /**
   * Enable JSONL output
   */
  withJsonl(directory: string = './logs'): this {
    this.config.output = {
      ...this.config.output,
      jsonl: true,
      logsDirectory: directory,
    };
    return this;
  }
  
  /**
   * Build the preset
   */
  build(): Partial<LoggingConfig> {
    return this.config;
  }
}

/**
 * Smart preset selector based on environment
 */
export function selectPresetFromEnvironment(): LoggingPreset {
  const env = process.env.NODE_ENV?.toLowerCase();
  const isCI = process.env.CI === 'true';
  const isDebug = process.env.DEBUG === 'true';
  
  if (isCI) return 'CI';
  if (isDebug) return 'LOCAL_DEV';
  
  switch (env) {
    case 'production':
      return 'PRODUCTION';
    case 'staging':
      return 'STAGING';
    case 'test':
      return 'TEST';
    case 'development':
    default:
      return 'LOCAL_DEV';
  }
}