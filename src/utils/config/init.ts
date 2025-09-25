/**
 * Configuration System Initialization
 * 
 * Provides automatic initialization of the enhanced configuration system
 * that integrates .persuader files with the existing ConfigResolver.
 */

import { 
  initializeGlobalConfigResolver,
  migrateToEnhancedResolver,
  type EnhancedConfigResolver 
} from './config-resolver-integration.js';
import { CategoryPresets } from '../category-manager.js';

/**
 * Configuration initialization options
 */
export interface ConfigInitOptions {
  /** Environment name (e.g., 'development', 'production') */
  environment?: string;
  
  /** Pipeline name for pipeline-specific settings */
  pipeline?: string;
  
  /** Custom path to configuration file */
  configPath?: string;
  
  /** Initial category preset if no file config found */
  initialCategories?: number;
  
  /** Whether to automatically migrate existing usage */
  autoMigrate?: boolean;
  
  /** Whether to suppress initialization logging */
  silent?: boolean;
}

/**
 * Initialize the Persuader configuration system
 * 
 * This function should be called at application startup to enable
 * .persuader configuration file support throughout the application.
 */
export async function initializePersuaderConfig(
  options: ConfigInitOptions = {}
): Promise<{
  resolver: EnhancedConfigResolver;
  hasFileConfig: boolean;
  environment?: string;
  pipeline?: string;
}> {
  const {
    environment = process.env.NODE_ENV,
    pipeline,
    configPath,
    initialCategories = CategoryPresets.DEV_BASIC,
    autoMigrate = true,
    silent = false
  } = options;
  
  if (!silent) {
    console.log('🔧 Initializing Persuader configuration system...');
  }
  
  // Initialize the enhanced resolver
  const resolverOptions: any = {
    initialCategories
  };
  
  if (environment) {
    resolverOptions.environment = environment;
  }
  if (pipeline) {
    resolverOptions.pipeline = pipeline;
  }
  if (configPath) {
    resolverOptions.configPath = configPath;
  }
  
  const resolver = initializeGlobalConfigResolver(resolverOptions);
  
  // Get load status
  const loadStatus = resolver.getLoadStatus();
  
  if (!silent) {
    if (loadStatus.hasFileConfig) {
      console.log(`✅ Loaded .persuader configuration`);
      if (loadStatus.environment) {
        console.log(`   Environment: ${loadStatus.environment}`);
      }
      if (loadStatus.pipeline) {
        console.log(`   Pipeline: ${loadStatus.pipeline}`);
      }
    } else {
      console.log('ℹ️  No .persuader configuration found - using defaults');
    }
  }
  
  // Perform migration if requested
  if (autoMigrate) {
    migrateToEnhancedResolver();
    if (!silent) {
      console.log('🔄 Migrated existing configuration resolver usage');
    }
  }
  
  const result: {
    resolver: EnhancedConfigResolver;
    hasFileConfig: boolean;
    environment?: string;
    pipeline?: string;
  } = {
    resolver,
    hasFileConfig: loadStatus.hasFileConfig
  };
  
  if (loadStatus.environment) {
    result.environment = loadStatus.environment;
  }
  if (loadStatus.pipeline) {
    result.pipeline = loadStatus.pipeline;
  }
  
  return result;
}

/**
 * Environment-aware initialization helper
 * 
 * Automatically determines environment from NODE_ENV and initializes
 * the configuration system with appropriate settings.
 */
export async function initializePersuaderConfigForEnvironment(
  customOptions: Partial<ConfigInitOptions> = {}
): Promise<{
  resolver: EnhancedConfigResolver;
  hasFileConfig: boolean;
  environment?: string;
  pipeline?: string;
}> {
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development' || !nodeEnv;
  const isTest = nodeEnv === 'test';
  
  // Set environment-appropriate defaults
  const defaults: any = {
    initialCategories: isProduction 
      ? CategoryPresets.LEVEL_INFO 
      : isDevelopment 
        ? CategoryPresets.DEV_BASIC
        : CategoryPresets.LEVEL_ERROR, // Test environment
    autoMigrate: true,
    silent: isTest // Suppress logging in tests
  };
  
  if (nodeEnv) {
    defaults.environment = nodeEnv;
  }
  
  const finalOptions: any = { ...defaults };
  
  // Only add defined custom options
  if (customOptions.environment) {
    finalOptions.environment = customOptions.environment;
  }
  if (customOptions.pipeline) {
    finalOptions.pipeline = customOptions.pipeline;
  }
  if (customOptions.configPath) {
    finalOptions.configPath = customOptions.configPath;
  }
  if (customOptions.initialCategories !== undefined) {
    finalOptions.initialCategories = customOptions.initialCategories;
  }
  if (customOptions.autoMigrate !== undefined) {
    finalOptions.autoMigrate = customOptions.autoMigrate;
  }
  if (customOptions.silent !== undefined) {
    finalOptions.silent = customOptions.silent;
  }
  
  return initializePersuaderConfig(finalOptions);
}

/**
 * Quick initialization for development
 * 
 * Sets up the configuration system with development-friendly defaults.
 */
export async function initializeForDevelopment(
  pipeline?: string
): Promise<EnhancedConfigResolver> {
  const options: any = {
    environment: 'development',
    initialCategories: CategoryPresets.DEV_BASIC,
    autoMigrate: true,
    silent: false
  };
  
  if (pipeline) {
    options.pipeline = pipeline;
  }
  
  const result = await initializePersuaderConfig(options);
  
  return result.resolver;
}

/**
 * Quick initialization for production
 * 
 * Sets up the configuration system with production-appropriate defaults.
 */
export async function initializeForProduction(
  pipeline?: string
): Promise<EnhancedConfigResolver> {
  const options: any = {
    environment: 'production',
    initialCategories: CategoryPresets.LEVEL_INFO,
    autoMigrate: true,
    silent: false
  };
  
  if (pipeline) {
    options.pipeline = pipeline;
  }
  
  const result = await initializePersuaderConfig(options);
  
  return result.resolver;
}

/**
 * Quick initialization for testing
 * 
 * Sets up the configuration system with test-appropriate defaults.
 */
export async function initializeForTesting(): Promise<EnhancedConfigResolver> {
  const result = await initializePersuaderConfig({
    environment: 'test',
    initialCategories: CategoryPresets.LEVEL_ERROR,
    autoMigrate: false, // Don't interfere with test isolation
    silent: true
  });
  
  return result.resolver;
}

/**
 * Check if the configuration system has been initialized
 */
export function isConfigSystemInitialized(): boolean {
  try {
    const { getGlobalEnhancedConfigResolver } = require('./config-resolver-integration.js');
    const resolver = getGlobalEnhancedConfigResolver();
    return resolver !== null;
  } catch {
    return false;
  }
}

/**
 * Get configuration system status
 */
export function getConfigSystemStatus(): {
  initialized: boolean;
  hasFileConfig: boolean;
  configAge?: number;
  environment?: string;
  pipeline?: string;
} {
  if (!isConfigSystemInitialized()) {
    return { initialized: false, hasFileConfig: false };
  }
  
  try {
    const { getGlobalEnhancedConfigResolver } = require('./config-resolver-integration.js');
    const resolver = getGlobalEnhancedConfigResolver();
    const status = resolver.getLoadStatus();
    
    return {
      initialized: true,
      hasFileConfig: status.hasFileConfig,
      configAge: status.configAge,
      environment: status.environment,
      pipeline: status.pipeline
    };
  } catch {
    return { initialized: false, hasFileConfig: false };
  }
}

/**
 * Automatic initialization for Node.js applications
 * 
 * Can be imported to automatically initialize the configuration system
 * when the module is first loaded. Useful for applications that want
 * zero-configuration setup.
 */
export async function autoInitialize(): Promise<void> {
  if (isConfigSystemInitialized()) {
    return; // Already initialized
  }
  
  try {
    await initializePersuaderConfigForEnvironment({
      silent: process.env.NODE_ENV === 'test'
    });
  } catch (error) {
    // Fail silently - application can still function without file-based config
    if (process.env.NODE_ENV !== 'test') {
      console.warn('Warning: Failed to auto-initialize Persuader configuration:', error);
    }
  }
}