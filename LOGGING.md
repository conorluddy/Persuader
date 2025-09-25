# Logging Framework Documentation

> **"Transparency is the cornerstone of trustworthy LLM orchestration."**

Persuader's logging system is designed around the principle that **logging is a first-class citizen** in LLM applications. Given the critical importance of transparency in AI systems, our logging framework provides unprecedented visibility into every aspect of LLM interactions, validation processes, and system performance.

---

## 🎯 Philosophy & Design Principles

### Human-Centric Transparency
Following our [CODESTYLE.md](./CODESTYLE.md) principles, the logging system prioritizes human understanding:

- **Progressive Disclosure**: Start with essential information, drill down as needed
- **Cognitive Load Management**: Clear, structured output that doesn't overwhelm
- **Jackson's Law Compliance**: Small logging deficiencies compound exponentially—comprehensive logging prevents debugging nightmares

### LLM-Specific Observability
Unlike traditional application logging, LLM orchestration requires specialized visibility:

- **Prompt Engineering Transparency**: Full prompt visibility for debugging and optimization
- **Validation Loop Insights**: Detailed retry logic and error feedback analysis  
- **Token Usage Monitoring**: Cost tracking and performance optimization data
- **Schema Compliance Tracking**: Validation success rates and failure patterns

---

## 🏗️ Architecture Overview

The Persuader logging system consists of multiple specialized components working together:

```
📊 Logging Architecture
├── 🎯 Core Logger (src/utils/logger.ts)
│   ├── 6 Hierarchical Levels: none → error → warn → info → debug → prompts → verboseDebug
│   ├── LLM-Specific Methods: llmRequest(), llmResponse(), llmError()
│   ├── Structured Context: JSON metadata with every log entry
│   └── Visual Formatting: Colored output with beautiful prompt/response boxes
├── 🏷️ Category System (src/utils/logging/)
│   ├── 30+ Categories: Bitwise flags for granular control
│   ├── Smart Presets: DEV_FULL, PRODUCTION, LLM_DEBUG, GDPR_COMPLIANT
│   ├── Dynamic Configuration: Session and request-scoped overrides
│   └── Privacy Protection: Automatic PII masking and redaction
├── 📁 JSONL Writer (src/utils/jsonl-writer.ts)
│   ├── Thread-Safe: Concurrent writes with automatic queuing
│   ├── Rotation: Size-based file rotation (10MB default)
│   ├── Cleanup: Automatic retention policies (10 files default)
│   └── Structured Logs: Machine-readable JSON lines format
└── 🛠️ CLI Management (src/cli/commands/logs.ts)
    ├── 8 Commands: view, search, clean, stats, perf, privacy-scan, config, tail
    ├── Advanced Filtering: By session, request, category, time range
    ├── Analytics: Performance metrics and usage statistics
    └── Privacy Tools: Automated sensitive data detection and removal
```

---

## 📊 Log Levels & Hierarchy

### Traditional Level-Based Logging

```typescript
import { createLogger, setGlobalLogLevel } from 'persuader';

// 6-level hierarchy (none → verboseDebug)
const logger = createLogger({ level: 'debug' });

setGlobalLogLevel('prompts'); // Show beautiful LLM interactions
```

**Level Details:**
- **`none`** (`-1`): Completely silent
- **`error`** (`0`): Critical failures only
- **`warn`** (`1`): Warnings and validation failures  
- **`info`** (`2`): General execution flow (default)
- **`debug`** (`3`): Detailed operations with truncated prompts/responses
- **`prompts`** (`4`): Beautiful formatted LLM prompt/response display
- **`verboseDebug`** (`5`): Complete transparency with full prompts and raw responses

### Visual Output Examples

#### 🎨 Prompts Level (Beautiful LLM Interaction Display)

```bash
🚀 PROMPT → claude-cli (claude-3-5-haiku-20241022)
  ID: req-abc123 • Attempt: 1 • T: 0.7 • Max: 2000

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ You are a world-class BJJ expert. Extract transitions from this position:  ┃
┃                                                                            ┃
┃ Position: mount-high-controlling                                           ┃
┃ Available targets: ["side-control", "back-control", "submission"]         ┃
┃                                                                            ┃
┃ Output must conform to: {                                                  ┃
┃   "transitions": [{"name": "string", "difficulty": "number"}]             ┃
┃ }                                                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

✅ RESPONSE ← claude-cli (claude-3-5-haiku-20241022)  
  ID: req-abc123 • 1.2s • $0.000045 • 890→156 tokens • stop

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ {                                                                          ┃
┃   "transitions": [                                                         ┃
┃     {"name": "arm-triangle-choke", "difficulty": 7},                       ┃
┃     {"name": "transition-to-back-control", "difficulty": 6},               ┃
┃     {"name": "americana-submission", "difficulty": 8}                      ┃
┃   ]                                                                        ┃
┃ }                                                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

#### 🔍 VerboseDebug Level (Maximum Transparency)

```bash
[2024-09-25T14:30:15.123Z] [Persuader] [VERBOSEDEBUG] 🔍 FULL LLM REQUEST claude-cli
  requestId: req-abc123
  attempt: 2
  temperature: 0.7
  maxTokens: 2000
  fullPrompt: ┌─ COMPLETE PROMPT
              │ [SYSTEM] You are a world-class BJJ expert with deep knowledge of position transitions, submission mechanics, and fight strategy...
              │ 
              │ [SCHEMA] The output must strictly conform to this Zod schema:
              │ {
              │   "type": "object", 
              │   "properties": {
              │     "transitions": {
              │       "type": "array",
              │       "items": {
              │         "type": "object",
              │         "properties": {
              │           "name": {"type": "string"},
              │           "difficulty": {"type": "number", "minimum": 1, "maximum": 10}
              │         },
              │         "required": ["name", "difficulty"]
              │       }
              │     }
              │   }
              │ }
              │ 
              │ [USER] Generate transitions from base-mount-high-controlling...
              └─ END COMPLETE PROMPT
  promptLength: 2847

🔍 RAW LLM RESPONSE claude-cli  
  requestId: req-abc123
  durationMs: 1234
  tokens: 890→156 (1046 total)
  rawResponse: ┌─ RAW RESPONSE
               │ {
               │   "transitions": [
               │     {
               │       "name": "arm-triangle-choke",
               │       "difficulty": 7
               │     },
               │     {
               │       "name": "transition-to-back-control", 
               │       "difficulty": 6
               │     }
               │   ]
               │ }
               └─ END RAW RESPONSE
  rawResponseLength: 243
```

---

## 🏷️ Category-Based Logging System

### Advanced Granular Control

Beyond traditional levels, Persuader offers 30+ categories using bitwise flags:

```typescript
import { CategoryManager, LogCategory } from 'persuader';

// Core categories
const manager = new CategoryManager();
manager.enable(
  LogCategory.ERROR,           // Critical failures
  LogCategory.LLM_REQUEST,     // LLM prompt logging  
  LogCategory.LLM_RESPONSE,    // LLM response logging
  LogCategory.VALIDATION_FAILURE, // Schema validation errors
  LogCategory.RETRY_LOGIC,     // Retry attempt information
  LogCategory.PERFORMANCE,     // Timing and metrics
  LogCategory.SESSION          // Session management
);

// Check if category is enabled
if (manager.isEnabled(LogCategory.LLM_REQUEST)) {
  // Log LLM request details
}

// Combine categories with bitwise operations  
const llmCategories = LogCategory.LLM_REQUEST | LogCategory.LLM_RESPONSE | LogCategory.LLM_ERROR;
manager.setCategories(llmCategories);
```

### Complete Category Reference

```typescript
export enum LogCategory {
  // Core System
  ERROR = 1 << 0,              // Critical failures and exceptions
  WARN = 1 << 1,               // Warnings and non-fatal issues
  INFO = 1 << 2,               // General information
  DEBUG = 1 << 3,              // Debug information
  
  // LLM Interaction Categories
  LLM_REQUEST = 1 << 4,        // Outgoing prompts to LLM providers
  LLM_RESPONSE = 1 << 5,       // LLM response content
  LLM_ERROR = 1 << 6,          // LLM provider errors
  LLM_TOKEN = 1 << 7,          // Token usage and costs
  LLM_ALL = LLM_REQUEST | LLM_RESPONSE | LLM_ERROR | LLM_TOKEN,
  
  // Validation System
  VALIDATION_SUCCESS = 1 << 8,  // Successful schema validations
  VALIDATION_FAILURE = 1 << 9,  // Failed validations with details
  VALIDATION_RETRY = 1 << 10,   // Retry attempts after failures
  VALIDATION_ALL = VALIDATION_SUCCESS | VALIDATION_FAILURE | VALIDATION_RETRY,
  
  // Performance Monitoring  
  PERFORMANCE = 1 << 11,        // Timing and performance metrics
  MEMORY = 1 << 12,            // Memory usage tracking
  NETWORK = 1 << 13,           // Network call monitoring
  PERFORMANCE_ALL = PERFORMANCE | MEMORY | NETWORK,
  
  // Session Management
  SESSION = 1 << 14,           // Session lifecycle events
  SESSION_METRICS = 1 << 15,   // Session performance data
  SESSION_ALL = SESSION | SESSION_METRICS,
  
  // File I/O Operations
  FILE_READ = 1 << 16,         // File reading operations
  FILE_WRITE = 1 << 17,        // File writing operations  
  FILE_ALL = FILE_READ | FILE_WRITE,
  
  // CLI Operations
  CLI_COMMAND = 1 << 18,       // CLI command execution
  CLI_PROGRESS = 1 << 19,      // Progress bars and status
  CLI_ALL = CLI_COMMAND | CLI_PROGRESS,
  
  // Security & Privacy
  PRIVACY_FILTER = 1 << 20,    // Privacy filtering operations
  SECURITY_AUDIT = 1 << 21,    // Security auditing events
  PRIVACY_ALL = PRIVACY_FILTER | SECURITY_AUDIT,
  
  // Development & Debugging
  SCHEMA_ANALYSIS = 1 << 22,   // Zod schema introspection
  PROMPT_ENGINEERING = 1 << 23, // Prompt construction details
  DEV_ALL = SCHEMA_ANALYSIS | PROMPT_ENGINEERING,
  
  // Presets for common combinations
  MINIMAL = ERROR | WARN,
  STANDARD = ERROR | WARN | INFO | LLM_ERROR,
  FULL = 0xFFFFFFFF           // All categories enabled
}
```

---

## ⚙️ Configuration System

### Multi-Layer Configuration

Persuader uses a sophisticated 3-layer configuration system:

```typescript
import { 
  getGlobalConfigResolver, 
  createSessionLogging,
  createRequestLogging 
} from 'persuader/utils/logging/config-resolver';

// 1. Global Configuration (baseline for all operations)
const resolver = getGlobalConfigResolver();
resolver.setGlobalConfig(LogCategory.STANDARD, {
  level: 'info',
  jsonlLogging: true,
  privacyLevel: PrivacyLevel.STANDARD
});

// 2. Session-Scoped Configuration (for related operations)
createSessionLogging('session-123', 'debug', LogCategory.LLM_ALL, 3600000); // 1 hour TTL

// 3. Request-Scoped Configuration (for specific operations)  
createRequestLogging('req-456', LogCategory.VALIDATION_ALL, 300000); // 5 minutes TTL

// Configuration resolution priority: Request > Session > Global
```

### Configuration Interface

```typescript
interface LoggerConfig {
  // Core Settings
  level: LogLevel;
  prefix?: string;
  colors?: boolean;
  timestamp?: boolean;
  
  // Content Control
  maxPromptLength?: number;        // Truncation threshold (default: 1000)
  maxResponseLength?: number;      // Truncation threshold (default: 1000)  
  truncate?: boolean;              // Enable truncation (default: false)
  
  // Debug Features
  fullPromptLogging?: boolean;     // Show complete prompts in verboseDebug
  rawResponseLogging?: boolean;    // Show unprocessed responses
  detailedValidationErrors?: boolean; // Enhanced validation error details
  
  // File Logging
  jsonlLogging?: boolean;          // Enable JSONL file output
  logsDirectory?: string;          // Directory for log files (default: './logs')
  maxFileSize?: number;            // Rotation size (default: 10MB)
  maxFiles?: number;               // Retention count (default: 10)
}
```

---

## 🎚️ Preset System

### Built-in Presets for Common Scenarios

```typescript
import { getPreset, selectPresetFromEnvironment, setCategoryPreset } from 'persuader/utils/logging/presets';

// Automatic environment detection
const preset = selectPresetFromEnvironment(); // Reads NODE_ENV
resolver.setGlobalConfig(preset.categories, preset);

// Or use specific presets
const presets = {
  // Development Presets
  LOCAL_DEV: getPreset('LOCAL_DEV'),           // Full logging, beautiful prompts
  DEBUG_FULL: getPreset('DEBUG_FULL'),         // Maximum transparency
  LLM_DEBUG: getPreset('LLM_DEBUG'),           // LLM-focused debugging
  
  // Production Presets  
  PRODUCTION: getPreset('PRODUCTION'),         // Minimal, secure logging
  PROD_OBSERVABILITY: getPreset('PROD_OBSERVABILITY'), // Production monitoring
  PROD_MINIMAL: getPreset('PROD_MINIMAL'),     // Error tracking only
  
  // Security & Privacy
  GDPR_COMPLIANT: getPreset('GDPR_COMPLIANT'), // Privacy-first configuration
  SECURITY_AUDIT: getPreset('SECURITY_AUDIT'), // Security-focused logging
  
  // Performance Monitoring
  PERFORMANCE_FOCUS: getPreset('PERFORMANCE_FOCUS'), // Performance metrics only
  TOKEN_MONITORING: getPreset('TOKEN_MONITORING'),   // Cost tracking focus
  
  // Testing & CI/CD
  TEST_RUNNER: getPreset('TEST_RUNNER'),       // Test execution logging
  CI_PIPELINE: getPreset('CI_PIPELINE')        // Automated environment logging
};
```

### Preset Configuration Examples

```typescript
// Development: Full visibility for debugging
const devConfig = getPreset('LOCAL_DEV');
// Enables: All categories, prompts level, full prompts, raw responses, colored output

// Production: Secure and minimal
const prodConfig = getPreset('PRODUCTION');  
// Enables: ERROR, WARN, LLM_ERROR only, privacy filtering, file rotation

// LLM Debugging: Maximum LLM transparency
const llmDebugConfig = getPreset('LLM_DEBUG');
// Enables: All LLM categories, verboseDebug level, full prompts, raw responses

// GDPR Compliance: Privacy-first logging
const gdprConfig = getPreset('GDPR_COMPLIANT');
// Enables: Minimal categories, strict privacy filtering, automatic PII redaction
```

---

## 🔒 Privacy & Security Features

### Automatic Privacy Protection

```typescript
import { 
  PrivacyFilter, 
  PrivacyLevel,
  setGlobalPrivacyFilter,
  addRedactedField 
} from 'persuader/utils/logging/privacy-filter';

// Set global privacy level
const privacyFilter = new PrivacyFilter({ level: PrivacyLevel.STANDARD });
setGlobalPrivacyFilter(privacyFilter);

// Privacy levels
enum PrivacyLevel {
  MINIMAL = 0,    // Basic email masking
  STANDARD = 1,   // Email, phone, common PII  
  STRICT = 2,     // Extended PII detection
  PARANOID = 3    // Aggressive pattern matching
}

// Add custom sensitive patterns
addRedactedField('creditCard');        // Custom field names
addRedactedField('socialSecurity');
addRedactedField(/API_KEY_\w+/);       // Regex patterns

// Privacy filtering in action
logger.info('User email: john@example.com, phone: +1-555-123-4567');
// Output: "User email: jo****@ex****.com, phone: +1-***-***-**67"
```

### GDPR Compliance Features

```typescript
// GDPR-compliant logging setup
const gdprConfig = getPreset('GDPR_COMPLIANT');
resolver.setGlobalConfig(gdprConfig.categories, {
  ...gdprConfig,
  privacyLevel: PrivacyLevel.STRICT,
  retentionDays: 30,               // Automatic cleanup after 30 days
  encryptionEnabled: true,         // Encrypt log files at rest
  auditLogging: true              // Log privacy filtering actions
});

// Right to be forgotten - remove specific user data
await privacyFilter.redactUserData('user-123', {
  retainMetrics: true,            // Keep anonymized performance data
  auditTrail: true               // Log the redaction action
});
```

---

## 📁 JSONL File System

### Thread-Safe File Operations

```typescript
import { createJsonlWriter, JsonlWriter, JsonlLogEntry } from 'persuader';

// Configure JSONL writer
const writer = createJsonlWriter({
  logsDirectory: './logs',          // Log file directory
  maxFileSize: 10 * 1024 * 1024,   // 10MB per file  
  maxFiles: 10,                     // Keep 10 files max
  baseFilename: 'persuader'         // Base filename pattern
});

await writer.initialize(); // Create directories, setup rotation

// Write structured log entries
const logEntry: JsonlLogEntry = {
  timestamp: new Date().toISOString(),
  level: 'info',
  message: 'LLM_REQUEST',
  sessionId: 'session-123',
  requestId: 'req-456',
  context: {
    provider: 'claude-cli',
    model: 'claude-3-5-haiku-20241022',
    tokenUsage: { inputTokens: 890, outputTokens: 156, totalTokens: 1046 },
    durationMs: 1234,
    promptLength: 2847
  }
};

await writer.writeEntry(logEntry);
```

### File Rotation and Cleanup

```typescript
// Automatic rotation when size exceeds maxFileSize
// File naming pattern: persuader-2024-09-25-14-30-15.jsonl

// Configuration for production environments
const productionWriter = createJsonlWriter({
  logsDirectory: '/var/log/persuader',
  maxFileSize: 50 * 1024 * 1024,  // 50MB files
  maxFiles: 100,                   // Keep 100 files (5GB total)
  baseFilename: 'persuader-prod'
});

// Integration with cleanup policies
import { cleanupOldLogs } from 'persuader/utils/logging/jsonl-rotation';

// Clean files older than 30 days
await cleanupOldLogs({
  directory: './logs',
  retentionDays: 30,
  compressOld: true,              // Gzip old files before deletion
  compressionLevel: 9             // Maximum compression
});
```

---

## 🛠️ CLI Management Commands

### Complete Command Reference

#### `persuader logs view` - View Recent Logs

```bash
# Basic log viewing
persuader logs view --lines 100

# Filter by session and time
persuader logs view --session session-123 --since "2h" --lines 50

# Filter by category and level  
persuader logs search --category LLM_REQUEST --level debug

# Real-time following
persuader logs view --follow --no-color

# JSON output for processing
persuader logs view --json | jq '.[] | select(.level == "error")'
```

**Options:**
- `--lines, -n <number>`: Number of lines to show (default: 50)
- `--follow, -f`: Follow log output (like `tail -f`)
- `--session <id>`: Filter by session ID
- `--request <id>`: Filter by request ID  
- `--level <level>`: Filter by log level
- `--category <category>`: Filter by log category
- `--since <time>`: Show logs since time ("10m", "1h", "2024-01-01")
- `--json`: Output as JSON
- `--no-color`: Disable colored output

#### `persuader logs search` - Pattern Search

```bash
# Text search with context
persuader logs search "validation failed" --lines 20 -i

# Regex search
persuader logs search "session-\d+" --regex --since 1h

# Search in specific session
persuader logs search "error" --session session-123 --json

# Case-insensitive search with more context
persuader logs search "timeout" -i --lines 100 --since 24h
```

**Options:**
- `<pattern>`: Search pattern (text or regex)
- `--ignore-case, -i`: Case-insensitive search  
- `--regex`: Treat pattern as regular expression
- `--lines, -n <number>`: Number of results to show (default: 100)
- `--session <id>`: Filter by session ID
- `--since <time>`: Search logs since time
- `--json`: Output results as JSON

#### `persuader logs clean` - Log Cleanup

```bash
# Clean old logs (dry run first)
persuader logs clean --older-than 7 --dry-run

# Actually clean with compression
persuader logs clean --older-than 30 --compress

# Keep only recent files  
persuader logs clean --keep 5 --compress

# Aggressive cleanup
persuader logs clean --older-than 1 --keep 3
```

**Options:**
- `--older-than <days>`: Delete logs older than N days (default: 7)  
- `--keep <number>`: Keep at most N files (default: 10)
- `--dry-run`: Show what would be deleted without deleting
- `--compress`: Compress old logs instead of deleting

#### `persuader logs stats` - Analytics & Metrics

```bash
# General statistics
persuader logs stats --period 24h

# Group by different dimensions
persuader logs stats --by-level --period 7d
persuader logs stats --by-category --period 1h  
persuader logs stats --by-session --json

# Export for analysis
persuader logs stats --json > daily-stats.json
```

**Sample Output:**
```
📊 Persuader Logs Statistics (Last 24h)

Total Log Entries: 15,847
├── Error: 23 (0.1%)
├── Warn: 156 (1.0%) 
├── Info: 8,934 (56.4%)
├── Debug: 5,123 (32.3%)
└── VerboseDebug: 1,611 (10.2%)

By Category:
├── LLM_REQUEST: 1,245 (7.9%)
├── LLM_RESPONSE: 1,223 (7.7%)
├── VALIDATION_SUCCESS: 891 (5.6%)
├── VALIDATION_FAILURE: 67 (0.4%)
└── PERFORMANCE: 2,156 (13.6%)

Top Sessions:
├── session-abc123: 2,847 entries
├── session-def456: 1,923 entries  
└── session-ghi789: 1,445 entries

Performance:
├── Average Request Duration: 1.2s
├── Total Token Usage: 1,247,589
└── Estimated Cost: $2.47
```

#### `persuader logs perf` - Performance Monitoring

```bash
# Performance metrics overview  
persuader logs perf

# Specific metric focus
persuader logs perf --metric token-usage --period 7d

# Export for monitoring systems
persuader logs perf --export prometheus > metrics.prom
persuader logs perf --export json --period 1h > perf-data.json
```

**Supported Metrics:**
- `request-duration`: LLM request timing
- `token-usage`: Input/output token consumption
- `validation-rate`: Schema validation success rates  
- `retry-patterns`: Retry attempt analysis
- `cost-tracking`: Estimated usage costs
- `session-performance`: Session-level metrics

#### `persuader logs privacy-scan` - Security Auditing

```bash
# Scan for sensitive data
persuader logs privacy-scan --level standard --report

# Fix found issues (redact sensitive data)
persuader logs privacy-scan --level strict --fix

# Dry run to see what would be redacted
persuader logs privacy-scan --level paranoid --dry-run

# Generate compliance report
persuader logs privacy-scan --report > privacy-audit.html
```

**Privacy Levels:**
- **minimal**: Basic email and phone detection
- **standard**: Common PII patterns (SSN, credit cards, addresses)
- **strict**: Extended pattern matching and context analysis  
- **paranoid**: Aggressive detection with potential false positives

#### `persuader logs config` - Configuration Management

```bash
# Show current configuration
persuader logs config --show

# Set global log level
persuader logs config --set-level debug

# Use preset configuration
persuader logs config --set-preset PRODUCTION
persuader logs config --set-preset LLM_DEBUG

# Enable specific categories
persuader logs config --set-categories "LLM_REQUEST,LLM_RESPONSE,ERROR"

# Enable file logging
persuader logs config --enable-jsonl

# Set privacy level
persuader logs config --set-privacy strict
```

#### `persuader logs tail` - Real-Time Monitoring

```bash
# Follow logs in real-time
persuader logs tail

# Start with recent context
persuader logs tail --lines 20

# Filter by session while tailing
persuader logs tail --session session-123

# Focus on specific categories  
persuader logs tail --category LLM_REQUEST,ERROR

# Monochrome output for logging systems
persuader logs tail --no-color
```

---

## 💻 Programming Interface

### Basic Usage Patterns

#### Traditional Level-Based Logging

```typescript
import { createLogger, setGlobalLogLevel } from 'persuader';

// Create logger with configuration
const logger = createLogger({
  level: 'debug',
  colors: true,
  timestamp: true,
  prefix: 'MyApp',
  jsonlLogging: true,
  logsDirectory: './logs'
});

// Use logger methods
logger.error('Critical failure', { error: error.message, requestId: 'req-123' });
logger.warn('Rate limit approaching', { usage: 0.85, limit: 1000 });
logger.info('Processing request', { sessionId: 'session-456', input: 'User data...' });
logger.debug('Validation details', { schema: 'UserSchema', attempts: 2 });

// Change log level globally
setGlobalLogLevel('verboseDebug'); // Show everything
```

#### LLM-Specific Logging

```typescript
import { llmRequest, llmResponse, llmError } from 'persuader';

// Log LLM request with full context
llmRequest({
  provider: 'claude-cli',
  model: 'claude-3-5-haiku-20241022',
  prompt: 'Extract user information from: John Doe, age 30...',
  fullPrompt: '[SYSTEM] You are an expert...\n[USER] Extract user information...',
  temperature: 0.7,
  maxTokens: 2000,
  sessionId: 'session-123',
  attemptNumber: 1,
  requestId: 'req-456'
});

// Log successful response
llmResponse({
  provider: 'claude-cli',
  model: 'claude-3-5-haiku-20241022',
  response: '{"name": "John Doe", "age": 30}',
  rawResponse: '{\n  "name": "John Doe",\n  "age": 30\n}',
  tokenUsage: { inputTokens: 890, outputTokens: 156, totalTokens: 1046 },
  cost: 0.000234,
  durationMs: 1234,
  sessionId: 'session-123',
  requestId: 'req-456',
  stopReason: 'end_turn'
});

// Log LLM errors
llmError({
  provider: 'claude-cli', 
  model: 'claude-3-5-haiku-20241022',
  error: 'Rate limit exceeded: 429 Too Many Requests',
  attemptNumber: 3,
  requestId: 'req-456',
  isRetryable: true
});
```

#### Category-Based Advanced Logging

```typescript
import { 
  CategoryManager, 
  LogCategory, 
  getGlobalCategoryManager,
  enableCategories,
  disableCategories 
} from 'persuader';

// Create category manager
const manager = new CategoryManager();

// Enable specific categories
manager.enable(
  LogCategory.LLM_REQUEST,
  LogCategory.LLM_RESPONSE,  
  LogCategory.VALIDATION_FAILURE,
  LogCategory.PERFORMANCE
);

// Check if category is enabled
if (manager.isEnabled(LogCategory.VALIDATION_FAILURE)) {
  logger.warn('Schema validation failed', { 
    category: LogCategory.VALIDATION_FAILURE,
    field: 'email',
    expected: 'valid email format',
    actual: 'invalid-email',
    suggestions: ['user@example.com']
  });
}

// Use global category manager
const global = getGlobalCategoryManager();
global.setCategories(LogCategory.PRODUCTION); // Error + Warn + LLM_ERROR only

// Convenience functions
enableCategories(LogCategory.DEBUG, LogCategory.PERFORMANCE);
disableCategories(LogCategory.LLM_RESPONSE); // Reduce noise
```

### Advanced Features

#### Session-Scoped Configuration

```typescript
import { createSessionLogging, getSessionConfig } from 'persuader/utils/logging/config-resolver';

// Enable debug logging for specific session
createSessionLogging('debug-session-789', 'verboseDebug', LogCategory.LLM_ALL, 3600000);

// Session automatically inherits enhanced logging
const result = await persuade({
  schema: MySchema,
  input: 'Complex data...',
  sessionId: 'debug-session-789' // Automatically uses verbose logging
});

// Check session configuration
const sessionConfig = getSessionConfig('debug-session-789');
if (sessionConfig) {
  console.log('Session logging level:', sessionConfig.level);
  console.log('Session categories:', sessionConfig.categories);
}
```

#### Performance Monitoring Integration

```typescript
import { 
  getGlobalPerformanceMonitor,
  timed,
  startOperation,
  endOperation 
} from 'persuader/utils/logging/performance-monitor';

const monitor = getGlobalPerformanceMonitor();

// Manual operation timing
const timerId = monitor.startOperation('complex-validation');
try {
  await complexValidationLogic();
  monitor.endOperation(timerId, { success: true, itemCount: 47 });
} catch (error) {
  monitor.endOperation(timerId, { success: false, error: error.message });
  throw error;
}

// Decorator-based timing
class DataProcessor {
  @timed('process-batch')
  async processBatch(items: Item[]) {
    // Method execution automatically timed and logged
    return await processItems(items);
  }
}

// Get performance insights
const stats = monitor.getStats('complex-validation');
console.log(`Average duration: ${stats.avgDuration}ms`);
console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
console.log(`Total operations: ${stats.totalOperations}`);
```

#### Privacy-Aware Logging

```typescript
import { 
  PrivacyFilter,
  PrivacyLevel,
  addRedactedField,
  setGlobalPrivacyFilter 
} from 'persuader/utils/logging/privacy-filter';

// Configure privacy protection
const privacyFilter = new PrivacyFilter({
  level: PrivacyLevel.STRICT,
  customPatterns: [
    /API_KEY_\w+/g,           // API keys
    /sk-[a-zA-Z0-9]{48}/g,    // OpenAI API keys
    /\b\d{16}\b/g             // Credit card numbers
  ],
  redactionStyle: 'partial'    // Show partial data: "john****@example.com"
});

setGlobalPrivacyFilter(privacyFilter);

// Add custom sensitive field detection
addRedactedField('socialSecurityNumber');
addRedactedField('bankAccount');
addRedactedField(/password/i); // Case-insensitive regex

// Privacy filtering happens automatically
logger.info('User data', {
  email: 'john@example.com',        // Becomes: "jo****@ex****.com"
  phone: '+1-555-123-4567',         // Becomes: "+1-***-***-**67"
  apiKey: 'sk-abc123def456...',      // Becomes: "sk-***"
  socialSecurityNumber: '123-45-6789' // Becomes: "***-**-****"
});
```

---

## 🎨 Visual Examples & Output

### Debug Mode (`--debug` flag)

When using the CLI with `--debug`, you get maximum transparency:

```bash
persuader run --schema ./schema.ts --input ./data.json --debug
```

**Enhanced Output:**
```
🔍 FULL LLM REQUEST claude-cli (claude-3-5-haiku-20241022)
┌─ COMPLETE PROMPT
│ [SYSTEM] You are a world-class BJJ expert with deep knowledge of position transitions, 
│ submission mechanics, and fight strategy. Your expertise covers all aspects of Brazilian 
│ Jiu-Jitsu from fundamental positions to advanced techniques.
│ 
│ [SCHEMA] The output must strictly conform to this Zod schema:
│ {
│   "type": "object",
│   "properties": {
│     "perspectiveUuid": {
│       "type": "string",
│       "enum": ["base-mount-high-controlling", "base-control-high-mount-controlling", ...]
│     },
│     "transitions": {
│       "type": "array", 
│       "items": {
│         "type": "object",
│         "properties": {
│           "targetUuid": {"type": "string", "enum": [...]},
│           "name": {"type": "string"},
│           "difficulty": {"type": "number", "minimum": 1, "maximum": 10}
│         }
│       }
│     }
│   }
│ }
│ 
│ [USER] Generate transitions from base-mount-high-controlling targeting positions 
│ that allow for control or submission opportunities...
└─ END COMPLETE PROMPT

🔍 RAW LLM RESPONSE claude-cli
┌─ RAW RESPONSE  
│ {
│   "perspectiveUuid": "base-mount-high-controlling",
│   "transitions": [
│     {
│       "targetUuid": "base-control-high-mount-controlling", 
│       "name": "high-mount-to-mount-control",
│       "difficulty": 4
│     },
│     {
│       "targetUuid": "submission-arm-triangle-choke-from-mount",
│       "name": "arm-triangle-choke-setup",
│       "difficulty": 7
│     }
│   ]
│ }
└─ END RAW RESPONSE

🔍 DETAILED VALIDATION ERROR transitions[0].targetUuid
field: transitions[0].targetUuid
actualValue: base-control-high-mount-controlling
expectedType: enum
validOptionsCount: 194
closestMatches: ["base-mount-controlling", "base-control-mount-controlling"]
suggestions: ["Did you mean: base-mount-controlling?"]

✅ VALIDATION SUCCESS after 2 attempts
⏱️  PERFORMANCE Total execution time: 3.2s
📊 TOKEN USAGE 1,247→189 tokens ($0.000156)
```

### Performance Dashboard

Using `persuader logs stats --by-category --period 24h`:

```
📊 Persuader Performance Dashboard (Last 24 Hours)

╭─ OVERVIEW ────────────────────────────────────────────────────╮
│ Total Operations: 1,247                                       │
│ Success Rate: 94.7% (1,181 successful, 66 failed)           │  
│ Average Duration: 1.8s                                       │
│ Total Token Usage: 2,847,391 tokens                         │
│ Estimated Cost: $4.23                                       │
╰───────────────────────────────────────────────────────────────╯

╭─ BY CATEGORY ─────────────────────────────────────────────────╮
│ LLM_REQUEST      1,247 ops │ █████████████████████████ 100% │
│ LLM_RESPONSE     1,181 ops │ ███████████████████████▌   94% │
│ VALIDATION_SUCCESS 1,089 ops │ ██████████████████████▋    87% │
│ VALIDATION_FAILURE   158 ops │ ████▏                      13% │
│ RETRY_LOGIC          112 ops │ ███▏                        9% │
│ PERFORMANCE        1,247 ops │ █████████████████████████ 100% │
╰───────────────────────────────────────────────────────────────╯

╭─ PERFORMANCE BREAKDOWN ───────────────────────────────────────╮
│ Fastest Request:    0.3s │ Slowest Request:   8.9s           │
│ P50 Duration:       1.2s │ P95 Duration:      4.1s           │
│ P99 Duration:       6.8s │ Timeout Rate:      0.2%           │
╰───────────────────────────────────────────────────────────────╯

╭─ TOKEN ANALYSIS ──────────────────────────────────────────────╮
│ Input Tokens:  1,923,847 │ Output Tokens:   923,544          │
│ Avg Input:         1,543 │ Avg Output:        782            │  
│ Most Expensive:   $0.023 │ Cheapest:       $0.0001          │
╰───────────────────────────────────────────────────────────────╯

╭─ TOP SESSIONS ────────────────────────────────────────────────╮
│ session-abc123   347 ops │ ████████████▎              27.8% │
│ session-def456   298 ops │ ██████████████             23.9% │  
│ session-ghi789   201 ops │ ████████▊                  16.1% │
│ session-jkl012   156 ops │ ██████▌                    12.5% │
╰───────────────────────────────────────────────────────────────╯
```

---

## 🔧 Integration with Existing Documentation

### Links to LOGGING.md

**From README.md:**
- [Comprehensive Logging System](./LOGGING.md) - Complete logging framework documentation
- [Debug Mode & Advanced Logging](./LOGGING.md#visual-examples--output) - Visual examples and debug output  
- [CLI Log Management](./LOGGING.md#cli-management-commands) - Complete CLI command reference

**From API.md:**
- [Logging System](./LOGGING.md) - Complete logging framework reference
- [Category-Based Logging](./LOGGING.md#category-based-logging-system) - Advanced category system
- [Performance Monitoring](./LOGGING.md#programming-interface) - Performance monitoring integration

**From CLAUDE.md:**
- [Production Logging](./LOGGING.md#preset-system) - Production-ready logging configuration
- [Debug Workflows](./LOGGING.md#visual-examples--output) - Debugging with comprehensive logs
- [CLI Log Commands](./LOGGING.md#cli-management-commands) - Log management and analysis

---

## 🚀 Best Practices & Recommendations

### 1. Environment-Based Configuration

```typescript
import { selectPresetFromEnvironment } from 'persuader/utils/logging/presets';

// Automatic configuration based on NODE_ENV
const preset = selectPresetFromEnvironment();
/*
  development → LOCAL_DEV (full logging, beautiful prompts)
  test → TEST_RUNNER (minimal output, structured logs)
  production → PRODUCTION (secure, minimal, file rotation)
*/
```

### 2. Session-Based Learning Integration

```typescript
// Enable session-based learning with success feedback
const result = await persuade({
  schema: MySchema,
  input: 'Complex data...',
  sessionId: 'learning-session',
  successMessage: "Excellent! Your output format is perfect. Keep using this exact structure."
});

// Success feedback is automatically logged for analysis
// View learning patterns: persuader logs search "success feedback" --session learning-session
```

### 3. Performance Optimization Workflow

```typescript
// Monitor performance metrics
const monitor = getGlobalPerformanceMonitor();

// Identify slow operations
const stats = monitor.getStats();
const slowOperations = stats.filter(op => op.avgDuration > 3000); // > 3s

// Enable targeted debugging for slow operations
if (slowOperations.length > 0) {
  createSessionLogging('perf-debug', 'verboseDebug', LogCategory.PERFORMANCE_ALL);
}

// Analyze with CLI: persuader logs perf --metric request-duration --period 1h
```

### 4. Production Security Checklist

```typescript
// ✅ Production-ready logging configuration
const productionConfig = {
  level: 'warn',                          // Minimal console output
  jsonlLogging: true,                     // Structured file logging
  privacyLevel: PrivacyLevel.STRICT,      // Aggressive PII protection  
  truncate: true,                         // Truncate long prompts
  maxPromptLength: 500,                   // Limit prompt length in logs
  retentionDays: 30,                      // Automatic cleanup
  encryptionEnabled: true,                // Encrypt log files
  categories: LogCategory.ERROR | LogCategory.WARN | LogCategory.LLM_ERROR
};

// ✅ Regular security audits
// Run: persuader logs privacy-scan --level strict --report
```

### 5. Debugging Complex Validation Issues

```bash
# Step 1: Enable maximum transparency for problematic schema
persuader run --schema ./problematic-schema.ts --input ./test-data.json --debug

# Step 2: Analyze validation patterns  
persuader logs search "DETAILED_VALIDATION_ERROR" --since 1h --json > validation-issues.json

# Step 3: Review fuzzy matching suggestions
persuader logs search "closestMatches" --since 30m

# Step 4: Monitor retry patterns
persuader logs search "RETRY_LOGIC" --session your-session --lines 50
```

### 6. Cost and Performance Monitoring

```bash
# Daily cost tracking
persuader logs stats --period 24h | grep "Estimated Cost"

# Token usage analysis
persuader logs perf --metric token-usage --period 7d --export json > weekly-usage.json

# Identify expensive operations
persuader logs search "cost" --since 24h --json | jq 'sort_by(.context.cost) | reverse | .[0:10]'

# Session efficiency analysis  
persuader logs stats --by-session --period 7d
```

---

## 🔍 Troubleshooting Guide

### Common Issues & Solutions

#### **Issue: No log output appearing**

```typescript
// Check if categories are enabled
import { getGlobalCategoryManager } from 'persuader';
const manager = getGlobalCategoryManager();
console.log('Enabled categories:', manager.toString());

// Enable basic categories
manager.enable(LogCategory.INFO, LogCategory.ERROR, LogCategory.WARN);

// Or use preset
import { setCategoryPreset } from 'persuader/utils/logging/presets';  
setCategoryPreset('STANDARD');
```

#### **Issue: Too much log output (performance impact)**

```typescript
// Use more restrictive preset
setCategoryPreset('PROD_MINIMAL'); // Only errors and warnings

// Or disable noisy categories
import { disableCategories } from 'persuader';
disableCategories(LogCategory.DEBUG, LogCategory.LLM_RESPONSE, LogCategory.VALIDATION_SUCCESS);

// Enable log truncation
logger.updateConfig({ truncate: true, maxPromptLength: 200 });
```

#### **Issue: Sensitive data visible in logs**

```typescript
// Increase privacy level
import { getGlobalPrivacyFilter, PrivacyLevel } from 'persuader/utils/logging/privacy-filter';
getGlobalPrivacyFilter().setLevel(PrivacyLevel.STRICT);

// Add custom sensitive patterns
addRedactedField('customSensitiveField');
addRedactedField(/SECRET_\w+/);

// Run privacy scan
// CLI: persuader logs privacy-scan --level strict --fix
```

#### **Issue: Log files growing too large**

```typescript
// Configure smaller file rotation
const writer = createJsonlWriter({
  maxFileSize: 5 * 1024 * 1024,  // 5MB instead of 10MB
  maxFiles: 20,                   // Keep more smaller files
  compress: true                  // Enable compression
});

// Set up automatic cleanup
// CLI: persuader logs clean --older-than 7 --compress
```

#### **Issue: Missing context in log entries**

```typescript
// Add more context to log calls
logger.info('Operation completed', {
  requestId: 'req-123',
  sessionId: 'session-456', 
  userId: 'user-789',
  operation: 'data-extraction',
  duration: 1234,
  tokenUsage: { input: 890, output: 156 }
});

// Use structured logging for better searchability
logJson('debug', 'Request Context', {
  timestamp: new Date().toISOString(),
  request: { id: 'req-123', type: 'validation' },
  session: { id: 'session-456', operations: 15 },
  metadata: { retries: 2, success: true }
});
```

---

## 📋 Quick Reference Card

### Essential Commands
```bash
# View recent logs
persuader logs view --lines 50 --follow

# Search for errors  
persuader logs search "error" --since 1h -i

# Performance metrics
persuader logs perf --period 24h

# Clean old logs
persuader logs clean --older-than 7 --dry-run

# Privacy scan
persuader logs privacy-scan --level standard

# Show configuration
persuader logs config --show
```

### Configuration Snippets
```typescript
// Development setup
import { getPreset } from 'persuader/utils/logging/presets';
const devConfig = getPreset('LOCAL_DEV');

// Production setup
const prodConfig = getPreset('PRODUCTION');

// Debug specific session
createSessionLogging('debug-123', 'verboseDebug', LogCategory.LLM_ALL);

// Enable privacy protection
setGlobalPrivacyFilter(new PrivacyFilter({ level: PrivacyLevel.STRICT }));
```

### Category Quick Reference
```typescript
// Essential categories
LogCategory.ERROR           // Critical failures
LogCategory.LLM_REQUEST     // Outgoing prompts  
LogCategory.LLM_RESPONSE    // Response content
LogCategory.VALIDATION_FAILURE // Schema failures
LogCategory.PERFORMANCE     // Timing metrics

// Combined presets
LogCategory.LLM_ALL         // All LLM categories
LogCategory.VALIDATION_ALL  // All validation categories  
LogCategory.STANDARD        // Production baseline
LogCategory.FULL            // Everything enabled
```

---

## 🎯 Summary

The Persuader logging framework is designed to be the **most comprehensive and developer-friendly logging system** for LLM applications. By making logging a first-class citizen, we enable:

- **🔍 Complete Transparency**: See every aspect of LLM interactions
- **🎯 Granular Control**: 30+ categories with bitwise precision
- **🔒 Privacy-First**: Automatic PII detection and compliance features
- **📊 Performance Insights**: Built-in monitoring and cost tracking
- **🛠️ Powerful CLI**: 8 specialized commands for log management
- **🎨 Beautiful Output**: Color-coded, structured, human-readable logs

Whether you're debugging a complex validation issue, monitoring production performance, or ensuring privacy compliance, Persuader's logging system provides the tools and visibility you need to build reliable, transparent, and efficient LLM applications.

**Next Steps:**
1. Start with `persuader logs config --show` to see your current setup
2. Try `persuader logs view --follow` to see real-time logs
3. Enable debug mode with `--debug` flag for maximum transparency  
4. Explore presets with `getPreset('LOCAL_DEV')` for development
5. Set up privacy protection with `PrivacyLevel.STANDARD` for production

For additional examples and advanced usage patterns, see the [Migration Guide](./docs/LOGGING_MIGRATION_GUIDE.md) and [API Reference](./API.md).