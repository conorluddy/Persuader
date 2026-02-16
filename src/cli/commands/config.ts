/**
 * Configuration Command
 * 
 * CLI commands for managing .persuader configuration files
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { consola } from 'consola';
import { 
  discoverConfigFile,
  loadConfig,
  getDefaultConfig,
  getConfigSystemStatus,
  initializePersuaderConfigForEnvironment
} from '../../utils/config/index.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Create the config command with subcommands
 */
export function createConfigCommand(): Command {
  const configCmd = new Command('config');
  
  configCmd
    .description('Manage .persuader configuration files')
    .addHelpText('after', `
Examples:
  $ persuader config init                    Create default .persuader config
  $ persuader config init --format yaml     Create YAML config file
  $ persuader config show                   Display current configuration
  $ persuader config validate               Validate configuration files
  $ persuader config discover               Find configuration files in project
  $ persuader config status                 Show configuration system status
`);

  // Init subcommand
  configCmd
    .command('init')
    .description('Create a default .persuader configuration file')
    .option('-f, --format <type>', 'Configuration format (json|yaml|js|ts)', 'json')
    .option('-o, --output <path>', 'Output file path', './.persuader')
    .option('--preset <preset>', 'Logging preset to use (LOCAL_DEV|PRODUCTION|GDPR_COMPLIANT|etc.)')
    .option('--overwrite', 'Overwrite existing configuration file')
    .action(async (options) => {
      try {
        await initConfigFile(options);
      } catch (error) {
        consola.error('Failed to initialize configuration:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Show subcommand  
  configCmd
    .command('show')
    .description('Display current configuration')
    .option('-e, --environment <env>', 'Environment to show config for')
    .option('-p, --pipeline <name>', 'Pipeline to show config for')
    .option('--resolved', 'Show resolved configuration (after merging)')
    .action(async (options) => {
      try {
        await showConfig(options);
      } catch (error) {
        consola.error('Failed to show configuration:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Validate subcommand
  configCmd
    .command('validate')
    .description('Validate .persuader configuration files')
    .option('-c, --config <path>', 'Configuration file to validate')
    .action(async (options) => {
      try {
        await validateConfigFile(options);
      } catch (error) {
        consola.error('Failed to validate configuration:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Discover subcommand
  configCmd
    .command('discover')
    .description('Find .persuader configuration files in project')
    .option('--verbose', 'Show detailed discovery information')
    .action(async (options) => {
      try {
        await discoverConfigFiles(options);
      } catch (error) {
        consola.error('Failed to discover configuration files:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // Status subcommand
  configCmd
    .command('status')
    .description('Show configuration system status')
    .action(async () => {
      try {
        await showSystemStatus();
      } catch (error) {
        consola.error('Failed to get system status:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return configCmd;
}

/**
 * Initialize a new configuration file
 */
async function initConfigFile(options: {
  format: string;
  output: string;
  preset?: string;
  overwrite?: boolean;
}): Promise<void> {
  const { format, output, preset, overwrite } = options;

  // Check if file exists
  const configPath = getConfigPath(output, format);
  try {
    await fs.access(configPath);
    if (!overwrite) {
      consola.error(`Configuration file already exists: ${configPath}`);
      consola.info('Use --overwrite to replace it');
      return;
    }
  } catch {
    // File doesn't exist, which is good
  }

  // Generate default config
  const defaultConfig = getDefaultConfig();
  
  // Apply preset if specified
  if (preset) {
    if (preset in ['LOCAL_DEV', 'DEBUG_FULL', 'LLM_DEBUG', 'PRODUCTION', 'PROD_OBSERVABILITY', 'PROD_MINIMAL', 'GDPR_COMPLIANT', 'SECURITY_AUDIT', 'PERFORMANCE_FOCUS', 'TOKEN_MONITORING', 'TEST_RUNNER', 'CI_PIPELINE']) {
      defaultConfig.logging = defaultConfig.logging || {};
      defaultConfig.logging.preset = preset as any;
    } else {
      consola.warn(`Unknown preset '${preset}'. Using default.`);
    }
  }

  // Add helpful metadata
  const configWithMetadata = {
    $schema: 'https://raw.githubusercontent.com/conorluddy/Persuader/main/schemas/persuader-config.schema.json',
    ...defaultConfig,
    project: {
      name: path.basename(process.cwd()),
      version: '1.0.0',
      description: 'Generated by Persuader CLI'
    }
  };

  // Generate content based on format
  let content: string;
  switch (format.toLowerCase()) {
    case 'json':
      content = JSON.stringify(configWithMetadata, null, 2);
      break;
    case 'yaml':
    case 'yml':
      content = generateYamlContent(configWithMetadata);
      break;
    case 'js':
      content = generateJsContent(configWithMetadata, false);
      break;
    case 'ts':
      content = generateJsContent(configWithMetadata, true);
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  // Write file
  await fs.writeFile(configPath, content, 'utf8');
  
  consola.success(`Created configuration file: ${configPath}`);
  consola.info(chalk.blue(`Edit this file to customize your Persuader logging and behavior settings.`));
  
  if (format === 'json') {
    consola.info(chalk.gray(`Tip: Add "persuader-config.schema.json" to your IDE for autocompletion`));
  }
}

/**
 * Show current configuration
 */
async function showConfig(options: {
  environment?: string;
  pipeline?: string;
  resolved?: boolean;
}): Promise<void> {
  const loadOptions: any = {
    mergeWithDefaults: true
  };
  
  if (options.environment) {
    loadOptions.environment = options.environment;
  }
  if (options.pipeline) {
    loadOptions.pipeline = options.pipeline;
  }
  
  const loadResult = await loadConfig(loadOptions);

  if (!loadResult.config) {
    consola.warn('No configuration found. Using built-in defaults.');
    const defaults = getDefaultConfig();
    console.log(JSON.stringify(defaults, null, 2));
    return;
  }

  consola.info(chalk.blue('Configuration loaded successfully'));
  
  if (loadResult.discovery.configPath) {
    consola.info(`📁 Source: ${loadResult.discovery.configPath}`);
    consola.info(`📋 Format: ${loadResult.discovery.format}`);
  }
  
  if (loadResult.environment) {
    consola.info(`🌍 Environment: ${loadResult.environment}`);
  }
  
  if (loadResult.pipeline) {
    consola.info(`🚀 Pipeline: ${loadResult.pipeline}`);
  }
  
  // Show inheritance information
  if (loadResult.inheritanceChain) {
    consola.info(`🔗 Inheritance: Extended from ${loadResult.inheritanceChain.baseConfigs.length} base config(s)`);
    if (loadResult.inheritanceChain.conflicts.length > 0) {
      consola.warn(`⚠️  ${loadResult.inheritanceChain.conflicts.length} inheritance conflicts resolved`);
    }
  }
  
  // Show interpolation information
  if (loadResult.interpolationResult) {
    const { interpolationResult } = loadResult;
    if (interpolationResult.resolvedVariables.length > 0) {
      consola.info(`🔧 Interpolated ${interpolationResult.resolvedVariables.length} environment variable(s)`);
    }
    if (interpolationResult.missingVariables.length > 0) {
      consola.warn(`❌ ${interpolationResult.missingVariables.length} missing variable(s): ${interpolationResult.missingVariables.join(', ')}`);
    }
    if (interpolationResult.typeCoercions.length > 0) {
      consola.info(`🔄 Applied ${interpolationResult.typeCoercions.length} type coercion(s)`);
    }
    if (Object.keys(interpolationResult.defaultsUsed).length > 0) {
      consola.info(`📝 Used ${Object.keys(interpolationResult.defaultsUsed).length} default value(s)`);
    }
  }

  if (loadResult.warnings?.length) {
    consola.warn('Warnings:');
    loadResult.warnings.forEach(warning => consola.warn(`  • ${warning}`));
  }

  console.log('\nConfiguration:');
  console.log(JSON.stringify(loadResult.config, null, 2));
}

/**
 * Validate configuration file
 */
async function validateConfigFile(options: { config?: string }): Promise<void> {
  let configPath = options.config;
  
  if (!configPath) {
    // Discover config file
    const discovery = await discoverConfigFile();
    if (!discovery.configPath) {
      consola.error('No .persuader configuration file found');
      return;
    }
    configPath = discovery.configPath;
  }

  const loadResult = await loadConfig({ configPath });
  
  if (loadResult.errors.length > 0) {
    consola.error('❌ Configuration validation failed:');
    loadResult.errors.forEach(error => consola.error(`  • ${error}`));
    process.exit(1);
  }

  if (loadResult.warnings?.length) {
    consola.warn('⚠️  Validation warnings:');
    loadResult.warnings.forEach(warning => consola.warn(`  • ${warning}`));
  }

  consola.success('✅ Configuration is valid');
  
  if (loadResult.discovery.configPath) {
    consola.info(`📁 Validated: ${loadResult.discovery.configPath}`);
    consola.info(`📋 Format: ${loadResult.discovery.format}`);
    consola.info(`⏱️  Parse time: ${loadResult.loadTimeMs}ms`);
  }
}

/**
 * Discover configuration files
 */
async function discoverConfigFiles(options: { verbose?: boolean }): Promise<void> {
  const discovery = await discoverConfigFile();
  
  if (discovery.configPath) {
    consola.success(`📁 Found configuration file: ${discovery.configPath}`);
    consola.info(`📋 Format: ${discovery.format}`);
    consola.info(`🔍 Discovery method: ${discovery.discoveryMethod}`);
    
    if (options.verbose) {
      consola.info(`⏱️  Discovery time: ${discovery.discoveryTimeMs}ms`);
      if (discovery.searchedPaths.length > 0) {
        consola.info('🔎 Searched paths:');
        discovery.searchedPaths.forEach(searchPath => consola.info(`   • ${searchPath}`));
      }
    }
  } else {
    consola.warn('❌ No .persuader configuration file found');
    if (options.verbose && discovery.searchedPaths.length > 0) {
      consola.info('🔎 Searched paths:');
      discovery.searchedPaths.forEach(searchPath => consola.info(`   • ${searchPath}`));
    }
    consola.info(chalk.blue('\nTo create a configuration file, run:'));
    consola.info(chalk.gray('  $ persuader config init'));
  }
}

/**
 * Show configuration system status
 */
async function showSystemStatus(): Promise<void> {
  const status = getConfigSystemStatus();
  
  consola.info(chalk.blue('Configuration System Status'));
  consola.info(`🔧 Initialized: ${status.initialized ? '✅ Yes' : '❌ No'}`);
  consola.info(`📁 File config: ${status.hasFileConfig ? '✅ Yes' : '❌ No'}`);
  
  if (status.environment) {
    consola.info(`🌍 Environment: ${status.environment}`);
  }
  
  if (status.pipeline) {
    consola.info(`🚀 Pipeline: ${status.pipeline}`);
  }
  
  if (status.configAge !== undefined) {
    const ageSeconds = Math.floor(status.configAge / 1000);
    consola.info(`⏰ Config age: ${ageSeconds}s`);
  }

  if (!status.initialized) {
    consola.info(chalk.blue('\nTo initialize the configuration system:'));
    await initializePersuaderConfigForEnvironment();
    consola.success('✅ Configuration system initialized');
  }
}

/**
 * Get configuration file path with proper extension
 */
function getConfigPath(basePath: string, format: string): string {
  const extensions: Record<string, string> = {
    json: '.json',
    yaml: '.yaml',
    yml: '.yml',
    js: '.js',
    ts: '.ts'
  };
  
  const ext = extensions[format.toLowerCase()] || '.json';
  return basePath.endsWith(ext) ? basePath : `${basePath}${ext}`;
}

/**
 * Generate YAML content for configuration
 */
function generateYamlContent(config: any): string {
  // Simple YAML generation - in production, use a proper YAML library
  return `# Persuader Configuration File
# Generated by Persuader CLI

$schema: "${config.$schema}"

version: "${config.version}"

# Project information
project:
  name: "${config.project.name}"
  version: "${config.project.version}"
  description: "${config.project.description}"

# Logging configuration
logging:
  level: ${config.logging.level}
  colors: ${config.logging.colors}
  timestamp: ${config.logging.timestamp}
  truncate: ${config.logging.truncate}
  maxPromptLength: ${config.logging.maxPromptLength}
  maxResponseLength: ${config.logging.maxResponseLength}
  
  categories:
    usePreset: ${config.logging.categories.usePreset}
  
  jsonl:
    enabled: ${config.logging.jsonl.enabled}
    directory: "${config.logging.jsonl.directory}"
    maxFileSize: "${config.logging.jsonl.maxFileSize}"
    maxFiles: ${config.logging.jsonl.maxFiles}
    baseFilename: "${config.logging.jsonl.baseFilename}"
    rotation: ${config.logging.jsonl.rotation}
    compression: ${config.logging.jsonl.compression}
  
  privacy:
    level: ${config.logging.privacy.level}
    redactionStyle: ${config.logging.privacy.redactionStyle}
    auditLogging: ${config.logging.privacy.auditLogging}
  
  performance:
    enabled: ${config.logging.performance.enabled}
    sampleRate: ${config.logging.performance.sampleRate}
    slowThreshold: "${config.logging.performance.slowThreshold}"
    memoryTracking: ${config.logging.performance.memoryTracking}
    costTracking: ${config.logging.performance.costTracking}

# Environment-specific configurations
# environments:
#   production:
#     level: info
#     jsonl:
#       enabled: true
#   development:
#     level: debug

# Pipeline-specific configurations  
# pipelines:
#   data-processing:
#     logging:
#       level: info
#       performance:
#         enabled: true
`;
}

/**
 * Generate JavaScript/TypeScript content for configuration
 */
function generateJsContent(config: any, isTypeScript: boolean): string {
  const typeAnnotation = isTypeScript ? ': PersuaderConfig' : '';
  const importStatement = isTypeScript 
    ? `import type { PersuaderConfig } from 'persuader';\n\n`
    : '';

  return `${importStatement}/**
 * Persuader Configuration File
 * Generated by Persuader CLI
 */

const config${typeAnnotation} = ${JSON.stringify(config, null, 2)};

export default config;
`;
}