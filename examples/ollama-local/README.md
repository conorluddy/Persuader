# Ollama Local LLM Creative Writing Example

This example demonstrates using **Ollama** for **private, local creative writing** with the Persuader framework. Perfect for exploring creative ideas, writing stories, or brainstorming content without sending any data to external servers.

## 🔒 Privacy First

**Everything runs on your machine:**
- ✅ Complete privacy for creative prompts and stories
- ✅ No API costs - unlimited story generation
- ✅ Works offline once models are downloaded
- ✅ No data sent to external servers
- ✅ Perfect for confidential or personal creative projects

## 🚀 Quick Start

```bash
# Install and start Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve

# Pull a suitable model (in another terminal)
ollama pull llama3.2

# Run the creative writing demo
npm run example:ollama
```

## 📋 Prerequisites

### 1. Install Ollama
Visit [ollama.ai](https://ollama.ai) or install via script:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### 2. Start Ollama Service
```bash
ollama serve
```
Keep this running in a terminal. Ollama will be available at `http://localhost:11434`.

### 3. Download a Model
```bash
# Recommended: Fast, capable model
ollama pull llama3.2

# Alternative: Larger, more capable model (requires more RAM)
ollama pull llama3.1:8b

# For creative writing: Specialized model
ollama pull mistral
```

### 4. Verify Setup
```bash
# Check available models
ollama list

# Test a model
ollama run llama3.2 "Write a haiku about coding"
```

## 🎨 What This Example Does

### Creative Writing Pipeline
1. **Health Check**: Verifies Ollama service and model availability
2. **Model Discovery**: Lists available local models
3. **Session Creation**: Establishes context for narrative continuity
4. **Story Generation**: Creates multiple stories with consistent style
5. **Output Saving**: Stores all stories locally

### Sample Story Prompts
- "A person discovers an old letter in a used book that changes everything"
- "In a world where colors have been drained away, someone finds the last rainbow"  
- "A time traveler gets stuck in the wrong decade and must adapt to survive"

### Generated Story Structure
Each story includes:
- **Narrative Elements**: Title, genre, setting, characters, plot
- **Writing Analysis**: Style, tone, perspective, themes
- **Metadata**: Word count, generation time, model info

## 🏗️ Architecture

```
examples/ollama-local/
├── README.md                 # This file
├── index.ts                 # Main demo script
├── schemas/
│   └── story-schema.ts      # Zod schemas for story validation
├── prompts/
│   └── creative-writer.ts   # Writer persona and contexts
└── output/
    └── stories.json         # Generated stories (created after run)
```

### Key Components

#### Story Schema (`schemas/story-schema.ts`)
Comprehensive Zod schema defining:
- Story structure (title, genre, plot, characters)
- Writing style analysis (perspective, tone, pacing)
- Narrative elements (setting, themes, conflict resolution)

#### Creative Writer Persona (`prompts/creative-writer.ts`)
Professional writer context including:
- Writing philosophy and expertise
- Genre versatility and techniques
- Session continuity guidelines
- Privacy-focused messaging

## 🎯 Learning Objectives

### Ollama Concepts
- **Local LLM Setup**: Installing and configuring Ollama
- **Model Management**: Downloading and selecting appropriate models
- **Health Monitoring**: Checking service availability and performance
- **Privacy Benefits**: Understanding local vs. cloud trade-offs

### Persuader Patterns
- **Session Continuity**: Maintaining context across multiple generations
- **Schema Validation**: Ensuring structured creative output
- **Error Handling**: Graceful degradation for local services
- **Performance Tuning**: Optimizing for creative tasks

## 🔧 Configuration

### Model Selection
Different models for different creative needs:

```typescript
// Fast, general creative writing
const ollamaProvider = createOllamaAdapter({
  defaultModel: 'llama3.2',
  baseUrl: 'http://localhost:11434'
});

// Larger model for complex narratives
const ollamaProvider = createOllamaAdapter({
  defaultModel: 'llama3.1:8b',
  timeout: 120000 // Longer timeout for larger models
});

// Specialized creative model
const ollamaProvider = createOllamaAdapter({
  defaultModel: 'mistral',
  temperature: 0.9 // Higher creativity
});
```

### Creative Parameters
Adjust for different writing styles:

```typescript
// More creative and varied
const result = await persuade({
  temperature: 0.9,
  maxTokens: 3000,
  // ... other options
});

// More focused and consistent  
const result = await persuade({
  temperature: 0.6,
  maxTokens: 1500,
  // ... other options
});
```

## 📊 Sample Output

```json
{
  "metadata": {
    "provider": "ollama",
    "model": "llama3.2",
    "totalStories": 3,
    "totalGenerationTime": 15420,
    "sessionId": "uuid-session-id"
  },
  "stories": [
    {
      "promptNumber": 1,
      "prompt": "A person discovers an old letter...",
      "story": {
        "title": "The Letter in Chapter Seven",
        "genre": "literary fiction",
        "wordCount": 847,
        "characters": [
          {
            "name": "Sarah Chen",
            "role": "protagonist",
            "description": "Graduate student struggling with thesis"
          }
        ],
        "story": "Sarah had always been careful with used books..."
      }
    }
  ]
}
```

## 🛠️ Troubleshooting

### Common Issues

#### "Ollama API not responding"
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve
```

#### "No models available"
```bash
# List installed models
ollama list

# Pull a model if none installed
ollama pull llama3.2
```

#### "Generation timeout"
- Increase timeout for complex stories
- Try a smaller, faster model
- Reduce `maxTokens` parameter

#### "Poor story quality"
- Try different models (mistral, llama3.1)
- Adjust temperature (0.7-0.9 for creativity)
- Modify prompts for clearer instructions

## 🔄 Extending the Example

### Add New Story Types
1. Create new prompt templates in the script
2. Adjust schema for different story formats
3. Modify writer context for specific genres

### Multiple Models
Compare outputs from different models:
```typescript
const models = ['llama3.2', 'mistral', 'llama3.1:8b'];
for (const model of models) {
  const provider = createOllamaAdapter({ defaultModel: model });
  // Generate and compare stories
}
```

### Advanced Features
- **Story Series**: Generate connected stories with recurring characters
- **Style Analysis**: Compare writing styles across different models
- **Interactive Mode**: Accept user prompts for custom story generation
- **Export Formats**: Convert to markdown, PDF, or other formats

## 🎓 Next Steps

1. **Try Different Models**: Experiment with various Ollama models
2. **Custom Prompts**: Create your own story prompts and themes
3. **Session Management**: Explore longer creative sessions with character development
4. **Integration**: Use generated stories in larger creative projects

This example showcases the power of local LLMs for creative work while maintaining complete privacy and control over your content!