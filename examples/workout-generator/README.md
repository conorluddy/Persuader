# Multi-Stage Workout Generator

This example demonstrates Persuader's advanced session-based orchestration capabilities through a comprehensive fitness program generator that processes user input through 5 distinct stages.

## Overview

The workout generator showcases:
- **Session-based context reuse** across multiple LLM calls
- **Progressive complexity** building from simple inputs to detailed programs  
- **Schema-driven validation** ensuring structured, reliable outputs
- **Real-world utility** generating actually usable fitness programs
- **Error recovery** with stage-specific retry logic

## Architecture

### 5-Stage Pipeline

1. **Fitness Profile Assessment** (`FitnessProfileSchema`)
   - Analyzes user experience, goals, equipment, and constraints
   - Establishes foundation for all subsequent decisions

2. **Exercise Selection** (`ExerciseSelectionSchema`) 
   - Chooses primary and accessory exercises based on profile
   - Considers equipment availability and skill level

3. **Workout Structure** (`WorkoutStructureSchema`)
   - Creates weekly schedule with sets, reps, and timing
   - Balances training and recovery across the week

4. **Progression Planning** (`ProgressionPlanSchema`)
   - Designs 4-week progression with assessment points
   - Provides criteria for advancing difficulty

5. **Recovery Integration** (`RecoveryIntegrationSchema`)
   - Adds sleep, nutrition, and recovery protocols
   - Completes holistic program design

### Session Benefits

- **Context Efficiency**: Establishes "fitness coach" persona once, reused across all stages
- **Consistency**: Same expert knowledge and approach throughout
- **Memory**: Later stages naturally reference earlier decisions
- **Cost Savings**: Avoids repeating context in each LLM call

## Usage

### Run the Demo

```bash
# From the Persuader root directory
npm run example:workout
```

This runs with a sample intermediate user and generates a complete 4-week program.

### Custom User Input

```typescript
import { generateWorkoutProgram } from './index.js';

const customUser = {
  age: 30,
  experience: "Your fitness experience description...",
  goals: "Your specific goals...", 
  equipment: "Available equipment...",
  timeAvailable: "Time constraints...",
  limitations: "Any injuries or limitations..."
};

const program = await generateWorkoutProgram(customUser);
```

### Sample Users

The `data/sample-users.json` file contains 5 diverse user profiles:
- Sarah (Beginner, minimal equipment)
- Mike (Intermediate, full home gym)
- Jennifer (Busy parent, time-constrained) 
- Alex (Advanced athlete, elite setup)
- Robert (Senior, health-focused)

## Output Structure

Generated programs include:

```typescript
{
  profile: FitnessProfile,        // User assessment and requirements
  exercises: ExerciseSelection,   // Chosen exercises with rationale  
  structure: WorkoutStructure,    // Weekly schedule and protocols
  progression: ProgressionPlan,   // 4-week advancement plan
  recovery: RecoveryIntegration,  // Holistic wellness integration
  summary: {                      // Program overview
    programName: string,
    duration: string, 
    keyBenefits: string[],
    successTips: string[]
  }
}
```

## Key Features

### Schema-Driven Validation

Each stage uses comprehensive Zod schemas ensuring:
- Consistent data structure across stages
- Validation of exercise difficulty appropriateness  
- Proper equipment matching
- Realistic time and frequency constraints

### Intelligent Context Management

- **Initial Context**: Establishes expert fitness coach persona with credentials
- **Stage Contexts**: Each stage builds on previous results with targeted prompts
- **Session Continuity**: LLM maintains consistent expertise and decision rationale

### Error Recovery

If any stage fails:
- Previous stage results are preserved
- Session context is maintained for retry
- Specific error feedback guides corrections
- Independent stage validation prevents cascade failures

## File Structure

```
workout-generator/
├── index.ts              # Main orchestration logic
├── schemas/              # Zod validation schemas
│   └── schemas.ts        # Schemas for all 5 stages
├── prompts/              # External prompt files
├── data/
│   └── sample-users.json # Sample user profiles for testing
├── output/              # Generated workout programs (created on run)
└── __tests__/           # Unit tests (planned)
```

## Development Notes

This example demonstrates several advanced Persuader patterns:

1. **Multi-Schema Orchestration**: Different validation schemas for each stage
2. **Session Context Evolution**: Context becomes more specific as stages progress  
3. **Compound Data Flow**: Each stage's output becomes the next stage's input
4. **Professional Persona Maintenance**: Consistent expert voice across all interactions
5. **Real-World Complexity**: Handles nuanced fitness programming requirements

The generated programs are comprehensive enough to be actually used for fitness training, demonstrating Persuader's capability to handle complex, multi-dimensional problem domains.