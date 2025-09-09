# Persuader

```
npm i persuader
```

A TypeScript framework for LLM orchestration with Zod schema validation and intelligent retry loops.


## 🎯 Overview

Persuader provides a robust TypeScript framework for processing data with Large Language Models while ensuring type safety and validation. The framework demonstrates its capabilities through yoga pose analysis examples, showing how to handle complex domain knowledge with reliable validation patterns.

### Key Features

- **Schema-First Validation**: Zod integration with intelligent error feedback for retry loops
- **Type Safety**: Full TypeScript support with generated types from schemas
- **CLI Tool**: Production-ready `persuader run` command for batch processing
- **Session Management**: Optional session reuse for context continuity (Claude CLI adapter)
- **Comprehensive Testing**: 200+ tests with Vitest, full TypeScript coverage
- **Production Ready**: Error handling, logging, progress indicators, and metadata tracking

## 🚀 Core Patterns

### 1. Schema-First Validation with Retry Logic

Persuader uses Zod schemas to ensure LLM outputs match your expected structure, with intelligent retry loops when validation fails:

```typescript
import { z } from 'zod';
import { runPersuader, createClaudeCLIAdapter } from 'persuader';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150)
});

const result = await runPersuader({
  schema: UserSchema,
  input: rawUserData,
  retries: 5,
  context: "Extract user information accurately"
}, createClaudeCLIAdapter());

if (result.ok) {
  // result.value is fully typed and validated
  console.log('User:', result.value);
}
```

### 2. CLI-First Design

Process data with the `persuader run` command for batch operations:

```bash
# Process multiple files with schema validation
persuader run \
  --schema ./schemas/user.ts \
  --input "./data/*.json" \
  --output ./results/ \
  --retries 3 \
  --verbose
```

### 3. Session Management (Claude CLI)

Optional session reuse for context continuity:

```typescript
import { createSessionManager, createClaudeCLIAdapter } from 'persuader';

const sessionManager = createSessionManager();
const provider = createClaudeCLIAdapter();

// Create session with shared context
const session = await sessionManager.createSession(provider, {
  context: 'You are an expert data analyst...'
});

// Process multiple items with shared context
for (const item of items) {
  const result = await runPersuader({
    schema: MySchema,
    input: item,
    sessionId: session.id
  }, provider);
}
```

## 💎 Architecture

Persuader's core innovation is **wrapping LLM responses between two layers of Zod validation** - one for input structure and one for output validation, with intelligent retry loops that learn from validation failures.

### Intelligent Error-Driven Re-prompting

When validation fails, Persuader converts specific Zod errors into targeted feedback for the next attempt:

```typescript
const UserSchema = z.object({
  email: z.string().email("Must be valid email"),
  age: z.number().min(0).max(150, "Age must be 0-150"),
  role: z.enum(['admin', 'user'], { message: "Role must be 'admin' or 'user'" })
});

// When validation fails, Persuader generates specific feedback:
// "Your previous response had validation errors:
// - email field: Must be valid email (you provided: 'not-an-email')
// - age field: Age must be 0-150 (you provided: 200)
// Please fix these specific issues and provide a corrected response."
```

### Session Management with Claude CLI

Persuader optionally leverages Claude CLI's session capabilities for context continuity:

```typescript
// Internal implementation uses claude -p --output-format json
// Sessions maintain conversation context across retries
// Response includes metadata for monitoring:
{
  "result": "The actual LLM response content",
  "session_id": "conv_123abc",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 75,
    "cache_read_input_tokens": 1200 // Context reuse
  },
  "duration_ms": 850
}
```

## 📦 Installation & Setup

### Requirements

- **Node.js**: Version 22.0.0 or higher
- **TypeScript**: 5.7.2+ for development
- **Claude CLI**: Required for the Claude adapter (`pip install claude-cli`)

### Installation

```bash
# Install as dependency
npm install persuader

# Install globally for CLI usage
npm install -g persuader

# Development setup
npm install persuader zod typescript @types/node
```

### Quick Start

1. **Create a schema file** (`schema.ts`):
```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email()
});
```

2. **Use the CLI**:
```bash
persuader run --schema ./schema.ts --input ./data.json
```

3. **Or use programmatically**:
```typescript
import { runPersuader, createClaudeCLIAdapter } from 'persuader';

const result = await runPersuader({
  schema: UserSchema,
  input: rawData,
  context: "Extract user information",
  retries: 3
}, createClaudeCLIAdapter());

if (result.ok) {
  console.log('Validated data:', result.value);
}
```

## 🎯 Examples & Learning

Explore comprehensive examples demonstrating Persuader's capabilities across different domains and complexity levels:

**👉 [View All Examples](./examples/README.md)**

### Quick Examples

```bash
# Fitness program analysis with expert perspectives  
npm run example:fitness

# Yoga pose transition generation
npm run example:yoga

# Multi-stage workout program generation
npm run example:workout

# Exercise relationship extraction
npm run example:exercise

# Advanced multi-dimensional analysis
npm run example:yoga-advanced
```

Each example includes:
- **Comprehensive documentation** with usage patterns and learning outcomes
- **Production-ready code** with error handling and type safety
- **Domain expertise** modeling real-world professional knowledge
- **Progressive complexity** from simple validation to multi-stage orchestration

Perfect for learning Persuader patterns, understanding domain modeling, and building your own LLM applications.

## 🏗️ Architecture

```
src/
├── core/
│   ├── runner.ts               # Main pipeline orchestration
│   ├── validation.ts           # Zod integration with error feedback
│   ├── retry.ts                # Smart retry with backoff logic
│   └── prompt.ts               # Prompt building and management
├── session/
│   ├── manager.ts              # Session lifecycle management
│   └── provider-session.ts     # Provider-specific sessions
├── adapters/
│   └── claude-cli.ts           # Claude CLI integration
├── cli/
│   ├── index.ts                # CLI entry point  
│   └── commands/run.ts         # Run command implementation
├── utils/
│   ├── file-io.ts              # File processing utilities
│   ├── schema-loader.ts        # Dynamic schema loading
│   ├── logger.ts               # Logging and JSONL output
│   └── schema-analyzer.ts      # Schema introspection
└── examples/                   # Comprehensive usage examples
```

## 🎨 API Reference

### Core `runPersuader` Function

The main entry point for processing data with validation and retry logic:

```typescript
import { runPersuader, createClaudeCLIAdapter } from 'persuader';
import { z } from 'zod';

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150)
});

const result = await runPersuader({
  schema: UserSchema,
  input: rawUserData,
  retries: 5,
  context: "Extract user information accurately",
  model: "claude-3-5-haiku-20241022"
}, createClaudeCLIAdapter());

if (result.ok) {
  // result.value is fully typed and validated
  console.log('Validated data:', result.value);
  console.log('Attempts taken:', result.attempts);
  console.log('Execution time:', result.metadata.executionTimeMs, 'ms');
}
```

### CLI Usage

```bash
# Basic usage
persuader run --schema ./schema.ts --input ./data.json

# Advanced options
persuader run \
  --schema ./schemas/user.ts \
  --input "./data/*.json" \
  --output ./results/ \
  --context "Extract user information with accuracy" \
  --lens "Focus on data completeness" \
  --retries 5 \
  --model claude-3-5-haiku-20241022 \
  --verbose

# Dry run (validate configuration without LLM calls)
persuader run --schema ./schema.ts --input ./data.json --dry-run
```

### Session Management (Optional)

Create sessions for context reuse across multiple operations:

```typescript
import { createSessionManager, createClaudeCLIAdapter } from 'persuader';

const sessionManager = createSessionManager();
const provider = createClaudeCLIAdapter();

// Create session with shared context
const session = await sessionManager.createSession(provider, {
  context: 'You are an expert data analyst...',
  model: 'claude-3-5-haiku-20241022'
});

// Process multiple items with shared session
for (const item of items) {
  const result = await runPersuader({
    schema: MySchema,
    input: item,
    sessionId: session.id
  }, provider);
  
  if (result.ok) {
    console.log('Processed:', result.value);
  }
}
```

### Result Interface

```typescript
interface Result<T> {
  ok: boolean;
  value?: T;              // Validated output (when ok: true)
  error?: ValidationError | ProviderError;  // Error details (when ok: false)
  attempts: number;       // Number of retry attempts made
  metadata: {
    executionTimeMs: number;
    startedAt: Date;
    completedAt: Date;
    provider: string;
    model?: string;
  };
  sessionId?: string;     // Session ID if used
}
```

## 🛠️ Key Features

### ✅ Currently Available

#### Core Framework
- **Schema-First Validation**: Zod integration with intelligent error feedback and retry logic
- **Type Safety**: Complete TypeScript support with generated types from schemas
- **Error-Driven Retries**: Converts Zod validation errors into specific LLM feedback for next attempts
- **Comprehensive Testing**: 200+ unit and integration tests with Vitest

#### CLI Tool (`persuader run`)
- **File Processing**: Supports JSON, YAML, and structured data files
- **Glob Patterns**: Process multiple files with wildcard patterns (`./data/*.json`)
- **Dynamic Schema Loading**: TypeScript/JavaScript schema file loading at runtime
- **Verbose Mode**: Detailed execution metrics, token usage, and debug information
- **Dry Run Mode**: Validate configuration without making LLM calls
- **Progress Indicators**: Real-time feedback with spinners and status updates

#### Session Management (Claude CLI)
- **Optional Session Reuse**: Initialize expensive context once, reuse across multiple items
- **Session Continuity**: Maintain conversation flow during validation retries
- **Claude CLI Integration**: Built-in adapter with session support and metadata tracking
- **Execution Metadata**: Comprehensive stats including timing, token usage, and attempt counts

#### Production Features
- **Robust Error Handling**: Detailed error types, recovery strategies, and graceful degradation
- **File I/O Utilities**: Robust file reading/writing with format detection
- **JSONL Logging**: Comprehensive session logging for debugging and analysis
- **Health Checks**: Provider validation before processing starts
- **Configuration Validation**: Pre-flight checks for all options and requirements

### 📋 Planned Features

- **Multi-Provider Support**: OpenAI, Anthropic SDK, and local model adapters
- **Advanced Patterns**: Progressive enhancement pipelines for complex workflows  
- **Batch Optimization**: Smart batching strategies for high-volume processing
- **Result Caching**: Intelligent caching layer for processed data
- **Observability**: Metrics collection and monitoring integration

## 📋 Examples

### Yoga Pose Analysis Demo

The included yoga demo demonstrates Persuader's capabilities with complex domain knowledge:

```bash
# Run the yoga pose transition demo
npm run demo:yoga

# Or use CLI to process yoga data
persuader run \
  --schema ./examples/yoga/simple-schema.ts \
  --input "./examples/yoga/simple-poses/*.json" \
  --context "You are an expert yoga instructor analyzing pose transitions" \
  --retries 3 \
  --verbose
```

### Basic Data Processing

```typescript
import { runPersuader, createClaudeCLIAdapter } from 'persuader';
import { z } from 'zod';

const PersonSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(0).max(150),
  location: z.string()
});

const result = await runPersuader({
  schema: PersonSchema,
  input: "John Doe is 30 years old, lives in San Francisco, email john@example.com",
  context: "Extract person information from text",
  retries: 3
}, createClaudeCLIAdapter());

if (result.ok) {
  console.log('Extracted:', result.value);
  // Type-safe access to result.value.name, .email, etc.
}
```

### Batch File Processing

```bash
# Process multiple JSON files with validation
persuader run \
  --schema ./schemas/user-schema.ts \
  --input "./data/*.json" \
  --output ./validated/ \
  --context "Clean and validate user data" \
  --retries 5 \
  --verbose
```

### Session-Based Processing

```typescript
import { createSessionManager, createClaudeCLIAdapter } from 'persuader';

const sessionManager = createSessionManager();
const provider = createClaudeCLIAdapter();

// Create shared context session
const session = await sessionManager.createSession(provider, {
  context: "You are a data analyst extracting insights from survey responses"
});

// Process multiple surveys with shared context
const results = [];
for (const survey of surveyResponses) {
  const result = await runPersuader({
    schema: SurveyInsightSchema,
    input: survey,
    sessionId: session.id, // Reuse context
    retries: 3
  }, provider);
  
  if (result.ok) {
    results.push(result.value);
  }
}
```

## 🎯 Framework Advantages

### vs. Single-Shot LLM Calls
- **Higher Success Rate**: Validation-driven retries improve reliability over single attempts
- **Type Safety**: Schema validation ensures consistent, typed output structure  
- **Error Feedback**: Specific validation errors guide LLM corrections on retry

### vs. Manual LLM Integration  
- **Ready-to-Use**: CLI and programmatic API ready out of the box
- **Comprehensive Testing**: Battle-tested with 200+ unit and integration tests
- **Production Features**: Error handling, progress tracking, and metadata collection built-in

### vs. Custom Solutions
- **Schema-First**: Leverage Zod's powerful validation ecosystem
- **TypeScript Native**: Full type safety from schema to final result
- **Extensible**: Clean provider adapter pattern for different LLM services

## 🏗️ Production Readiness

### v0.1.0 - Current Release

#### ✅ Core Features Complete
- **Schema-First Validation**: Full Zod integration with intelligent error feedback
- **CLI Tool**: Production-ready `persuader run` command with comprehensive options  
- **Session Management**: Optional Claude CLI session support for context reuse
- **Type Safety**: Complete TypeScript coverage with strict mode enabled
- **Testing**: 200+ unit and integration tests with Vitest
- **File Processing**: Robust I/O with glob patterns, JSON/YAML support
- **Error Handling**: Detailed error types, recovery strategies, graceful degradation
- **Logging**: JSONL session logging and comprehensive metadata tracking

#### 📊 Quality Metrics
- **Test Coverage**: Comprehensive unit and integration test coverage  
- **Type Safety**: Full TypeScript 5.7.2+ strict mode compliance
- **Code Quality**: Biome linting and formatting for consistent codebase
- **Documentation**: Complete API documentation with examples

### 🗺️ Roadmap

#### v0.2.0 - Enhanced Patterns  
- [ ] Multi-provider support (OpenAI, Anthropic SDK)
- [ ] Advanced retry strategies with adaptive backoff
- [ ] Progressive enhancement pipelines
- [ ] Performance monitoring and metrics

#### v0.3.0 - Enterprise Features
- [ ] Result caching layer
- [ ] Distributed processing support  
- [ ] Observability integration
- [ ] Advanced configuration management

## 🤝 Contributing

Persuader is a TypeScript framework for reliable LLM orchestration with schema validation. We welcome contributions that enhance the core patterns of validation-driven retry logic and session-based processing.

### Development Setup

```bash
git clone https://github.com/conorluddy/Persuader.git
cd Persuader
npm install

# Development commands
npm run dev              # Watch mode development
npm run dev:cli          # Watch mode for CLI development
npm run typecheck        # TypeScript validation
npm run build           # Production build
```

### Testing & Quality Assurance

```bash
# Testing (using Vitest)
npm test                 # Interactive test runner
npm run test:run         # Run all tests once
npm run test:ui          # Visual test interface
npm run test:coverage    # Generate coverage report

# Code Quality (using Biome)
npm run check            # Check formatting and linting
npm run check:fix        # Auto-fix issues
npm run format           # Format code
npm run lint             # Lint code

# Legacy support
npm run test:legacy      # Jest (if needed)
npm run lint:legacy      # ESLint (disabled in favor of Biome)
```

### Project Structure

```
src/
├── core/                # Core framework logic
│   ├── runner.ts       # Main pipeline orchestration
│   ├── validation.ts   # Zod validation integration
│   ├── retry.ts        # Retry logic and strategies
│   └── prompt.ts       # Prompt building and management
├── session/            # Session management
│   ├── manager.ts      # Session lifecycle management
│   └── provider-session.ts # Provider-specific sessions
├── adapters/           # LLM provider adapters
│   └── claude-cli.ts   # Claude CLI integration
├── cli/                # Command-line interface
│   ├── index.ts        # CLI entry point
│   └── commands/run.ts # Run command implementation
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── index.ts            # Main library export
```

## 📜 License

MIT License - feel free to use this in your projects!

## 🙏 Acknowledgments

Special thanks to the Anthropic team for Claude's consistency and the broader TypeScript community for building the excellent tooling ecosystem that makes projects like this possible.

---

**Built with ❤️ for reliable, type-safe LLM orchestration.**

---


