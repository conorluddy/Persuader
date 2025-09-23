# Enhancement Rounds Example

This example demonstrates the **Enhancement Rounds** feature in Persuader, which automatically improves initial valid results through additional LLM calls with encouraging prompts.

## What Enhancement Rounds Do

Enhancement Rounds bridge the gap between "acceptable" and "excellent" results while maintaining complete reliability:

1. **Get Initial Valid Result**: First, achieve a result that passes schema validation (guaranteed)
2. **Save Baseline**: Store the successful result as a guaranteed fallback
3. **Enhancement Rounds**: Make additional LLM calls with encouraging, strategy-specific prompts
4. **Improvement Evaluation**: Score enhancements against baseline using quantitative metrics
5. **Best Result Wins**: Return the best result, never worse than the original valid baseline
6. **Risk-Free**: Enhancement never compromises the initial valid result

## Enhancement Strategies

### 1. `expand-array` (Default)
- **Goal**: Encourages more items in arrays and collections
- **Good for**: Lists, transitions, examples that benefit from quantity
- **Example**: Transform 3 BJJ transitions → 15-20 comprehensive transitions

### 2. `expand-detail`  
- **Goal**: Encourages more detailed descriptions and explanations
- **Good for**: Instructions, explanations, comprehensive content
- **Example**: Basic workout plan → Detailed plan with form cues and progressions

### 3. `expand-variety`
- **Goal**: Encourages more diverse content and reduces repetition
- **Good for**: Reducing repetition, exploring different perspectives
- **Example**: Similar recommendations → Diverse, creative alternatives

### 4. `custom`
- **Goal**: Full control with user-provided prompt and evaluation functions
- **Good for**: Specialized domain improvements and custom scoring
- **Example**: BJJ transitions with competition-level details and common mistakes

## Examples in This Demo

### Example 1: Simple Enhancement
```typescript
const result = await persuade({
  schema: BJJTransitionsSchema,
  input: 'Generate transitions from side control position',
  enhancement: 2, // Try 2 enhancement rounds
  context: 'You are a BJJ black belt instructor'
});
```

**Demonstrates**: Basic enhancement usage with default `expand-array` strategy

### Example 2: Advanced Configuration
```typescript
const result = await persuade({
  schema: ContentAnalysisSchema,
  input: 'Analyze this market trend...',
  enhancement: {
    rounds: 1,
    strategy: 'expand-detail',
    minImprovement: 0.25, // Require 25% improvement
    customPrompt: (currentResult, round) => 
      `Excellent! Can you expand with more detailed insights...`
  }
});
```

**Demonstrates**: Advanced enhancement configuration with custom prompts

### Example 3: Custom Strategy
```typescript
const result = await persuade({
  schema: BJJTransitionsSchema,
  input: 'Generate comprehensive transitions...',
  enhancement: {
    strategy: 'custom',
    customPrompt: (currentResult, round) => 
      `Make this masterclass-level with competition tips...`,
    evaluateImprovement: customScoringFunction
  }
});
```

**Demonstrates**: Full custom control with domain-specific scoring

## Running the Example

```bash
# Run the comprehensive enhancement example
npm run example:enhancement

# Or run directly with tsx
tsx examples/enhancement-rounds/index.ts
```

## Expected Output

The example will show:

1. **BJJ Transitions Enhancement**: Demonstrates expanding from minimum required transitions to comprehensive collections
2. **Content Analysis Enhancement**: Shows how detail enhancement improves analysis depth
3. **Custom Enhancement**: Illustrates domain-specific improvements with custom scoring

For each example, you'll see:
- Number of attempts made
- Improvement metrics (quantity, quality, detail level)
- Execution time and metadata
- Sample enhanced content

## Key Benefits Demonstrated

- **Risk-Free**: Enhancement never makes results worse
- **Automatic**: Improves results without manual intervention  
- **Configurable**: Fine-tune strategies and improvement thresholds
- **Measurable**: Quantitative improvement scoring
- **Flexible**: Works with any schema and domain

## Perfect Use Cases

- **Content Generation**: Get minimum viable content, then enhance for quality
- **Data Extraction**: Extract required fields, then enhance for completeness
- **Analysis**: Get basic insights, then enhance for depth and nuance
- **Lists/Collections**: Meet minimums, then expand for comprehensiveness

Enhancement Rounds make it easy to get the best possible results from your LLM interactions while maintaining the reliability guarantees that Persuader provides.