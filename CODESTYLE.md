# Code Style Guide

> "Code is for humans, not computers." - Zohar Jackson

This guide captures our philosophy and practical approach to crafting maintainable, human-centric code. It synthesizes principles from *Code is for Humans*, our experience, and the specific needs of the Persuader framework.

## Core Philosophy

### Jackson's Law
> "Bad design and engineering cause more harm than you expect, even when taking into account Jackson's Law."

Small deficiencies compound exponentially in complex systems. Every decision matters.

### Goal-Driven Development
- **Strive for your goals, not abstract "good code"**
- **Quality code vs Good code** - Quality is the ideal; Good meets your actual goals
- **Context matters more than best practices** - Use judgment, not dogma

## Fundamental Values

### 1. Human-Centric Design
Code is written for human minds with limited cognitive capacity:
- **Working memory holds ~7 items** - Don't make developers juggle more
- **Attention is scarce** - Make the important things obvious
- **Humans make mistakes** - Design systems that prevent and catch errors

### 2. Simplicity & Clarity (KISS)
- **The best code is no code** - Question if features are necessary
- **Simple > Clever** - Optimize for readability over cleverness
- **Explicit > Implicit** - Make dependencies and side effects visible
- **Progressive Disclosure** - Start simple, reveal complexity only when needed

### 3. Modularity & Reusability (DRY with AHA)
- **Single Responsibility** - Each module does one thing well
- **AHA (Avoid Hasty Abstractions)** - Wait for patterns to emerge (3 strikes rule)
- **Small, focused modules** - Target <300 lines, but prioritize cognitive load over line count
- **Clear boundaries** - Well-defined interfaces between modules

### 4. Fail Fast, Fix Early
- **Validate inputs at boundaries immediately**
- **Surface errors clearly with actionable messages**
- **Never silently swallow errors**
- **Fix broken windows immediately** - Small issues cascade into big problems

## Cognitive Load Management

Based on Cognitive Load Theory, we use four techniques to reduce complexity:

### 1. Reduce Information
- Remove unnecessary code and features
- Eliminate redundant comments
- Simplify complex logic into smaller steps

### 2. Hide Information
- Encapsulate implementation details
- Use abstractions to hide complexity
- Provide simple interfaces to complex systems

### 3. Explain Information
- **Exceptional naming** - Names should eliminate need for comments
- Document the "why", not the "what"
- Use types to communicate intent

### 4. Compartmentalize
- Separate concerns into distinct modules
- Group related functionality
- Create clear mental models

## Practical Guidelines

### File Organization
```
✅ DO:
- Keep files under 300 lines (guideline, not rule)
- One export per file for major components
- Co-locate tests with source files
- Group by feature/domain, not file type

❌ DON'T:
- Create files unless necessary
- Mix multiple responsibilities in one file
- Create deep nesting (max 3 levels)
```

### Naming Excellence
```typescript
// ✅ GOOD - Clear, descriptive, self-documenting
async function validateJsonAgainstSchema(schema: ZodSchema, input: string): Promise<ValidationResult>

// ❌ BAD - Vague, abbreviated, requires mental translation
async function valJson(s: any, i: string): Promise<any>
```

### TypeScript Patterns
```typescript
// ✅ Strict mode with all checks
{
  "strict": true,
  "noImplicitReturns": true,
  "exactOptionalPropertyTypes": true
}

// ✅ Explicit types where it aids understanding
const retryDelay: number = calculateExponentialBackoff(attempt);

// ✅ Readonly for immutability
interface RunOptions {
  readonly schema: ZodSchema;
  readonly maxRetries: number;
}
```

### Error Handling
```typescript
// ✅ GOOD - Actionable error with context
throw new Error(
  `Schema validation failed at field "${path}": Expected ${expected}, received ${received}. ` +
  `Please ensure this field contains the correct data type.`
);

// ❌ BAD - Generic, unhelpful error
throw new Error("Validation failed");
```

### Testing Approach
- **Test behavior, not implementation**
- **80% coverage minimum** - But don't chase 100% blindly
- **Fast tests first** - Unit > Integration > E2E
- **Test names describe scenarios**: `"should retry with exponential backoff when rate limited"`

## Data Flow Clarity

### Pure Functions Preferred
```typescript
// ✅ GOOD - Pure, predictable, testable
function calculateRetryDelay(attempt: number, baseDelay: number): number {
  return Math.min(baseDelay * (2 ** attempt), MAX_DELAY);
}

// ❌ BAD - Side effects, hidden dependencies
function calculateRetryDelay(attempt: number): number {
  globalRetryCount++; // Hidden side effect
  updateMetrics();    // Hidden dependency
  return Math.min(config.baseDelay * (2 ** attempt), MAX_DELAY);
}
```

### Observable Systems
- **Structured logging** - Use consistent log levels and formats
- **Performance metrics** - Measure what matters (execution time, token usage)
- **Clear trace paths** - Make debugging straightforward

## Investment Philosophy

### High-Yield Focus (Pareto Principle)
Invest effort where it matters most:
1. **Foundations** - Core abstractions that everything builds on
2. **High-frequency paths** - Code executed most often
3. **Long-lived code** - Components that will exist for years
4. **Scale points** - Code that will handle growing load

### The Middle Way
Avoid extremism in any direction:
- **Not too DRY** - Some duplication is better than wrong abstraction
- **Not too simple** - Don't sacrifice necessary functionality
- **Not too complex** - Don't over-engineer for unlikely futures
- **Not too perfect** - Ship working code, iterate based on feedback

### Worse Is Better
Sometimes the simple, imperfect solution wins:
- **Working > Perfect**
- **Simple > Complete**
- **Understandable > Optimal**

## Anti-Patterns to Avoid

### ❌ Premature Optimization
Don't optimize before measuring. Profile first, optimize second.

### ❌ Hasty Abstractions
Wait for patterns to emerge. Extract after third duplication, not first.

### ❌ Clever Code
```typescript
// ❌ BAD - Clever one-liner
const result = arr.reduce((a,b)=>({...a,[b.k]:b.v}),{});

// ✅ GOOD - Clear and obvious
const result: Record<string, string> = {};
for (const item of arr) {
  result[item.key] = item.value;
}
```

### ❌ Silent Failures
```typescript
// ❌ BAD - Swallowing errors
try {
  await riskyOperation();
} catch {
  // Silent failure
}

// ✅ GOOD - Handle or propagate
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new OperationError('Failed to complete operation', { cause: error });
}
```

## Recovery Over Prevention

Design for graceful failure:
- **Assume things will fail** - Plan for recovery
- **Intelligent retry strategies** - Exponential backoff, circuit breakers
- **Provide escape hatches** - Manual overrides for when automation fails
- **Clear error messages** - Help users fix problems themselves

## Development Workflow

### Code Review Checklist
- [ ] Does it solve the stated problem?
- [ ] Is the cognitive load reasonable?
- [ ] Are errors handled gracefully?
- [ ] Is the naming clear and consistent?
- [ ] Would a new developer understand this?
- [ ] Are there tests for critical paths?

### Refactoring Triggers
Refactor when you see:
- Functions over 50 lines
- Files over 300 lines
- More than 3 levels of nesting
- Repeated patterns (3rd occurrence)
- Unclear naming that requires comments
- Complex conditions that need explanation

## Observability & Debugging

### Logging Principles
```typescript
// ✅ Structured, contextual, actionable
logger.info('LLM request completed', {
  provider: 'claude',
  model: 'sonnet',
  tokenUsage: { input: 1000, output: 500 },
  duration: 1234,
  requestId: 'req-123'
});
```

### Performance Tracking
Always measure critical operations:
- API call durations
- Token usage and costs
- Retry attempts and success rates
- Error frequencies and types

## Be a Mensch

Remember that code is written by humans, for humans:
- **Write code for the next developer** (who might be you in 6 months)
- **Leave things better than you found them**
- **Document the "why" for non-obvious decisions**
- **Be kind in code reviews** - Critique code, not people

## Summary

Great code is:
1. **Human-readable** - Optimized for understanding
2. **Goal-oriented** - Serves actual needs, not abstract ideals
3. **Maintainable** - Easy to change and extend
4. **Resilient** - Handles failure gracefully
5. **Observable** - Makes debugging straightforward

Remember: Every line of code is a liability. Only write what's necessary to achieve your goals, but write it well.

---

*"Any fool can write code that a computer can understand. Good programmers write code that humans can understand."* - Martin Fowler