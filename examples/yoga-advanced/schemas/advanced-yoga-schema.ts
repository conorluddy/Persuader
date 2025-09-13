import { z } from 'zod/v4';

/**
 * Zod schema for validating advanced yoga relationship responses
 * Captures 6 dimensions of pose relationships based on rich pose data
 */
export const AdvancedYogaRelationshipSchema = z.object({
  pose: z.string().describe('Current pose being analyzed'),
  anatomicalProgression: z
    .array(z.string())
    .describe('Poses with same muscle groups but increased difficulty'),
  energeticFlow: z
    .array(z.string())
    .describe('Poses with compatible or complementary energy states'),
  therapeuticAlternatives: z
    .array(z.string())
    .describe('Gentler alternatives for practitioners with limitations'),
  counterPoses: z
    .array(z.string())
    .describe('Balancing opposite poses (e.g., backbend after forward fold)'),
  preparatorySequence: z
    .array(z.string())
    .describe('Poses that warm up and prepare the body for this pose'),
  integrationOptions: z
    .array(z.string())
    .describe('Neutral poses for processing and integration afterward'),
});

/**
 * Represents advanced multi-dimensional yoga pose relationships
 */
export interface AdvancedYogaRelationships {
  /** Current pose being analyzed */
  pose: string;
  /** Poses with same muscles but increased difficulty */
  anatomicalProgression: string[];
  /** Poses with compatible/complementary energy states */
  energeticFlow: string[];
  /** Safer alternatives for physical limitations */
  therapeuticAlternatives: string[];
  /** Balancing opposite poses (backbend ↔ forward fold) */
  counterPoses: string[];
  /** Poses that prepare the body for this pose */
  preparatorySequence: string[];
  /** Neutral poses for integration after this pose */
  integrationOptions: string[];
}

/**
 * Rich pose data structure from the detailed JSON files
 */
export interface RichPoseData {
  name: string;
  sanskritName: string;
  variation: string;
  practitioner: {
    position: string;
    alignment?: string;
    armConfiguration?: string;
    groundingLevel?: string;
  };
  breathingPattern: {
    type: string;
    pace: string;
    awareness: string;
  };
  practiceContext: {
    sequencePhase: string;
    energyState: string;
    intention: string;
    difficulty: string;
  };
  environmentalFactors: {
    space: string;
    temperature: string;
    props: string;
    surface: string;
  };
  practitionerProfile: {
    experience: string;
    physicalConsiderations: string;
    specificNeeds: string[];
    practiceStyle: string;
  };
  anatomicalFocus: {
    primaryMuscles: string[];
    jointActions: string[];
    breathingMuscles: string[];
    energeticEffect: string;
  };
  transitionOpportunities: string[];
}
