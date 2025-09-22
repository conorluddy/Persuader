# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Code Philosophy & Style

**IMPORTANT: This project follows strict coding principles outlined in [CODESTYLE.md](./CODESTYLE.md)**

### Core Principles (from CODESTYLE.md)
- **Jackson's Law**: Small deficiencies compound exponentially - fix issues immediately
- **Human-Centric Design**: Code for developers with ~7 item working memory limit
- **KISS & Modularity**: Small, focused files (<300 lines guideline) with single responsibilities
- **Fail Fast, Fix Early**: Validate at boundaries with clear, actionable errors
- **Progressive Disclosure**: Start simple, reveal complexity only when needed

### When Writing Code
1. **Read [CODESTYLE.md](./CODESTYLE.md) first** - understand our values and patterns
2. **Apply the Middle Way** - avoid extremism in any direction
3. **Prioritize cognitive load reduction** over clever solutions
4. **Use exceptional naming** that eliminates need for comments
5. **Make errors actionable** with context and recovery suggestions

## Development Commands

### Core Development
```bash
npm run dev              # Watch mode development with TypeScript compilation
npm run dev:cli          # Watch mode for CLI development specifically
npm run build            # Production build using unbuild
npm run typecheck        # TypeScript type checking without emit
npm run clean            # Remove dist directory
```

### Testing
```bash
npm test                 # Interactive Vitest test runner
npm run test:run         # Run all tests once (CI mode)
npm run test:ui          # Launch Vitest UI for visual test running
npm run test:coverage    # Generate test coverage report
```

### Code Quality
```bash
npm run check            # ESLint + TypeScript checks (linting and type checking)
npm run check:fix        # Auto-fix ESLint and Prettier issues
npm run format           # Format code with Prettier
npm run lint             # Lint code with ESLint
```

### Demo and Examples
```bash
# Core examples
npm run example:yoga        # Yoga pose analysis demo
npm run example:fitness     # Fitness program analysis
npm run example:workout     # Workout generation

# Provider-specific examples
npm run example:openai      # OpenAI integration
npm run example:anthropic   # Anthropic SDK
npm run example:gemini      # Google Gemini
npm run example:ollama      # Local Ollama
```

### Single Test Execution
To run a specific test file:
```bash
npx vitest src/core/runner.test.ts    # Run specific test file
npx vitest --grep "validation"        # Run tests matching pattern
```

## 📚 API Reference

**[Complete API Documentation](./API.md)** - Comprehensive reference for all functions, classes, and utilities exported by Persuader. Essential for understanding what functionality is available to consuming packages beyond the core `persuade()`, `initSession()`, and `preload()` functions.

Key exports include:
- **Core Functions**: `persuade()`, `initSession()`, `preload()`
- Provider adapters (`createClaudeCLIAdapter`, `createOpenAIAdapter`, etc.)
- Validation utilities (`validateJson`, `retryWithFeedback`)
- Session management (`createSessionManager`, `defaultSessionManager`)
- Testing utilities (`createMockProvider`)
- File I/O utilities (`loadSchema`, `readInputs`, `writeOutput`)
- Comprehensive TypeScript types for all functionality

## Core API Functions

### `persuade()` - Schema-Driven LLM Orchestration
Main function for validated data extraction with retry loops and error feedback.

**Key Parameters:**
- `schema: ZodSchema<T>` - Zod schema for output validation
- `input: unknown` - Input data to process  
- `exampleOutput?: T` - Optional concrete example to guide LLM formatting (validates against schema before use)

### `initSession()` - Session Creation
Creates persistent sessions for context reuse and cost optimization.

### `preload()` - Context Loading
**NEW**: Load data into existing sessions without validation for progressive context building.

```typescript
// Typical workflow
const { sessionId } = await initSession({ context: "You are an expert..." });

await preload({ 
  sessionId, 
  input: "Large document or dataset...",
  validateInput: OptionalSchema // Quality gate
});

const result = await persuade({
  schema: OutputSchema,
  input: "Extract insights from loaded data",
  sessionId
});
```

## Architecture Overview

Persuader is a TypeScript framework for schema-driven LLM orchestration with validation-driven retry loops. The architecture follows a clear separation of concerns:

### Core Pipeline (`src/core/`)
- **`runner/`** - Modular pipeline orchestration (6 focused modules under 100 lines each)
  - `pipeline-orchestrator.ts` - Main execution coordinator
  - `configuration-manager.ts` - Options validation & normalization
  - `session-coordinator.ts` - Session lifecycle management
  - `execution-engine.ts` - Core LLM execution logic
  - `error-recovery.ts` - Intelligent retry strategies
  - `result-processor.ts` - Response validation & metadata
  - `index.ts` - Public API with `persuade()` and `initSession()`
- **`validation/`** - Validation system (5 focused modules)
  - `json-parser.ts` - JSON parsing with intelligent error detection
  - `error-factory.ts` - Structured ValidationError creation
  - `suggestion-generator.ts` - Smart validation suggestions with fuzzy matching
  - `feedback-formatter.ts` - LLM-friendly error formatting
  - `field-analyzer.ts` - Schema field analysis utilities
- **`retry.ts`** - Smart retry logic with exponential backoff and validation-driven feedback
- **`prompt.ts`** - Prompt building, template management, and progressive enhancement

### Session Management (`src/session/`)
- **`manager.ts`** - Session lifecycle management for context reuse across multiple operations
- **`provider-session.ts`** - Provider-specific session implementations (currently ClaudeCode)

### Provider Adapters (`src/adapters/`)
- **`claude-cli.ts`** - Integration with ClaudeCode using `claude -p --output-format json`
- **`openai.ts`** - OpenAI API integration with direct API calls
- **`anthropic-sdk.ts`** - Anthropic SDK integration with streaming support
- **`ollama.ts`** - Local Ollama integration for privacy-focused deployments
- **`gemini.ts`** - Google Gemini integration with multimodal capabilities
- **`vercel-ai-sdk.ts`** - Vercel AI SDK showcase and integration patterns
- **`index.ts`** - Provider factory and adapter creation utilities

### CLI Implementation (`src/cli/`)
- **`commands/run.ts`** - Main `persuader run` command implementation
- **`utilities/`** - CLI utilities (5 focused modules)
  - `workflow-orchestrator.ts` - Command execution coordination
  - `config-validator.ts` - CLI option validation & schema loading
  - `progress-reporter.ts` - Real-time progress & metrics
  - `file-processor.ts` - File I/O with glob patterns
  - `error-handler.ts` - Comprehensive CLI error management
- Handles file processing, schema loading, progress tracking, and batch operations
- Supports glob patterns, dry-run mode, verbose logging, and debug mode

### Type System (`src/types/`)
- **`pipeline.ts`** - Core pipeline types (Options, Result, ExecutionMetadata)
- **`provider.ts`** - Provider adapter interface and response types
- **`validation.ts`** - Validation error types and feedback structures
- **`session.ts`** - Session management types
- **`config.ts`** - Configuration and CLI argument types

### Utilities (`src/utils/`)
- **`schema-loader.ts`** - Dynamic TypeScript/JavaScript schema file loading at runtime
- **`file-io.ts`** - File processing with glob patterns, JSON/YAML support
- **`logger.ts`** - Structured logging with JSONL session output for debugging
- **`schema-analyzer.ts`** - Schema introspection for validation feedback

## Recent Major Changes (v0.4.1)

### Example Generation System Overhaul
**BREAKING CHANGE**: Replaced automatic example generation with user-provided examples:

- **❌ Removed**: `src/utils/example-generator.ts` - Was generating hardcoded fitness examples regardless of schema
- **✅ Enhanced**: Manual example control via `exampleOutput` parameter in `Options<T>` interface
- **✅ Added**: Pre-validation of user examples against schema in `configuration-manager.ts`
- **✅ Improved**: JSON Schema integration using Zod v4 `z.toJSONSchema()` for better LLM guidance

**Developer Impact:**
- LLMs now receive comprehensive JSON Schema descriptions instead of potentially wrong examples
- Users have full control over examples through the `exampleOutput` parameter
- Examples are validated before any LLM calls to prevent runtime errors

## Key Development Patterns

### Pipeline Flow
The core `persuade` function in `runner/index.ts` orchestrates:
1. **Schema validation and options processing** - Includes `exampleOutput` validation in `configuration-manager.ts`
2. Session creation/reuse (if provider supports it)
3. **Prompt building with context and lens** - Enhanced JSON Schema integration in `prompt.ts`
4. LLM provider calls with retry logic
5. Response validation against Zod schema
6. Error feedback generation for retries
7. Metadata collection and logging

### Provider Adapter Pattern
New LLM providers implement the `ProviderAdapter` interface:
```typescript
interface ProviderAdapter {
  name: string;
  supportsSession: boolean;
  sendPrompt(sessionId: string | null, prompt: string, options?: ProviderPromptOptions): Promise<ProviderResponse>;
  createSession?(context: string, options?: ProviderPromptOptions): Promise<string>;
  checkHealth?(): Promise<ProviderHealth>;
}
```

### Schema-First Validation
All validation uses Zod schemas. Validation errors are converted to specific LLM feedback through `formatValidationErrorFeedback` in `validation/feedback-formatter.ts`. This enables intelligent retry loops where the LLM receives targeted corrections with fuzzy matching suggestions.

### Session Management
Sessions are optional but recommended for batch processing. The session manager handles context reuse, reducing token costs and improving consistency. New `initSession()` function enables schema-free session creation for exploratory workflows. Implemented for ClaudeCode; other providers can implement session support.

## Testing Architecture

- **Unit Tests**: 28 TypeScript files with corresponding test files
- **Integration Tests**: End-to-end pipeline testing in `tests/` directory
- **Test Framework**: Vitest with 80% coverage thresholds
- **Test Structure**: Co-located tests in `__tests__` directories and dedicated `tests/` folder
- **Mocking**: Provider adapters can be mocked using `createMockProvider` utility

## Dependencies and Requirements

### Runtime Requirements
- **Node.js**: 20.0.0+ (specified in package.json engines)
- **ClaudeCode**: Required for the default adapter (`npm install -g @anthropic-ai/claude-code`)
- **TypeScript**: ES2024 target with strict mode enabled

### Development Stack
- **Build Tool**: unbuild for ESM output
- **Testing**: Vitest with coverage via v8
- **Code Quality**: ESLint + Prettier for linting and formatting
- **Type Checking**: TypeScript 5.7.2+ with strict configuration

## File Structure Conventions

- **ES Modules**: All imports use `.js` extensions (TypeScript compilation target)
- **Strict TypeScript**: Full strict mode with additional checks (noImplicitReturns, exactOptionalPropertyTypes)
- **Path Aliases**: `@/*` maps to `src/*` for cleaner imports
- **Index Exports**: Each module has comprehensive type exports through `index.ts` files

## CLI Usage Patterns

The `persuader run` command supports:
- **Schema Loading**: Dynamic TypeScript/JavaScript schema files
- **File Processing**: Glob patterns for batch operations
- **Context/Lens**: LLM guidance through context and lens parameters  
- **Session Management**: Optional session reuse for related operations
- **Progress Tracking**: Spinners and verbose logging
- **Dry Run**: Configuration validation without LLM calls
- Don't have more than a couple of node processes running at a time if possible

## Enhanced Debug Features (v0.3.4+)

### Debug Mode Usage

The `--debug` flag provides comprehensive LLM interaction visibility for troubleshooting validation issues:

```bash
# Basic debug mode - enables all debug features
persuader run --schema ./schema.ts --input ./data.json --debug

# Combined with verbose for maximum visibility
persuader run --schema ./schema.ts --input ./data.json --verbose --debug

# Debug specific enum validation issues
persuader run --schema ./complex-enums.ts --input ./problematic-data.json --debug
```

### Debug Features Enabled

When `--debug` is active, the system:

1. **Full Prompt Logging**: Shows complete prompts without truncation
   ```
   🔍 FULL LLM REQUEST claude-cli (claude-3-5-haiku-20241022)
   ┌─ COMPLETE PROMPT
   │ [SYSTEM] You are a world-class BJJ expert with deep knowledge...
   │ [SCHEMA] The output must strictly conform to this Zod schema:...
   │ [USER] Generate transitions from base-back-control-harness-controlling...
   └─ END COMPLETE PROMPT
   ```

2. **Raw Response Capture**: Shows unprocessed LLM responses before validation
   ```
   🔍 RAW LLM RESPONSE claude-cli
   ┌─ RAW RESPONSE
   │ {
   │   "perspectiveUuid": "base-mount-high-controlling",
   │   "transitions": [...]
   │ }
   └─ END RAW RESPONSE
   ```

3. **Enhanced Validation Errors**: Detailed validation failures with fuzzy matching
   ```
   🔍 DETAILED VALIDATION ERROR transitions[0].targetUuid
   field: transitions[0].targetUuid
   actualValue: base-mount-high-controlling
   expectedType: enum
   validOptionsCount: 194
   closestMatches: ["base-control-high-mount-controlling", "base-mount-controlling"]
   suggestions: ["Did you mean: base-control-high-mount-controlling?"]
   ```

### Logging Level Hierarchy

The framework uses a 6-level logging system:

- **none**: No output
- **error**: Critical failures only
- **warn**: Warnings and validation failures
- **info**: General execution flow (default)
- **debug**: Truncated prompts/responses, basic metadata
- **prompts**: Beautiful formatted prompt/response display
- **verboseDebug**: Complete prompts, raw responses, validation details (enabled by `--debug`)

### Troubleshooting Common Issues

#### Enum Validation Failures
```bash
# Problem: UUID enum validation fails
persuader run --schema ./schema.ts --input ./data.json --debug

# Look for output like:
# 💡 Did you mean: base-control-high-mount-controlling, base-mount-controlling?
```

#### Unknown Validation Errors
```bash
# Use debug mode to see the exact raw response that failed validation
persuader run --schema ./schema.ts --input ./data.json --debug | grep -A 10 "RAW RESPONSE"
```

#### Token Usage Optimization
```bash
# Check token usage patterns with debug metadata
persuader run --schema ./schema.ts --input ./data.json --debug --verbose | grep "tokens:"
```

### Fuzzy Matching Algorithm

The enhanced validation system uses Levenshtein distance to suggest corrections:

- **30% similarity threshold**: Only suggests reasonably similar options
- **Top 3 suggestions**: Provides up to 3 closest matches
- **Case-insensitive matching**: Handles casing differences gracefully
- **Intelligent ranking**: Sorts by similarity score (highest first)

Example fuzzy matching behavior:
```
Input: "base-mount-high-controlling"
Valid options: ["base-control-high-mount-controlling", "base-mount-controlling", ...]
Suggestions: ["base-control-high-mount-controlling", "base-mount-controlling"]
Similarity scores: [0.89, 0.78]
```

## Code Quality Standards

### Important! Before Committing (PR will fail CI/CD if ignored)
Always run these checks (as per CODESTYLE.md):
```bash
npm run typecheck        # Must pass - TypeScript validation
npm run check            # Must pass - ESLint linting and TypeScript checks
npm run test:run         # Must pass - All tests
```

### Refactoring Guidelines
When refactoring, follow the priorities in [CODESTYLE.md](./CODESTYLE.md#refactoring-triggers):
1. Fix critical issues (silent errors, missing boundaries)
2. Reduce cognitive load (split large functions/files)
3. Improve clarity (naming, types, explicit behavior)
4. Optimize structure (single responsibility, clear interfaces)
- Use @CODESTYLE.md as a coding style guide