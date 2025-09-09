/**
 * Yoga Session Context Builder
 *
 * Creates session context for yoga pose transition analysis with
 * comprehensive available pose information for validation.
 */

/**
 * Creates the initial session context containing all available pose names
 *
 * This context is used for the first LLM call to establish the session with
 * knowledge of all available poses. Subsequent calls can use shorter contexts
 * since the session retains this information.
 *
 * @param poseNames - Array of all available pose names
 * @returns Context string for establishing the LLM session
 */
export function createYogaSessionContext(poseNames: string[]): string {
  return `You are a yoga instructor analyzing pose transitions. 
Available poses: ${poseNames.join(', ')}.
For each pose I give you, return 3-5 natural transitions from that pose using only poses from the available list.`;
}
