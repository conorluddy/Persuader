#!/usr/bin/env tsx

/**
 * CLI Integration Example
 * 
 * This example demonstrates how to integrate the Persuader configuration system
 * into command-line applications. It shows configuration discovery, validation,
 * inheritance, and practical usage patterns.
 */

import { program } from 'commander';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  // Configuration discovery and loading
  discoverConfigFile,
  loadConfig,
  validateConfigFile,
  
  // Environment-specific configuration
  loadEnvironmentConfig,
  loadPipelineConfig,
  
  // System utilities
  initializePersuaderConfig,
  getConfigSystemStatus,
  
  // Performance and caching
  preloadConfig,
  getConfigCacheStats,
  clearConfigCache,
  
  // Types
  type LoadConfigOptions,
  type ConfigDiscoveryResult
} from '../src/utils/index.js';

/**
 * CLI Application Configuration Interface
 * Extends Persuader config with CLI-specific options
 */
interface CLIConfig {
  // CLI-specific configuration
  cli?: {
    colors?: boolean;
    interactive?: boolean;
    defaultTimeout?: string;
    outputFormat?: 'json' | 'yaml' | 'table';
  };
  
  // Application environment
  environment?: string;
  pipeline?: string;
  
  // Feature flags
  features?: {
    enableCache?: boolean;
    enableMetrics?: boolean;
    enableDebug?: boolean;
  };
}

/**
 * Configuration Manager for CLI Applications
 */
class CLIConfigManager {
  private config: any = null;
  private configPath: string | null = null;
  private environment: string | null = null;
  
  /**
   * Initialize configuration system for CLI application
   */
  async initialize(options: {
    configPath?: string;
    environment?: string;
    pipeline?: string;
    skipCache?: boolean;
  } = {}): Promise<void> {
    console.log('🔧 Initializing Persuader configuration system...');
    
    try {
      // Initialize the configuration system
      await initializePersuaderConfig();
      
      // Discover or use provided configuration file
      let discoveryResult: ConfigDiscoveryResult;
      
      if (options.configPath) {
        // Use explicitly provided config path
        if (!existsSync(options.configPath)) {
          throw new Error(`Configuration file not found: ${options.configPath}`);
        }
        this.configPath = resolve(options.configPath);
        console.log(`📄 Using configuration file: ${this.configPath}`);
      } else {
        // Auto-discover configuration file
        discoveryResult = await discoverConfigFile();
        if (discoveryResult.found && discoveryResult.path) {
          this.configPath = discoveryResult.path;
          console.log(`🔍 Discovered configuration: ${this.configPath} (${discoveryResult.method})`);
        } else {
          console.log('ℹ️  No configuration file found, using defaults');
        }
      }
      
      // Load base configuration
      if (this.configPath) {
        const loadOptions: LoadConfigOptions = {
          validate: true,
          useCache: !options.skipCache,
          throwOnError: false
        };
        
        const result = await loadConfig(this.configPath, loadOptions);
        if (result.success && result.config) {
          this.config = result.config;
          console.log(`✅ Configuration loaded successfully`);
        } else {
          console.error('❌ Failed to load configuration:', result.errors);
          throw new Error('Configuration loading failed');
        }
      }
      
      // Apply environment-specific configuration
      if (options.environment) {
        this.environment = options.environment;
        console.log(`🌍 Loading environment configuration: ${options.environment}`);
        
        const envResult = await loadEnvironmentConfig(options.environment, {
          baseConfigPath: this.configPath || undefined,
          validate: true,
          useCache: !options.skipCache
        });
        
        if (envResult.success && envResult.config) {
          this.config = envResult.config;
          console.log(`✅ Environment configuration applied`);
        }
      }
      
      // Apply pipeline-specific configuration
      if (options.pipeline) {
        console.log(`🔄 Loading pipeline configuration: ${options.pipeline}`);
        
        const pipelineResult = await loadPipelineConfig(options.pipeline, {
          baseConfigPath: this.configPath || undefined,
          environment: this.environment || undefined,
          validate: true,
          useCache: !options.skipCache
        });
        
        if (pipelineResult.success && pipelineResult.config) {
          this.config = pipelineResult.config;
          console.log(`✅ Pipeline configuration applied`);
        }
      }
      
    } catch (error) {
      console.error('❌ Configuration initialization failed:', error);
      throw error;
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): any {
    return this.config;
  }
  
  /**
   * Get CLI-specific configuration
   */
  getCLIConfig(): CLIConfig {
    return this.config?.cli || {};
  }
  
  /**
   * Get logging configuration for CLI output
   */
  getLoggingConfig() {
    return this.config?.logging || {
      preset: 'LOCAL_DEV',
      colors: true,
      timestamp: false
    };
  }
  
  /**
   * Preload configurations for batch operations
   */
  async preloadConfigurations(paths: string[]): Promise<void> {
    console.log(`📦 Preloading ${paths.length} configurations...`);
    
    const results = await preloadConfig(paths, {
      validate: true,
      parallel: true,
      batchSize: 5
    });
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Preloaded ${successful}/${paths.length} configurations`);
    
    if (successful < paths.length) {
      const failed = results.filter(r => !r.success);
      console.warn('⚠️  Some configurations failed to preload:', 
        failed.map(f => f.path).join(', '));
    }
  }
  
  /**
   * Display system status and performance metrics
   */
  async displayStatus(): Promise<void> {
    console.log('\n📊 Configuration System Status');
    console.log('================================');
    
    // System status
    const status = await getConfigSystemStatus();
    console.log(`System Status: ${status.initialized ? '✅ Initialized' : '❌ Not Initialized'}`);
    console.log(`Config File: ${status.hasFileConfig ? '✅ Found' : '❌ Not Found'}`);
    if (status.configAge !== undefined) {
      console.log(`Config Age: ${Math.round(status.configAge / 1000)}s`);
    }
    if (status.environment) {
      console.log(`Environment: ${status.environment}`);
    }
    if (status.pipeline) {
      console.log(`Pipeline: ${status.pipeline}`);
    }
    
    // Cache statistics
    const cacheStats = getConfigCacheStats();
    console.log(`\nCache Statistics:`);
    console.log(`  Total Entries: ${cacheStats.totalEntries}`);
    console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Memory Usage: ${cacheStats.memoryUsage}`);
    console.log(`  Total Hits: ${cacheStats.totalHits}`);
    console.log(`  Total Misses: ${cacheStats.totalMisses}`);
    
    if (cacheStats.oldestEntry) {
      console.log(`  Oldest Entry: ${Math.round(cacheStats.oldestEntry / 1000)}s ago`);
    }
  }
  
  /**
   * Validate configuration file
   */
  async validateConfiguration(path?: string): Promise<boolean> {
    const configPath = path || this.configPath;
    
    if (!configPath) {
      console.error('❌ No configuration file to validate');
      return false;
    }
    
    console.log(`🔍 Validating configuration: ${configPath}`);
    
    try {
      const result = await validateConfigFile(configPath);
      
      if (result.valid) {
        console.log('✅ Configuration is valid');
        console.log(`   Format: ${result.format}`);
        console.log(`   Size: ${result.fileSize} bytes`);
        if (result.parseTime) {
          console.log(`   Parse Time: ${result.parseTime}ms`);
        }
        return true;
      } else {
        console.error('❌ Configuration validation failed:');
        if (result.errors) {
          result.errors.forEach(error => console.error(`   • ${error}`));
        }
        if (result.validationErrors) {
          result.validationErrors.forEach(error => console.error(`   • ${error}`));
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Validation error:', error);
      return false;
    }
  }
}

// Initialize global configuration manager
const configManager = new CLIConfigManager();

/**
 * CLI Commands
 */

// Initialize command
program
  .command('init')
  .description('Initialize configuration system')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-e, --environment <env>', 'Environment name (development, production, etc.)')
  .option('-p, --pipeline <name>', 'Pipeline name for pipeline-specific configuration')
  .option('--skip-cache', 'Skip configuration caching')
  .action(async (options) => {
    try {
      await configManager.initialize({
        configPath: options.config,
        environment: options.environment,
        pipeline: options.pipeline,
        skipCache: options.skipCache
      });
      console.log('🎉 Configuration system initialized successfully!');
    } catch (error) {
      console.error('💥 Initialization failed:', error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Display configuration system status and metrics')
  .action(async () => {
    try {
      await configManager.displayStatus();
    } catch (error) {
      console.error('💥 Failed to get status:', error.message);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate [path]')
  .description('Validate configuration file')
  .action(async (path) => {
    try {
      const isValid = await configManager.validateConfiguration(path);
      process.exit(isValid ? 0 : 1);
    } catch (error) {
      console.error('💥 Validation failed:', error.message);
      process.exit(1);
    }
  });

// Preload command
program
  .command('preload <paths...>')
  .description('Preload multiple configuration files')
  .action(async (paths) => {
    try {
      await configManager.preloadConfigurations(paths);
      console.log('🎉 Preloading completed!');
    } catch (error) {
      console.error('💥 Preloading failed:', error.message);
      process.exit(1);
    }
  });

// Cache management commands
program
  .command('cache')
  .description('Cache management commands')
  .addCommand(
    program.createCommand('clear')
      .description('Clear configuration cache')
      .action(async () => {
        try {
          const clearedCount = clearConfigCache();
          console.log(`🧹 Cleared ${clearedCount} cache entries`);
        } catch (error) {
          console.error('💥 Cache clear failed:', error.message);
          process.exit(1);
        }
      })
  )
  .addCommand(
    program.createCommand('stats')
      .description('Display cache statistics')
      .action(async () => {
        try {
          await configManager.displayStatus();
        } catch (error) {
          console.error('💥 Failed to get cache stats:', error.message);
          process.exit(1);
        }
      })
  );

// Example application command
program
  .command('run-app')
  .description('Example application using configuration system')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-e, --environment <env>', 'Environment name')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      // Initialize configuration
      await configManager.initialize({
        configPath: options.config,
        environment: options.environment
      });
      
      const config = configManager.getConfig();
      const cliConfig = configManager.getCLIConfig();
      const loggingConfig = configManager.getLoggingConfig();
      
      console.log('\n🚀 Running Example Application');
      console.log('==============================');
      
      if (options.verbose) {
        console.log('Configuration loaded:', JSON.stringify(config, null, 2));
      } else {
        console.log('Configuration Summary:');
        console.log(`  Version: ${config?.version || 'unknown'}`);
        console.log(`  Logging Preset: ${loggingConfig.preset || 'default'}`);
        console.log(`  Colors Enabled: ${loggingConfig.colors ? 'yes' : 'no'}`);
        console.log(`  CLI Interactive: ${cliConfig.interactive ? 'yes' : 'no'}`);
        console.log(`  Output Format: ${cliConfig.outputFormat || 'json'}`);
      }
      
      // Simulate application work
      console.log('\n⚙️  Simulating application execution...');
      console.log('✅ Task 1: Configuration loaded and validated');
      console.log('✅ Task 2: Environment settings applied');
      console.log('✅ Task 3: CLI options configured');
      console.log('✅ Task 4: Application ready');
      
      console.log('\n🎉 Application completed successfully!');
      
    } catch (error) {
      console.error('💥 Application failed:', error.message);
      process.exit(1);
    }
  });

// Global error handler
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
program
  .name('cli-integration-example')
  .description('Example CLI application using Persuader configuration system')
  .version('1.0.0')
  .parse();