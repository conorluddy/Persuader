/**
 * Configuration Inheritance System
 * 
 * Implements hierarchical configuration inheritance with proper merging semantics.
 * Supports base configurations that can be extended by environments and pipelines.
 */

import type { PersuaderConfig } from './schema.js';

/**
 * Inheritance configuration for base configs
 */
export interface BaseConfig {
  extends?: string | string[];
  [key: string]: any;
}

/**
 * Resolved inheritance chain
 */
export interface InheritanceChain {
  baseConfigs: string[];
  finalConfig: PersuaderConfig;
  depth: number;
  conflicts: ConfigConflict[];
}

/**
 * Configuration conflict information
 */
export interface ConfigConflict {
  path: string;
  baseValue: any;
  overrideValue: any;
  source: string;
  resolution: 'override' | 'merge' | 'array_concat';
}

/**
 * Inheritance options
 */
export interface InheritanceOptions {
  maxDepth?: number;
  allowCircular?: boolean;
  mergeArrays?: boolean;
  deepMergeObjects?: boolean;
  trackConflicts?: boolean;
}

/**
 * Configuration inheritance resolver
 */
export class ConfigInheritanceResolver {
  private readonly baseConfigs = new Map<string, PersuaderConfig>();
  private readonly options: Required<InheritanceOptions>;
  
  constructor(options: InheritanceOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 10,
      allowCircular: options.allowCircular ?? false,
      mergeArrays: options.mergeArrays ?? true,
      deepMergeObjects: options.deepMergeObjects ?? true,
      trackConflicts: options.trackConflicts ?? true
    };
  }
  
  /**
   * Register a base configuration
   */
  registerBaseConfig(name: string, config: PersuaderConfig): void {
    this.baseConfigs.set(name, config);
  }
  
  /**
   * Resolve inheritance chain for a configuration
   */
  async resolveInheritance(
    config: any,
    visited: Set<string> = new Set(),
    depth = 0
  ): Promise<InheritanceChain> {
    if (depth >= this.options.maxDepth) {
      throw new Error(`Maximum inheritance depth (${this.options.maxDepth}) exceeded`);
    }
    
    const conflicts: ConfigConflict[] = [];
    let finalConfig = { ...config };
    const baseConfigs: string[] = [];
    
    // Handle extends property
    if (config.extends) {
      const extendsArray = Array.isArray(config.extends) ? config.extends : [config.extends];
      
      for (const baseName of extendsArray) {
        if (visited.has(baseName)) {
          if (!this.options.allowCircular) {
            throw new Error(`Circular inheritance detected: ${baseName} -> ${Array.from(visited).join(' -> ')}`);
          }
          continue;
        }
        
        const baseConfig = this.baseConfigs.get(baseName);
        if (!baseConfig) {
          throw new Error(`Base configuration not found: ${baseName}`);
        }
        
        baseConfigs.push(baseName);
        visited.add(baseName);
        
        // Recursively resolve base configuration
        const baseChain = await this.resolveInheritance(
          baseConfig,
          new Set(visited),
          depth + 1
        );
        
        // Merge base configuration with current
        const mergeResult = this.mergeConfigurations(
          baseChain.finalConfig,
          finalConfig,
          baseName,
          conflicts
        );
        
        finalConfig = mergeResult as PersuaderConfig;
        baseConfigs.unshift(...baseChain.baseConfigs);
        conflicts.push(...baseChain.conflicts);
        
        visited.delete(baseName);
      }
    }
    
    // Remove extends property from final config
    const { extends: _, ...cleanConfig } = finalConfig;
    const cleanedConfig = cleanConfig as PersuaderConfig;
    
    return {
      baseConfigs,
      finalConfig: cleanedConfig,
      depth,
      conflicts
    };
  }
  
  /**
   * Merge two configurations with conflict tracking
   */
  private mergeConfigurations(
    base: PersuaderConfig,
    override: PersuaderConfig,
    sourceName: string,
    conflicts: ConfigConflict[]
  ): PersuaderConfig {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (key === 'extends') continue;
      
      const basePath = key;
      const baseValue = result[key as keyof PersuaderConfig];
      
      if (baseValue === undefined) {
        // No conflict, just assign
        (result as any)[key] = value;
      } else if (this.isObject(baseValue) && this.isObject(value) && this.options.deepMergeObjects) {
        // Deep merge objects
        const mergeResult = this.deepMergeObjects(
          baseValue as Record<string, any>,
          value as Record<string, any>,
          basePath,
          sourceName,
          conflicts
        );
        (result as any)[key] = mergeResult;
      } else if (Array.isArray(baseValue) && Array.isArray(value) && this.options.mergeArrays) {
        // Concatenate arrays
        const mergedArray = [...baseValue, ...value];
        (result as any)[key] = mergedArray;
        
        if (this.options.trackConflicts) {
          conflicts.push({
            path: basePath,
            baseValue,
            overrideValue: value,
            source: sourceName,
            resolution: 'array_concat'
          });
        }
      } else {
        // Override value
        (result as any)[key] = value;
        
        if (this.options.trackConflicts) {
          conflicts.push({
            path: basePath,
            baseValue,
            overrideValue: value,
            source: sourceName,
            resolution: 'override'
          });
        }
      }
    }
    
    return result;
  }
  
  /**
   * Deep merge two objects
   */
  private deepMergeObjects(
    base: Record<string, any>,
    override: Record<string, any>,
    basePath: string,
    sourceName: string,
    conflicts: ConfigConflict[]
  ): Record<string, any> {
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      const currentPath = `${basePath}.${key}`;
      const baseValue = result[key];
      
      if (baseValue === undefined) {
        result[key] = value;
      } else if (this.isObject(baseValue) && this.isObject(value)) {
        // Recursively merge nested objects
        result[key] = this.deepMergeObjects(
          baseValue as Record<string, any>,
          value as Record<string, any>,
          currentPath,
          sourceName,
          conflicts
        );
      } else if (Array.isArray(baseValue) && Array.isArray(value) && this.options.mergeArrays) {
        // Concatenate arrays
        result[key] = [...baseValue, ...value];
        
        if (this.options.trackConflicts) {
          conflicts.push({
            path: currentPath,
            baseValue,
            overrideValue: value,
            source: sourceName,
            resolution: 'array_concat'
          });
        }
      } else {
        // Override value
        result[key] = value;
        
        if (this.options.trackConflicts) {
          conflicts.push({
            path: currentPath,
            baseValue,
            overrideValue: value,
            source: sourceName,
            resolution: 'override'
          });
        }
      }
    }
    
    return result;
  }
  
  /**
   * Check if a value is a plain object
   */
  private isObject(value: any): boolean {
    return value !== null && 
           typeof value === 'object' && 
           !Array.isArray(value) && 
           !(value instanceof Date) && 
           !(value instanceof RegExp);
  }
  
  /**
   * Create environment-specific inheritance
   */
  async resolveEnvironmentInheritance(
    config: PersuaderConfig,
    environment: string
  ): Promise<PersuaderConfig> {
    if (!config.environments?.[environment]) {
      return config;
    }
    
    const envConfig = config.environments[environment];
    
    // Create inheritance configuration
    const inheritanceConfig: PersuaderConfig & BaseConfig = {
      ...envConfig,
      extends: 'base'
    };
    
    // Register base configuration
    this.registerBaseConfig('base', config);
    
    // Resolve inheritance
    const chain = await this.resolveInheritance(inheritanceConfig);
    
    return chain.finalConfig;
  }
  
  /**
   * Create pipeline-specific inheritance
   */
  async resolvePipelineInheritance(
    config: PersuaderConfig,
    pipeline: string,
    environment?: string
  ): Promise<PersuaderConfig> {
    let baseConfig = config;
    
    // First apply environment inheritance if specified
    if (environment) {
      baseConfig = await this.resolveEnvironmentInheritance(config, environment);
    }
    
    if (!config.pipelines?.[pipeline]) {
      return baseConfig;
    }
    
    const pipelineConfig = config.pipelines[pipeline];
    
    // Create inheritance configuration
    const inheritanceConfig: PersuaderConfig & BaseConfig = {
      ...pipelineConfig,
      extends: 'base'
    };
    
    // Register base configuration
    this.registerBaseConfig('base', baseConfig);
    
    // Resolve inheritance
    const chain = await this.resolveInheritance(inheritanceConfig);
    
    return chain.finalConfig;
  }
  
  /**
   * Get inheritance statistics
   */
  getStats(): {
    registeredBases: number;
    baseNames: string[];
    options: Required<InheritanceOptions>;
  } {
    return {
      registeredBases: this.baseConfigs.size,
      baseNames: Array.from(this.baseConfigs.keys()),
      options: { ...this.options }
    };
  }
  
  /**
   * Clear all registered base configurations
   */
  clear(): void {
    this.baseConfigs.clear();
  }
}

/**
 * Global inheritance resolver instance
 */
let globalInheritanceResolver: ConfigInheritanceResolver | null = null;

/**
 * Get the global inheritance resolver
 */
export function getGlobalInheritanceResolver(): ConfigInheritanceResolver {
  if (!globalInheritanceResolver) {
    globalInheritanceResolver = new ConfigInheritanceResolver();
  }
  return globalInheritanceResolver;
}

/**
 * Set global inheritance resolver
 */
export function setGlobalInheritanceResolver(resolver: ConfigInheritanceResolver): void {
  globalInheritanceResolver = resolver;
}

/**
 * Helper function to resolve environment configuration with inheritance
 */
export async function resolveEnvironmentConfig(
  config: PersuaderConfig,
  environment: string,
  options?: InheritanceOptions
): Promise<PersuaderConfig> {
  const resolver = new ConfigInheritanceResolver(options);
  return resolver.resolveEnvironmentInheritance(config, environment);
}

/**
 * Helper function to resolve pipeline configuration with inheritance
 */
export async function resolvePipelineConfig(
  config: PersuaderConfig,
  pipeline: string,
  environment?: string,
  options?: InheritanceOptions
): Promise<PersuaderConfig> {
  const resolver = new ConfigInheritanceResolver(options);
  return resolver.resolvePipelineInheritance(config, pipeline, environment);
}

/**
 * Helper function to analyze inheritance conflicts
 */
export function analyzeInheritanceConflicts(conflicts: ConfigConflict[]): {
  totalConflicts: number;
  overrides: number;
  merges: number;
  arrayConcats: number;
  conflictPaths: string[];
  sourceBreakdown: Record<string, number>;
} {
  const overrides = conflicts.filter(c => c.resolution === 'override').length;
  const merges = conflicts.filter(c => c.resolution === 'merge').length;
  const arrayConcats = conflicts.filter(c => c.resolution === 'array_concat').length;
  
  const conflictPaths = [...new Set(conflicts.map(c => c.path))];
  
  const sourceBreakdown: Record<string, number> = {};
  for (const conflict of conflicts) {
    sourceBreakdown[conflict.source] = (sourceBreakdown[conflict.source] || 0) + 1;
  }
  
  return {
    totalConflicts: conflicts.length,
    overrides,
    merges,
    arrayConcats,
    conflictPaths,
    sourceBreakdown
  };
}