# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run check            # Biome check (linting and formatting)
npm run check:fix        # Auto-fix Biome issues
npm run format           # Format code with Biome
npm run lint             # Lint code with Biome
```

### Demo and Examples
```bash
npm run demo:yoga        # Run the yoga pose analysis demo
```

### Single Test Execution
To run a specific test file:
```bash
npx vitest src/core/runner.test.ts    # Run specific test file
npx vitest --grep "validation"        # Run tests matching pattern
```

## Architecture Overview

Persuader is a TypeScript framework for schema-driven LLM orchestration with validation-driven retry loops. The architecture follows a clear separation of concerns:

### Core Pipeline (`src/core/`)
- **`runner.ts`** - The central orchestration engine that handles the complete prompt → LLM → validation → retry cycle
- **`validation.ts`** - Zod schema validation integration with intelligent error feedback generation
- **`retry.ts`** - Smart retry logic with exponential backoff and validation-driven feedback
- **`prompt.ts`** - Prompt building, template management, and progressive enhancement

### Session Management (`src/session/`)
- **`manager.ts`** - Session lifecycle management for context reuse across multiple operations
- **`provider-session.ts`** - Provider-specific session implementations (currently Claude CLI)

### Provider Adapters (`src/adapters/`)
- **`claude-cli.ts`** - Integration with Claude CLI using `claude -p --output-format json`
- Provider adapter pattern allows for future OpenAI, Anthropic SDK, and local LLM support

### CLI Implementation (`src/cli/`)
- **`commands/run.ts`** - Main `persuader run` command implementation
- Handles file processing, schema loading, progress tracking, and batch operations
- Supports glob patterns, dry-run mode, and verbose logging

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

## Key Development Patterns

### Pipeline Flow
The core `runPersuader` function in `runner.ts` orchestrates:
1. Schema validation and options processing
2. Session creation/reuse (if provider supports it)
3. Prompt building with context and lens
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
All validation uses Zod schemas. Validation errors are converted to specific LLM feedback through `formatValidationErrorFeedback` in `validation.ts`. This enables intelligent retry loops where the LLM receives targeted corrections.

### Session Management
Sessions are optional but recommended for batch processing. The session manager handles context reuse, reducing token costs and improving consistency. Currently implemented for Claude CLI; other providers can implement session support.

## Testing Architecture

- **Unit Tests**: 28 TypeScript files with corresponding test files
- **Integration Tests**: End-to-end pipeline testing in `tests/` directory
- **Test Framework**: Vitest with 80% coverage thresholds
- **Test Structure**: Co-located tests in `__tests__` directories and dedicated `tests/` folder
- **Mocking**: Provider adapters can be mocked using `createMockProvider` utility

## Dependencies and Requirements

### Runtime Requirements
- **Node.js**: 22.0.0+ (specified in package.json engines)
- **Claude CLI**: Required for the default adapter (`pip install claude-cli`)
- **TypeScript**: ES2024 target with strict mode enabled

### Development Stack
- **Build Tool**: unbuild for ESM output
- **Testing**: Vitest with coverage via v8
- **Code Quality**: Biome (replaces ESLint + Prettier)
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