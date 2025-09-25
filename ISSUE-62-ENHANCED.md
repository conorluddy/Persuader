# 🎯 .persuader Configuration File Support - Epic

## Overview
**Problem Statement**: The Persuader logging system currently requires programmatic configuration or CLI arguments, making it difficult to maintain consistency across teams, environments, and deployment scenarios. Teams need a declarative, version-controlled configuration solution that leverages the existing sophisticated 3-layer configuration cascade system.

**Solution Overview**: Implement comprehensive .persuader configuration file support that integrates seamlessly with the existing ConfigResolver architecture, providing zero-code configuration management while maintaining backward compatibility and supporting runtime overrides.

**Success Metrics**: 
- Zero breaking changes to existing API
- Configuration discovery time <50ms
- Support for 100% of existing LoggingConfig options
- Team adoption rate >80% within 3 months

## Repository Context
**Tech Stack**: TypeScript, Zod validation, Node.js 20+, ESM modules
**Related Components**: 
- `src/utils/logging/config-resolver.ts` - 3-layer configuration cascade
- `src/utils/logging/presets.ts` - 30+ category presets
- `src/utils/schema-loader.ts` - Dynamic file loading patterns
- `src/cli/commands/run.ts` - CLI initialization point

**Architectural Patterns**: 
- Zod schema validation throughout
- Modular architecture with focused modules (<300 lines)
- Strong TypeScript typing with strict mode
- Comprehensive error handling with actionable messages

**Integration Points**:
- Global configuration layer in ConfigResolver
- CLI initialization in run command
- Session and request config creation
- Preset system with environment detection

## Implementation Phases

### Phase 1: Core Configuration File Support
**Estimated Time**: 5 days
**Child Issue**: #[number] - Implement .persuader file discovery and parsing
**Dependencies**: None
**Deliverables**: 
- Configuration file discovery mechanism
- Multi-format parser (.json, .js, .ts, .yaml)
- Zod schema for configuration validation
- Integration with ConfigResolver global layer

### Phase 2: Advanced Features & DX
**Estimated Time**: 4 days  
**Child Issue**: #[number] - Enhanced configuration features and tooling
**Dependencies**: Phase 1 completion
**Deliverables**: 
- Schema autocompletion support
- Configuration inheritance and extends
- Environment variable interpolation
- Config validation CLI command

### Phase 3: Runtime Integration & Performance
**Estimated Time**: 3 days
**Child Issue**: #[number] - Optimize configuration loading and caching
**Dependencies**: Phase 2 completion
**Deliverables**: 
- Configuration caching system
- File watching for hot reload
- Performance optimizations
- Migration utilities for existing users

## Cross-Phase Considerations

### Configuration File Schema
```typescript
// .persuader.schema.ts
import { z } from 'zod';
import type { LoggingConfig } from './src/utils/logging/config-resolver';

export const PersuaderConfigSchema = z.object({
  // Version for forward compatibility
  version: z.literal('1.0.0'),
  
  // Inherit from other config files
  extends: z.union([
    z.string(), // Path to another config
    z.array(z.string()) // Multiple configs to merge
  ]).optional(),
  
  // Environment-specific overrides
  env: z.record(z.string(), z.lazy(() => PersuaderConfigCore)).optional(),
  
  // Core configuration matching LoggingConfig
  logging: z.object({
    // Category configuration with preset support
    categories: z.union([
      z.number(), // Raw bitmask
      z.array(z.string()), // Array of category names
      z.object({
        preset: z.string(), // Named preset
        add: z.array(z.string()).optional(),
        remove: z.array(z.string()).optional()
      })
    ]).optional(),
    
    // Formatting configuration
    formatting: z.object({
      colors: z.boolean().optional(),
      timestamp: z.boolean().optional(),
      prefix: z.string().optional(),
      maxPromptLength: z.number().min(0).optional(),
      maxResponseLength: z.number().min(0).optional()
    }).optional(),
    
    // Output configuration
    output: z.object({
      console: z.boolean().optional(),
      jsonl: z.boolean().optional(),
      logsDirectory: z.string().optional(),
      maxFileSize: z.number().min(1024).optional(),
      maxFiles: z.number().min(1).optional()
    }).optional(),
    
    // Privacy configuration
    privacy: z.object({
      maskSensitiveData: z.boolean().optional(),
      level: z.enum(['OFF', 'STANDARD', 'STRICT', 'PARANOID']).optional(),
      sensitivePatterns: z.array(z.string()).optional(), // Regex patterns as strings
      redactFields: z.array(z.string()).optional()
    }).optional(),
    
    // Performance configuration
    performance: z.object({
      trackMetrics: z.boolean().optional(),
      metricsInterval: z.number().min(1000).optional(),
      slowThreshold: z.number().min(100).optional(),
      sampleRate: z.number().min(0).max(1).optional()
    }).optional()
  }),
  
  // Provider-specific configuration
  providers: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  
  // Session defaults
  session: z.object({
    defaultTimeout: z.number().optional(),
    persistSessions: z.boolean().optional(),
    sessionDirectory: z.string().optional()
  }).optional()
});
```

### File Discovery Algorithm
```typescript
// src/utils/logging/config-discovery.ts
export async function discoverConfig(
  startPath: string = process.cwd(),
  options?: DiscoveryOptions
): Promise<ConfigFile | null> {
  const searchPaths = [
    '.persuader', '.persuader.json', '.persuader.js', '.persuader.ts',
    '.persuader.yaml', '.persuader.yml', '.persuader.config.js',
    'persuader.config.js', 'persuader.config.ts'
  ];
  
  // Search order:
  // 1. Current directory
  // 2. Parent directories up to root
  // 3. Home directory ~/.persuader
  // 4. Global config /etc/persuader
  
  // Implementation leverages existing file-io.ts patterns
}
```

### Integration with ConfigResolver
```typescript
// Enhanced src/utils/logging/config-resolver.ts
export class ConfigResolver {
  private fileConfig?: ConfigLayer; // New layer
  
  constructor(initialCategories?: number) {
    // Load file configuration if available
    this.loadFileConfig();
    
    // Existing initialization...
  }
  
  private async loadFileConfig(): Promise<void> {
    const config = await discoverConfig();
    if (config) {
      this.fileConfig = {
        id: 'file',
        name: 'File Configuration',
        priority: -5, // Lower than global
        categories: this.parseCategories(config.logging?.categories),
        metadata: config,
        createdAt: new Date()
      };
    }
  }
  
  getEffectiveCategories(): number {
    let categories = this.fileConfig?.categories ?? 0;
    categories = this.mergeCategories(categories, this.globalConfig.categories);
    // Rest of existing cascade...
  }
}
```

### Testing Strategy
- Unit tests for config discovery and parsing
- Integration tests with ConfigResolver
- Performance benchmarks for config loading
- Environment-specific preset tests
- Migration path validation tests

### Documentation Updates
- Configuration file format reference
- Migration guide from programmatic config
- Best practices for team configuration
- Environment-specific configuration examples
- Troubleshooting guide

## Technical Specification

### Files to Modify/Create

#### Phase 1: Core Implementation
- `src/utils/logging/config-discovery.ts` - Config file discovery logic
- `src/utils/logging/config-parser.ts` - Multi-format parsing
- `src/utils/logging/config-schema.ts` - Zod schema definitions
- `src/utils/logging/config-loader.ts` - Integration orchestrator
- `src/utils/logging/config-resolver.ts` - Add file config layer
- `src/types/config.ts` - TypeScript interfaces

#### Phase 2: Advanced Features
- `src/utils/logging/config-inheritance.ts` - Extends functionality
- `src/utils/logging/config-interpolation.ts` - Environment variables
- `src/cli/commands/config.ts` - New CLI command
- `src/utils/logging/config-validator.ts` - Validation utilities

#### Phase 3: Performance & Integration
- `src/utils/logging/config-cache.ts` - Caching layer
- `src/utils/logging/config-watcher.ts` - File watching
- `src/utils/logging/config-migration.ts` - Migration utilities
- `src/cli/utilities/config-generator.ts` - Config generation

### Performance Considerations
```typescript
interface ConfigCacheStrategy {
  // Cache discovered config paths
  discoveryCache: Map<string, string>;
  
  // Cache parsed configurations
  parseCache: Map<string, ParsedConfig>;
  
  // TTL for cache entries
  ttl: number;
  
  // File watching for invalidation
  watchedFiles: Set<string>;
}
```

### Security Considerations
- Validate all config files against schema
- Sanitize regex patterns in privacy settings
- Prevent directory traversal in extends paths
- Validate file permissions for config files
- Log config loading for audit trail

### Migration Path
```typescript
// Auto-migration utility
export async function migrateToConfigFile(
  options: MigrationOptions
): Promise<void> {
  // 1. Analyze existing code for config patterns
  // 2. Generate .persuader file with discovered settings
  // 3. Validate generated config
  // 4. Create backup of existing code
  // 5. Update code to use config file
}
```

## Acceptance Criteria
- [ ] Config files discovered in <50ms average
- [ ] All LoggingConfig options supported
- [ ] Environment-specific overrides functional
- [ ] Extends/inheritance system working
- [ ] CLI integration complete with helpful errors
- [ ] File watching and hot reload operational
- [ ] Migration tool successfully converts 95%+ of existing configs
- [ ] TypeScript autocompletion working in VSCode
- [ ] Performance impact <5% on startup time
- [ ] 100% backward compatibility maintained

## Implementation Guidance (Agent-Friendly)

### Patterns to Follow
- Use existing schema-loader.ts for dynamic file loading
- Follow config-resolver.ts cascade pattern
- Leverage presets.ts for named configuration sets
- Use file-io.ts patterns for robust file operations

### Utilities to Use
- `fastGlob` for config file discovery
- `Zod` for schema validation
- `chokidar` for file watching
- Existing `SchemaLoader` for .ts/.js configs

### Components to Extend
- `ConfigResolver` class for file config layer
- `LoggingConfig` interface for new options
- CLI command structure for config command

### Testing Approach
```typescript
describe('Configuration File Support', () => {
  describe('Discovery', () => {
    test('finds config in current directory');
    test('searches parent directories');
    test('respects discovery options');
    test('handles missing configs gracefully');
  });
  
  describe('Parsing', () => {
    test('parses JSON configs');
    test('loads JavaScript modules');
    test('compiles TypeScript configs');
    test('handles YAML format');
  });
  
  describe('Integration', () => {
    test('integrates with ConfigResolver');
    test('respects cascade priority');
    test('allows runtime overrides');
  });
});
```

## Edge Cases & Error Handling
- **Circular extends**: Detect and error with dependency chain
- **Invalid regex patterns**: Validate and provide fix suggestions
- **Missing preset names**: Suggest similar presets using fuzzy matching
- **Permission errors**: Clear error with permission requirements
- **Syntax errors in JS/TS**: Show location and suggestion
- **Schema version mismatch**: Migration prompt or compatibility mode

## Definition of Done (Epic)
- [ ] All 3 phases completed and tested
- [ ] Documentation comprehensive and reviewed
- [ ] Performance benchmarks passing
- [ ] Security review completed
- [ ] Migration tool tested on real projects
- [ ] No breaking changes to existing API
- [ ] Team onboarding materials created
- [ ] Config examples for all presets
- [ ] VSCode extension for config IntelliSense (stretch goal)