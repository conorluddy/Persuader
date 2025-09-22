/**
 * Example schemas for success feedback demonstrations
 */

import { z } from 'zod';

// Simple person extraction schema
export const PersonSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  age: z.number().int().min(0).max(150, 'Age must be between 0 and 150'),
  occupation: z.string().min(3, 'Occupation must be at least 3 characters'),
  location: z.string().min(2, 'Location must be at least 2 characters'),
  interests: z.array(z.string()).min(1, 'Must have at least one interest'),
});

// More complex analysis schema that benefits from success feedback
export const AnalysisSchema = z.object({
  summary: z.string().min(50, 'Summary must be at least 50 characters'),
  keyPoints: z.array(z.string()).min(3, 'Must have at least 3 key points'),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  recommendations: z.array(z.object({
    action: z.string().min(10, 'Action must be at least 10 characters'),
    priority: z.enum(['high', 'medium', 'low']),
    reasoning: z.string().min(20, 'Reasoning must be at least 20 characters'),
  })).min(1, 'Must have at least one recommendation'),
  metadata: z.object({
    wordCount: z.number().int().positive(),
    category: z.string(),
    tags: z.array(z.string()),
  }),
});

export type Person = z.infer<typeof PersonSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;