# Logging System Migration Guide

## Overview

The Persuader logging system has been upgraded to a powerful category-based architecture with enhanced features for performance monitoring, privacy protection, and multi-level configuration. This guide helps you migrate from the traditional level-based logging to the new system.

## Key Benefits of the New System

- **🎯 Category-Based Filtering**: Fine-grained control over what gets logged
- **🔒 Privacy Protection**: Built-in sensitive data masking
- **📊 Performance Monitoring**: Automatic metrics collection and analysis
- **🎚️ Multi-Level Configuration**: Global, session, and request-scoped settings
- **📁 Smart File Rotation**: Automatic JSONL rotation with compression
- **🧹 Auto-Cleanup**: 7-day retention policy with configurable cleanup
- **⚡ Zero Breaking Changes**: Full backward compatibility maintained

## Migration Path

### Phase 1: No Changes Required (Backward Compatible)

The new system maintains 100% backward compatibility. Your existing code continues to work:

```typescript
// This still works exactly as before
import { createLogger, info, error, debug } from 'persuader/utils/logger';

const logger = createLogger({ level: 'debug' });
logger.info('Application started');
```

### Phase 2: Gradual Adoption of New Features

Start using new features without breaking existing code:

```typescript
// Enable privacy protection
import { PrivacyLevel, setGlobalPrivacyFilter } from 'persuader/utils/logging/privacy-filter';

setGlobalPrivacyFilter(new PrivacyFilter({ 
  level: PrivacyLevel.STANDARD 
}));

// Enable performance monitoring
import { getGlobalPerformanceMonitor } from 'persuader/utils/logging/performance-monitor';

const monitor = getGlobalPerformanceMonitor();
const timerId = monitor.startOperation('api-call');
// ... perform operation ...
monitor.endOperation(timerId);
```

### Phase 3: Adopt Category-Based Logging

Transition to the more powerful category system:

```typescript
// Old way (still supported)
logger.setLevel('debug');

// New way - more granular control
import { CategoryManager, LogCategory } from 'persuader/utils/category-manager';

const categoryManager = new CategoryManager();
categoryManager.enable(
  LogCategory.ERROR,
  LogCategory.LLM_REQUEST,
  LogCategory.VALIDATION_FAILURE
);
```

### Phase 4: Use Presets for Common Scenarios

Leverage built-in presets for different environments:

```typescript
import { getPreset, selectPresetFromEnvironment } from 'persuader/utils/logging/presets';

// Automatic environment detection
const preset = selectPresetFromEnvironment();

// Or use specific presets
const devConfig = getPreset('LOCAL_DEV');
const prodConfig = getPreset('PRODUCTION');
```

## Feature Comparison

| Feature | Old System | New System |
|---------|-----------|------------|
| Log Levels | ✅ 6 levels | ✅ Supported + 30+ categories |
| Filtering | By level only | By category, session, request |
| Privacy | Manual | Automatic masking |
| Performance | Manual timing | Automatic monitoring |
| File Output | Basic JSONL | Rotation + compression |
| Configuration | Single global | 3-layer cascade |
| Cleanup | Manual | Automatic 7-day policy |

## Common Migration Scenarios

### Scenario 1: Development to Production

```typescript
// Old approach
const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
});

// New approach
import { selectPresetFromEnvironment, getGlobalConfigResolver } from 'persuader/utils/logging';

const resolver = getGlobalConfigResolver();
const preset = selectPresetFromEnvironment();
resolver.setGlobalConfig(preset.categories, preset);
```

### Scenario 2: LLM Debugging

```typescript
// Old approach
logger.setLevel('prompts');
logger.updateConfig({ 
  fullPromptLogging: true,
  rawResponseLogging: true 
});

// New approach
import { DebugPresets } from 'persuader/utils/logging/presets';

const llmDebugConfig = getPreset('LLM_DEBUG');
resolver.setGlobalConfig(llmDebugConfig.categories, llmDebugConfig);
```

### Scenario 3: Session-Specific Logging

```typescript
// New capability - not available in old system
import { createSessionLogging } from 'persuader/utils/logging/config-resolver';

// Enable debug logging for specific session
createSessionLogging(sessionId, 'debug', LogCategory.LLM_ALL);

// Session automatically uses enhanced logging
// Other sessions remain unaffected
```

### Scenario 4: Privacy Compliance

```typescript
// New capability - automatic sensitive data protection
import { SecurityPresets } from 'persuader/utils/logging/presets';

// GDPR compliant logging
const gdprConfig = getPreset('GDPR_COMPLIANT');
resolver.setGlobalConfig(gdprConfig.categories, gdprConfig);

// All logs automatically redact PII
logger.info('User email: john@example.com'); 
// Output: "User email: jo****@ex****.***"
```

## CLI Commands

The new system includes powerful CLI commands for log management:

```bash
# View recent logs
persuader logs view --lines 100 --category LLM_REQUEST

# Search logs
persuader logs search "error" --since 1h

# Clean old logs
persuader logs clean --older-than 7 --compress

# Show statistics
persuader logs stats --by-category --period 24h

# Performance metrics
persuader logs perf --export prometheus

# Privacy scan
persuader logs privacy-scan --level strict --fix

# Configure logging
persuader logs config --set-preset PRODUCTION
```

## Migration Checklist

- [ ] **Phase 1**: Verify existing code works (no changes needed)
- [ ] **Phase 2**: Enable privacy protection for sensitive environments
- [ ] **Phase 3**: Add performance monitoring for slow operations
- [ ] **Phase 4**: Configure JSONL rotation for production
- [ ] **Phase 5**: Set up appropriate presets for each environment
- [ ] **Phase 6**: Implement session-scoped logging where beneficial
- [ ] **Phase 7**: Add custom categories for domain-specific logging
- [ ] **Phase 8**: Configure auto-cleanup policies
- [ ] **Phase 9**: Set up CLI commands for operations team
- [ ] **Phase 10**: Monitor and optimize based on metrics

## Best Practices

### 1. Use Presets as Starting Points

```typescript
import { PresetBuilder } from 'persuader/utils/logging/presets';

const customConfig = new PresetBuilder()
  .fromPreset('PRODUCTION')
  .withCategories(LogCategory.LLM_TOKEN)
  .withPerformance(0.1)
  .build();
```

### 2. Implement Request Tracing

```typescript
import { createRequestLogging } from 'persuader/utils/logging/config-resolver';

// In request handler
app.use((req, res, next) => {
  const requestId = generateRequestId();
  createRequestLogging(requestId, undefined, 300000); // 5 min TTL
  req.requestId = requestId;
  next();
});
```

### 3. Monitor Performance Metrics

```typescript
import { timed } from 'persuader/utils/logging/performance-monitor';

class ApiService {
  @timed('api.fetchData')
  async fetchData() {
    // Method automatically timed
  }
}
```

### 4. Protect Sensitive Data

```typescript
import { addRedactedField } from 'persuader/utils/logging/privacy-filter';

// Add custom fields to redact
addRedactedField('creditCard');
addRedactedField('socialSecurity');
```

## Troubleshooting

### Issue: Logs not appearing

```typescript
// Check if categories are enabled
const manager = getGlobalCategoryManager();
console.log('Enabled categories:', manager.toString());

// Enable specific category
manager.enable(LogCategory.INFO);
```

### Issue: Too much log output

```typescript
// Use more restrictive preset
setCategoryPreset('PROD_MINIMAL');

// Or disable specific categories
disableCategories(LogCategory.DEBUG, LogCategory.LLM_RESPONSE);
```

### Issue: Sensitive data in logs

```typescript
// Increase privacy level
import { PrivacyLevel } from 'persuader/utils/logging/privacy-filter';

getGlobalPrivacyFilter().setLevel(PrivacyLevel.STRICT);
```

### Issue: Log files too large

```typescript
// Configure rotation
const writer = createRotationWriter({
  maxFileSize: 5242880, // 5MB
  maxFiles: 20,
  compress: true,
  compressionLevel: 9
});
```

## Advanced Usage

### Custom Categories

```typescript
// Define domain-specific categories
enum CustomCategory {
  PAYMENT = 1 << 31,
  AUTHENTICATION = 1 << 30,
  RECOMMENDATION = 1 << 29,
}

// Combine with existing categories
const categories = LogCategory.ERROR | CustomCategory.PAYMENT;
```

### Performance Profiling

```typescript
const monitor = getGlobalPerformanceMonitor();

// Start parent operation
const parentId = monitor.startOperation('checkout');

// Track child operations
const paymentId = monitor.startChildOperation(parentId, 'payment');
// ... payment logic ...
monitor.endOperation(paymentId);

const shippingId = monitor.startChildOperation(parentId, 'shipping');
// ... shipping logic ...
monitor.endOperation(shippingId);

monitor.endOperation(parentId);

// Get insights
const stats = monitor.getStats('checkout');
console.log('Checkout performance:', stats);
```

### Dynamic Configuration

```typescript
// Adjust logging based on conditions
if (detectHighLoad()) {
  // Reduce logging overhead
  resolver.setGlobalConfig(CategoryPresets.PROD_MINIMAL);
} else if (detectErrors()) {
  // Increase debugging
  resolver.createRequestConfig(
    'debug-session',
    CategoryPresets.DEV_FULL,
    undefined,
    600000 // 10 minutes
  );
}
```

## Support and Resources

- **Documentation**: See [API.md](../API.md) for complete API reference
- **Examples**: Check `examples/logging/` directory for working examples
- **Issues**: Report problems at github.com/your-repo/issues
- **Discussions**: Join our Discord for help and best practices

## Summary

The new logging system provides powerful capabilities while maintaining full backward compatibility. You can adopt new features gradually without breaking existing code. Start with the migration bridge, experiment with new features, and progressively modernize your logging infrastructure at your own pace.