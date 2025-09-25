/**
 * Configuration System Index
 * 
 * Main exports for the .persuader configuration file system
 */

// File discovery
export {
  discoverConfigFile,
  hasConfigFile,
  getDefaultConfigPath,
  validateConfigPath,
  getDiscoveryMetrics,
  type ConfigDiscoveryOptions,
  type ConfigDiscoveryResult,
  type ConfigFileFormat,
  type DiscoveryMethod,
  CONFIG_FILENAMES
} from './file-discovery.js';

// Configuration schema
export {
  PersuaderConfigSchema,
  LoggingConfigSchema,
  JsonlConfigSchema,
  PrivacyConfigSchema,
  PerformanceConfigSchema,
  CategoryConfigSchema,
  ProviderConfigSchema,
  PipelineConfigSchema,
  EnvironmentConfigSchema,
  PrivacyLevelSchema,
  LoggingPresetSchema,
  LogLevelSchema,
  FileSizeSchema,
  DurationSchema,
  validateConfig,
  getDefaultConfig,
  mergeConfigs,
  type PersuaderConfig,
  type LoggingConfig,
  type JsonlConfig,
  type PrivacyConfig,
  type PerformanceConfig,
  type CategoryConfig,
  type ProviderConfig,
  type PipelineConfig,
  type EnvironmentConfig,
  type PrivacyLevel,
  type LoggingPreset,
  type ConfigValidationResult
} from './schema.js';

// Configuration parsing
export {
  parseConfigFile,
  parseConfigWithEnv,
  validateConfigFile,
  isValidConfigFile,
  detectConfigFormat,
  getParserMetrics,
  type ParseResult,
  type ParseOptions,
  type ParserMetrics
} from './parser.js';

// Configuration loading
export {
  loadConfig,
  loadEnvironmentConfig,
  loadPipelineConfig,
  clearConfigCache,
  getConfigCacheStats,
  preloadConfig,
  watchConfigFile,
  type LoadConfigOptions,
  type LoadConfigResult
} from './loader.js';

// Configuration system integration
export {
  EnhancedConfigResolver,
  initializeGlobalConfigResolver,
  getGlobalEnhancedConfigResolver,
  getGlobalConfigResolver,
  migrateToEnhancedResolver,
  createEnvironmentSessionLogging,
  createPipelineSessionLogging
} from './config-resolver-integration.js';

// Configuration initialization
export {
  initializePersuaderConfig,
  initializePersuaderConfigForEnvironment,
  initializeForDevelopment,
  initializeForProduction,
  initializeForTesting,
  isConfigSystemInitialized,
  getConfigSystemStatus,
  autoInitialize,
  type ConfigInitOptions
} from './init.js';

// Re-export LogLevel from logger for convenience
export type { LogLevel } from '../logger.js';