/**
 * Business Analysis Schemas
 *
 * Comprehensive Zod schemas for business and product analysis,
 * showcasing the Vercel AI SDK's native schema validation capabilities.
 */

import { z } from 'zod';

// Input schemas
export const ProductInputSchema = z.object({
  name: z.string().describe('Product name'),
  category: z.string().describe('Product category or industry'),
  description: z.string().describe('Detailed product description'),
  targetMarket: z
    .string()
    .describe('Primary target market or customer segment'),
  pricePoint: z
    .enum(['budget', 'mid-range', 'premium', 'luxury'])
    .describe('Pricing tier'),
  keyFeatures: z.array(z.string()).describe('Key features and capabilities'),
});

export type ProductInput = z.infer<typeof ProductInputSchema>;

// Market Analysis Schema
export const MarketAnalysisSchema = z.object({
  marketSize: z.string().describe('Estimated total addressable market size'),
  marketGrowthRate: z.string().describe('Annual market growth rate or trend'),
  marketScore: z
    .number()
    .min(1)
    .max(10)
    .describe('Overall market attractiveness score (1-10)'),
  keyTrends: z
    .array(z.string())
    .describe('Important market trends affecting this space'),
  customerSegments: z
    .array(
      z.object({
        segment: z.string().describe('Customer segment name'),
        size: z.string().describe('Segment size or percentage'),
        characteristics: z
          .array(z.string())
          .describe('Key segment characteristics'),
      })
    )
    .describe('Primary customer segments'),
  competitiveLandscape: z
    .object({
      intensity: z
        .enum(['low', 'moderate', 'high', 'very-high'])
        .describe('Competitive intensity level'),
      keyCompetitors: z
        .array(z.string())
        .describe('Main competitors in the space'),
      barriers: z.array(z.string()).describe('Barriers to entry'),
    })
    .describe('Competitive landscape analysis'),
});

export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>;

// SWOT Analysis Schema
export const SWOTAnalysisSchema = z.object({
  strengths: z
    .array(
      z.object({
        strength: z.string().describe('Internal strength'),
        impact: z.enum(['low', 'moderate', 'high']).describe('Impact level'),
        reasoning: z.string().describe('Why this is a strength'),
      })
    )
    .describe('Internal strengths'),
  weaknesses: z
    .array(
      z.object({
        weakness: z.string().describe('Internal weakness'),
        impact: z.enum(['low', 'moderate', 'high']).describe('Impact level'),
        mitigation: z.string().describe('Potential mitigation strategy'),
      })
    )
    .describe('Internal weaknesses'),
  opportunities: z
    .array(
      z.object({
        opportunity: z.string().describe('External opportunity'),
        potential: z
          .enum(['low', 'moderate', 'high'])
          .describe('Opportunity potential'),
        timeframe: z.string().describe('Expected timeframe to realize'),
      })
    )
    .describe('External opportunities'),
  threats: z
    .array(
      z.object({
        threat: z.string().describe('External threat'),
        severity: z
          .enum(['low', 'moderate', 'high'])
          .describe('Threat severity'),
        likelihood: z
          .enum(['low', 'moderate', 'high'])
          .describe('Likelihood of occurrence'),
      })
    )
    .describe('External threats'),
});

export type SWOTAnalysis = z.infer<typeof SWOTAnalysisSchema>;

// Product Analysis Schema (comprehensive)
export const ProductAnalysisSchema = z.object({
  productName: z.string().describe('Product being analyzed'),
  analysisDate: z.string().describe('Date of analysis'),
  executiveSummary: z
    .string()
    .min(100)
    .max(500)
    .describe('Concise executive summary of the analysis'),

  marketAnalysis: MarketAnalysisSchema.describe(
    'Comprehensive market analysis'
  ),

  swotAnalysis: SWOTAnalysisSchema.describe('SWOT analysis for the product'),

  valueProposition: z
    .object({
      core: z.string().describe('Core value proposition'),
      differentiators: z
        .array(z.string())
        .describe('Key differentiating factors'),
      customerBenefits: z
        .array(
          z.object({
            benefit: z.string().describe('Customer benefit'),
            importance: z
              .enum(['low', 'moderate', 'high'])
              .describe('Benefit importance'),
          })
        )
        .describe('Primary customer benefits'),
    })
    .describe('Value proposition analysis'),

  financialProjections: z
    .object({
      revenueModel: z.string().describe('Primary revenue generation model'),
      estimatedRevenue: z
        .object({
          year1: z.string().describe('Year 1 revenue estimate'),
          year3: z.string().describe('Year 3 revenue estimate'),
          year5: z.string().describe('Year 5 revenue estimate'),
        })
        .describe('Revenue projections'),
      keyMetrics: z
        .array(
          z.object({
            metric: z.string().describe('Key business metric'),
            target: z.string().describe('Target value'),
          })
        )
        .describe('Important business metrics to track'),
    })
    .describe('Financial analysis and projections'),

  risks: z
    .array(
      z.object({
        risk: z.string().describe('Identified risk'),
        category: z
          .enum([
            'market',
            'technical',
            'financial',
            'operational',
            'regulatory',
          ])
          .describe('Risk category'),
        severity: z
          .enum(['low', 'moderate', 'high', 'critical'])
          .describe('Risk severity'),
        mitigation: z.string().describe('Proposed mitigation strategy'),
      })
    )
    .describe('Key risks and mitigation strategies'),

  opportunities: z
    .array(
      z.object({
        opportunity: z.string().describe('Business opportunity'),
        category: z
          .enum([
            'market-expansion',
            'product-enhancement',
            'partnership',
            'innovation',
            'efficiency',
          ])
          .describe('Opportunity type'),
        impact: z
          .enum(['low', 'moderate', 'high'])
          .describe('Potential impact'),
        effort: z.enum(['low', 'moderate', 'high']).describe('Required effort'),
      })
    )
    .describe('Strategic opportunities'),

  recommendations: z
    .array(
      z.object({
        recommendation: z.string().describe('Strategic recommendation'),
        priority: z
          .enum(['low', 'medium', 'high', 'critical'])
          .describe('Priority level'),
        timeframe: z.string().describe('Recommended implementation timeframe'),
        resources: z.string().describe('Required resources'),
      })
    )
    .describe('Strategic recommendations'),

  confidence: z
    .number()
    .min(1)
    .max(10)
    .describe('Overall confidence in analysis (1-10)'),
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

// Competitive Comparison Schema
export const CompetitiveComparisonSchema = z.object({
  productName: z.string().describe('Product being compared'),
  analysisDate: z.string().describe('Date of competitive analysis'),

  competitiveScore: z
    .number()
    .min(1)
    .max(10)
    .describe('Overall competitive position score (1-10)'),

  marketPosition: z
    .enum(['leader', 'challenger', 'follower', 'niche'])
    .describe('Market position category'),

  keyDifferentiators: z
    .array(
      z.object({
        differentiator: z.string().describe('Key differentiating factor'),
        advantage: z
          .enum(['strong', 'moderate', 'weak'])
          .describe('Competitive advantage level'),
        sustainability: z
          .enum(['high', 'moderate', 'low'])
          .describe('How sustainable this advantage is'),
      })
    )
    .describe('Key competitive differentiators'),

  competitorComparison: z
    .array(
      z.object({
        competitor: z.string().describe('Competitor name'),
        strengths: z
          .array(z.string())
          .describe('Competitor strengths vs our product'),
        weaknesses: z
          .array(z.string())
          .describe('Competitor weaknesses vs our product'),
        marketShare: z.string().describe('Estimated competitor market share'),
        threat: z
          .enum(['low', 'moderate', 'high'])
          .describe('Threat level from this competitor'),
      })
    )
    .describe('Direct competitor analysis'),

  competitiveStrategy: z
    .object({
      approach: z
        .enum(['cost-leadership', 'differentiation', 'focus', 'hybrid'])
        .describe('Recommended competitive strategy'),
      tactics: z.array(z.string()).describe('Specific tactical approaches'),
      timeline: z.string().describe('Implementation timeline'),
    })
    .describe('Recommended competitive strategy'),

  marketGaps: z
    .array(
      z.object({
        gap: z.string().describe('Identified market gap'),
        opportunity: z.string().describe('Opportunity presented by this gap'),
        difficulty: z
          .enum(['low', 'moderate', 'high'])
          .describe('Difficulty to address'),
      })
    )
    .describe('Market gaps and opportunities'),

  providerInsights: z
    .object({
      consensusPoints: z
        .array(z.string())
        .describe('Points where all AI providers agreed'),
      divergentViews: z
        .array(
          z.object({
            topic: z.string().describe('Topic of disagreement'),
            perspectives: z
              .array(z.string())
              .describe('Different provider perspectives'),
          })
        )
        .describe('Areas where AI providers had different views'),
      synthesizedRecommendation: z
        .string()
        .describe('Recommendation synthesized from multiple AI perspectives'),
    })
    .describe('Insights from multi-provider analysis'),
});

export type CompetitiveComparison = z.infer<typeof CompetitiveComparisonSchema>;

// Business Strategy Schema
export const BusinessStrategySchema = z.object({
  strategyTitle: z.string().describe('Title of the business strategy'),
  analysisDate: z.string().describe('Date of strategy creation'),

  executiveSummary: z
    .string()
    .min(200)
    .max(800)
    .describe('Comprehensive executive summary'),

  strategicObjectives: z
    .array(
      z.object({
        objective: z.string().describe('Strategic objective'),
        category: z
          .enum([
            'growth',
            'profitability',
            'market-share',
            'innovation',
            'operational',
          ])
          .describe('Objective category'),
        timeframe: z.string().describe('Achievement timeframe'),
        kpis: z.array(z.string()).describe('Key performance indicators'),
      })
    )
    .describe('Primary strategic objectives'),

  strategicRecommendations: z
    .array(
      z.object({
        recommendation: z.string().describe('Strategic recommendation'),
        rationale: z.string().describe('Reasoning behind recommendation'),
        priority: z
          .enum(['critical', 'high', 'medium', 'low'])
          .describe('Priority level'),
        complexity: z
          .enum(['low', 'moderate', 'high'])
          .describe('Implementation complexity'),
        impact: z
          .object({
            revenue: z
              .enum(['negative', 'neutral', 'positive', 'significant'])
              .describe('Revenue impact'),
            market: z
              .enum(['negative', 'neutral', 'positive', 'significant'])
              .describe('Market position impact'),
            operations: z
              .enum(['negative', 'neutral', 'positive', 'significant'])
              .describe('Operational impact'),
          })
          .describe('Expected impact areas'),
      })
    )
    .describe('Strategic recommendations'),

  implementationTimeline: z
    .object({
      phases: z
        .array(
          z.object({
            phase: z.string().describe('Phase name'),
            duration: z.string().describe('Phase duration'),
            objectives: z.array(z.string()).describe('Phase objectives'),
            milestones: z.array(z.string()).describe('Key milestones'),
            dependencies: z
              .array(z.string())
              .describe('Dependencies on other phases or factors'),
          })
        )
        .describe('Implementation phases'),
      totalTimeline: z.string().describe('Total implementation timeline'),
      criticalPath: z.array(z.string()).describe('Critical path items'),
    })
    .describe('Implementation timeline and phases'),

  investmentRequirements: z
    .object({
      totalBudgetRange: z.string().describe('Total budget requirement range'),
      keyInvestmentAreas: z
        .array(
          z.object({
            area: z.string().describe('Investment area'),
            budget: z.string().describe('Required budget'),
            justification: z.string().describe('Investment justification'),
          })
        )
        .describe('Major investment areas'),
      roi: z
        .object({
          expectedReturn: z.string().describe('Expected return on investment'),
          paybackPeriod: z.string().describe('Expected payback period'),
          assumptions: z
            .array(z.string())
            .describe('Key assumptions for ROI calculation'),
        })
        .describe('Return on investment analysis'),
    })
    .describe('Investment and budget requirements'),

  riskManagement: z
    .object({
      majorRisks: z
        .array(
          z.object({
            risk: z.string().describe('Major strategic risk'),
            probability: z
              .enum(['low', 'moderate', 'high'])
              .describe('Probability of occurrence'),
            impact: z
              .enum(['low', 'moderate', 'high', 'critical'])
              .describe('Impact if it occurs'),
            mitigation: z.string().describe('Mitigation strategy'),
          })
        )
        .describe('Major strategic risks'),
      contingencyPlans: z
        .array(
          z.object({
            scenario: z.string().describe('Risk scenario'),
            response: z.string().describe('Contingency response'),
          })
        )
        .describe('Contingency plans for major risks'),
    })
    .describe('Risk management strategy'),

  successMetrics: z
    .array(
      z.object({
        metric: z.string().describe('Success metric'),
        target: z.string().describe('Target value'),
        measurement: z.string().describe('How it will be measured'),
        frequency: z
          .enum(['weekly', 'monthly', 'quarterly', 'annually'])
          .describe('Measurement frequency'),
      })
    )
    .describe('Success metrics and targets'),

  multiProviderSynthesis: z
    .object({
      providersConsulted: z
        .array(z.string())
        .describe('AI providers that contributed to this strategy'),
      synthesisMethod: z
        .string()
        .describe('How insights were synthesized across providers'),
      confidenceLevel: z
        .number()
        .min(1)
        .max(10)
        .describe('Confidence in synthesized strategy (1-10)'),
      keyDifferences: z
        .array(z.string())
        .describe('Key differences in provider recommendations'),
      consensusStrengths: z
        .array(z.string())
        .describe('Strategic elements all providers agreed on'),
    })
    .describe('Multi-provider AI synthesis information'),
});

export type BusinessStrategy = z.infer<typeof BusinessStrategySchema>;
