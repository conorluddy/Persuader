# Exercise Relationship Analysis Demo

This example demonstrates Persuader's relationship extraction capabilities through comprehensive exercise analysis. The demo showcases how to process structured exercise data and generate meaningful relationships between different exercises based on muscle groups, progression patterns, and training principles.

## 🎯 Demo Overview

The exercise demo consists of:

- **Rich Exercise Data**: Detailed exercise information including muscle groups, equipment, and movement patterns
- **Relationship Analysis**: LLM-powered generation of exercise relationships across 4 dimensions
- **Session-Based Processing**: Efficient context reuse across multiple exercise analyses
- **Schema Validation**: Ensures all generated relationships follow the defined structure

## 📁 Directory Structure

```
examples/exercise/
├── README.md                 # This file
├── index.ts                # Main demo script
├── data/                    # Input data files
│   └── exercises/           # Exercise data files
│       ├── 001-bench-press.json # Individual exercise definitions
│       ├── 002-deadlift.json    # ... (9 total exercises)
│       └── ...
├── schemas/                 # Zod validation schemas
├── prompts/                 # External prompt files
└── output/                  # Generated relationship data
    ├── *-relationships.json # Individual exercise analyses
    └── summary.json        # Comprehensive summary
```

## 🔄 Relationship Analysis Workflow

The exercise demo follows a structured analysis pipeline:

```mermaid
flowchart TD
    A[Load exercises/*.json] --> B[Extract exercise names]
    B --> C[Create output/ directory]
    C --> D[Initialize session with all exercise names]
    D --> E[For each exercise...]

    E --> F[Build input with current exercise data]
    F --> G[Send to Persuader pipeline]

    G --> H[LLM Processing]
    H --> I[Schema validation against ExerciseRelationshipSchema]
    I --> J{Valid?}

    J -->|No| K[Generate feedback]
    K --> L[Retry with corrections]
    L --> H

    J -->|Yes| M[Save individual result]
    M --> N[Write {exerciseName}-relationships.json]
    N --> O[Update session metrics]
    O --> P[Next exercise or finish]

    P --> Q[Generate summary.json]
    Q --> R[Performance metrics & statistics]

    style A fill:#e1f5fe
    style N fill:#c8e6c9
    style Q fill:#fff3e0
    style I fill:#fce4ec
```

### Key Processing Steps

1. **Input Loading**: Read exercise data from JSON files with muscle groups and movement patterns
2. **Context Creation**: Build session context with all available exercise names for relationship validation
3. **LLM Pipeline**: Process each exercise through Persuader with relationship schema validation
4. **Retry Logic**: Auto-correct invalid relationships with targeted feedback
5. **Individual Output**: Save validated relationships per exercise as JSON
6. **Batch Summary**: Generate comprehensive analysis with performance metrics

## 🚀 Running the Demo

### Quick Start

Run the built-in demo script:

```bash
# From the Persuader root directory
npm run example:exercise
```

This will:

1. Load exercise data from `exercises/`
2. Generate relationships for each exercise using Claude
3. Validate results against the relationship schema
4. Save validated relationships to `output/`

### Using the CLI

Process exercise data with the CLI tool:

```bash
# Process all exercises
persuader run \
  --schema ./examples/exercise/exercise-schema.ts \
  --input "./examples/exercise/data/exercises/*.json" \
  --context "You are an expert strength training coach analyzing exercise relationships" \
  --retries 3 \
  --verbose
```

## 📊 Schema Structure

### Exercise Data Schema

Each exercise contains comprehensive training information:

```typescript
interface Exercise {
  name: string; // Exercise name (e.g., "Bench Press")
  category: string; // Exercise category (e.g., "Compound Push")
  equipment: string; // Required equipment (e.g., "Barbell, Bench")
  primaryMuscles: string[]; // Primary muscle groups worked
  difficulty: string; // Difficulty level ("Beginner", "Intermediate", "Advanced")
  movementPattern: string; // Movement type (e.g., "Horizontal Push")
}
```

### Exercise Relationship Schema

The demo generates relationships across 4 dimensions:

```typescript
const ExerciseRelationshipSchema = z.object({
  exercise: z.string().describe('Starting exercise name'),
  similarMuscles: z
    .array(z.string())
    .describe('Exercises that work similar muscle groups'),
  variationOf: z.array(z.string()).describe('Exercises this is a variation of'),
  progressionFrom: z
    .array(z.string())
    .describe('Exercises that naturally progress to this one'),
  substitutableFor: z
    .array(z.string())
    .describe('Exercises that can be substituted with this one'),
});
```

## 💪 What the Demo Demonstrates

### 1. Multi-Dimensional Exercise Relationships

The exercise domain requires understanding of:

- **Muscle Group Synergy**: Which exercises target similar muscle groups
- **Progressive Overload**: Natural progression pathways between exercises
- **Movement Patterns**: Exercises sharing similar biomechanical patterns
- **Substitution Logic**: Equivalent exercises for program flexibility

### 2. Session-Based Context Efficiency

- **Comprehensive Context**: All exercise names loaded into session context for validation
- **Relationship Validation**: LLM can verify suggested exercises actually exist in the dataset
- **Context Reuse**: Same expert strength coaching context across all analyses
- **Performance Optimization**: Session reduces token costs for batch processing

### 3. Schema-Driven Exercise Validation

Persuader ensures all generated relationships:

- Reference valid exercises from the available dataset
- Follow proper strength training progression principles
- Include meaningful categorization across all 4 relationship types
- Can be safely processed by workout generation systems

## 🔍 Example Output

```json
{
  "exercise": "Bench Press",
  "similarMuscles": ["Push-up", "Incline Bench Press", "Dips"],
  "variationOf": ["Push-up", "Chest Press"],
  "progressionFrom": ["Push-up", "Incline Push-up"],
  "substitutableFor": ["Chest Press", "Dumbbell Press"]
}
```

## 📈 Performance Characteristics

The demo showcases Persuader's reliability patterns:

- **High Success Rate**: Schema validation catches relationship errors
- **Intelligent Retries**: Specific feedback improves LLM exercise selections
- **Consistent Output**: All results follow the same validated structure
- **Domain Accuracy**: LLM corrections lead to biomechanically sound relationships

## 🛠️ Customization

### Adding New Exercises

1. Create a new exercise file in `data/exercises/`:

```json
{
  "data": {
    "name": "New Exercise",
    "category": "Exercise Type",
    "equipment": "Required Equipment",
    "primaryMuscles": ["Muscle1", "Muscle2"],
    "difficulty": "Beginner",
    "movementPattern": "Movement Type"
  }
}
```

2. The demo will automatically include it in the next run

### Modifying the Schema

Edit the `ExerciseRelationshipSchema` in `minimal.ts` to change validation rules:

```typescript
// Add minimum relationship requirements
similarMuscles: z.array(z.string())
  .min(1, 'Must have at least 1 similar exercise')
  .max(5, 'Too many similar exercises - keep it focused');
```

### Changing the Context

Modify the LLM context to focus on different training aspects:

```typescript
const context = `You are a physical therapist focusing on safe exercise progressions and injury prevention for recreational athletes.`;
```

## 🎓 Key Learning Points

This demo illustrates several important Persuader patterns:

1. **Domain Relationship Extraction**: Using LLMs to find connections between structured entities
2. **Session-Based Validation**: How context improves relationship accuracy and prevents hallucination
3. **Multi-Dimensional Analysis**: Extracting different types of relationships from the same data
4. **Batch Processing Efficiency**: Session reuse for processing related data sets
5. **Production Readiness**: File I/O, error handling, and comprehensive progress tracking

The exercise domain provides an excellent example because it requires both technical precision (valid data structures) and domain knowledge (proper strength training principles), demonstrating Persuader's ability to bridge structured programming with expert domain knowledge.
