# Persuader API Reference

> Complete reference for all functions, classes, and utilities exported by the Persuader package.

## Table of Contents

- [Core Functions](#core-functions)
- [Provider Adapters](#provider-adapters)
- [Session Management](#session-management)
- [Validation & Retry](#validation--retry)
- [Utilities](#utilities)
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
  context: "You are a technical writer"
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

**Returns:** `Promise<Result<T>>` with validated data and execution metadata

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

### Configuration Types

- All provider adapter configuration types (`ClaudeCLIAdapterConfig`, `OpenAIAdapterConfig`, etc.)
- `SessionConfig` - Session management configuration
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