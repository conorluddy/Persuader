/**
 * Configuration Loader
 * 
 * High-level API for discovering, parsing, and loading .persuader configuration files
 * with caching, environment support, and error handling.
 */

import path from 'node:path';
import {
  discoverConfigFile,
  type ConfigDiscoveryOptions,
  type ConfigDiscoveryResult
} from './file-discovery.js';
import {
  parseConfigFile,
  type ParseOptions,
  type ParseResult
} from './parser.js';
import {
  type PersuaderConfig,
  mergeConfigs,
  getDefaultConfig,
  validateConfig
} from './schema.js';

export interface LoadConfigOptions extends ConfigDiscoveryOptions, ParseOptions {
  /** Environment name for environment-specific configuration */
  environment?: string;
  
  /** Pipeline name for pipeline-specific configuration */
  pipeline?: string;
  
  /** Merge with default configuration */
  mergeWithDefaults?: boolean;
  
  /** Cache loaded configurations */
  cache?: boolean;
  
  /** Force reload even if cached */
  forceReload?: boolean;
}

export interface LoadConfigResult {
  /** Successfully loaded configuration */
  config: PersuaderConfig | null;
  
  /** File discovery result */
  discovery: ConfigDiscoveryResult;
  
  /** File parsing result */
  parse?: ParseResult;
  
  /** Environment-specific config applied */
  environment: string | undefined;
  
  /** Pipeline-specific config applied */
  pipeline: string | undefined;
  
  /** Whether result came from cache */
  fromCache: boolean;
  
  /** Total load time in milliseconds */
  loadTimeMs: number;
  
  /** Any errors encountered */
  errors: string[];
  
  /** Any warnings generated */
  warnings: string[];
}

/**
 * Configuration cache
 */
const configCache = new Map<string, {
  config: PersuaderConfig;
  timestamp: number;
  filePath: string;
}>();

/**
 * Cache TTL in milliseconds (5 minutes default)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Load configuration from file system
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<LoadConfigResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // 1. Discover configuration file
    const discoveryOptions: ConfigDiscoveryOptions = {};
    if (options.startDir !== undefined) discoveryOptions.startDir = options.startDir;
    if (options.configPath !== undefined) discoveryOptions.configPath = options.configPath;
    if (options.stopAtPackageJson !== undefined) discoveryOptions.stopAtPackageJson = options.stopAtPackageJson;
    if (options.maxTraversalDepth !== undefined) discoveryOptions.maxTraversalDepth = options.maxTraversalDepth;
    
    const discovery = await discoverConfigFile(discoveryOptions);
    
    if (!discovery.configPath) {
      return {
        config: options.mergeWithDefaults ? getDefaultConfig() : null,
        discovery,
        environment: undefined,
        pipeline: undefined,
        fromCache: false,
        loadTimeMs: Date.now() - startTime,
        errors: [],
        warnings: discovery.searchedPaths.length > 0 
          ? [`No configuration file found. Searched ${discovery.searchedPaths.length} locations.`]
          : []
      };
    }
    
    // 2. Check cache
    const cacheKey = getCacheKey(discovery.configPath, options);
    if (options.cache !== false && !options.forceReload) {
      const cached = configCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        const resolvedConfig = await resolveConfiguration(cached.config, options);
        
        return {
          config: resolvedConfig.config,
          discovery,
          environment: resolvedConfig.environment,
          pipeline: resolvedConfig.pipeline,
          fromCache: true,
          loadTimeMs: Date.now() - startTime,
          errors: resolvedConfig.errors,
          warnings: resolvedConfig.warnings
        };
      }
    }
    
    // 3. Parse configuration file
    const parseOptions: ParseOptions = {
      allowExecution: options.allowExecution ?? true
    };
    if (options.validate !== undefined) parseOptions.validate = options.validate;
    if (options.includeRawContent !== undefined) parseOptions.includeRawContent = options.includeRawContent;
    if (options.env !== undefined) parseOptions.env = options.env;
    
    const parseResult = await parseConfigFile(discovery.configPath, parseOptions);
    
    if (!parseResult.valid || !parseResult.config) {
      errors.push(...(parseResult.errorMessages || ['Failed to parse configuration']));
      
      return {
        config: options.mergeWithDefaults ? getDefaultConfig() : null,
        discovery,
        parse: parseResult,
        environment: undefined,
        pipeline: undefined,
        fromCache: false,
        loadTimeMs: Date.now() - startTime,
        errors,
        warnings: parseResult.warnings || []
      };
    }
    
    // 4. Handle configuration inheritance (extends)
    let finalConfig = parseResult.config;
    if (parseResult.config.extends) {
      try {
        finalConfig = await resolveInheritance(parseResult.config, path.dirname(discovery.configPath));
      } catch (error) {
        errors.push(`Failed to resolve inheritance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 5. Cache the loaded configuration
    if (options.cache !== false) {
      configCache.set(cacheKey, {
        config: finalConfig,
        timestamp: Date.now(),
        filePath: discovery.configPath
      });
    }
    
    // 6. Resolve environment and pipeline-specific configuration
    const resolvedConfig = await resolveConfiguration(finalConfig, options);
    
    return {
      config: resolvedConfig.config,
      discovery,
      parse: parseResult,
      environment: resolvedConfig.environment,
      pipeline: resolvedConfig.pipeline,
      fromCache: false,
      loadTimeMs: Date.now() - startTime,
      errors: [...errors, ...resolvedConfig.errors],
      warnings: [...warnings, ...(parseResult.warnings || []), ...resolvedConfig.warnings]
    };
  } catch (error) {
    return {
      config: options.mergeWithDefaults ? getDefaultConfig() : null,
      discovery: {
        configPath: null,
        format: null,
        discoveryMethod: null,
        searchedPaths: [],
        discoveryTimeMs: 0
      },
      environment: undefined,
      pipeline: undefined,
      fromCache: false,
      loadTimeMs: Date.now() - startTime,
      errors: [`Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}

/**
 * Generate cache key for configuration
 */
function getCacheKey(filePath: string, options: LoadConfigOptions): string {
  return `${filePath}:${options.environment || 'default'}:${options.pipeline || 'default'}`;
}

/**
 * Resolve configuration inheritance
 */
async function resolveInheritance(
  config: PersuaderConfig, 
  configDir: string
): Promise<PersuaderConfig> {
  if (!config.extends) {
    return config;
  }
  
  const extendsArray = Array.isArray(config.extends) ? config.extends : [config.extends];
  let resolvedConfig = { ...config };
  
  // Remove extends property from final config
  delete resolvedConfig.extends;
  
  // Load and merge parent configurations (in order)
  for (const parentPath of extendsArray) {
    const absoluteParentPath = path.resolve(configDir, parentPath);
    
    try {
      const parentResult = await parseConfigFile(absoluteParentPath, {
        allowExecution: true,
        validate: true
      });
      
      if (parentResult.valid && parentResult.config) {
        // Recursively resolve parent's inheritance
        const resolvedParent = await resolveInheritance(parentResult.config, path.dirname(absoluteParentPath));
        
        // Merge parent with current (current takes precedence)
        resolvedConfig = mergeConfigs(resolvedParent, resolvedConfig);
      }
    } catch (error) {
      throw new Error(`Failed to load parent configuration '${parentPath}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return resolvedConfig;
}

/**
 * Resolve environment and pipeline-specific configuration
 */
async function resolveConfiguration(
  baseConfig: PersuaderConfig,
  options: LoadConfigOptions
): Promise<{
  config: PersuaderConfig;
  environment: string | undefined;
  pipeline: string | undefined;
  errors: string[];
  warnings: string[];
}> {
  let finalConfig = { ...baseConfig };
  const errors: string[] = [];
  const warnings: string[] = [];
  let appliedEnvironment: string | undefined;
  let appliedPipeline: string | undefined;
  
  // 1. Apply environment-specific configuration
  const environment = options.environment || process.env.NODE_ENV || 'development';
  if (finalConfig.environments && finalConfig.environments[environment]) {
    try {
      finalConfig = mergeConfigs(finalConfig, { 
        logging: finalConfig.environments[environment] 
      });
      appliedEnvironment = environment;
    } catch (error) {
      errors.push(`Failed to apply environment '${environment}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // 2. Apply pipeline-specific configuration
  if (options.pipeline && finalConfig.pipelines && finalConfig.pipelines[options.pipeline]) {
    try {
      const pipelineConfig = finalConfig.pipelines[options.pipeline];
      if (pipelineConfig) {
        const pipelineAsFullConfig: PersuaderConfig = {
          logging: pipelineConfig.logging,
          provider: pipelineConfig.provider
        };
        finalConfig = mergeConfigs(finalConfig, pipelineAsFullConfig);
        appliedPipeline = options.pipeline;
      }
    } catch (error) {
      errors.push(`Failed to apply pipeline '${options.pipeline}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // 3. Merge with defaults if requested
  if (options.mergeWithDefaults) {
    const defaults = getDefaultConfig();
    finalConfig = mergeConfigs(defaults, finalConfig);
  }
  
  // 4. Final validation
  const validation = validateConfig(finalConfig);
  if (!validation.valid) {
    errors.push(...(validation.errorMessages || ['Configuration validation failed']));
  } else if (validation.warnings) {
    warnings.push(...validation.warnings);
  }
  
  return {
    config: validation.config || finalConfig,
    environment: appliedEnvironment || undefined,
    pipeline: appliedPipeline || undefined,
    errors,
    warnings
  };
}

/**
 * Load configuration for specific environment
 */
export async function loadEnvironmentConfig(
  environment: string,
  options: Omit<LoadConfigOptions, 'environment'> = {}
): Promise<LoadConfigResult> {
  return loadConfig({
    ...options,
    environment,
    mergeWithDefaults: true
  });
}

/**
 * Load configuration for specific pipeline
 */
export async function loadPipelineConfig(
  pipeline: string,
  options: Omit<LoadConfigOptions, 'pipeline'> = {}
): Promise<LoadConfigResult> {
  return loadConfig({
    ...options,
    pipeline,
    mergeWithDefaults: true
  });
}

/**
 * Clear configuration cache
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Get configuration cache statistics
 */
export function getConfigCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  entries: Array<{ filePath: string; age: number; }>;
} {
  const entries = Array.from(configCache.entries()).map(([_key, value]) => ({
    filePath: value.filePath,
    age: Date.now() - value.timestamp
  }));
  
  // Note: hit/miss tracking would require additional instrumentation
  return {
    size: configCache.size,
    hits: 0, // Would need tracking
    misses: 0, // Would need tracking
    entries
  };
}

/**
 * Preload configuration (for performance optimization)
 */
export async function preloadConfig(options: LoadConfigOptions = {}): Promise<boolean> {
  try {
    const result = await loadConfig({ ...options, cache: true });
    return result.config !== null;
  } catch {
    return false;
  }
}

/**
 * Watch configuration file for changes (basic implementation)
 * Full implementation would use fs.watch with proper debouncing
 */
export async function watchConfigFile(
  callback: (config: PersuaderConfig | null) => void,
  options: LoadConfigOptions = {}
): Promise<() => void> {
  // Basic implementation - would need proper file watching in production
  let lastConfig: PersuaderConfig | null = null;
  
  const checkForChanges = async () => {
    try {
      const result = await loadConfig({ ...options, forceReload: true });
      
      if (JSON.stringify(result.config) !== JSON.stringify(lastConfig)) {
        lastConfig = result.config;
        callback(result.config);
      }
    } catch {
      // Ignore errors in watch mode
    }
  };
  
  // Initial load
  await checkForChanges();
  
  // Poll for changes (in production, use fs.watch)
  const interval = setInterval(checkForChanges, 1000);
  
  return () => {
    clearInterval(interval);
  };
}