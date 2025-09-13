# Yoga Pose Analysis Demo

This directory demonstrates Persuader's capabilities with complex domain knowledge through yoga pose analysis. The demo shows how to use schema-driven validation to process structured yoga data and generate pose transitions (edges in a pose graph).

## 🎯 Demo Overview

The yoga demo consists of:

- **Simple Pose Data**: Basic yoga poses with core attributes (name, Sanskrit name, category, difficulty)
- **Transition Analysis**: LLM-powered generation of pose-to-pose transitions based on anatomical safety and flow principles
- **Schema Validation**: Ensures all generated transitions follow the defined structure

## 📁 Directory Structure

```
examples/yoga/
├── README.md                 # This file
├── index.ts           # Main demo script showing transition generation
├── poses/                   # Full pose data (50+ poses)
├── simple-poses/            # Simplified pose data for demo
│   ├── index.json          # Index of all simple poses
│   └── *.json              # Individual pose files
└── output/                # Generated transition data
    └── transitions/        # Pose transition results
```

## 🔄 JSON Processing Workflow

The yoga demo follows a structured JSON processing pipeline:

```mermaid
flowchart TD
    A[Load simple-poses/index.json] --> B[Extract poses array]
    B --> C[Create results/ directory]
    C --> D[Initialize session & metrics]
    D --> E[For each pose...]

    E --> F[Build input JSON]
    F --> G[Current pose + available pose IDs]
    G --> H[Send to Persuader pipeline]

    H --> I[LLM Processing]
    I --> J[Schema validation against PoseTransitionSchema]
    J --> K{Valid?}

    K -->|No| L[Generate feedback]
    L --> M[Retry with corrections]
    M --> I

    K -->|Yes| N[Save individual result]
    N --> O[Write {poseId}-transitions.json]
    O --> P[Update metrics & session]
    P --> Q[Next pose or finish]

    Q --> R[Generate summary.json]
    R --> S[Performance metrics & statistics]

    style A fill:#e1f5fe
    style O fill:#c8e6c9
    style R fill:#fff3e0
    style J fill:#fce4ec
```

### Key Processing Steps

1. **Input Loading**: Read pose data from JSON index file
2. **Structured Input**: Build input object with current pose + available transitions
3. **LLM Pipeline**: Process through Persuader with schema validation
4. **Retry Logic**: Auto-correct invalid outputs with targeted feedback
5. **Individual Output**: Save validated transitions per pose as JSON
6. **Batch Summary**: Generate comprehensive analysis with performance metrics

## 🚀 Running the Demo

### Quick Start

Run the built-in demo script:

```bash
# From the Persuader root directory
npm run example:yoga
```

This will:

1. Load simple pose data from `simple-poses/`
2. Generate transitions for each pose using Claude
3. Validate results against the transition schema
4. Save validated transitions to `output/transitions/`

### Using the CLI

Process yoga data with the CLI tool:

```bash
# Process all simple poses
persuader run \
  --schema ./examples/yoga/simple-schema.ts \
  --input "./examples/yoga/simple-poses/*.json" \
  --context "You are an expert yoga instructor analyzing pose transitions" \
  --retries 3 \
  --verbose
```

## 📊 Schema Structure

### Simple Pose Schema

Each pose contains basic information:

```typescript
interface SimplePose {
  id: string; // Unique identifier (e.g., "mountain-pose")
  name: string; // English name (e.g., "Mountain Pose")
  sanskritName: string; // Sanskrit name (e.g., "Tadasana")
  difficulty: string; // Difficulty level ("beginner", "intermediate", "advanced")
  category: string; // Pose category ("standing", "seated", "backbend", etc.)
}
```

### Pose Transition Schema

The demo generates transitions between poses:

```typescript
const PoseTransitionSchema = z.object({
  currentPoseId: z.string().describe('ID of the pose being analyzed'),
  transitionIds: z
    .array(z.string())
    .describe(
      'Array of pose IDs that can be transitioned into from current pose'
    ),
  reasoning: z
    .string()
    .optional()
    .describe('Brief explanation of transition logic'),
});
```

## 🧘‍♀️ What the Demo Demonstrates

### 1. Complex Domain Knowledge

The yoga domain requires understanding of:

- **Anatomical Safety**: Which transitions are safe for the body
- **Flow Principles**: Natural movement patterns between poses
- **Difficulty Progression**: Appropriate sequences for different skill levels
- **Sanskrit Accuracy**: Proper handling of traditional terminology

### 2. Schema-Driven Validation

Persuader ensures all generated transitions:

- Reference valid pose IDs from the dataset
- Include meaningful transition reasoning
- Follow the expected data structure
- Can be safely processed by downstream applications

### 3. Retry Intelligence

When the LLM generates invalid transitions, Persuader:

- Identifies specific validation errors (e.g., invalid pose IDs)
- Provides targeted feedback to the LLM
- Retries with corrected context
- Tracks attempts and success rates

## 🔍 Example Output

```json
{
  "currentPoseId": "mountain-pose",
  "transitionIds": ["tree-pose", "forward-fold", "upward-salute", "chair-pose"],
  "reasoning": "From Mountain Pose, practitioners can safely transition to Tree Pose for balance work, Forward Fold to begin spinal flexion, Upward Salute to open the body, or Chair Pose to engage the legs."
}
```

## 📈 Performance Characteristics

The demo showcases Persuader's reliability patterns:

- **High Success Rate**: Schema validation catches common LLM errors
- **Intelligent Retries**: Specific feedback improves LLM responses
- **Consistent Output**: All results follow the same validated structure
- **Domain Accuracy**: LLM corrections lead to anatomically sound transitions

## 🛠️ Customization

### Adding New Poses

1. Create a new pose file in `simple-poses/`:

```json
{
  "id": "new-pose",
  "name": "New Pose",
  "sanskritName": "Sanskrit Name",
  "difficulty": "beginner",
  "category": "standing"
}
```

2. Update `simple-poses/index.json` to include the new pose

### Modifying the Schema

Edit the `PoseTransitionSchema` in `index.ts` to change validation rules:

```typescript
// Add minimum/maximum transition counts
transitionIds: z.array(z.string())
  .min(2, 'Must have at least 2 transitions')
  .max(8, 'Too many transitions - keep it focused');
```

### Changing the Context

Modify the LLM context to focus on different aspects:

```typescript
const context = `You are a therapeutic yoga instructor focusing on accessibility and modifications for practitioners with limited mobility.`;
```

## 🎓 Key Learning Points

This demo illustrates several important Persuader patterns:

1. **Domain Expertise**: How to encode subject matter expertise in prompts and schemas
2. **Graph Generation**: Using LLMs to find relationships (edges) between entities (nodes)
3. **Validation Precision**: Schema design that catches domain-specific errors
4. **Iterative Refinement**: How retry loops improve output quality
5. **Production Readiness**: File I/O, error handling, and progress tracking

The yoga domain provides an excellent example because it requires both technical precision (valid data structures) and domain knowledge (safe anatomical transitions), demonstrating Persuader's ability to bridge structured programming with human expertise.
