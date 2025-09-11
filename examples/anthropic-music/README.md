# Anthropic SDK Music Composition Example

This example demonstrates using Anthropic's language models for sophisticated music composition, showcasing the power of advanced reasoning for creative tasks. Transform simple themes into complete, professional-quality songs with lyrics, chord progressions, and full arrangements.

## What This Example Showcases

### Anthropic SDK Advantages
- **Advanced Creative Reasoning**: Superior ability to transform abstract concepts into concrete musical elements
- **Stateless Design**: Each composition is an independent creative project without session dependencies
- **Comprehensive Output**: Generate complete songs including lyrics, chords, arrangements, and production notes
- **Professional Quality**: Industry-standard terminology and practical implementation guidance

### Music Composition Features
- **Complete Song Creation**: From theme to finished composition with all musical elements
- **Multi-Genre Capability**: Folk, rock, electronic, country, jazz, and more
- **Professional Arrangements**: Detailed instrumentation and production guidance
- **Lyrical Sophistication**: Meaningful, well-crafted lyrics with proper rhyme schemes
- **Performance Ready**: Practical information for musicians and producers

## Example Output

The system transforms simple themes like:
```json
{
  "theme": "A coffee shop on a rainy Tuesday morning where strangers share quiet moments",
  "mood": "contemplative",
  "genre": "indie folk"
}
```

Into complete compositions including:
- **Song Metadata**: Title, genre, key, time signature, estimated duration
- **Full Lyrics**: Verses, choruses, bridge with rhyme schemes
- **Chord Progressions**: Detailed progressions for each song section
- **Instrumentation**: Lead, rhythm, harmony, and special instruments
- **Production Notes**: Arrangement, dynamics, performance tips
- **Artistic Context**: Inspiration and listening suggestions

## Setup Requirements

### 1. Install Dependencies
```bash
# Install from project root
npm install
```

### 2. Anthropic API Setup
Get your API key from [Anthropic Console](https://console.anthropic.com/):

```bash
# Copy environment template
cp .env.example .env

# Add your API key to .env
ANTHROPIC_API_KEY=your_api_key_here
```

### 3. Verify Setup
```bash
# Test the example
npm run demo:anthropic-music
```

## Usage

### Basic Composition
```bash
# Run the music composition demo
npm run demo:anthropic-music
```

This will:
1. Load song themes from `input/song-themes.json`
2. Create complete compositions for each theme
3. Save results to `output/compositions.json`
4. Display composition summaries in the console

### Custom Themes
Edit `input/song-themes.json` to add your own themes:

```json
[
  {
    "theme": "Your creative concept here",
    "mood": "energetic",
    "genre": "rock",
    "inspiration": "Additional context or inspiration",
    "keyElements": ["guitar", "drums", "vocals"]
  }
]
```

### Using in Code
```typescript
import { createAnthropicAdapter, persuade } from 'persuader';
import { SongCompositionSchema } from './schemas/song-schema.js';

const provider = createAnthropicAdapter({
  defaultModel: 'claude-3-5-sonnet-20241022',
  maxTokens: 4000,
});

const result = await persuade(
  {
    schema: SongCompositionSchema,
    input: {
      theme: {
        theme: "Dancing under city lights on New Year's Eve",
        mood: "celebratory",
        genre: "pop"
      }
    },
    context: "You are an expert music composer...",
    temperature: 0.8, // Higher for creativity
  },
  provider
);

if (result.ok) {
  console.log(`Created song: "${result.value.metadata.title}"`);
  console.log(`Lyrics preview: ${result.value.lyrics[0].lines[0]}`);
}
```

## Generated Content Structure

### Song Composition Schema
```typescript
{
  metadata: {
    title: "Song Title",
    genre: "Folk Rock",
    key: "C Major",
    timeSignature: "4/4",
    estimatedDuration: "3:45",
    difficulty: "intermediate"
  },
  structure: {
    sections: ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"],
    form: "ABABCB"
  },
  lyrics: [
    {
      section: "verse",
      sectionNumber: 1,
      lines: ["First line of verse", "Second line of verse"],
      rhymeScheme: "ABAB"
    }
  ],
  chordProgressions: [
    {
      section: "verse",
      chords: ["C", "Am", "F", "G"],
      pattern: "Down-up strum pattern",
      tempo: "Moderate 4/4"
    }
  ],
  instrumentation: {
    lead: ["acoustic guitar", "vocals"],
    rhythm: ["bass guitar", "drums"],
    harmony: ["strings", "backing vocals"]
  },
  productionNotes: {
    arrangement: "Start with solo guitar, build to full arrangement",
    dynamics: "Soft verses, powerful chorus",
    style: "Fingerpicked verses, strummed chorus",
    tips: ["Use capo on 3rd fret", "Record vocals with room reverb"]
  }
}
```

## Advanced Features

### Batch Composition
Process multiple themes in a single run with comprehensive collection analysis:

```typescript
const themes = [
  { theme: "Morning coffee ritual", mood: "peaceful", genre: "jazz" },
  { theme: "Highway adventure", mood: "adventurous", genre: "country" },
  { theme: "Late night coding", mood: "focused", genre: "electronic" }
];

// Each composition is independent (stateless design)
for (const theme of themes) {
  const composition = await persuade({ schema, input: { theme } }, provider);
}
```

### Genre Specialization
The composer persona adapts to different musical styles:

- **Folk & Acoustic**: Intimate storytelling with organic arrangements
- **Rock & Pop**: Hook-driven songs with strong rhythmic foundations  
- **Jazz & Blues**: Sophisticated harmony with improvisation focus
- **Electronic**: Textural, atmospheric compositions with technology themes
- **Country**: Narrative-driven songs with traditional instrumentation

### Professional Output
Generated compositions include:

- **Music Theory**: Proper chord notation, key signatures, time signatures
- **Performance Details**: Tempo markings, dynamics, playing techniques
- **Production Guidance**: Recording tips, arrangement suggestions, mixing notes
- **Reference Material**: Similar artists and songs for stylistic context

## Anthropic SDK Benefits

### Creative Excellence
- **Advanced Reasoning**: Superior ability to connect abstract themes with concrete musical elements
- **Cultural Awareness**: Understanding of musical traditions and contemporary trends
- **Artistic Vision**: Coherent creative decisions that serve the overall artistic statement

### Technical Sophistication
- **Music Theory Knowledge**: Proper harmonic progressions and structural forms
- **Genre Fluency**: Authentic representation of diverse musical styles
- **Industry Standards**: Professional terminology and practical implementation details

### Reliable Quality
- **Consistent Output**: High-quality compositions across diverse themes and genres
- **Complete Information**: All elements needed for performance and recording
- **Practical Focus**: Realistic arrangements suitable for actual musicians

## Troubleshooting

### Common Issues

**API Key Problems**
```bash
# Error: Authentication failed
# Solution: Verify API key in .env file
echo $ANTHROPIC_API_KEY  # Should show your key
```

**Model Access Issues**
```bash
# Error: Model not available
# Solution: Check your Anthropic account tier and model access
```

**Output Quality Concerns**
- Increase `maxTokens` for more detailed compositions
- Adjust `temperature` (0.7-0.9 for creative tasks)
- Refine theme descriptions for better results

### Performance Tips
- Use specific, evocative themes for better compositions
- Include genre and mood preferences for focused output
- Provide key elements or instruments for targeted arrangements
- Review and iterate on generated compositions

## Next Steps

1. **Experiment with Themes**: Try different musical concepts and styles
2. **Customize Schemas**: Modify the composition schema for specific needs
3. **Integrate with DAWs**: Use generated chord progressions in music software
4. **Collaborate with Musicians**: Share compositions with performers and producers
5. **Build Music Applications**: Create tools for songwriters and composers

This example demonstrates the power of AI-assisted music composition while maintaining professional standards and practical usability. The stateless design makes it perfect for independent creative projects and integration into larger music production workflows.