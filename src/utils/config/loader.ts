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
  getDefaultConfig,
  validateConfig
} from './schema.js';
import {
  ConfigInheritanceResolver,
  type InheritanceChain,
  type InheritanceOptions,
  type BaseConfig
} from './inheritance.js';
import {
  EnvironmentInterpolator,
  type InterpolationOptions,
  type InterpolationResult
} from './interpolation.js';
import {
  hasFileChanged,
  performanceCollector,
  optimizedMergeConfigs,
  getCacheStats,
  type ConfigPerformanceMetrics
} from './performance.js';

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
  
  /** Enable configuration inheritance */
  enableInheritance?: boolean;
  
  /** Inheritance resolver options */
  inheritanceOptions?: InheritanceOptions;
  
  /** Enable environment variable interpolation */
  enableInterpolation?: boolean;
  
  /** Environment interpolation options */
  interpolationOptions?: InterpolationOptions;
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
  
  /** Inheritance chain information */
  inheritanceChain?: InheritanceChain;
  
  /** Environment variable interpolation result */
  interpolationResult?: InterpolationResult;
  
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
    
    // 2. Check cache and file changes
    const cacheKey = getCacheKey(discovery.configPath, options);
    if (options.cache !== false && !options.forceReload) {
      const cached = configCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        // Check if file has actually changed
        const fileChanged = await hasFileChanged(discovery.configPath);
        if (!fileChanged) {
          const resolvedConfig = await resolveConfiguration(cached.config, options);
          
          // Record cache hit
          const loadTime = Date.now() - startTime;
          performanceCollector.recordOperation(loadTime, true);
          
          return {
            config: resolvedConfig.config,
            discovery,
            environment: resolvedConfig.environment,
            pipeline: resolvedConfig.pipeline,
            fromCache: true,
            loadTimeMs: loadTime,
            errors: resolvedConfig.errors,
            warnings: resolvedConfig.warnings
          };
        }
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
    
    // Record file read and validation
    performanceCollector.recordFileRead();
    performanceCollector.recordValidation();
    
    if (!parseResult.valid || !parseResult.config) {
      errors.push(...(parseResult.errorMessages || ['Failed to parse configuration']));
      performanceCollector.recordError();
      
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
    let inheritanceChain: InheritanceChain | undefined;
    
    if (options.enableInheritance !== false && parseResult.config.extends) {
      try {
        const resolver = new ConfigInheritanceResolver(options.inheritanceOptions);
        
        // Register base configurations from the same directory
        await registerBaseConfigurations(resolver, path.dirname(discovery.configPath));
        
        // Create inheritance configuration
        const inheritanceConfig: PersuaderConfig & BaseConfig = {
          ...parseResult.config,
          extends: parseResult.config.extends
        };
        
        inheritanceChain = await resolver.resolveInheritance(inheritanceConfig);
        finalConfig = inheritanceChain.finalConfig;
        
        if (inheritanceChain.conflicts.length > 0) {
          warnings.push(`Configuration inheritance resulted in ${inheritanceChain.conflicts.length} conflicts`);
        }
      } catch (error) {
        errors.push(`Failed to resolve inheritance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 5. Handle environment variable interpolation
    let interpolationResult: InterpolationResult | undefined;
    
    if (options.enableInterpolation !== false) {
      try {
        const interpolator = options.interpolationOptions 
          ? new EnvironmentInterpolator(options.interpolationOptions)
          : new EnvironmentInterpolator();
        
        interpolationResult = interpolator.interpolate(finalConfig);
        
        if (interpolationResult.errors.length > 0) {
          errors.push(...interpolationResult.errors.map(err => `Interpolation error: ${err}`));
        } else {
          finalConfig = interpolationResult.value;
        }
        
        if (interpolationResult.missingVariables.length > 0) {
          warnings.push(`Missing environment variables: ${interpolationResult.missingVariables.join(', ')}`);
        }
        
        if (interpolationResult.typeCoercions.length > 0) {
          warnings.push(`Applied ${interpolationResult.typeCoercions.length} type coercions during interpolation`);
        }
      } catch (error) {
        errors.push(`Failed to interpolate environment variables: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // 6. Cache the loaded configuration
    if (options.cache !== false) {
      configCache.set(cacheKey, {
        config: finalConfig,
        timestamp: Date.now(),
        filePath: discovery.configPath
      });
    }
    
    // 6. Resolve environment and pipeline-specific configuration
    const resolvedConfig = await resolveConfiguration(finalConfig, options);
    
    const result: LoadConfigResult = {
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
    
    if (inheritanceChain) {
      result.inheritanceChain = inheritanceChain;
    }
    
    if (interpolationResult) {
      result.interpolationResult = interpolationResult;
    }
    
    // Record successful operation
    performanceCollector.recordOperation(result.loadTimeMs, false);
    
    return result;
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
      finalConfig = optimizedMergeConfigs(finalConfig, { 
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
        finalConfig = optimizedMergeConfigs(finalConfig, pipelineAsFullConfig);
        appliedPipeline = options.pipeline;
      }
    } catch (error) {
      errors.push(`Failed to apply pipeline '${options.pipeline}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // 3. Merge with defaults if requested
  if (options.mergeWithDefaults) {
    const defaults = getDefaultConfig();
    finalConfig = optimizedMergeConfigs(defaults, finalConfig);
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
 * Register base configurations from a directory for inheritance
 */
async function registerBaseConfigurations(
  resolver: ConfigInheritanceResolver,
  configDir: string
): Promise<void> {
  const { promises: fs } = await import('node:fs');
  
  try {
    const files = await fs.readdir(configDir);
    const configFiles = files.filter(file => 
      file.endsWith('.json') ||
      file.endsWith('.js') ||
      file.endsWith('.ts') ||
      file.endsWith('.yaml') ||
      file.endsWith('.yml')
    );
    
    for (const file of configFiles) {
      try {
        const filePath = path.join(configDir, file);
        const baseName = path.basename(file, path.extname(file));
        
        // Skip if this looks like the main config file
        if (baseName === '.persuader' || baseName === 'persuader') {
          continue;
        }
        
        // Try to parse as configuration
        const parseResult = await parseConfigFile(filePath, { validate: false });
        if (parseResult.valid && parseResult.config) {
          resolver.registerBaseConfig(baseName, parseResult.config);
        }
      } catch {
        // Ignore invalid files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
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

/**
 * Get configuration system performance metrics
 */
export function getConfigPerformanceMetrics(): ConfigPerformanceMetrics {
  return performanceCollector.getMetrics();
}

/**
 * Get enhanced configuration cache statistics
 */
export function getEnhancedConfigCacheStats(): ReturnType<typeof getCacheStats> {
  return getCacheStats();
}

/**
 * Reset performance metrics
 */
export function resetConfigPerformanceMetrics(): void {
  performanceCollector.reset();
}