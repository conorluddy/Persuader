# Persuader API Reference

> Complete reference for all functions, classes, and utilities exported by the Persuader package.

## Table of Contents

- [Core Functions](#core-functions)
- [Provider Adapters](#provider-adapters)
- [Session Management](#session-management)
- [Validation & Retry](#validation--retry)
- [Utilities](#utilities)
- [Logging System](#logging-system)
  - [Category-Based Logging](#category-based-logging)
  - [Logging Presets](#logging-presets)
  - [Privacy Filter](#privacy-filter)
  - [Performance Monitoring](#performance-monitoring)
  - [Session Logger](#session-logger)
  - [JSONL Rotation Writer](#jsonl-rotation-writer)
  - [Logging Configuration](#logging-configuration)
- [Legacy Interface](#legacy-interface)
- [Type Exports](#type-exports)

## Core Functions

### `persuade<T>(options: Options<T>): Promise<Result<T>>`

Main LLM orchestration function with schema-driven validation and retry loops.

```typescript
import { persuade } from 'persuader';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  description: z.string()
});

const result = await persuade({
  input: "Create a blog post about TypeScript",
  schema,
  provider: createClaudeCLIAdapter(),
  context: "You are a technical writer",
  exampleOutput: {
    title: "Advanced TypeScript Features",
    description: "Exploring the latest TypeScript capabilities for modern development"
  }
});
```

**Parameters:**
- `input: string` - The input prompt/data to process
- `schema: ZodSchema<T>` - Zod schema for validation
- `provider: ProviderAdapter` - LLM provider adapter
- `context?: string` - Optional context for the LLM
- `lens?: string` - Optional perspective/lens for processing
- `maxRetries?: number` - Maximum retry attempts (default: 3)
- `sessionId?: string` - Optional session for context reuse
- `exampleOutput?: T` - Optional concrete example of valid output to guide LLM formatting
- `successMessage?: string` - Optional success feedback for session-based learning
- `enhancement?: number | EnhancementConfiguration` - Optional enhancement rounds to improve initial successful results

**Returns:** `Promise<Result<T>>` with validated data and execution metadata

#### Enhanced Schema Guidance with `exampleOutput`

The `exampleOutput` parameter significantly improves LLM output reliability by providing concrete examples:

```typescript
import { z } from 'zod';
import { persuade, createClaudeCLIAdapter } from 'persuader';

const ProductSchema = z.object({
  rating: z.enum(['excellent', 'good', 'fair', 'poor']),
  score: z.number().min(1).max(10),
  features: z.array(z.string()).min(1).max(5),
  recommended: z.boolean()
});

// Without exampleOutput - LLM might use inconsistent formatting
const basicResult = await persuade({
  input: "Review this smartphone: Great camera, fast processor, good battery life",
  schema: ProductSchema,
  context: "You are a product reviewer"
});

// With exampleOutput - LLM follows exact formatting
const enhancedResult = await persuade({
  input: "Review this smartphone: Great camera, fast processor, good battery life", 
  schema: ProductSchema,
  context: "You are a product reviewer",
  exampleOutput: {
    rating: "excellent",     // Shows exact enum formatting
    score: 8,               // Demonstrates realistic numeric values
    features: ["camera", "processor", "battery"], // Array structure and content style
    recommended: true       // Boolean usage example
  }
});
```

**Key Benefits:**
- **Enum Consistency**: Prevents "Good" vs "good" formatting issues
- **Realistic Values**: Guides appropriate numeric ranges and content
- **Structure Clarity**: Shows proper nesting and array formatting
- **Validation**: Example is validated against schema before use

**Validation**: The `exampleOutput` is validated against the provided schema before any LLM calls. If validation fails, an error is thrown immediately.

#### Session-Based Learning with `successMessage`

The `successMessage` parameter enables positive reinforcement for session-based learning workflows:

```typescript
import { initSession, persuade } from 'persuader';
import { z } from 'zod';

const AnalysisSchema = z.object({
  summary: z.string().min(50),
  keyPoints: z.array(z.string()).min(3),
  confidence: z.number().min(0).max(1)
});

// Create session for multiple related requests
const { sessionId } = await initSession({
  context: "You are an expert data analyst providing structured insights."
});

// First request with success feedback
const result1 = await persuade({
  input: "Analyze Q1 sales data: Revenue up 15%, new customers increased 23%...",
  schema: AnalysisSchema,
  sessionId,
  successMessage: "✅ Perfect analysis! Your structured format and depth are exactly what we need. Continue this approach."
});

// Subsequent requests benefit from reinforced patterns  
const result2 = await persuade({
  input: "Analyze Q2 sales data: Revenue up 8%, customer retention at 94%...",
  schema: AnalysisSchema,
  sessionId, // Same session
  successMessage: "Great work! Maintain this level of detail and formatting consistency."
});
```

**Success Feedback Triggers When:**
1. ✅ Schema validation passes (on **any successful attempt**)
2. ✅ A `sessionId` is provided (session-based workflow) 
3. ✅ A `successMessage` parameter is provided
4. ✅ The provider supports success feedback (Claude CLI does)

**Benefits:**
- **Pattern Reinforcement**: Helps LLM understand successful output characteristics
- **Consistency**: Reduces variance across multiple session requests
- **Learning**: Builds on successful approaches throughout the conversation
- **Complementary**: Works alongside error feedback for comprehensive learning

**Best Practices:**
- Be specific about what was done well: format, accuracy, approach
- Use encouraging, positive language
- Keep messages concise but meaningful
- Maintain consistent feedback patterns for similar work types

#### Enhancement Rounds with `enhancement`

The `enhancement` parameter enables automatic improvement of initial successful results through additional LLM calls with encouraging prompts. This bridges the gap between "acceptable" and "excellent" results while maintaining reliability.

```typescript
import { persuade } from 'persuader';
import { z } from 'zod';

const TransitionsSchema = z.object({
  transitions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced'])
  })).min(3) // Hard minimum
});

// Simple enhancement - try to improve twice
const result = await persuade({
  input: "Generate BJJ transitions from mount position",
  schema: TransitionsSchema,
  enhancement: 2, // Try 2 enhancement rounds after initial success
  context: "You are a BJJ expert"
});

// Advanced enhancement configuration
const advancedResult = await persuade({
  input: "Create a workout plan",
  schema: WorkoutSchema,
  enhancement: {
    rounds: 1,
    strategy: 'expand-detail',
    minImprovement: 0.3, // Require 30% improvement to accept
    customPrompt: (currentResult, round) => 
      `Great start! Can you add more detailed exercise descriptions and progression tips?`
  }
});
```

**Enhancement Configuration:**

**Simple Format (Number):**
- `enhancement: 2` - Try 2 enhancement rounds with default strategy

**Advanced Format (Object):**
- `rounds: number` - Number of enhancement attempts (0 disables enhancement)
- `strategy?: 'expand-array' | 'expand-detail' | 'expand-variety' | 'custom'` - Enhancement approach
- `minImprovement?: number` - Minimum improvement score (0-1) to accept enhancement (default: 0.2)
- `customPrompt?: (currentResult: unknown, round: number) => string` - Custom prompt builder
- `evaluateImprovement?: (baseline: unknown, enhanced: unknown) => number` - Custom improvement scorer

**Enhancement Strategies:**

1. **`expand-array`** (default): Encourages more items in arrays
   - Good for: Lists, collections, multiple examples
   - Prompt style: "Great start! Could you add 5-10 more diverse items?"

2. **`expand-detail`**: Encourages more detailed descriptions  
   - Good for: Explanations, instructions, comprehensive content
   - Prompt style: "Good response! Could you add more detailed information and context?"

3. **`expand-variety`**: Encourages more diverse content
   - Good for: Reducing repetition, exploring different perspectives  
   - Prompt style: "Nice variety! Could you include more unique and distinctive examples?"

4. **`custom`**: Uses your custom prompt function
   - Requires: `customPrompt` function that builds enhancement prompts
   - Full control over enhancement messaging

**How Enhancement Works:**

1. **Initial Success**: First, get a valid result that passes schema validation
2. **Save Baseline**: Store the successful result as guaranteed fallback
3. **Enhancement Rounds**: Make additional LLM calls with encouraging prompts
4. **Improvement Evaluation**: Score enhancements against baseline using strategy-specific metrics
5. **Best Result Wins**: Return the best result, never worse than baseline
6. **Risk-Free**: Enhancement never compromises the initial valid result

**Example Use Cases:**

```typescript
// BJJ Transitions: Get minimum 3, enhance to 15-20 for comprehensive coverage
const transitions = await persuade({
  schema: z.object({ transitions: z.array(TransitionType).min(3) }),
  input: "Transitions from side control",
  enhancement: 2, // Default expand-array strategy
});

// Workout Plans: Enhance detail and instruction quality
const workout = await persuade({
  schema: WorkoutSchema,
  input: "Upper body strength workout",
  enhancement: {
    rounds: 1,
    strategy: 'expand-detail'
  }
});

// Product Analysis: Reduce repetitive insights
const analysis = await persuade({
  schema: AnalysisSchema, 
  input: "Analyze market trends",
  enhancement: {
    rounds: 1,
    strategy: 'expand-variety',
    minImprovement: 0.25 // Require 25% improvement
  }
});
```

**Performance Considerations:**
- Enhancement adds extra LLM calls (cost and time)
- Each round is independent - failures don't affect baseline
- Use `minImprovement` threshold to avoid unnecessary enhancements
- Consider enhancement rounds in token budgets for workflows

**Enhancement vs Retries:**
- **Retries**: Fix validation failures, get from invalid → valid
- **Enhancement**: Improve valid results, get from acceptable → excellent
- Both work together: retries ensure validation, enhancement improves quality

### `preload(options: PreloadOptions, provider?: ProviderAdapter): Promise<PreloadResult>`

Load data into an existing session without output validation for context building.

```typescript
import { preload, initSession } from 'persuader';

// First, create a session
const { sessionId } = await initSession({
  context: 'You are a financial analyst',
  initialPrompt: 'Ready to analyze financial data'
});

// Then preload context data
const result = await preload({
  sessionId,
  input: 'Q4 earnings report: Revenue $1.2M, Expenses $800K, Profit $400K',
  context: 'Store this financial data for analysis'
});

if (result.ok) {
  console.log('Data preloaded successfully');
}
```

**Parameters:**
- `input: unknown` - Input data to load into the session
- `sessionId: string` - Existing session ID (required)
- `context?: string` - Optional additional context for this operation
- `lens?: string` - Optional perspective/lens for processing
- `model?: string` - LLM model to use
- `validateInput?: ZodSchema<unknown>` - Optional schema to validate input before sending
- `logLevel?: LogLevel` - Logging level for this operation
- `providerOptions?: Record<string, unknown>` - Provider-specific options

**Returns:** `Promise<PreloadResult>` with raw response and execution metadata

**Use Cases:**
- Loading large documents into session context
- Building rich context before structured extraction
- Progressive session enhancement with multiple data sources
- Data quality validation before LLM processing

### `initSession(options: InitSessionOptions): Promise<InitSessionResult>`

Initialize a session for context reuse across multiple operations.

```typescript
import { initSession, createClaudeCLIAdapter } from 'persuader';

const session = await initSession({
  provider: createClaudeCLIAdapter(),
  context: "You are a fitness expert with 10 years of experience"
});

// Use session across multiple calls
const result1 = await persuade({ 
  input: "Create a workout", 
  schema, 
  sessionId: session.sessionId 
});
```

**Parameters:**
- `provider: ProviderAdapter` - Provider that supports sessions
- `context: string` - Initial context for the session
- `options?: ProviderPromptOptions` - Provider-specific options

**Returns:** `Promise<InitSessionResult>` with sessionId and metadata

## Provider Adapters

### Claude CLI Adapter

#### `createClaudeCLIAdapter(config?: ClaudeCLIAdapterConfig): ProviderAdapter`

Primary adapter using the Claude CLI for reliable LLM access.

```typescript
import { createClaudeCLIAdapter } from 'persuader';

const provider = createClaudeCLIAdapter({
  model: 'claude-3-5-sonnet-20241022',
  timeout: 30000
});
```

**Configuration:**
- `model?: string` - Claude model to use
- `timeout?: number` - Request timeout in milliseconds
- `debug?: boolean` - Enable debug logging

### OpenAI Adapter

#### `createOpenAIAdapter(config?: OpenAIAdapterConfig): ProviderAdapter`

Direct OpenAI API integration.

```typescript
import { createOpenAIAdapter } from 'persuader';

const provider = createOpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4'
});
```

### Anthropic SDK Adapter

#### `createAnthropicSDKAdapter(config?: AnthropicSDKAdapterConfig): ProviderAdapter`

Official Anthropic SDK integration with streaming support.

```typescript
import { createAnthropicSDKAdapter } from 'persuader';

const provider = createAnthropicSDKAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022'
});
```

### Gemini Adapter

#### `createGeminiAdapter(config?: GeminiAdapterConfig): ProviderAdapter`

Google Gemini integration with multimodal capabilities.

```typescript
import { createGeminiAdapter } from 'persuader';

const provider = createGeminiAdapter({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-pro'
});
```

### Ollama Adapter

#### `createOllamaAdapter(config?: OllamaAdapterConfig): ProviderAdapter`

Local Ollama integration for privacy-focused deployments.

```typescript
import { createOllamaAdapter } from 'persuader';

const provider = createOllamaAdapter({
  baseUrl: 'http://localhost:11434',
  model: 'llama2'
});
```

### Vercel AI SDK Adapter

#### `createVercelAISDKAdapter(config: VercelAISDKAdapterConfig): ProviderAdapter`

Vercel AI SDK integration supporting multiple providers.

```typescript
import { createVercelAISDKAdapter } from 'persuader';
import { openai } from 'ai';

const provider = createVercelAISDKAdapter({
  model: openai('gpt-4')
});
```

### Provider Utilities

#### `createProviderAdapter(type: ProviderType, options?: Record<string, unknown>): ProviderAdapter`

Factory function for creating provider adapters by type.

```typescript
import { createProviderAdapter } from 'persuader';

const provider = createProviderAdapter('openai', {
  apiKey: process.env.OPENAI_API_KEY
});
```

#### `getAvailableProviders(): ProviderType[]`

Returns array of supported provider types.

```typescript
import { getAvailableProviders } from 'persuader';

const providers = getAvailableProviders();
// ['claude-cli', 'openai', 'ollama', 'gemini', 'anthropic-sdk', 'vercel-ai-sdk']
```

#### `isProviderTypeSupported(type: string): type is ProviderType`

Type guard to check if a provider type is supported.

```typescript
import { isProviderTypeSupported } from 'persuader';

if (isProviderTypeSupported('claude-cli')) {
  // Type is narrowed to ProviderType
}
```

## Session Management

### `createSessionManager(): SessionManager`

Create a session manager for handling session lifecycle.

```typescript
import { createSessionManager } from 'persuader';

const sessionManager = createSessionManager();
const session = await sessionManager.createSession(provider, context);
```

### `createProviderSessionManager(provider: ProviderAdapter): ProviderSessionManager`

Create a provider-specific session manager.

```typescript
import { createProviderSessionManager } from 'persuader';

const providerSessions = createProviderSessionManager(provider);
```

### `defaultSessionManager: SessionManager`

Default session manager instance for convenience.

```typescript
import { defaultSessionManager } from 'persuader';

const session = await defaultSessionManager.createSession(provider, context);
```

### `getSessionMetrics(sessionId: string): Promise<SessionMetrics | null>`

Retrieve comprehensive performance metrics for a session.

```typescript
import { getSessionMetrics, persuade, initSession } from 'persuader';
import { z } from 'zod';

// Initialize session and run operations
const { sessionId } = await initSession({ 
  context: "You are an expert analyst",
  successMessage: "Great analysis!" 
});

const schema = z.object({
  insights: z.array(z.string()),
  confidence: z.number()
});

// Run operations with success feedback
await persuade({
  schema,
  input: "Analyze market trends...",
  sessionId,
  successMessage: "Excellent analysis! Keep this detailed approach."
});

// Get comprehensive metrics
const metrics = await getSessionMetrics(sessionId);
if (metrics) {
  console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
  console.log(`Average attempts: ${metrics.avgAttemptsToSuccess.toFixed(1)}`);
  console.log(`Total operations: ${metrics.successfulValidations}`);
  console.log(`Operations with retries: ${metrics.operationsWithRetries}`);
  console.log(`Execution time: ${metrics.avgExecutionTimeMs}ms`);
  console.log(`Token usage: ${metrics.totalTokenUsage?.totalTokens}`);
}
```

**Returns:** `Promise<SessionMetrics | null>` containing:

- `totalAttempts: number` - Total validation attempts across all operations
- `successfulValidations: number` - Number of successful validations
- `avgAttemptsToSuccess: number` - Average attempts needed for success
- `successRate: number` - Success rate as percentage (0-1)
- `lastSuccessTimestamp?: Date` - Most recent successful validation
- `totalExecutionTimeMs: number` - Total execution time across all attempts
- `avgExecutionTimeMs: number` - Average execution time per attempt
- `totalTokenUsage?: TokenUsage` - Aggregated token consumption
- `operationsWithRetries: number` - Count of operations requiring retries
- `maxAttemptsForOperation: number` - Maximum attempts needed for any single operation

**Use Cases:**
- **Performance Analysis**: Identify optimization opportunities
- **Success Pattern Recognition**: Understand what works best
- **Cost Monitoring**: Track token usage and execution times
- **Quality Metrics**: Monitor success rates and retry patterns
- **Learning Effectiveness**: Evaluate session-based learning progress

## Validation & Retry

### `validateJson<T>(input: string, schema: ZodSchema<T>): ValidationResult<T>`

Validate JSON string against Zod schema with detailed error feedback.

```typescript
import { validateJson } from 'persuader';
import { z } from 'zod';

const schema = z.object({ name: z.string() });
const result = validateJson('{"name": "John"}', schema);

if (result.success) {
  console.log(result.data); // { name: "John" }
} else {
  console.log(result.errors); // Detailed validation errors
}
```

### `retryWithFeedback<T>(options: RetryWithFeedbackOptions<T>): Promise<RetryResult<T>>`

Intelligent retry logic with validation-driven feedback for LLMs.

```typescript
import { retryWithFeedback } from 'persuader';

const result = await retryWithFeedback({
  operation: async () => provider.sendPrompt(sessionId, prompt),
  validator: (response) => validateJson(response.content, schema),
  maxRetries: 3,
  feedbackBuilder: (errors) => formatValidationErrorFeedback(errors)
});
```

### `formatValidationErrorFeedback(errors: ValidationError[]): string`

Convert validation errors into LLM-friendly feedback with suggestions.

```typescript
import { formatValidationErrorFeedback } from 'persuader';

const feedback = formatValidationErrorFeedback(errors);
// "The field 'status' must be one of: active, inactive, pending. You provided: 'running'. Did you mean: 'active'?"
```

## Utilities

### Prompt Building

#### `buildPrompt(options: PromptBuildOptions): PromptParts`

Construct prompts with templates, context, and schema information.

```typescript
import { buildPrompt } from 'persuader';

const parts = buildPrompt({
  input: "Create a user profile",
  schema,
  context: "You are a UX designer",
  lens: "Focus on accessibility"
});
```

### Schema Analysis

#### `extractSchemaInfo(schema: ZodSchema): SchemaInfo`

Extract metadata and structure information from Zod schemas.

```typescript
import { extractSchemaInfo } from 'persuader';

const info = extractSchemaInfo(schema);
console.log(info.fields); // Field definitions
console.log(info.description); // Schema description
```

#### `getSchemaDescription(schema: ZodSchema): string`

Generate human-readable description of schema structure.

```typescript
import { getSchemaDescription } from 'persuader';

const description = getSchemaDescription(schema);
// "Object with required fields: name (string), age (number), optional email (string)"
```

### File I/O

#### `loadSchema(filePath: string): Promise<SchemaLoadResult>`

Dynamically load TypeScript/JavaScript schema files at runtime.

```typescript
import { loadSchema } from 'persuader';

const result = await loadSchema('./schemas/user.ts');
if (result.success) {
  const schema = result.schema;
}
```

#### `readInputs(patterns: string[]): Promise<InputFileMetadata[]>`

Read input files using glob patterns with metadata.

```typescript
import { readInputs } from 'persuader';

const inputs = await readInputs(['./data/*.json']);
```

#### `writeOutput(data: unknown, options: WriteOutputOptions): Promise<void>`

Write processed data to output files with formatting.

```typescript
import { writeOutput } from 'persuader';

await writeOutput(results, {
  outputPath: './output.json',
  format: 'json',
  pretty: true
});
```

### Logging

#### `debug(message: string, context?: LogContext): void`
#### `info(message: string, context?: LogContext): void`
#### `warn(message: string, context?: LogContext): void`
#### `error(message: string, context?: LogContext): void`

Structured logging functions with context support.

```typescript
import { info, debug } from 'persuader';

info('Processing started', { userId: '123', operation: 'validate' });
debug('Validation details', { field: 'email', value: 'test@example.com' });
```

### Testing

#### `createMockProvider(responses?: string[]): ProviderAdapter`

Create mock provider for testing with predefined responses.

```typescript
import { createMockProvider } from 'persuader';

const mockProvider = createMockProvider([
  '{"name": "John", "age": 30}',
  '{"name": "Jane", "age": 25}'
]);
```

### Execution Monitoring

#### `formatResultMetadata(metadata: ExecutionMetadata): string`

Format execution metadata for display.

```typescript
import { formatResultMetadata } from 'persuader';

const formatted = formatResultMetadata(result.metadata);
console.log(formatted); // "Duration: 1.2s, Tokens: 150, Retries: 1"
```

#### `getExecutionStats(results: Result<any>[]): ExecutionStats`

Aggregate statistics from multiple execution results.

```typescript
import { getExecutionStats } from 'persuader';

const stats = getExecutionStats(batchResults);
console.log(stats.averageDuration);
console.log(stats.totalTokens);
```

## Logging System

> **📖 Complete Logging Documentation**: This section provides API reference for logging components. For comprehensive usage guides, configuration examples, CLI commands, and troubleshooting, see [LOGGING.md](./LOGGING.md).

### Category-Based Logging

#### `CategoryManager`

Manages logging categories with bitwise flags for fine-grained control.

```typescript
import { CategoryManager, LogCategory } from 'persuader';

const manager = new CategoryManager(LogCategory.LLM | LogCategory.VALIDATION);
manager.enable(LogCategory.PERFORMANCE);
manager.disable(LogCategory.DEBUG);
```

#### `LogCategory` Enum

Available logging categories:
- `GENERAL` - General application logs
- `LLM` - LLM request/response logs  
- `VALIDATION` - Schema validation logs
- `PERFORMANCE` - Performance metrics
- `SESSION` - Session management
- `RETRY` - Retry loop debugging
- `SCHEMA` - Schema analysis
- `PROVIDER` - Provider operations
- `CACHE` - Cache operations
- `CONFIG` - Configuration changes
- `ERROR` - Error logs
- `DEBUG` - Debug information

### Logging Presets

#### `CategoryPresets`

Pre-configured category combinations for common use cases:

```typescript
import { CategoryPresets, setCategoryPreset } from 'persuader';

// Set production logging
setCategoryPreset(CategoryPresets.PRODUCTION);

// Available presets:
// - DEVELOPMENT: Full logging for development
// - PRODUCTION: Minimal logging for production
// - DEBUG: Maximum verbosity
// - PERFORMANCE: Focus on performance metrics
// - MINIMAL: Errors only
```

### Privacy Filter

#### `PrivacyFilter`

Intelligent masking and redaction of sensitive data in logs.

```typescript
import { PrivacyFilter, PrivacyLevel } from 'persuader';

const filter = new PrivacyFilter({
  level: PrivacyLevel.STANDARD,
  preserveStructure: true,
  showPartial: false
});

const filtered = filter.filterString("email: user@example.com");
// Output: "email: ****@****.***"

const hasPrivateData = filter.containsSensitiveData(input);
const detectedTypes = filter.detectSensitiveData(input);
```

#### `PrivacyLevel` Enum

- `OFF` - No masking
- `MINIMAL` - Only mask obvious sensitive data (tokens, keys)
- `STANDARD` - Mask PII and credentials
- `STRICT` - Mask all potential sensitive data
- `PARANOID` - Maximum masking, including metadata

### Performance Monitoring

#### `PerformanceMonitor`

Track operation timings, memory usage, and performance metrics.

```typescript
import { getGlobalPerformanceMonitor, startTimer, endTimer } from 'persuader';

const monitor = getGlobalPerformanceMonitor();

// Start timing an operation
const timerId = startTimer('data-processing');
// ... do work ...
endTimer(timerId, { success: true });

// Get statistics
const stats = monitor.getStats('data-processing');
console.log(stats.mean, stats.p95, stats.p99);

// Export metrics
const prometheus = monitor.exportMetrics('prometheus');
const json = monitor.exportMetrics('json');
```

#### `@timed` Decorator

Automatically time class methods:

```typescript
import { timed } from 'persuader';

class DataProcessor {
  @timed('process-batch')
  async processBatch(data: any[]) {
    // Automatically timed
  }
}
```

### Session Logger

#### `SessionLogger<T>`

Context-aware logging with automatic scope management.

```typescript
import { SessionLogger, createSessionId, createRequestId } from 'persuader';

interface AppContext {
  userId: string;
  feature: string;
}

const logger = new SessionLogger<AppContext>({
  sessionId: createSessionId('session-123'),
  userId: 'user-456',
  feature: 'data-import'
});

// Log with context
logger.info('Starting import', { fileCount: 10 });

// Create request scope
const requestLogger = logger.createRequestScope(
  createRequestId('req-789'),
  { endpoint: '/api/import' }
);
```

### JSONL Rotation Writer

#### `JSONLRotationWriter`

Structured logging to JSONL files with automatic rotation.

```typescript
import { JSONLRotationWriter } from 'persuader';

const writer = new JSONLRotationWriter({
  directory: './logs',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 7,
  compress: true
});

await writer.write({
  timestamp: new Date(),
  level: 'info',
  message: 'Application started',
  context: { version: '1.0.0' }
});

await writer.rotate(); // Manual rotation
await writer.close(); // Cleanup
```

### Logging Configuration

#### `LoggingConfig`

Comprehensive logging configuration interface:

```typescript
import { LoggingConfig, configureLogging } from 'persuader';

const config: LoggingConfig = {
  categories: LogCategory.LLM | LogCategory.VALIDATION,
  formatting: {
    colors: true,
    timestamp: true,
    prefix: '[APP]'
  },
  output: {
    console: true,
    jsonl: true,
    logsDirectory: './logs'
  },
  privacy: {
    maskSensitiveData: true,
    redactFields: ['password', 'apiKey']
  },
  performance: {
    trackMetrics: true,
    slowThreshold: 1000
  }
};

configureLogging(config);
```

### Logging Utilities

#### `sanitizeLogContext`

Sanitize log context before writing:

```typescript
import { sanitizeLogContext } from 'persuader';

const sanitized = sanitizeLogContext({
  user: 'john@example.com',
  apiKey: 'sk-123456',
  data: { count: 42 }
});
// Output: { user: '****@****.***', apiKey: '<REDACTED_API_KEY>', data: { count: 42 } }
```

## Legacy Interface

### `Persuader` Class

Object-oriented interface for backward compatibility.

```typescript
import { Persuader } from 'persuader';

const persuader = Persuader.create({
  maxRetries: 5,
  timeout: 15000,
  debug: true
});

const result = await persuader.process(input, schema, processor);
```

## Type Exports

### Core Types

- `Options<T>` - Configuration for persuade() function
- `Result<T>` - Execution result with metadata
- `ExecutionMetadata` - Performance and execution details
- `InitSessionOptions` - Session initialization configuration
- `InitSessionResult` - Session creation result
- `EnhancementConfiguration` - Enhancement rounds configuration

### Provider Types

- `ProviderAdapter` - Provider interface contract
- `ProviderResponse` - Standardized provider response
- `ProviderPromptOptions` - Provider-specific options
- `ProviderHealth` - Provider health check result
- `ProviderType` - Union of supported provider types

### Validation Types

- `ValidationResult<T>` - Validation operation result
- `ValidationError` - Structured validation error
- `RetryResult<T>` - Retry operation result
- `RetryWithFeedbackOptions<T>` - Retry configuration

### Session Types

- `SessionMetrics` - Comprehensive session performance metrics
- `SessionConfig` - Session management configuration  
- `SessionManager` - Session management interface
- `SessionSuccessFeedback` - Success feedback tracking data

### Configuration Types

- All provider adapter configuration types (`ClaudeCLIAdapterConfig`, `OpenAIAdapterConfig`, etc.)
- `PromptBuildOptions` - Prompt construction options
- `WriteOutputOptions` - File output configuration

### Utility Types

- `SchemaInfo` - Schema metadata structure
- `LogContext` - Logging context structure
- `LogLevel` - Logging level enumeration
- `InputFileMetadata` - File input metadata

## Module Health Checks

### `isCoreModuleReady(): boolean`

Check if core module dependencies are properly initialized.

```typescript
import { isCoreModuleReady } from 'persuader';

if (!isCoreModuleReady()) {
  throw new Error('Core module not ready');
}
```

## Constants

The package exports various constants for configuration and defaults:

```typescript
import { 
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  SUPPORTED_INPUT_FORMATS,
  CORE_MODULE_VERSION 
} from 'persuader';
```

## Error Handling

All functions use structured error handling with clear error types:

- `ValidationError` - Schema validation failures
- `ProviderError` - Provider communication issues  
- `SessionError` - Session management failures
- `ConfigurationError` - Invalid configuration

## Best Practices

1. **Always use sessions** for batch processing to reduce token costs
2. **Handle validation errors** gracefully with user-friendly messages  
3. **Monitor execution metadata** for performance optimization
4. **Use appropriate providers** based on your privacy/cost requirements
5. **Implement proper error handling** for production applications

---

For implementation examples and getting started guides, see the [README](./README.md) and [examples directory](./examples/).