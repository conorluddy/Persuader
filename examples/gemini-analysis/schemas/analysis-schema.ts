import { z } from 'zod';

/**
 * Schema for technical documentation analysis
 *
 * Defines comprehensive analysis structure for technical documents,
 * APIs, code documentation, and technical specifications.
 */

export const TechnicalAnalysisSchema = z.object({
  documentInfo: z
    .object({
      title: z.string().describe('Document title or name'),
      type: z
        .enum([
          'api-docs',
          'tutorial',
          'specification',
          'guide',
          'reference',
          'other',
        ])
        .describe('Type of technical document'),
      primaryTechnology: z
        .string()
        .describe('Main technology or framework discussed'),
      complexity: z
        .enum(['beginner', 'intermediate', 'advanced', 'expert'])
        .describe('Technical complexity level'),
      estimatedReadTime: z
        .number()
        .min(1)
        .describe('Estimated reading time in minutes'),
    })
    .describe('Basic document information'),

  contentAnalysis: z
    .object({
      topics: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe('Main topics covered in the document'),
      keyTerms: z
        .array(z.string())
        .min(3)
        .max(15)
        .describe('Important technical terms and concepts'),
      prerequisites: z
        .array(z.string())
        .max(8)
        .describe('Knowledge or skills assumed by the document'),
      learningObjectives: z
        .array(z.string())
        .min(2)
        .max(8)
        .describe('What readers will learn or accomplish'),
    })
    .describe('Content analysis and categorization'),

  technicalDepth: z
    .object({
      hasCodeExamples: z
        .boolean()
        .describe('Whether document includes code examples'),
      codeLanguages: z
        .array(z.string())
        .describe('Programming languages used in examples'),
      hasApiEndpoints: z
        .boolean()
        .describe('Whether document describes API endpoints'),
      includesDiagrams: z
        .boolean()
        .describe('Whether document contains diagrams or visual aids'),
      practicalExamples: z
        .number()
        .min(0)
        .describe('Number of practical examples or use cases'),
    })
    .describe('Technical depth and practical content'),

  qualityAssessment: z
    .object({
      clarity: z
        .number()
        .min(1)
        .max(10)
        .describe('How clear and understandable the documentation is (1-10)'),
      completeness: z
        .number()
        .min(1)
        .max(10)
        .describe('How complete the documentation appears (1-10)'),
      accuracy: z
        .number()
        .min(1)
        .max(10)
        .describe('Perceived accuracy of technical information (1-10)'),
      upToDate: z
        .enum(['current', 'recent', 'dated', 'outdated'])
        .describe('How current the information appears'),
      accessibility: z
        .number()
        .min(1)
        .max(10)
        .describe('How accessible to target audience (1-10)'),
    })
    .describe('Quality assessment metrics'),

  audienceAnalysis: z
    .object({
      primaryAudience: z
        .enum([
          'developers',
          'architects',
          'devops',
          'students',
          'researchers',
          'mixed',
        ])
        .describe('Primary intended audience'),
      skillLevel: z
        .enum(['beginner', 'intermediate', 'advanced', 'mixed'])
        .describe('Expected skill level of readers'),
      useCase: z
        .enum([
          'learning',
          'reference',
          'implementation',
          'troubleshooting',
          'evaluation',
        ])
        .describe('Primary use case for this documentation'),
    })
    .describe('Target audience and usage analysis'),

  recommendations: z
    .object({
      strengths: z
        .array(z.string())
        .min(2)
        .max(5)
        .describe('Key strengths of the documentation'),
      improvements: z
        .array(z.string())
        .max(5)
        .describe('Suggested improvements or missing elements'),
      similarResources: z
        .array(z.string())
        .max(3)
        .describe('Recommendations for complementary resources'),
      nextSteps: z
        .array(z.string())
        .min(1)
        .max(4)
        .describe('Suggested next steps for readers'),
    })
    .describe('Recommendations and suggestions'),

  summary: z
    .string()
    .min(100)
    .max(500)
    .describe('Comprehensive summary of the document and analysis'),
});

export type TechnicalAnalysis = z.infer<typeof TechnicalAnalysisSchema>;

/**
 * Schema for document input
 */
export const DocumentInputSchema = z.object({
  title: z.string().describe('Document title'),
  content: z.string().min(100).describe('Document content to analyze'),
  url: z.string().url().optional().describe('Optional source URL'),
  metadata: z
    .object({
      author: z.string().optional(),
      publishDate: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Optional document metadata'),
});

export type DocumentInput = z.infer<typeof DocumentInputSchema>;

/**
 * Schema for batch analysis results
 */
export const BatchAnalysisSchema = z.object({
  totalDocuments: z
    .number()
    .min(1)
    .describe('Total number of documents analyzed'),
  analysisDate: z.string().describe('Date of analysis'),
  summaryStats: z
    .object({
      averageComplexity: z.string().describe('Most common complexity level'),
      commonTopics: z
        .array(z.string())
        .describe('Most frequently mentioned topics'),
      averageQuality: z
        .number()
        .min(1)
        .max(10)
        .describe('Average quality score across all documents'),
      recommendedAudience: z
        .string()
        .describe('Primary audience across all documents'),
    })
    .describe('Summary statistics across all analyzed documents'),
  documents: z
    .array(
      z.object({
        title: z.string(),
        analysis: TechnicalAnalysisSchema,
      })
    )
    .describe('Individual document analyses'),
});

export type BatchAnalysis = z.infer<typeof BatchAnalysisSchema>;
