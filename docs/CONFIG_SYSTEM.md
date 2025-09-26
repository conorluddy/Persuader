# Persuader Configuration System

A comprehensive, high-performance configuration system for Persuader that supports file-based configuration with inheritance, environment variable interpolation, multi-format parsing, and intelligent caching.

## 🚀 Quick Start

### Basic Usage

```typescript
import { initializePersuaderConfig } from './src/utils/config/init.js';

// Initialize the configuration system
const { resolver, hasFileConfig } = await initializePersuaderConfig();

if (hasFileConfig) {
  console.log('✅ Configuration loaded from .persuader file');
} else {
  console.log('ℹ️ Using default configuration');
}
```

### Create Your First Config File

Create a `.persuader` file in your project root:

```json
{
  "version": "1.0",
  "logging": {
    "preset": "LOCAL_DEV",
    "colors": true,
    "timestamp": true,
    "jsonl": {
      "enabled": true,
      "directory": "./logs"
    }
  }
}
```

## 📁 Configuration File Discovery

The system automatically discovers configuration files using intelligent traversal:

### Supported Formats & Filenames

| Priority | Filename | Format | Use Case |
|----------|----------|--------|----------|
| 1 | `.persuader` | JSON | Primary config file |
| 2 | `.persuader.json` | JSON | Explicit JSON format |
| 3 | `.persuader.yaml` | YAML | Human-readable format |
| 4 | `.persuader.js` | JavaScript | Dynamic configuration |
| 5 | `.persuader.ts` | TypeScript | Type-safe configuration |

### Discovery Process

1. **Current Directory**: Checks for config files in the current working directory
2. **Parent Traversal**: Walks up the directory tree until finding a config or hitting boundaries
3. **Package Boundaries**: Stops at `package.json` files (configurable)
4. **Explicit Paths**: Supports direct file path specification

```typescript
import { discoverConfigFile } from './src/utils/config/file-discovery.js';

const result = await discoverConfigFile({
  startDir: './my-project',
  stopAtPackageJson: true,
  maxTraversalDepth: 10
});

console.log(`Found config: ${result.configPath}`);
console.log(`Format: ${result.format}`);
```

## 🏗️ Configuration Schema

The configuration system uses Zod schemas for validation and type safety.

### Core Configuration Structure

```typescript
interface PersuaderConfig {
  version: string;                    // Config version
  $schema?: string;                   // JSON Schema reference
  extends?: string | string[];        // Configuration inheritance
  logging?: LoggingConfig;           // Logging configuration
  provider?: ProviderConfig;         // LLM provider settings
  environments?: Record<string, EnvironmentConfig>;  // Environment overrides
  pipelines?: Record<string, PipelineConfig>;        // Pipeline-specific settings
}
```

### Logging Configuration

```typescript
interface LoggingConfig {
  preset?: LoggingPreset;           // Predefined logging level
  colors?: boolean;                 // Enable colored output
  timestamp?: boolean;              // Include timestamps
  prefix?: string;                  // Log message prefix
  maxPromptLength?: number;         // Truncate long prompts
  maxResponseLength?: number;       // Truncate long responses
  jsonl?: JsonlConfig;             // JSONL file logging
  privacy?: PrivacyConfig;         // Privacy and masking
  performance?: PerformanceConfig; // Performance tracking
  categories?: CategoryConfig;      // Category-based logging
}
```

### Logging Presets

| Preset | Description | Use Case |
|--------|-------------|----------|
| `LOCAL_DEV` | Full logging with colors | Local development |
| `DEBUG_FULL` | Maximum verbosity | Debugging issues |
| `LLM_DEBUG` | Focus on LLM interactions | Model debugging |
| `PRODUCTION` | Production-safe logging | Live systems |
| `PROD_OBSERVABILITY` | Detailed production metrics | Monitoring |
| `PROD_MINIMAL` | Minimal production logging | High-performance systems |
| `GDPR_COMPLIANT` | Privacy-focused logging | GDPR compliance |
| `SECURITY_AUDIT` | Security-focused logging | Audit trails |
| `PERFORMANCE_FOCUS` | Performance metrics only | Performance tuning |
| `TOKEN_MONITORING` | Token usage tracking | Cost monitoring |
| `TEST_RUNNER` | Test-appropriate logging | Automated testing |
| `CI_PIPELINE` | CI/CD pipeline logging | Build systems |

## 🔗 Configuration Inheritance

Support for powerful configuration composition through inheritance.

### Single Inheritance

```json
{
  "version": "1.0",
  "extends": "base-config",
  "logging": {
    "colors": false
  }
}
```

### Multiple Inheritance

```json
{
  "version": "1.0", 
  "extends": ["logging-config", "provider-config", "performance-config"],
  "logging": {
    "timestamp": true
  }
}
```

### Inheritance Chain Resolution

```typescript
import { ConfigInheritanceResolver } from './src/utils/config/inheritance.js';

const resolver = new ConfigInheritanceResolver();

// Register base configurations
resolver.registerBaseConfig('base', {
  version: '1.0',
  logging: { preset: 'LOCAL_DEV' }
});

// Resolve inheritance
const chain = await resolver.resolveInheritance({
  version: '1.0',
  extends: 'base',
  logging: { colors: true }
});

console.log('Final config:', chain.finalConfig);
console.log('Inheritance chain:', chain.chain);
console.log('Conflicts:', chain.conflicts);
```

## 🌍 Environment Variable Interpolation

Powerful environment variable substitution with security controls.

### Basic Interpolation

```json
{
  "version": "1.0",
  "provider": {
    "apiKey": "${OPENAI_API_KEY}",
    "baseUrl": "${API_BASE_URL:-https://api.openai.com/v1}",
    "timeout": "${REQUEST_TIMEOUT:-30s}"
  }
}
```

### Advanced Interpolation Features

- **Default Values**: `${VAR_NAME:-default_value}`
- **Nested Interpolation**: `${DB_HOST_${ENVIRONMENT}}`
- **Type Coercion**: Automatic conversion to boolean/number
- **Security Controls**: Variable allowlists/blocklists

```typescript
import { 
  EnvironmentInterpolator,
  createSecureInterpolator 
} from './src/utils/config/interpolation.js';

// Custom interpolator with security controls
const secureInterpolator = createSecureInterpolator();

const result = secureInterpolator.interpolateObject({
  apiKey: '${API_KEY}',      // Allowed
  secret: '${SECRET_KEY}'    // Blocked by security rules
});
```

## 📊 Performance Optimizations

High-performance configuration loading with intelligent caching.

### Caching System

- **File Hash-Based Cache Invalidation**: Only reloads when files actually change
- **LRU Eviction**: Intelligent cache management (max 50 entries)
- **Performance Metrics**: Comprehensive tracking of cache efficiency
- **Concurrent Operation Safety**: Thread-safe cache operations

```typescript
import { 
  getConfigCacheStats,
  getEnhancedConfigCacheStats,
  clearConfigCache 
} from './src/utils/config/loader.js';

// Check cache performance
const stats = getEnhancedConfigCacheStats();
console.log(`Cache hit rate: ${stats.analysis.efficiency}%`);
console.log(`Recommended cache size: ${stats.analysis.recommendedCacheSize}`);

// Enhanced statistics with performance analysis
const enhanced = getEnhancedConfigCacheStats();
console.log('Most accessed configs:', enhanced.analysis.mostAccessedEntries);
```

### Batch Operations

```typescript
import { preloadConfig } from './src/utils/config/loader.js';

// Preload multiple configurations for better performance
const result = await preloadConfig([
  '/project1/.persuader',
  '/project2/.persuader',  
  '/project3/.persuader'
]);

console.log(`Loaded ${result.loaded} configs in ${result.totalTime}ms`);
console.log(`Average time per config: ${result.averageTime}ms`);
console.log(`Cache hits: ${result.fromCache}`);
```

### File Watching

```typescript
import { watchConfigFile } from './src/utils/config/loader.js';

// Watch for configuration changes
const stopWatching = await watchConfigFile(
  '/path/to/.persuader',
  (newConfig) => {
    console.log('Configuration updated:', newConfig);
    // Reconfigure your application
  }
);

// Stop watching when done
stopWatching();
```

## 🏢 Environment & Pipeline Configuration

Support for environment-specific and pipeline-specific overrides.

### Environment Configuration

```json
{
  "version": "1.0",
  "logging": {
    "preset": "LOCAL_DEV"
  },
  "environments": {
    "production": {
      "logging": {
        "preset": "PRODUCTION",
        "privacy": {
          "level": "strict"
        }
      }
    },
    "development": {
      "logging": {
        "preset": "DEBUG_FULL"
      }
    }
  }
}
```

### Pipeline Configuration

```json
{
  "version": "1.0",
  "pipelines": {
    "data-processing": {
      "logging": {
        "preset": "PERFORMANCE_FOCUS",
        "performance": {
          "enabled": true,
          "slowThreshold": "5s"
        }
      }
    },
    "user-interaction": {
      "logging": {
        "preset": "LLM_DEBUG"
      }
    }
  }
}
```

### Loading Environment/Pipeline Configs

```typescript
import { 
  loadEnvironmentConfig,
  loadPipelineConfig 
} from './src/utils/config/loader.js';

// Load environment-specific configuration
const prodConfig = await loadEnvironmentConfig('production');

// Load pipeline-specific configuration  
const dataConfig = await loadPipelineConfig('data-processing');
```

## 🔧 Integration with Existing Systems

Seamless integration with the existing ConfigResolver system.

### Enhanced ConfigResolver

The system extends the existing `ConfigResolver` with `.persuader` file support:

```typescript
import { 
  initializeGlobalConfigResolver,
  getGlobalEnhancedConfigResolver,
  migrateToEnhancedResolver
} from './src/utils/config/config-resolver-integration.js';

// Initialize enhanced resolver
const resolver = initializeGlobalConfigResolver({
  environment: 'production',
  pipeline: 'data-processing',
  initialCategories: CategoryPresets.PRODUCTION
});

// Migrate existing code
migrateToEnhancedResolver();
```

### 4-Layer Configuration Cascade

1. **📄 .persuader File Configuration** - File-based defaults and overrides
2. **🌍 Global Configuration** - Programmatic global settings
3. **🎯 Session Configuration** - Session-specific overrides
4. **📨 Request Configuration** - Individual request settings

## 🛠️ Development Tools

### Environment-Specific Initialization

```typescript
import { 
  initializeForDevelopment,
  initializeForProduction,
  initializeForTesting
} from './src/utils/config/init.js';

// Development setup
const devResolver = await initializeForDevelopment('my-pipeline');

// Production setup  
const prodResolver = await initializeForProduction('data-pipeline');

// Test setup (silent, minimal logging)
const testResolver = await initializeForTesting();
```

### Configuration Status & Health

```typescript
import { 
  isConfigSystemInitialized,
  getConfigSystemStatus 
} from './src/utils/config/init.js';

// Check if system is ready
if (isConfigSystemInitialized()) {
  const status = getConfigSystemStatus();
  
  console.log(`Initialized: ${status.initialized}`);
  console.log(`Has file config: ${status.hasFileConfig}`);
  console.log(`Environment: ${status.environment}`);
  console.log(`Config age: ${status.configAge}ms`);
}
```

## 📈 Performance Monitoring

Comprehensive performance tracking and analysis.

### Performance Metrics

```typescript
import { 
  getConfigPerformanceMetrics,
  resetConfigPerformanceMetrics 
} from './src/utils/config/loader.js';

const metrics = getConfigPerformanceMetrics();

console.log('Performance Summary:');
console.log(`Total operations: ${metrics.totalOperations}`);
console.log(`Average load time: ${metrics.averageLoadTime}ms`);
console.log(`Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
console.log(`File reads: ${metrics.fileReadCount}`);
console.log(`Validations: ${metrics.validationCount}`);
console.log(`Errors: ${metrics.errorCount}`);
```

### Cache Analysis

```typescript
import { getCacheStats } from './src/utils/config/performance.js';

const cacheStats = getCacheStats();
console.log(`File hash cache: ${cacheStats.fileHashes} entries`);
console.log(`Validation cache: ${cacheStats.validations} entries`);  
console.log(`Memory usage: ${cacheStats.memoryUsage}`);
```

## 🔒 Security Features

Built-in security controls for environment variable handling and configuration validation.

### Environment Variable Security

```typescript
import { createSecureInterpolator } from './src/utils/config/interpolation.js';

const secureInterpolator = createSecureInterpolator();

// Automatically blocks common sensitive variable patterns:
// - Anything with "SECRET", "PASSWORD", "TOKEN", "KEY"
// - Variables starting with underscores
// - System environment variables
```

### Privacy Controls

```json
{
  "version": "1.0",
  "logging": {
    "privacy": {
      "level": "strict",
      "customPatterns": ["credit_card_\\d+", "ssn_\\d+"],
      "redactedFields": ["password", "token", "apiKey"]
    }
  }
}
```

## 🚨 Error Handling

Comprehensive error handling with actionable error messages.

### Validation Errors

```typescript
import { validateConfig } from './src/utils/config/schema.js';

const result = validateConfig({
  version: '1.0',
  logging: {
    preset: 'INVALID_PRESET'  // This will fail validation
  }
});

if (!result.valid) {
  console.log('Validation errors:');
  result.errors.forEach(error => {
    console.log(`- ${error}`);
  });
}
```

### File Discovery Errors

```typescript
import { validateConfigPath } from './src/utils/config/file-discovery.js';

const validation = await validateConfigPath('./config.json');

if (!validation.valid) {
  console.log(`Config file error: ${validation.error}`);
  console.log(`Path exists: ${validation.exists}`);
  console.log(`Is readable: ${validation.readable}`);
}
```

## 🔧 Advanced Configuration

### Custom Configuration Formats

The system supports custom parsing through the enhanced parser system:

```typescript
import { parseConfigFile } from './src/utils/config/parser.js';

const result = await parseConfigFile('./config.js', {
  allowExecution: true,      // Enable JavaScript execution
  useEnhancedParsers: true,  // Use enhanced parsing features
  validate: true,            // Validate against schema
  includeRawContent: true    // Include original file content
});

console.log('Parsed config:', result.config);
console.log('Parse metadata:', result.metadata);
```

### Inheritance Conflict Resolution

```typescript
import { analyzeInheritanceConflicts } from './src/utils/config/inheritance.js';

const configs = [
  { id: 'base', config: { logging: { preset: 'LOCAL_DEV' } } },
  { id: 'override', config: { logging: { preset: 'PRODUCTION' } } }
];

const conflicts = analyzeInheritanceConflicts(configs);

conflicts.forEach(conflict => {
  console.log(`Conflict at ${conflict.path}:`);
  console.log(`Values: ${conflict.values.join(' vs ')}`);
  console.log(`Resolution: Uses last value (${conflict.values[conflict.values.length - 1]})`);
});
```

## 📚 API Reference

### Core Functions

- `initializePersuaderConfig(options?)` - Initialize the configuration system
- `loadConfig(options?)` - Load configuration with full feature support  
- `discoverConfigFile(options?)` - Discover configuration files
- `validateConfig(config)` - Validate configuration against schema
- `parseConfigFile(path, options?)` - Parse configuration files

### Performance Functions

- `preloadConfig(paths?)` - Batch preload configurations
- `watchConfigFile(path, callback)` - Watch for configuration changes
- `getConfigCacheStats()` - Get cache performance statistics
- `clearConfigCache()` - Clear configuration cache

### Integration Functions  

- `getGlobalEnhancedConfigResolver()` - Get the enhanced resolver
- `migrateToEnhancedResolver()` - Migrate to enhanced configuration
- `createEnvironmentSessionLogging()` - Create environment-aware logging
- `createPipelineSessionLogging()` - Create pipeline-aware logging

## 🛠️ Troubleshooting

### Common Issues

**Config file not found**
```bash
# Check file discovery process
const result = await discoverConfigFile({ startDir: './my-project' });
console.log('Searched paths:', result.searchedPaths);
```

**Environment variable not interpolating**
```typescript
// Check interpolation patterns
import { analyzeInterpolationPatterns } from './src/utils/config/interpolation.js';

const analysis = analyzeInterpolationPatterns(yourConfig);
console.log('Found variables:', analysis.variables);
console.log('Patterns without defaults:', analysis.withoutDefaults);
```

**Poor cache performance**
```typescript
const stats = getEnhancedConfigCacheStats();
console.log(`Current hit rate: ${stats.analysis.efficiency}%`);
console.log(`Recommended cache size: ${stats.analysis.recommendedCacheSize}`);

// Clear cache if needed
if (stats.analysis.efficiency < 50) {
  clearConfigCache();
}
```

**Configuration validation errors**
```typescript
// Get detailed validation information
const validation = validateConfig(yourConfig);
if (!validation.valid) {
  console.log('Detailed errors:', validation.errors);
  console.log('Schema description available for debugging');
}
```

## 🔗 Example Configurations

### Complete Development Configuration

```json
{
  "version": "1.0",
  "extends": ["base-logging", "base-provider"],
  "logging": {
    "preset": "LOCAL_DEV",
    "colors": true,
    "timestamp": true,
    "prefix": "MyApp",
    "maxPromptLength": 1000,
    "jsonl": {
      "enabled": true,
      "directory": "./logs/dev",
      "maxFileSize": "10MB",
      "maxFiles": 5
    },
    "performance": {
      "enabled": true,
      "slowThreshold": "5s"
    }
  },
  "provider": {
    "name": "openai",
    "apiKey": "${OPENAI_API_KEY}",
    "baseUrl": "${OPENAI_BASE_URL:-https://api.openai.com/v1}",
    "timeout": "30s",
    "retryAttempts": 3
  },
  "environments": {
    "production": {
      "logging": {
        "preset": "PRODUCTION",
        "colors": false,
        "privacy": {
          "level": "strict"
        },
        "jsonl": {
          "directory": "./logs/prod"
        }
      }
    }
  },
  "pipelines": {
    "data-processing": {
      "logging": {
        "preset": "PERFORMANCE_FOCUS",
        "performance": {
          "sampleRate": 0.1
        }
      }
    }
  }
}
```

---

## 🎉 Summary

The Persuader Configuration System provides:

✅ **Intelligent File Discovery** - Automatic config file location with priority-based selection  
✅ **Multi-Format Support** - JSON, YAML, JavaScript, TypeScript with enhanced parsing  
✅ **Powerful Inheritance** - Single and multiple inheritance with conflict resolution  
✅ **Environment Interpolation** - Secure variable substitution with defaults and validation  
✅ **High Performance** - Intelligent caching with LRU eviction and performance monitoring  
✅ **Comprehensive Integration** - Seamless integration with existing ConfigResolver system  
✅ **Production Ready** - Extensive testing, error handling, and security controls

Perfect for applications requiring flexible, high-performance configuration management with developer-friendly features and production-grade reliability.