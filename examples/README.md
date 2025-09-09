# Persuader Examples

This directory contains comprehensive examples demonstrating Persuader's capabilities across different domains and complexity levels. Each example showcases specific features and patterns, progressing from simple validation to complex multi-stage orchestration.

## 🚀 Quick Start

All examples can be run using standardized npm scripts from the project root:

```bash
# Fitness program analysis with multiple expert perspectives
npm run example:fitness

# Basic yoga pose transition generation  
npm run example:yoga

# Advanced multi-dimensional yoga relationship analysis
npm run example:yoga-advanced

# Exercise relationship extraction and categorization
npm run example:exercise

# Multi-stage workout program generation with session management
npm run example:workout
```

## 📚 Examples Overview

### 🏋️ [Fitness Analysis](./fitness-analysis/) - **Multi-Lens Analysis**
**Complexity**: ⭐⭐⭐⭐  
**Key Features**: Multi-perspective analysis, external prompts, lens system

Demonstrates how different fitness professionals (strength coach, endurance coach, physical therapist, bodybuilder) analyze the same workout program through their specialized expertise. Showcases Persuader's lens feature for perspective-driven analysis.

```bash
npm run example:fitness         # Single lens analysis
npm run example:fitness:compare # Multi-perspective comparison
```

**Learning Focus**: 
- Lens-based analysis patterns
- Professional domain expertise modeling
- External prompt management
- Multi-perspective data generation

---

### 🧘 [Yoga Pose Transitions](./yoga/) - **Graph Relationship Discovery**
**Complexity**: ⭐⭐  
**Key Features**: Simple relationships, pose transition graphs, session efficiency

Generates safe anatomical transitions between yoga poses, treating poses as nodes and transitions as edges in a knowledge graph. Perfect introduction to relationship extraction.

```bash
npm run example:yoga          # Full transition analysis
npm run example:yoga:minimal  # Streamlined version
```

**Learning Focus**:
- Basic relationship extraction
- Graph generation patterns  
- Session-based context reuse
- Domain safety validation

---

### 🔥 [Advanced Yoga Analysis](./yoga-advanced/) - **Multi-Dimensional Relationships**  
**Complexity**: ⭐⭐⭐⭐⭐  
**Key Features**: 6-dimensional analysis, rich data utilization, complex schemas

Advanced relationship extraction across 6 dimensions: anatomical progression, energetic flow, therapeutic alternatives, counter-poses, preparatory sequences, and integration options.

```bash
npm run example:yoga-advanced
```

**Learning Focus**:
- Complex multi-dimensional analysis
- Rich dataset utilization
- Advanced schema design
- Expert domain knowledge integration

---

### 💪 [Exercise Relationships](./exercise/) - **Domain Categorization**
**Complexity**: ⭐⭐⭐  
**Key Features**: Multi-category relationships, exercise science, biomechanics

Analyzes exercise relationships across 4 categories: similar muscle groups, exercise variations, progression pathways, and substitution patterns. Demonstrates structured categorization in the fitness domain.

```bash
npm run example:exercise
```

**Learning Focus**:
- Multi-category relationship extraction
- Biomechanical understanding validation
- Exercise science domain modeling
- Progressive training concepts

---

### 🏃 [Workout Generator](./workout-generator/) - **Multi-Stage Orchestration**
**Complexity**: ⭐⭐⭐⭐⭐  
**Key Features**: 5-stage pipeline, session continuity, compound data flow

Sophisticated multi-stage workflow generating complete 4-week workout programs through 5 sequential stages: fitness assessment, exercise selection, workout structuring, progression planning, and recovery integration.

```bash
npm run example:workout
```

**Learning Focus**:
- Multi-stage orchestration patterns
- Session-based context evolution
- Compound data flow between stages
- Complex professional persona maintenance
- Real-world utility generation

---

## 🏗️ Example Architecture

All examples follow a consistent, professional structure:

```
example-name/
├── README.md                 # Comprehensive documentation
├── index.ts                 # Main entry point
├── schemas/                 # Zod validation schemas
│   └── *.ts                # Type-safe validation definitions
├── prompts/                 # External prompt files  
│   └── *.ts                # Reusable LLM contexts and lenses
├── data/                    # Input data files
│   └── */                  # Organized by data type
└── output/                  # Generated results
    ├── *-analysis.json     # Individual results
    └── summary.json        # Batch summaries
```

### Key Design Principles

1. **Consistent Commands**: All examples use `npm run example:[name]` pattern
2. **External Prompts**: Domain expertise stored in reusable prompt files
3. **Type Safety**: Comprehensive Zod schemas for all LLM outputs
4. **Professional Structure**: Production-ready file organization
5. **Clear Documentation**: Detailed README with usage and learning outcomes

## 🎓 Learning Path

### Beginner: Start with Yoga
- **Basic**: `npm run example:yoga` - Simple relationship extraction
- **Minimal**: `npm run example:yoga:minimal` - Streamlined session usage

### Intermediate: Exercise Relationships  
- **Multi-Category**: `npm run example:exercise` - Structured categorization patterns

### Advanced: Complex Analysis
- **Multi-Lens**: `npm run example:fitness` - Professional perspective modeling
- **Multi-Dimensional**: `npm run example:yoga-advanced` - Complex relationship extraction

### Expert: Orchestration
- **Multi-Stage**: `npm run example:workout` - Complete workflow orchestration

## 🔧 Development Patterns

### Schema Design
Each example demonstrates progressively complex schema patterns:

```typescript
// Simple: Basic object validation
const SimpleSchema = z.object({
  pose: z.string(),
  transitions: z.array(z.string())
});

// Advanced: Multi-dimensional with rich metadata
const AdvancedSchema = z.object({
  anatomicalProgression: z.array(z.string()),
  energeticFlow: z.array(z.string()),
  therapeuticAlternatives: z.array(z.string()),
  // ... 6 total dimensions
});

// Expert: Multi-stage compound schemas
const CompoundWorkoutSchema = z.object({
  profile: FitnessProfileSchema,
  exercises: ExerciseSelectionSchema,  
  structure: WorkoutStructureSchema,
  progression: ProgressionPlanSchema,
  recovery: RecoveryIntegrationSchema
});
```

### Prompt Management
External prompts enable reusability and maintainability:

```typescript
// Basic context
export const YOGA_TRANSITION_CONTEXT = `You are analyzing yoga pose transitions...`;

// Professional persona
export const STRENGTH_COACH_LENS = `You are a certified strength coach with expertise in...`;

// Multi-stage context evolution
export const COACH_CONTEXT = `You are an expert fitness coach and exercise physiologist...`;
```

### Session Patterns
Examples demonstrate different session usage patterns:

```typescript
// Simple: Context reuse
const sessionContext = createSessionContext(allPoses);
for (const pose of poses) {
  await persuade({ context: sessionContext, sessionId });
}

// Advanced: Context evolution across stages
let sessionId = await createSession(coachContext);
const profile = await assessFitness(userInput, sessionId);
const exercises = await selectExercises(profile, sessionId); 
// ... context builds through stages
```

## 📊 Complexity Matrix

| Example | Schema Complexity | Domain Depth | Session Usage | Output Richness | Learning Value |
|---------|-------------------|--------------|---------------|-----------------|----------------|
| **Yoga** | ⭐⭐ Simple | ⭐⭐⭐ Moderate | ⭐⭐ Basic | ⭐⭐ Lists | ⭐⭐⭐⭐ High |
| **Exercise** | ⭐⭐⭐ Multi-field | ⭐⭐⭐⭐ Advanced | ⭐⭐⭐ Context Reuse | ⭐⭐⭐ Categorized | ⭐⭐⭐⭐ High |
| **Fitness** | ⭐⭐⭐⭐ Rich Objects | ⭐⭐⭐⭐⭐ Expert | ⭐⭐⭐ Multi-Lens | ⭐⭐⭐⭐ Professional | ⭐⭐⭐⭐⭐ Highest |
| **Yoga Advanced** | ⭐⭐⭐⭐⭐ Multi-Dimensional | ⭐⭐⭐⭐⭐ Expert | ⭐⭐⭐ Efficient | ⭐⭐⭐⭐⭐ Comprehensive | ⭐⭐⭐⭐ High |
| **Workout Generator** | ⭐⭐⭐⭐⭐ Compound | ⭐⭐⭐⭐⭐ Expert | ⭐⭐⭐⭐⭐ Multi-Stage | ⭐⭐⭐⭐⭐ Production-Ready | ⭐⭐⭐⭐⭐ Highest |

## 🛠️ Customization Guide

Each example is designed for easy customization:

### Adding New Data
```bash
# Add new poses, exercises, or programs to data/ directories
examples/yoga/data/poses/051-new-pose.json
examples/exercise/data/exercises/010-new-exercise.json
```

### Modifying Schemas
```typescript
// Extend validation schemas in schemas/ directories
export const EnhancedSchema = BaseSchema.extend({
  newField: z.string().describe("Additional analysis dimension")
});
```

### Creating New Prompts
```typescript
// Add domain expertise in prompts/ directories
export const SPECIALIST_LENS = `You are a specialist in...`;
```

### Extending Analysis
```typescript
// Add new relationship types or analysis dimensions
const ExtendedAnalysis = {
  ...existingAnalysis,
  newDimension: await analyzeNewAspect(input)
};
```

## 🎯 Production Patterns

These examples demonstrate production-ready patterns:

- **Error Handling**: Comprehensive error recovery with detailed logging
- **Type Safety**: Full TypeScript coverage with runtime validation  
- **Performance**: Session reuse and intelligent batching
- **Maintainability**: External prompts and modular architecture
- **Observability**: Detailed progress tracking and metadata collection
- **Extensibility**: Clear patterns for adding new analysis dimensions

## 🔗 Integration Examples

Use these examples as templates for:

- **Fitness Apps**: Exercise recommendation and program generation
- **Educational Platforms**: Curriculum sequencing and prerequisite mapping
- **E-commerce**: Product relationship discovery and recommendation
- **Content Management**: Article tagging and relationship extraction
- **Healthcare**: Treatment protocol generation and safety validation
- **Research**: Data classification and relationship analysis

Each example provides both immediate utility and architectural patterns for building your own domain-specific LLM applications with Persuader.

---

Ready to explore? Start with `npm run example:yoga` for a gentle introduction, or dive into `npm run example:workout` to see Persuader's full orchestration capabilities!