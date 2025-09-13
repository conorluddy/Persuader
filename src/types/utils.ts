/**
 * Utility Types
 *
 * Advanced TypeScript utility types and helper functions for the Persuader framework.
 * These types provide common patterns for type manipulation and schema inference.
 */

import type { z } from 'zod/v4';

/**
 * Make all properties in T deeply readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extract the type from a Zod schema
 */
export type InferZodType<T> = T extends z.ZodSchema<infer U> ? U : never;

/**
 * Make specified properties optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specified properties required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;
