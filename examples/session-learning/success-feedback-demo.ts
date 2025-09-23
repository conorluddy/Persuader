/**
 * Success Feedback Demo
 * 
 * Demonstrates how success feedback improves session-based learning
 * by providing positive reinforcement after successful validation.
 * 
 * This example shows the difference between regular sessions and 
 * sessions with success feedback for maintaining consistent output quality.
 */

import { z } from 'zod';
import { initSession, persuade } from '../../src/index.js';

// Define a schema for data extraction
const PersonSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  age: z.number().int().min(0).max(150, 'Age must be between 0 and 150'),
  occupation: z.string().min(3, 'Occupation must be at least 3 characters'),
  location: z.string().min(2, 'Location must be at least 2 characters'),
  interests: z.array(z.string()).min(1, 'Must have at least one interest'),
});

// Sample input data for extraction
const inputTexts = [
  "Hi, I'm Sarah Johnson, a 28-year-old software engineer from Seattle. I love hiking, reading, and playing piano.",
  "Meet David Chen, 35, works as a marketing director in San Francisco. His hobbies include cooking, photography, and cycling.",
  "This is Maria Rodriguez, age 42, teacher from Austin. She enjoys gardening, yoga, and painting in her free time.",
];

async function demonstrateSuccessFeedback() {
  console.log('🧪 Success Feedback Demo: Session-Based Learning\n');

  // Create a session with success feedback enabled
  const { sessionId } = await initSession({
    context: `You are an expert data extractor. Extract person information from text with perfect accuracy and consistency.`,
  });

  console.log(`📝 Created session: ${sessionId.substring(0, 8)}...\n`);

  console.log('🎯 Processing data with success feedback enabled...\n');

  for (let i = 0; i < inputTexts.length; i++) {
    const inputText = inputTexts[i];
    
    console.log(`📄 Processing input ${i + 1}: "${inputText.substring(0, 50)}..."`);

    try {
      const result = await persuade({
        schema: PersonSchema,
        input: inputText,
        sessionId,
        // Success feedback helps the LLM understand successful patterns
        successMessage: `✅ Perfect extraction! Your accuracy and format are exactly what we need. Continue using this precise approach for consistent results.`,
        retries: 3,
      });

      console.log(`✅ Extracted person ${i + 1}:`, {
        name: result.data.name,
        age: result.data.age,
        occupation: result.data.occupation,
        location: result.data.location,
        interests: result.data.interests,
      });

      console.log(`📊 Metadata:`, {
        attempts: result.metadata.attemptCount,
        executionTime: `${result.metadata.executionTimeMs}ms`,
        tokenUsage: result.metadata.tokenUsage,
      });

    } catch (error) {
      console.error(`❌ Failed to extract person ${i + 1}:`, error);
    }

    console.log(''); // Add spacing between results
  }

  console.log('🎉 Demo completed! Success feedback helps maintain consistency across multiple extractions.');
  console.log('\n💡 Key Benefits of Success Feedback:');
  console.log('   • Reinforces successful patterns in session-based workflows');
  console.log('   • Reduces variance in output quality over multiple requests');
  console.log('   • Helps LLM understand what constitutes perfect results');
  console.log('   • Complements error feedback for comprehensive learning');
  console.log('\n🚀 Try running this example to see success feedback in action!');
}

// Example usage patterns
export function demonstrateUsagePatterns() {
  console.log('\n📚 Success Feedback Usage Patterns:\n');

  // Pattern 1: Basic success feedback
  console.log('1️⃣  Basic Usage:');
  console.log(`
const result = await persuade({
  schema: MySchema,
  input: data,
  sessionId: 'my-session',
  successMessage: '✅ Perfect! Continue this approach.'
});`);

  // Pattern 2: Detailed success feedback
  console.log('\n2️⃣  Detailed Feedback:');
  console.log(`
const result = await persuade({
  schema: ComplexSchema,
  input: complexData,
  sessionId: 'analysis-session',
  successMessage: \`✅ Excellent analysis! Your format, depth, and accuracy are exactly what we need. 
    Continue using this structured approach with clear categorization and precise details.\`
});`);

  // Pattern 3: CLI usage
  console.log('\n3️⃣  CLI Usage:');
  console.log(`
persuader run \\
  --schema ./schema.ts \\
  --input ./data.json \\
  --session-id my-session \\
  --success-message "Perfect! Continue this approach."
`);

  console.log('\n🎯 Success feedback is only sent when:');
  console.log('   • Schema validation passes on first attempt');
  console.log('   • A sessionId is provided (session-based workflow)');  
  console.log('   • A successMessage parameter is provided');
  console.log('   • The provider supports success feedback (Claude CLI does)');
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateSuccessFeedback()
    .then(() => demonstrateUsagePatterns())
    .catch(console.error);
}

export { demonstrateSuccessFeedback, PersonSchema };