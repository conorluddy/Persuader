#!/usr/bin/env tsx

/**
 * Schema Logging Demo
 *
 * Demonstrates the new schema visibility features added to Persuader.
 * Shows how schemas are logged and analyzed throughout the pipeline for debugging.
 */

import { z } from 'zod';
import {
  createClaudeCLIAdapter,
  extractSchemaInfo,
  getSchemaDescription,
  runPersuader,
} from '../src/index.js';

// Simple demo schemas of varying complexity
const PersonSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  age: z.number().min(0).max(150),
  email: z.string().email().optional(),
});

const ComplexProductSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  category: z.enum(['electronics', 'clothing', 'books', 'food']),
  price: z.number().min(0),
  inStock: z.boolean(),
  tags: z.array(z.string()).default([]),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
    depth: z.number(),
    unit: z.enum(['cm', 'in']).default('cm'),
  }),
  variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        price: z.number().optional(),
        available: z.boolean().default(true),
      })
    )
    .default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Colors for better console output
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
} as const;

/**
 * Demonstrate schema analysis without running the full pipeline
 */
function demonstrateSchemaAnalysis() {
  console.log(
    `\n${colors.bold}${colors.cyan}=== Schema Analysis Demo ===${colors.reset}\n`
  );

  const schemas = [
    { name: 'Simple Person', schema: PersonSchema },
    { name: 'Complex Product', schema: ComplexProductSchema },
  ];

  for (const { name, schema } of schemas) {
    console.log(`${colors.green}${colors.bold}${name} Schema:${colors.reset}`);

    // Extract schema information
    const info = extractSchemaInfo(schema as z.ZodSchema<unknown>);
    const description = getSchemaDescription(schema as z.ZodSchema<unknown>);

    console.log(`  Type: ${colors.yellow}${info.type}${colors.reset}`);
    console.log(`  Description: ${colors.yellow}${description}${colors.reset}`);
    console.log(
      `  Complexity: ${colors.yellow}${info.complexity}/10${colors.reset}`
    );
    console.log(
      `  Fields: ${colors.yellow}${info.fieldCount || 0}${colors.reset} (${colors.green}${info.requiredFields.length}${colors.reset} required, ${colors.blue}${info.optionalFields.length}${colors.reset} optional)`
    );

    if (info.nestedObjects.length > 0) {
      console.log(
        `  Nested Objects: ${colors.magenta}${info.nestedObjects.join(', ')}${colors.reset}`
      );
    }

    if (info.arrayFields.length > 0) {
      console.log(
        `  Array Fields: ${colors.magenta}${info.arrayFields.join(', ')}${colors.reset}`
      );
    }

    if (info.enumFields.length > 0) {
      console.log(
        `  Enum Fields: ${colors.magenta}${info.enumFields.join(', ')}${colors.reset}`
      );
    }

    // Show detailed shape for complex schemas
    if (
      info.shape &&
      Object.keys(info.shape).length > 0 &&
      info.complexity > 5
    ) {
      console.log(`  Shape Preview:${colors.reset}`);
      Object.entries(info.shape)
        .slice(0, 5)
        .forEach(([key, type]) => {
          console.log(
            `    ${colors.cyan}${key}${colors.reset}: ${colors.yellow}${type}${colors.reset}`
          );
        });
      if (Object.keys(info.shape).length > 5) {
        console.log(
          `    ${colors.cyan}... ${Object.keys(info.shape).length - 5} more fields${colors.reset}`
        );
      }
    }

    console.log('');
  }
}

/**
 * Demonstrate schema logging in action with a simple Persuader run
 */
async function demonstrateSchemaLogging() {
  console.log(
    `${colors.bold}${colors.cyan}=== Schema Logging in Persuader Pipeline ===${colors.reset}\n`
  );

  try {
    // Create a simple schema for demonstration
    const DemoSchema = z.object({
      message: z.string(),
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: z.number().min(0).max(1),
    });

    console.log(
      `${colors.green}Running Persuader with demo schema...${colors.reset}`
    );
    console.log(
      `${colors.yellow}Watch the logs to see schema analysis and validation logging!${colors.reset}\n`
    );

    const adapter = createClaudeCLIAdapter();

    // Check if Claude CLI is available
    if (!(await adapter.isAvailable())) {
      console.log(
        `${colors.yellow}⚠️  Claude CLI not available - skipping pipeline demo${colors.reset}`
      );
      return;
    }

    const result = await runPersuader(
      {
        schema: DemoSchema,
        input: 'This is a great day!',
        context:
          'You are a sentiment analyzer. Analyze the input text and return the sentiment, confidence score, and the original message.',
        model: 'haiku',
        retries: 1,
        logLevel: 'debug', // Enable debug logging to see schema information
      },
      adapter
    );

    if (result.ok) {
      console.log(
        `${colors.green}✅ Success!${colors.reset} Result:`,
        result.value
      );
    } else {
      console.log(
        `${colors.yellow}⚠️  Pipeline failed:${colors.reset}`,
        result.error.message
      );
    }
  } catch (error) {
    console.error(
      `${colors.yellow}Demo error:${colors.reset}`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Main demo execution
 */
async function runDemo() {
  console.log(
    `${colors.bold}${colors.magenta}🔍 Persuader Schema Logging Demo${colors.reset}`
  );
  console.log(
    `${colors.yellow}This demo showcases the new schema visibility features in Persuader${colors.reset}\n`
  );

  // Part 1: Schema analysis without pipeline execution
  demonstrateSchemaAnalysis();

  // Part 2: Schema logging in the pipeline
  await demonstrateSchemaLogging();

  console.log(`\n${colors.bold}${colors.green}Demo completed!${colors.reset}`);
  console.log(`${colors.cyan}Key features demonstrated:${colors.reset}`);
  console.log(`  • Schema complexity analysis`);
  console.log(`  • Field counting and categorization`);
  console.log(`  • Nested structure detection`);
  console.log(`  • Debug logging throughout the pipeline`);
  console.log(`  • Validation failure visibility`);
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(error => {
    console.error(`${colors.yellow}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}

export { demonstrateSchemaAnalysis, demonstrateSchemaLogging };
