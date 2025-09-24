/**
 * Interactive Configuration Builder Module
 * 
 * Provides an interactive CLI experience for configuring logging,
 * with intelligent suggestions, validation, and preset management.
 */

import { input, select, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { LogCategory, CategoryManager } from '../category-manager.js';
import { type LoggingConfig, ConfigResolver } from './config-resolver.js';
import { PrivacyLevel } from './privacy-filter.js';
import { getPreset } from './presets.js';

// Removed unused WizardStep interface

/**
 * Wizard context for maintaining state across steps
 */
interface WizardContext {
  preset?: string;
  environment?: string;
  categories: Set<LogCategory>;
  config: Partial<LoggingConfig>;
  customSettings: Map<string, unknown>;
}

// ConfigTemplate interface - used internally in initializeTemplates
// interface ConfigTemplate {
//   readonly name: string;
//   readonly description: string;
//   readonly icon: string;
//   readonly apply: (context: WizardContext) => void;
// }

/**
 * Interactive configuration builder with guided wizard
 */
export class InteractiveConfigBuilder {
  private context: WizardContext;
  private readonly categoryGroups: ReadonlyMap<string, ReadonlyArray<LogCategory>>;
  
  constructor() {
    this.context = {
      categories: new Set(),
      config: {},
      customSettings: new Map(),
    };
    
    this.initializeTemplates();
    this.categoryGroups = this.initializeCategoryGroups();
  }
  
  /**
   * Initialize configuration templates
   */
  private initializeTemplates(): void {
    // Templates are defined locally for type checking
    // Will be used in future implementation
    /* const _templates: ConfigTemplate[] = [
      {
        name: 'Quick Debug',
        description: 'Enable all debug categories for troubleshooting',
        icon: '🐛',
        apply: (ctx: WizardContext) => {
          ctx.categories.add(LogCategory.DEBUG);
          ctx.categories.add(LogCategory.VALIDATION_DETAIL);
          ctx.categories.add(LogCategory.LLM_TOKEN);
          ctx.config.formatting = {
            ...ctx.config.formatting,
            maxPromptLength: 5000,
            maxResponseLength: 5000,
          };
        },
      },
      {
        name: 'Production Ready',
        description: 'Conservative logging for production environments',
        icon: '🚀',
        apply: (ctx: WizardContext) => {
          ctx.categories.add(LogCategory.ERROR);
          ctx.categories.add(LogCategory.WARN);
          ctx.config.privacy = {
            maskSensitiveData: true,
            // Privacy level would be set elsewhere
          };
          ctx.config.output = {
            ...ctx.config.output,
            console: false,
            jsonl: true,
          };
        },
      },
      {
        name: 'LLM Analysis',
        description: 'Focus on LLM interactions and performance',
        icon: '🤖',
        apply: (ctx: WizardContext) => {
          ctx.categories.add(LogCategory.LLM_REQUEST);
          ctx.categories.add(LogCategory.LLM_RESPONSE);
          ctx.categories.add(LogCategory.LLM_TOKEN);
          ctx.config.performance = {
            trackMetrics: true,
            metricsInterval: 30000,
            slowThreshold: 5000,
          };
        },
      },
      {
        name: 'Performance Tuning',
        description: 'Track timing and resource usage',
        icon: '⚡',
        apply: (ctx: WizardContext) => {
          ctx.categories.add(LogCategory.PERF_TIMING);
          ctx.categories.add(LogCategory.PERF_MEMORY);
          ctx.categories.add(LogCategory.PERF_COST);
          ctx.config.performance = {
            trackMetrics: true,
            slowThreshold: 1000,
            metricsInterval: 30000,
          };
        },
      },
    ]; */
    // Templates will be used in future implementation
  }
  
  /**
   * Initialize category groups for easier selection
   */
  private initializeCategoryGroups(): ReadonlyMap<string, ReadonlyArray<LogCategory>> {
    return new Map([
      ['Core', [LogCategory.ERROR, LogCategory.WARN, LogCategory.INFO, LogCategory.DEBUG]],
      ['Validation', [LogCategory.VALIDATION_SUCCESS, LogCategory.VALIDATION_FAILURE, LogCategory.VALIDATION_DETAIL, LogCategory.VALIDATION_DIFF]],
      ['LLM', [LogCategory.LLM_REQUEST, LogCategory.LLM_RESPONSE, LogCategory.LLM_ERROR, LogCategory.LLM_TOKEN]],
      ['Performance', [LogCategory.PERF_TIMING, LogCategory.PERF_MEMORY, LogCategory.PERF_COST]],
      ['Session', [LogCategory.SESSION_CREATE, LogCategory.SESSION_UPDATE, LogCategory.SESSION_METRICS]],
    ]);
  }
  
  /**
   * Run the interactive configuration wizard
   */
  async runWizard(): Promise<LoggingConfig> {
    console.log(chalk.bold.cyan('\n🎨 Persuader Logging Configuration Wizard\n'));
    
    // Step 1: Choose base configuration
    const baseChoice = await this.chooseBaseConfiguration();
    if (baseChoice !== 'custom') {
      this.applyPreset(baseChoice);
    }
    
    // Step 2: Select categories
    if (baseChoice === 'custom' || await this.askCustomizeCategories()) {
      await this.selectCategories();
    }
    
    // Step 3: Configure output
    await this.configureOutput();
    
    // Step 4: Configure privacy
    await this.configurePrivacy();
    
    // Step 5: Configure performance
    await this.configurePerformance();
    
    // Step 6: Review and confirm
    const config = this.buildConfiguration();
    await this.reviewConfiguration(config);
    
    return config;
  }
  
  /**
   * Choose base configuration
   */
  private async chooseBaseConfiguration(): Promise<string> {
    const choices = [
      { name: '🚀 Production - Minimal overhead, maximum safety', value: 'production' },
      { name: '🔧 Development - Full visibility for debugging', value: 'development' },
      { name: '🧪 Testing - Focused on test execution', value: 'testing' },
      { name: '🔬 Debug Session - Maximum detail for troubleshooting', value: 'debug' },
      { name: '📊 Performance Analysis - Focus on metrics', value: 'performance' },
      { name: '✨ Custom - Build from scratch', value: 'custom' },
    ];
    
    return await select({
      message: 'Choose a base configuration:',
      choices,
    });
  }
  
  /**
   * Ask if user wants to customize categories
   */
  private async askCustomizeCategories(): Promise<boolean> {
    return await confirm({
      message: 'Would you like to customize the logging categories?',
      default: false,
    });
  }
  
  /**
   * Select logging categories
   */
  private async selectCategories(): Promise<void> {
    console.log(chalk.yellow('\n📝 Select logging categories:\n'));
    
    for (const [groupName, categories] of this.categoryGroups) {
      const choices = categories.map(cat => ({
        name: this.getCategoryDisplayName(cat),
        value: cat,
        checked: this.context.categories.has(cat),
      }));
      
      const selected = await checkbox({
        message: `${groupName} categories:`,
        choices,
      });
      
      // Update context
      for (const cat of categories) {
        if (selected.includes(cat)) {
          this.context.categories.add(cat);
        } else {
          this.context.categories.delete(cat);
        }
      }
    }
  }
  
  /**
   * Configure output settings
   */
  private async configureOutput(): Promise<void> {
    console.log(chalk.yellow('\n📤 Configure output settings:\n'));
    
    const outputToConsole = await confirm({
      message: 'Output logs to console?',
      default: true,
    });
    
    const outputToFile = await confirm({
      message: 'Save logs to JSONL files?',
      default: false,
    });
    
    let logsDirectory = './logs';
    let maxFileSize = 10485760; // 10MB
    let maxFiles = 10;
    
    if (outputToFile) {
      logsDirectory = await input({
        message: 'Logs directory:',
        default: './logs',
        validate: (value) => {
          if (!value.trim()) return 'Directory path is required';
          return true;
        },
      });
      
      const fileSizeStr = await input({
        message: 'Max file size (MB):',
        default: '10',
        validate: (value) => {
          const num = parseFloat(value);
          if (isNaN(num) || num <= 0) return 'Must be a positive number';
          return true;
        },
      });
      maxFileSize = parseFloat(fileSizeStr) * 1048576;
      
      const maxFilesStr = await input({
        message: 'Max number of log files:',
        default: '10',
        validate: (value) => {
          const num = parseInt(value, 10);
          if (isNaN(num) || num <= 0) return 'Must be a positive integer';
          return true;
        },
      });
      maxFiles = parseInt(maxFilesStr, 10);
    }
    
    this.context.config.output = {
      console: outputToConsole,
      jsonl: outputToFile,
      logsDirectory,
      maxFileSize,
      maxFiles,
    };
  }
  
  /**
   * Configure privacy settings
   */
  private async configurePrivacy(): Promise<void> {
    console.log(chalk.yellow('\n🔒 Configure privacy settings:\n'));
    
    const privacyLevel = await select({
      message: 'Select privacy level:',
      choices: [
        { name: 'Off - No masking', value: PrivacyLevel.OFF },
        { name: 'Minimal - Only obvious sensitive data', value: PrivacyLevel.MINIMAL },
        { name: 'Standard - PII and credentials', value: PrivacyLevel.STANDARD },
        { name: 'Strict - All potential sensitive data', value: PrivacyLevel.STRICT },
        { name: 'Paranoid - Maximum masking', value: PrivacyLevel.PARANOID },
      ],
    });
    
    const maskSensitiveData = privacyLevel > PrivacyLevel.OFF;
    
    this.context.config.privacy = {
      maskSensitiveData,
      // Privacy level is handled separately
    };
  }
  
  /**
   * Configure performance monitoring
   */
  private async configurePerformance(): Promise<void> {
    console.log(chalk.yellow('\n📊 Configure performance monitoring:\n'));
    
    const trackMetrics = await confirm({
      message: 'Enable performance metrics tracking?',
      default: false,
    });
    
    if (!trackMetrics) {
      this.context.config.performance = { trackMetrics: false };
      return;
    }
    
    // Sample rate input removed - not part of performance config
    
    const slowThresholdStr = await input({
      message: 'Slow operation threshold (ms):',
      default: '5000',
      validate: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num <= 0) return 'Must be a positive integer';
        return true;
      },
    });
    
    this.context.config.performance = {
      trackMetrics,
      slowThreshold: parseInt(slowThresholdStr, 10),
      metricsInterval: 60000,
    };
  }
  
  /**
   * Apply a preset configuration
   */
  private applyPreset(presetName: string): void {
    // Map preset names to LoggingPreset enum values used by getPreset
    const presetMap: Record<string, string> = {
      'production': 'PRODUCTION',
      'development': 'LOCAL_DEV',
      'testing': 'TEST',
      'debug': 'DEBUG_SESSION',
      'performance': 'PERFORMANCE_ANALYSIS',
    };
    
    const presetKey = presetMap[presetName];
    if (!presetKey) return;
    
    try {
      const preset = getPreset(presetKey as any);
      if (!preset || !preset.categories) return;
      
      // Apply categories
      const categoryManager = new CategoryManager(preset.categories);
      // Just iterate through all possible categories and check if enabled
      const allCategories = [
        LogCategory.ERROR, LogCategory.WARN, LogCategory.INFO, LogCategory.DEBUG,
        LogCategory.LLM_REQUEST, LogCategory.LLM_RESPONSE, LogCategory.LLM_ERROR, LogCategory.LLM_TOKEN,
        LogCategory.VALIDATION_SUCCESS, LogCategory.VALIDATION_FAILURE, LogCategory.VALIDATION_DETAIL, LogCategory.VALIDATION_DIFF,
        LogCategory.PERF_TIMING, LogCategory.PERF_MEMORY, LogCategory.PERF_COST,
        LogCategory.SESSION_CREATE, LogCategory.SESSION_UPDATE, LogCategory.SESSION_METRICS
      ];
      
      for (const cat of allCategories) {
        if (categoryManager.isEnabled(cat)) {
          this.context.categories.add(cat);
        }
      }
      
      // Apply other settings
      this.context.config = { ...preset };
      this.context.preset = presetName;
    } catch {
      // If preset doesn't exist, just continue
      console.warn(`Preset ${presetName} not found`);
    }
  }
  
  /**
   * Build final configuration
   */
  private buildConfiguration(): LoggingConfig {
    // Calculate categories bitmask
    let categories = 0; // Start with no categories
    for (const cat of this.context.categories) {
      categories |= cat;
    }
    
    return {
      categories,
      ...this.context.config,
    } as LoggingConfig;
  }
  
  /**
   * Review and confirm configuration
   */
  private async reviewConfiguration(config: LoggingConfig): Promise<void> {
    console.log(chalk.bold.green('\n✅ Configuration Summary:\n'));
    
    // Display categories
    const categoryManager = new CategoryManager(config.categories);
    const summary = categoryManager.getSummary();
    console.log(chalk.cyan('Enabled Categories:'));
    for (const cat of summary.enabledCategories) {
      console.log(`  • ${cat}`);
    }
    
    // Display output settings
    console.log(chalk.cyan('\nOutput Settings:'));
    console.log(`  • Console: ${config.output?.console ? 'Yes' : 'No'}`);
    console.log(`  • JSONL Files: ${config.output?.jsonl ? 'Yes' : 'No'}`);
    if (config.output?.jsonl) {
      console.log(`    - Directory: ${config.output.logsDirectory}`);
      console.log(`    - Max Size: ${(config.output.maxFileSize! / 1048576).toFixed(1)}MB`);
      console.log(`    - Max Files: ${config.output.maxFiles}`);
    }
    
    // Display privacy settings
    console.log(chalk.cyan('\nPrivacy Settings:'));
    // Privacy level display - removed since 'level' is not part of privacy config
    console.log(`  • Masking: ${config.privacy?.maskSensitiveData ? 'Enabled' : 'Disabled'}`);
    
    // Display performance settings
    console.log(chalk.cyan('\nPerformance Settings:'));
    console.log(`  • Tracking: ${config.performance?.trackMetrics ? 'Enabled' : 'Disabled'}`);
    if (config.performance?.trackMetrics) {
      console.log(`    - Slow Threshold: ${config.performance.slowThreshold}ms`);
      console.log(`    - Metrics Interval: ${config.performance.metricsInterval}ms`);
    }
    
    const proceed = await confirm({
      message: '\nApply this configuration?',
      default: true,
    });
    
    if (!proceed) {
      throw new Error('Configuration cancelled by user');
    }
  }
  
  /**
   * Get display name for a category
   */
  private getCategoryDisplayName(category: LogCategory): string {
    const names: Partial<Record<LogCategory, string>> = {
      [LogCategory.ERROR]: '❌ Errors',
      [LogCategory.WARN]: '⚠️  Warnings',
      [LogCategory.INFO]: 'ℹ️  Information',
      [LogCategory.DEBUG]: '🐛 Debug',
      [LogCategory.VALIDATION_SUCCESS]: '✅ Validation Success',
      [LogCategory.VALIDATION_FAILURE]: '❌ Validation Failures',
      [LogCategory.VALIDATION_DETAIL]: '📋 Validation Details',
      [LogCategory.VALIDATION_DIFF]: '🔄 Validation Diffs',
      [LogCategory.LLM_REQUEST]: '📤 LLM Requests',
      [LogCategory.LLM_RESPONSE]: '📥 LLM Responses',
      [LogCategory.LLM_ERROR]: '❌ LLM Errors',
      [LogCategory.LLM_TOKEN]: '🪙 Token Usage',
      [LogCategory.PERF_TIMING]: '⏱️ Performance Timing',
      [LogCategory.PERF_MEMORY]: '💾 Memory Usage',
      [LogCategory.PERF_COST]: '💰 Cost Tracking',
      [LogCategory.SESSION_CREATE]: '🆕 Session Creation',
      [LogCategory.SESSION_UPDATE]: '🔄 Session Updates',
      [LogCategory.SESSION_METRICS]: '📊 Session Metrics',
    };
    
    return names[category] ?? `Category ${category}`;
  }
  
  /**
   * Export configuration to file
   */
  async exportConfiguration(config: LoggingConfig, filepath: string): Promise<void> {
    const { promises: fs } = await import('fs');
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(filepath, content, 'utf-8');
    console.log(chalk.green(`✅ Configuration exported to ${filepath}`));
  }
  
  /**
   * Import configuration from file
   */
  async importConfiguration(filepath: string): Promise<LoggingConfig> {
    const { promises: fs } = await import('fs');
    const content = await fs.readFile(filepath, 'utf-8');
    const config = JSON.parse(content) as LoggingConfig;
    
    // Validate the imported configuration
    if (typeof config.categories !== 'number') {
      throw new Error('Invalid configuration: categories must be a number');
    }
    
    return config;
  }
}

/**
 * Factory function to create and run the wizard
 */
export async function runConfigurationWizard(): Promise<LoggingConfig> {
  const builder = new InteractiveConfigBuilder();
  return await builder.runWizard();
}

/**
 * Apply configuration to a resolver
 */
export function applyConfiguration(
  resolver: ConfigResolver,
  config: LoggingConfig
): void {
  resolver.setGlobalConfig(config.categories, {
    formatting: config.formatting,
    output: config.output,
    privacy: config.privacy,
    performance: config.performance,
  });
}

/**
 * CLI command handler for interactive configuration
 */
export async function configureLoggingInteractive(
  options: {
    export?: string;
    import?: string;
    apply?: boolean;
  } = {}
): Promise<void> {
  try {
    let config: LoggingConfig;
    
    if (options.import) {
      // Import existing configuration
      const builder = new InteractiveConfigBuilder();
      config = await builder.importConfiguration(options.import);
      console.log(chalk.green('✅ Configuration imported successfully'));
    } else {
      // Run interactive wizard
      config = await runConfigurationWizard();
    }
    
    // Export if requested
    if (options.export) {
      const builder = new InteractiveConfigBuilder();
      await builder.exportConfiguration(config, options.export);
    }
    
    // Apply if requested
    if (options.apply) {
      const { getGlobalConfigResolver } = await import('./config-resolver.js');
      const resolver = getGlobalConfigResolver();
      applyConfiguration(resolver, config);
      console.log(chalk.green('✅ Configuration applied to global resolver'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Configuration failed:'), error);
    process.exit(1);
  }
}