# Session Learning with Success Feedback

This directory contains examples demonstrating the success feedback feature for session-based learning in Persuader.

## What is Success Feedback?

Success feedback is a feature that provides positive reinforcement to LLMs after successful schema validation. When enabled in session-based workflows, it helps the LLM understand and maintain successful patterns across multiple requests.

## Key Benefits

- **Pattern Reinforcement**: Helps LLMs understand what constitutes successful output
- **Consistency**: Reduces variance in output quality over multiple requests  
- **Learning**: Builds on successful approaches across the conversation
- **Complementary**: Works alongside existing error feedback for comprehensive learning

## Examples

### 1. Basic Success Feedback Demo

Run the basic demonstration:

```bash
npx tsx examples/session-learning/success-feedback-demo.ts
```

This example shows:
- Creating a session with context
- Processing multiple inputs with success feedback
- How feedback improves consistency across requests

### 2. CLI Usage

Use success feedback from the command line:

```bash
# Extract person data with success feedback
persuader run \
  --schema ./examples/session-learning/schemas.ts \
  --input "./examples/session-learning/data.json" \
  --session-id person-extraction \
  --success-message "✅ Perfect extraction! Continue this precise approach."
```

## When Success Feedback Triggers

Success feedback is only sent when **all** conditions are met:

1. ✅ Schema validation passes on the first attempt
2. ✅ A `sessionId` is provided (session-based workflow)
3. ✅ A `successMessage` parameter is provided
4. ✅ The provider supports success feedback (Claude CLI does)

## Usage Patterns

### JavaScript/TypeScript API

```typescript
import { initSession, persuade } from '@persuader/core';

// Create session
const { sessionId } = await initSession({
  context: "You are an expert data analyst."
});

// Use success feedback
const result = await persuade({
  schema: MySchema,
  input: data,
  sessionId,
  successMessage: "✅ Perfect analysis! Continue this structured approach."
});
```

### CLI Usage

```bash
persuader run \
  --schema ./schema.ts \
  --input ./data.json \
  --session-id my-session \
  --success-message "Excellent work! Maintain this quality."
```

## Best Practices

1. **Be Specific**: Make success messages specific about what was done well
2. **Be Encouraging**: Use positive language that reinforces good behavior  
3. **Be Consistent**: Use similar feedback patterns for similar types of work
4. **Be Brief**: Keep messages concise but meaningful

### Good Examples

```typescript
// Specific about format and accuracy
successMessage: "✅ Perfect! Your JSON format and field accuracy are exactly right."

// Encouraging about approach
successMessage: "Excellent analysis! Your structured approach and clear reasoning are ideal."

// Consistent pattern
successMessage: "Great work! Continue using this precise extraction method."
```

### Avoid

```typescript
// Too generic
successMessage: "Good job"

// Too long
successMessage: "This is absolutely perfect in every way and I love how you..." // (continues for paragraphs)

// Negative focus
successMessage: "Finally you got it right after all those failures"
```

## Technical Details

- Success feedback is stored in the session manager for context persistence
- It's also sent directly to the provider if supported (Claude CLI)
- The feature is non-blocking - failures don't affect the main operation
- All operations are logged for debugging and monitoring

## See Also

- [Main Persuader Documentation](../../README.md)
- [API Reference](../../API.md)
- [Session Management](../../docs/sessions.md)