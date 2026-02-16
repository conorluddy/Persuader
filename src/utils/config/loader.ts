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
 * Configuration cache with enhanced metrics
 */
const configCache = new Map<string, {
  config: PersuaderConfig;
  timestamp: number;
  filePath: string;
  hitCount: number;
  lastAccessed: number;
}>();

/**
 * Cache performance metrics
 */
let cacheMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  totalSize: 0
};

/**
 * Cache TTL in milliseconds (5 minutes default)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Maximum cache size before LRU eviction kicks in
 */
const MAX_CACHE_SIZE = 50;

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
          // Update cache metrics
          cached.hitCount++;
          cached.lastAccessed = Date.now();
          cacheMetrics.hits++;
          
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
        } else {
          // File changed, remove from cache
          configCache.delete(cacheKey);
          cacheMetrics.evictions++;
        }
      } else if (cached) {
        // Cache entry expired
        configCache.delete(cacheKey);
        cacheMetrics.evictions++;
      }
      
      // Cache miss
      cacheMetrics.misses++;
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
      // Check if cache size limit exceeded
      if (configCache.size >= MAX_CACHE_SIZE) {
        evictLeastRecentlyUsed();
      }
      
      configCache.set(cacheKey, {
        config: finalConfig,
        timestamp: Date.now(),
        filePath: discovery.configPath,
        hitCount: 0,
        lastAccessed: Date.now()
      });
      
      // Update cache size metrics
      cacheMetrics.totalSize = configCache.size;
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
 * Evict least recently used cache entries
 */
function evictLeastRecentlyUsed(): void {
  if (configCache.size === 0) return;
  
  // Find entries to evict (oldest 25% based on lastAccessed)
  const entries = Array.from(configCache.entries());
  const toEvict = Math.max(1, Math.floor(entries.length * 0.25));
  
  // Sort by lastAccessed (oldest first)
  entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
  
  // Remove oldest entries
  for (let i = 0; i < toEvict; i++) {
    configCache.delete(entries[i]![0]);
    cacheMetrics.evictions++;
  }
}

/**
 * Clear configuration cache
 */
export function clearConfigCache(): void {
  configCache.clear();
  cacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0
  };
}

/**
 * Get configuration cache statistics
 */
export function getConfigCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  entries: Array<{ 
    filePath: string; 
    age: number; 
    hitCount: number;
    lastAccessed: number;
  }>;
} {
  const entries = Array.from(configCache.entries()).map(([_key, value]) => ({
    filePath: value.filePath,
    age: Date.now() - value.timestamp,
    hitCount: value.hitCount,
    lastAccessed: value.lastAccessed
  }));
  
  const totalRequests = cacheMetrics.hits + cacheMetrics.misses;
  const hitRate = totalRequests > 0 ? cacheMetrics.hits / totalRequests : 0;
  
  return {
    size: configCache.size,
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    evictions: cacheMetrics.evictions,
    hitRate,
    entries
  };
}

/**
 * Preload configuration with batch support (for performance optimization)
 */
export async function preloadConfig(
  configPathsOrOptions?: string[] | LoadConfigOptions,
  options: LoadConfigOptions = {}
): Promise<{
  loaded: number;
  errors: number;
  totalTime: number;
  averageTime: number;
  fromCache: number;
  details: Array<{ path: string; success: boolean; time: number; fromCache: boolean; }>;
}> {
  const startTime = Date.now();
  let loaded = 0;
  let errors = 0;
  let fromCache = 0;
  const details: Array<{ path: string; success: boolean; time: number; fromCache: boolean; }> = [];
  
  // Handle single config load case
  if (!Array.isArray(configPathsOrOptions)) {
    const loadOptions = configPathsOrOptions || options;
    const operationStart = Date.now();
    
    try {
      const result = await loadConfig({ ...loadOptions, cache: true });
      const operationTime = Date.now() - operationStart;
      
      if (result.config) {
        loaded++;
        if (result.fromCache) fromCache++;
        details.push({
          path: result.discovery.configPath || 'unknown',
          success: true,
          time: operationTime,
          fromCache: result.fromCache
        });
      } else {
        errors++;
        details.push({
          path: result.discovery.configPath || 'unknown',
          success: false,
          time: operationTime,
          fromCache: false
        });
      }
    } catch (error) {
      errors++;
      details.push({
        path: 'unknown',
        success: false,
        time: Date.now() - operationStart,
        fromCache: false
      });
    }
  } else {
    // Handle batch preloading
    const configPaths = configPathsOrOptions;
    
    const loadPromises = configPaths.map(async (configPath) => {
      const operationStart = Date.now();
      
      try {
        const result = await loadConfig({
          ...options,
          configPath,
          cache: true
        });
        const operationTime = Date.now() - operationStart;
        
        if (result.config) {
          loaded++;
          if (result.fromCache) fromCache++;
          details.push({
            path: configPath,
            success: true,
            time: operationTime,
            fromCache: result.fromCache
          });
        } else {
          errors++;
          details.push({
            path: configPath,
            success: false,
            time: operationTime,
            fromCache: false
          });
        }
      } catch (error) {
        errors++;
        details.push({
          path: configPath,
          success: false,
          time: Date.now() - operationStart,
          fromCache: false
        });
      }
    });
    
    await Promise.all(loadPromises);
  }
  
  const totalTime = Date.now() - startTime;
  const totalOperations = loaded + errors;
  const averageTime = totalOperations > 0 ? totalTime / totalOperations : 0;
  
  return {
    loaded,
    errors,
    totalTime,
    averageTime,
    fromCache,
    details
  };
}

/**
 * Watch configuration file for changes with intelligent caching
 */
export async function watchConfigFile(
  configPathOrCallback: string | ((config: PersuaderConfig | null) => void),
  callbackOrOptions?: ((config: PersuaderConfig | null) => void) | LoadConfigOptions,
  options: LoadConfigOptions = {}
): Promise<() => void> {
  let configPath: string | undefined;
  let callback: (config: PersuaderConfig | null) => void;
  let watchOptions: LoadConfigOptions;
  
  // Handle overloaded parameters
  if (typeof configPathOrCallback === 'string') {
    configPath = configPathOrCallback;
    callback = callbackOrOptions as (config: PersuaderConfig | null) => void;
    watchOptions = options;
  } else {
    callback = configPathOrCallback;
    watchOptions = (callbackOrOptions as LoadConfigOptions) || options;
  }
  
  const { ConfigWatcher } = await import('./performance.js');
  const watcher = new ConfigWatcher();
  
  // Discover config path if not provided
  if (!configPath) {
    const discovery = await discoverConfigFile(watchOptions);
    if (!discovery.configPath) {
      callback(null);
      return () => {}; // No config file to watch
    }
    configPath = discovery.configPath;
  }
  
  // Track last config for change detection
  let lastConfig: PersuaderConfig | null = null;
  
  const reloadConfig = async () => {
    try {
      const result = await loadConfig({
        ...watchOptions,
        configPath,
        forceReload: true
      });
      
      // Only trigger callback if config actually changed
      const configChanged = JSON.stringify(result.config) !== JSON.stringify(lastConfig);
      
      if (configChanged) {
        lastConfig = result.config;
        callback(result.config);
      }
    } catch (error) {
      callback(null);
    }
  };
  
  // Initial load
  await reloadConfig();
  
  // Start watching for file changes
  await watcher.watch([configPath], reloadConfig);
  
  return () => watcher.stop();
}

/**
 * Get configuration system performance metrics
 */
export function getConfigPerformanceMetrics(): ConfigPerformanceMetrics {
  return performanceCollector.getMetrics();
}

/**
 * Get enhanced configuration cache statistics with comprehensive performance data
 */
export function getEnhancedConfigCacheStats(): {
  cache: ReturnType<typeof getConfigCacheStats>;
  performance: ConfigPerformanceMetrics;
  system: ReturnType<typeof getCacheStats>;
  analysis: {
    efficiency: number;
    averageHitsPerEntry: number;
    mostAccessedEntries: Array<{ path: string; hitCount: number; age: number; }>;
    recommendedCacheSize: number;
    memoryEfficiency: string;
  };
} {
  const cacheStats = getConfigCacheStats();
  const performanceStats = getConfigPerformanceMetrics();
  const systemStats = getCacheStats();
  
  // Calculate efficiency metrics
  const totalRequests = cacheStats.hits + cacheStats.misses;
  const efficiency = totalRequests > 0 ? (cacheStats.hits / totalRequests) * 100 : 0;
  
  // Calculate average hits per entry
  const totalHits = cacheStats.entries.reduce((sum, entry) => sum + entry.hitCount, 0);
  const averageHitsPerEntry = cacheStats.entries.length > 0 ? totalHits / cacheStats.entries.length : 0;
  
  // Get most accessed entries
  const mostAccessedEntries = cacheStats.entries
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 5)
    .map(entry => ({
      path: entry.filePath,
      hitCount: entry.hitCount,
      age: entry.age
    }));
  
  // Recommend cache size based on usage patterns
  const activeEntries = cacheStats.entries.filter(entry => entry.hitCount > 0);
  const recommendedCacheSize = Math.max(
    activeEntries.length + 10, // Active entries plus buffer
    Math.min(MAX_CACHE_SIZE, Math.ceil(totalRequests * 0.1)) // 10% of total requests
  );
  
  return {
    cache: cacheStats,
    performance: performanceStats,
    system: systemStats,
    analysis: {
      efficiency: parseFloat(efficiency.toFixed(2)),
      averageHitsPerEntry: parseFloat(averageHitsPerEntry.toFixed(2)),
      mostAccessedEntries,
      recommendedCacheSize,
      memoryEfficiency: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`
    }
  };
}

/**
 * Reset performance metrics
 */
export function resetConfigPerformanceMetrics(): void {
  performanceCollector.reset();
}