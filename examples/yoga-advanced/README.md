# Advanced Yoga Pose Analysis Demo

This directory demonstrates Persuader's sophisticated multi-dimensional relationship analysis using rich yoga pose datasets. It showcases advanced domain knowledge extraction and complex schema validation capabilities.

## 🎯 Demo Overview

The advanced yoga demo analyzes **6 dimensions** of pose relationships using comprehensive anatomical and energetic data:

1. **Anatomical Progression** - Poses with same muscles but increased difficulty
2. **Energetic Flow** - Poses with compatible or complementary energy states  
3. **Therapeutic Alternatives** - Gentler alternatives for physical limitations
4. **Counter-poses** - Essential balancing poses (backbends after forward folds)
5. **Preparatory Sequence** - Poses that warm up and prepare the body
6. **Integration Options** - Neutral poses for rest and processing afterward

## 🧘‍♀️ Rich Data Source

Uses the comprehensive pose dataset from `examples/yoga/poses/` containing:

- **50 detailed poses** with anatomical focus, energy states, and practice context
- **Biomechanical analysis** including muscle engagement and joint actions
- **Practitioner profiles** with experience levels and physical considerations
- **Environmental factors** like space requirements and prop usage
- **Therapeutic information** for modifications and adaptations

## 🚀 Running the Demo

```bash
# From the Persuader root directory
npm run example:yoga-advanced
```

The demo processes the first 10 poses for comprehensive analysis, generating:
- Individual relationship files per pose
- Advanced summary with dimensional breakdowns
- Rich metadata preservation

## 📊 Example Output

### Boat Pose (Navasana) - 18 Total Relationships:

```json
{
  "pose": "Boat Pose",
  "anatomicalProgression": ["Forearm Stand", "Crow Pose", "Four-Limbed Staff"],
  "energeticFlow": ["Plank Pose", "Downward-Facing Dog", "Side Plank"],
  "therapeuticAlternatives": ["Staff Pose", "Easy Pose", "Child's Pose"],
  "counterPoses": ["Child's Pose", "Corpse Pose", "Seated Forward Fold"],
  "preparatorySequence": ["Cat-Cow Pose", "Staff Pose", "Mountain Pose"],
  "integrationOptions": ["Corpse Pose", "Easy Pose", "Happy Baby"],
  "sourceData": {
    "sanskritName": "Navasana",
    "difficulty": "Intermediate",
    "energyState": "Energizing and powerful",
    "primaryMuscles": ["Core stabilizers", "Hip flexors"],
    "energeticEffect": "Building strength and focus"
  }
}
```

## 🔬 Technical Sophistication

### Schema Complexity
- **Schema complexity: 10** (vs 4 for basic yoga, 8 for exercise)
- **6-dimensional analysis** with sophisticated domain understanding
- **Rich input context** using comprehensive pose metadata
- **Automatic retry/validation** handling complex JSON structures

### Domain Expertise Integration
- **Anatomical safety** considerations for progression recommendations
- **Energy system understanding** for compatible flow sequences
- **Therapeutic knowledge** for modification and adaptation suggestions
- **Sequencing wisdom** for preparation and integration practices

## 📁 Directory Structure

```
examples/yoga-advanced/
├── README.md           # This file
├── index.ts           # Advanced relationship analysis demo
└── output/  # Generated analysis files
    ├── *-advanced-relationships.json  # Individual pose analyses
    └── advanced-summary.json         # Comprehensive summary
```

## 🎓 Key Learning Points

This advanced demo illustrates sophisticated Persuader patterns:

1. **Multi-dimensional Analysis** - Complex relationship extraction (6D vs simple transitions)
2. **Rich Data Utilization** - Leveraging comprehensive domain datasets  
3. **Advanced Schema Design** - Handling complex validation requirements
4. **Domain Expertise Integration** - Encoding specialized knowledge in prompts
5. **Scalable Architecture** - Session-based processing for efficiency
6. **Production Metadata** - Comprehensive result tracking and analysis

The progression from basic → exercise → advanced demonstrates Persuader's ability to scale from simple validation to sophisticated domain analysis while maintaining the same clean, validated output patterns.

## 🧠 Domain Knowledge Demonstrated

- **Anatomical Understanding** - Muscle groups, joint actions, movement patterns
- **Energy System Awareness** - Grounding, centering, energizing, calming effects  
- **Therapeutic Applications** - Modifications for injuries and limitations
- **Sequencing Intelligence** - Safe progressions and balancing practices
- **Practice Integration** - Holistic consideration of yoga philosophy and safety

This represents the most sophisticated relationship analysis in the Persuader example suite, showing how the framework can handle expert-level domain knowledge extraction and validation.