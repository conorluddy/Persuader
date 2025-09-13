# Fitness Program Analysis - Lens Example

This example demonstrates how **Persuader's lens feature** enables different fitness professionals to analyze the same workout program from their specialized perspectives, producing varying insights and recommendations.

## 🎯 What This Example Demonstrates

- **Same Schema, Different Perspectives**: How identical validation schemas work with different analytical lenses
- **Professional Domain Expertise**: Rich, detailed prompts that embody real professional knowledge
- **Perspective-Driven Analysis**: How the same data produces different insights based on the analytical framework
- **Multi-Day Program Analysis**: Complex, realistic fitness programs rather than simple workouts

## 📁 Structure

```
fitness-analysis/
├── schemas/
│   └── workout-analysis.ts     # Zod schema for program analysis
├── prompts/
│   ├── base-context.ts         # Shared context for all analyses
│   ├── strength-coach-lens.ts  # Strength & conditioning perspective
│   ├── endurance-coach-lens.ts # Cardiovascular training perspective
│   ├── physical-therapist-lens.ts # Injury prevention & movement quality
│   └── bodybuilder-lens.ts     # Muscle building & aesthetics
├── data/
│   ├── beginner-3day-split.json    # 3-day full body program
│   └── advanced-ppl-split.json     # 6-day push/pull/legs split
├── examples/
│   ├── analyze-single.ts       # Single lens analysis demo
│   └── compare-perspectives.ts # Multi-perspective comparison
└── README.md
```

## 🏃‍♂️ Quick Start

### Analyze Single Program with One Lens

```bash
# From project root
npx tsx examples/fitness-analysis/examples/analyze-single.ts
```

### Compare All Professional Perspectives

```bash
# From project root
npx tsx examples/fitness-analysis/examples/compare-perspectives.ts
```

### CLI Usage

```bash
# Strength coach analysis of beginner program
persuader run \
  --schema examples/fitness-analysis/schemas/workout-analysis.ts \
  --input examples/fitness-analysis/data/beginner-3day-split.json \
  --context "$(cat examples/fitness-analysis/prompts/base-context.ts | grep -A 50 'BASE_CONTEXT')" \
  --lens "$(cat examples/fitness-analysis/prompts/strength-coach-lens.ts | grep -A 100 'STRENGTH_COACH_LENS')"
```

## 👥 Professional Perspectives

### 💪 Strength Coach

- **Focus**: Progressive overload, compound movements, strength gains
- **Priorities**: Movement patterns, periodization, power development
- **Concerns**: Technical breakdown, plateau prevention

### 🏃 Endurance Coach

- **Focus**: Cardiovascular adaptations, work capacity, recovery
- **Priorities**: Heart rate zones, energy systems, volume distribution
- **Concerns**: Overtraining, metabolic inflexibility

### 🩺 Physical Therapist

- **Focus**: Injury prevention, movement quality, tissue health
- **Priorities**: Biomechanics, muscle balance, safe progression
- **Concerns**: Injury risk, compensatory patterns

### 🏆 Bodybuilder

- **Focus**: Muscle hypertrophy, aesthetic development, volume
- **Priorities**: Muscle isolation, time under tension, symmetry
- **Concerns**: Muscle imbalances, hypertrophy optimization

## 🔍 Example Analysis Differences

The same **Beginner 3-Day Split** program might receive:

| Professional           | Rating    | Effectiveness | Primary Strength                     | Main Concern                             |
| ---------------------- | --------- | ------------- | ------------------------------------ | ---------------------------------------- |
| **Strength Coach**     | Very Good | 8/10          | "Solid compound movement foundation" | "Lacks progressive overload specificity" |
| **Endurance Coach**    | Fair      | 5/10          | "Good movement variety"              | "Insufficient cardiovascular challenge"  |
| **Physical Therapist** | Excellent | 9/10          | "Safe progression for beginners"     | "Missing mobility work"                  |
| **Bodybuilder**        | Good      | 6/10          | "Covers all major muscle groups"     | "Low volume for muscle growth"           |

## 🎓 Learning Outcomes

This example teaches:

1. **Lens Design**: How to create detailed, domain-specific analytical prompts
2. **Perspective Impact**: How the same data produces different insights
3. **Professional Thinking**: Real-world expertise embedded in prompts
4. **Schema Reusability**: One validation schema works across all perspectives
5. **Complex Data**: Handling multi-day, structured fitness programs

## 🛠️ Extending the Example

Add your own perspectives:

- **Sports Performance Coach** - Sport-specific adaptations
- **Rehabilitation Specialist** - Return from injury protocols
- **Nutrition Coach** - Integration with meal planning
- **Youth Coach** - Age-appropriate training modifications

## 📊 Key Insights

- **Same facts, different priorities**: All professionals see the same exercises but weight them differently
- **Domain expertise matters**: Deep professional knowledge creates more valuable insights
- **Structured prompting**: Rich context + focused lens = specialized analysis
- **Validation consistency**: Complex outputs remain type-safe across all perspectives
