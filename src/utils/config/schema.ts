/**
 * Configuration Schema Definition
 * 
 * Comprehensive Zod schema for .persuader configuration files
 * with full type safety and integration with existing logging system.
 */

import { z } from 'zod';

// Re-export existing types for integration
export type { LogLevel } from '../logger.js';

/**
 * Privacy level enum schema
 */
export const PrivacyLevelSchema = z.enum(['minimal', 'standard', 'strict', 'paranoid']);
export type PrivacyLevel = z.infer<typeof PrivacyLevelSchema>;

/**
 * Logging preset schema - matches existing preset system
 */
export const LoggingPresetSchema = z.enum([
  'LOCAL_DEV',
  'DEBUG_FULL', 
  'LLM_DEBUG',
  'PRODUCTION',
  'PROD_OBSERVABILITY',
  'PROD_MINIMAL',
  'GDPR_COMPLIANT',
  'SECURITY_AUDIT',
  'PERFORMANCE_FOCUS',
  'TOKEN_MONITORING',
  'TEST_RUNNER',
  'CI_PIPELINE'
]);
export type LoggingPreset = z.infer<typeof LoggingPresetSchema>;

/**
 * Log level schema
 */
export const LogLevelSchema = z.enum(['none', 'error', 'warn', 'info', 'debug', 'prompts', 'verboseDebug']);

/**
 * File size schema - accepts both numbers (bytes) and strings (e.g., "10MB")
 */
export const FileSizeSchema = z.union([
  z.number().min(1024), // Minimum 1KB
  z.string().regex(/^\d+(\.\d+)?\s*(B|KB|MB|GB)$/i, 'Invalid file size format. Use formats like "10MB", "1.5GB"')
]);

/**
 * Duration schema - accepts both numbers (ms) and strings (e.g., "5s")
 */
export const DurationSchema = z.union([
  z.number().min(0),
  z.string().regex(/^\d+(\.\d+)?\s*(ms|s|m|h)$/i, 'Invalid duration format. Use formats like "5s", "10m", "1h"')
]);

/**
 * JSONL logging configuration
 */
export const JsonlConfigSchema = z.object({
  /** Enable JSONL file logging */
  enabled: z.boolean().default(false),
  
  /** Directory for log files */
  directory: z.string().default('./logs'),
  
  /** Maximum file size before rotation */
  maxFileSize: FileSizeSchema.default('10MB'),
  
  /** Maximum number of files to keep */
  maxFiles: z.number().min(1).max(1000).default(10),
  
  /** Base filename for log files */
  baseFilename: z.string().default('persuader'),
  
  /** Enable file rotation */
  rotation: z.boolean().default(true),
  
  /** Enable compression for rotated files */
  compression: z.boolean().default(false),
  
  /** Compression level (1-9) */
  compressionLevel: z.number().min(1).max(9).default(6).optional(),
}).strict();

/**
 * Privacy configuration
 */
export const PrivacyConfigSchema = z.object({
  /** Privacy filtering level */
  level: PrivacyLevelSchema.default('standard'),
  
  /** Custom regex patterns for sensitive data */
  customPatterns: z.array(z.string()).default([]).optional(),
  
  /** Redaction style for sensitive data */
  redactionStyle: z.enum(['full', 'partial', 'hash']).default('partial'),
  
  /** Enable audit logging for privacy operations */
  auditLogging: z.boolean().default(false),
  
  /** Custom fields to redact */
  redactedFields: z.array(z.string()).default([]).optional(),
}).strict();

/**
 * Performance monitoring configuration
 */
export const PerformanceConfigSchema = z.object({
  /** Enable performance monitoring */
  enabled: z.boolean().default(true),
  
  /** Sampling rate for performance metrics (0-1) */
  sampleRate: z.number().min(0).max(1).default(1.0),
  
  /** Threshold for slow operation alerts */
  slowThreshold: DurationSchema.default('5s'),
  
  /** Enable memory usage tracking */
  memoryTracking: z.boolean().default(false),
  
  /** Enable cost tracking for LLM operations */
  costTracking: z.boolean().default(true),
  
  /** Detailed operation profiling */
  profiling: z.boolean().default(false).optional(),
}).strict();

/**
 * Logging category configuration
 */
export const CategoryConfigSchema = z.object({
  /** Enabled categories as strings */
  enabled: z.array(z.string()).default([]).optional(),
  
  /** Disabled categories as strings */
  disabled: z.array(z.string()).default([]).optional(),
  
  /** Use preset category combinations */
  usePreset: z.boolean().default(true).optional(),
}).strict();

/**
 * Core logging configuration
 */
export const LoggingConfigSchema = z.object({
  /** Logging preset selection */
  preset: LoggingPresetSchema.optional(),
  
  /** Log level */
  level: LogLevelSchema.optional(),
  
  /** Enable colored output */
  colors: z.boolean().optional(),
  
  /** Enable timestamps in logs */
  timestamp: z.boolean().optional(),
  
  /** Log prefix */
  prefix: z.string().optional(),
  
  /** Enable log truncation */
  truncate: z.boolean().optional(),
  
  /** Maximum prompt length in logs */
  maxPromptLength: z.number().min(100).max(100000).optional(),
  
  /** Maximum response length in logs */
  maxResponseLength: z.number().min(100).max(100000).optional(),
  
  /** Enable full prompt logging in debug */
  fullPromptLogging: z.boolean().optional(),
  
  /** Enable raw response logging in debug */
  rawResponseLogging: z.boolean().optional(),
  
  /** Enable detailed validation error logging */
  detailedValidationErrors: z.boolean().optional(),
  
  /** Category configuration */
  categories: CategoryConfigSchema.optional(),
  
  /** JSONL file logging configuration */
  jsonl: JsonlConfigSchema.optional(),
  
  /** Privacy configuration */
  privacy: PrivacyConfigSchema.optional(),
  
  /** Performance monitoring configuration */
  performance: PerformanceConfigSchema.optional(),
}).strict();

/**
 * Provider-specific configuration
 */
export const ProviderConfigSchema = z.object({
  /** Default LLM provider */
  provider: z.string().optional(),
  
  /** Provider-specific settings */
  settings: z.record(z.string(), z.unknown()).optional(),
  
  /** Timeout settings */
  timeout: DurationSchema.optional(),
  
  /** Retry configuration */
  maxRetries: z.number().min(0).max(10).optional(),
}).strict();

/**
 * Pipeline configuration
 */
export const PipelineConfigSchema = z.object({
  /** Pipeline name */
  name: z.string(),
  
  /** Pipeline-specific logging */
  logging: LoggingConfigSchema.optional(),
  
  /** Pipeline-specific provider settings */
  provider: ProviderConfigSchema.optional(),
  
  /** Pipeline description */
  description: z.string().optional(),
}).strict();

/**
 * Environment-specific configuration
 */
export const EnvironmentConfigSchema = z.object({
  /** Environment name (e.g., 'development', 'production') */
  name: z.string(),
  
  /** Environment-specific logging */
  logging: LoggingConfigSchema.optional(),
  
  /** Environment-specific provider settings */
  provider: ProviderConfigSchema.optional(),
  
  /** Environment condition (e.g., NODE_ENV value) */
  condition: z.string().optional(),
}).strict();

/**
 * Main Persuader configuration schema
 */
export const PersuaderConfigSchema = z.object({
  /** Schema version for future migrations */
  version: z.string().default('1.0').optional(),
  
  /** JSON Schema reference for IDE support */
  $schema: z.string().optional(),
  
  /** Configuration inheritance */
  extends: z.union([
    z.string(),
    z.array(z.string())
  ]).optional(),
  
  /** Core logging configuration */
  logging: LoggingConfigSchema.optional(),
  
  /** Provider configuration */
  provider: ProviderConfigSchema.optional(),
  
  /** Environment-specific configurations */
  environments: z.record(z.string(), LoggingConfigSchema.partial()).optional(),
  
  /** Named pipeline configurations */
  pipelines: z.record(z.string(), z.object({
    logging: LoggingConfigSchema.partial().optional(),
    provider: ProviderConfigSchema.partial().optional(),
    description: z.string().optional(),
  })).optional(),
  
  /** Project metadata */
  project: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
}).strict();

export type PersuaderConfig = z.infer<typeof PersuaderConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type JsonlConfig = z.infer<typeof JsonlConfigSchema>;
export type PrivacyConfig = z.infer<typeof PrivacyConfigSchema>;
export type PerformanceConfig = z.infer<typeof PerformanceConfigSchema>;
export type CategoryConfig = z.infer<typeof CategoryConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type PipelineConfig = z.infer<typeof PipelineConfigSchema>;
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

/**
 * Validation result for configuration files
 */
export interface ConfigValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** Parsed and validated configuration */
  config: PersuaderConfig | undefined;
  
  /** Validation errors if any */
  errors: z.ZodIssue[] | undefined;
  
  /** Human-readable error messages */
  errorMessages: string[] | undefined;
  
  /** Warnings (non-blocking issues) */
  warnings: string[] | undefined;
}

/**
 * Validate a raw configuration object against the schema
 */
export function validateConfig(rawConfig: unknown): ConfigValidationResult {
  try {
    const config = PersuaderConfigSchema.parse(rawConfig);
    
    const warnings: string[] = [];
    
    // Add warnings for common issues
    if (config.logging?.truncate === false && 
        (config.logging?.maxPromptLength === undefined || config.logging.maxPromptLength > 10000)) {
      warnings.push('Large prompt lengths without truncation may impact performance in production');
    }
    
    if (config.logging?.jsonl?.enabled && !config.logging.jsonl.rotation) {
      warnings.push('JSONL logging without rotation may consume excessive disk space');
    }
    
    if (config.logging?.privacy?.level === 'minimal' && 
        config.environments?.production) {
      warnings.push('Minimal privacy level detected with production environment - consider stricter privacy settings');
    }
    
    return {
      valid: true,
      config,
      errors: undefined,
      errorMessages: undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(err => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });
      
      return {
        valid: false,
        config: undefined,
        errors: error.issues,
        errorMessages,
        warnings: undefined
      };
    }
    
    return {
      valid: false,
      config: undefined,
      errors: undefined,
      errorMessages: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings: undefined
    };
  }
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): PersuaderConfig {
  return {
    version: '1.0',
    logging: {
      level: 'info',
      colors: true,
      timestamp: true,
      truncate: false,
      maxPromptLength: 1000,
      maxResponseLength: 1000,
      categories: {
        usePreset: true
      },
      jsonl: {
        enabled: false,
        directory: './logs',
        maxFileSize: '10MB',
        maxFiles: 10,
        baseFilename: 'persuader',
        rotation: true,
        compression: false
      },
      privacy: {
        level: 'standard',
        redactionStyle: 'partial',
        auditLogging: false
      },
      performance: {
        enabled: true,
        sampleRate: 1.0,
        slowThreshold: '5s',
        memoryTracking: false,
        costTracking: true
      }
    }
  };
}

/**
 * Merge two configurations with proper precedence
 */
export function mergeConfigs(base: PersuaderConfig, override: PersuaderConfig): PersuaderConfig {
  // Deep merge with override precedence
  // This is a simplified version - full implementation would use proper deep merging
  const result: PersuaderConfig = {
    ...base,
    ...override
  };
  
  // Handle logging merge
  if (base.logging || override.logging) {
    result.logging = {
      ...base.logging,
      ...override.logging
    };
    
    // Handle nested objects
    if (base.logging?.jsonl || override.logging?.jsonl) {
      const mergedJsonl = {
        ...base.logging?.jsonl,
        ...override.logging?.jsonl
      };
      // Ensure required properties have defaults
      result.logging.jsonl = {
        enabled: mergedJsonl.enabled ?? false,
        directory: mergedJsonl.directory ?? './logs',
        maxFileSize: mergedJsonl.maxFileSize ?? '10MB',
        maxFiles: mergedJsonl.maxFiles ?? 10,
        baseFilename: mergedJsonl.baseFilename ?? 'persuader',
        rotation: mergedJsonl.rotation ?? true,
        compression: mergedJsonl.compression ?? false,
        compressionLevel: mergedJsonl.compressionLevel
      };
    }
    
    if (base.logging?.privacy || override.logging?.privacy) {
      const mergedPrivacy = {
        ...base.logging?.privacy,
        ...override.logging?.privacy
      };
      result.logging.privacy = {
        level: mergedPrivacy.level ?? 'standard',
        redactionStyle: mergedPrivacy.redactionStyle ?? 'partial',
        auditLogging: mergedPrivacy.auditLogging ?? false,
        customPatterns: mergedPrivacy.customPatterns,
        redactedFields: mergedPrivacy.redactedFields
      };
    }
    
    if (base.logging?.performance || override.logging?.performance) {
      const mergedPerformance = {
        ...base.logging?.performance,
        ...override.logging?.performance
      };
      result.logging.performance = {
        enabled: mergedPerformance.enabled ?? true,
        sampleRate: mergedPerformance.sampleRate ?? 1.0,
        slowThreshold: mergedPerformance.slowThreshold ?? '5s',
        memoryTracking: mergedPerformance.memoryTracking ?? false,
        costTracking: mergedPerformance.costTracking ?? true,
        profiling: mergedPerformance.profiling
      };
    }
    
    if (base.logging?.categories || override.logging?.categories) {
      result.logging.categories = {
        ...base.logging?.categories,
        ...override.logging?.categories
      };
    }
  }
  
  // Handle environments merge
  if (base.environments || override.environments) {
    result.environments = {
      ...base.environments,
      ...override.environments
    };
  }
  
  // Handle pipelines merge
  if (base.pipelines || override.pipelines) {
    result.pipelines = {
      ...base.pipelines,
      ...override.pipelines
    };
  }
  
  return result;
}