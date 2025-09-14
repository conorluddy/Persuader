/**
 * Session Coordinator for Runner Pipeline
 *
 * Manages session creation, reuse, and lifecycle for provider adapters
 * that support session-based context management. Handles session state
 * coordination and error recovery for session-related failures.
 */

import { createSessionManager } from '../../session/manager.js';
import type { ProviderAdapter, ProviderError } from '../../types/index.js';
import { debug, info, error as logError } from '../../utils/logger.js';
import type { ProcessedConfiguration } from './configuration-manager.js';

/**
 * Session coordination result
 */
export interface SessionCoordinationResult {
  readonly success: boolean;
  readonly sessionId?: string | undefined;
  readonly error?: ProviderError;
}

/**
 * Session management options that extend ProviderSessionOptions
 */
export interface SessionOptions extends Record<string, unknown> {
  readonly temperature?: number;
  readonly model?: string;
}

/**
 * Coordinates session creation or reuse for the pipeline
 *
 * Handles the logic for determining whether to create a new session,
 * reuse an existing one, or proceed without sessions based on provider
 * capabilities and configuration. Now properly handles SessionManager ID
 * to provider session ID translation.
 *
 * @template T The expected output type
 * @param config Processed pipeline configuration
 * @param provider Provider adapter to use for session management
 * @returns Session coordination result with session ID or error
 */
export async function coordinateSession<T>(
  config: ProcessedConfiguration<T>,
  provider: ProviderAdapter
): Promise<SessionCoordinationResult> {
  // If session ID is already provided, translate it to provider session ID if needed
  if (config.sessionId) {
    debug('Provided session ID detected, checking if translation needed', {
      sessionId: config.sessionId,
      provider: provider.name,
    });

    const translatedSessionId = await translateSessionId(
      config.sessionId,
      provider
    );

    if (translatedSessionId) {
      debug('Session ID translated successfully', {
        originalSessionId: config.sessionId,
        providerSessionId: translatedSessionId,
        provider: provider.name,
      });

      return {
        success: true,
        sessionId: translatedSessionId,
      };
    } else {
      debug('Using provided session ID as-is (direct provider session)', {
        sessionId: config.sessionId,
        provider: provider.name,
      });

      return {
        success: true,
        sessionId: config.sessionId,
      };
    }
  }

  // If provider doesn't support sessions, proceed without one
  if (!provider.supportsSession) {
    debug('Provider does not support sessions, proceeding without session', {
      provider: provider.name,
      supportsSession: provider.supportsSession,
    });

    return {
      success: true,
    };
  }

  // Create new session if provider supports it
  return await createProviderSession(config, provider);
}

/**
 * Creates a new provider session with error handling
 *
 * @template T The expected output type
 * @param config Processed pipeline configuration
 * @param provider Provider adapter with session support
 * @returns Session creation result with session ID or error
 */
async function createProviderSession<T>(
  config: ProcessedConfiguration<T>,
  provider: ProviderAdapter
): Promise<SessionCoordinationResult> {
  if (!provider.createSession) {
    const error: ProviderError = {
      type: 'provider',
      code: 'session_not_supported',
      message: `Provider ${provider.name} claims to support sessions but has no createSession method`,
      provider: provider.name,
      timestamp: new Date(),
      retryable: false,
      details: { supportsSession: provider.supportsSession },
    };

    logError('Provider session support inconsistency detected', {
      provider: provider.name,
      supportsSession: provider.supportsSession,
      hasCreateSession: Boolean(provider.createSession),
    });

    return {
      success: false,
      error,
    };
  }

  try {
    debug('Creating new provider session', {
      provider: provider.name,
      supportsSession: provider.supportsSession,
      contextLength: config.context?.length || 0,
    });

    const sessionOptions: SessionOptions = {
      temperature: config.providerOptions.temperature,
      model: config.model,
    };

    const sessionId = await provider.createSession(
      config.context || '',
      sessionOptions
    );

    info('Provider session created successfully', {
      sessionId,
      provider: provider.name,
    });

    return {
      success: true,
      sessionId,
    };
  } catch (sessionError) {
    const error: ProviderError = {
      type: 'provider',
      code: 'session_creation_failed',
      message: `Failed to create session: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`,
      provider: provider.name,
      timestamp: new Date(),
      retryable: false,
      details: { originalError: sessionError },
    };

    logError('Failed to create provider session', {
      provider: provider.name,
      errorMessage:
        sessionError instanceof Error ? sessionError.message : 'Unknown error',
      errorType:
        sessionError instanceof Error
          ? sessionError.constructor.name
          : 'Unknown',
    });

    return {
      success: false,
      error,
    };
  }
}

/**
 * Validates session state before pipeline execution
 *
 * @param sessionId Session ID to validate (can be undefined)
 * @param provider Provider adapter being used
 * @returns Whether the session state is valid for execution
 */
export function validateSessionState(
  sessionId: string | undefined,
  provider: ProviderAdapter
): { valid: boolean; reason?: string } {
  // Session ID provided but provider doesn't support sessions
  if (sessionId && !provider.supportsSession) {
    return {
      valid: false,
      reason: `Session ID provided but provider ${provider.name} does not support sessions`,
    };
  }

  // Provider supports sessions but has no creation method and no session ID
  if (provider.supportsSession && !provider.createSession && !sessionId) {
    return {
      valid: false,
      reason: `Provider ${provider.name} supports sessions but has no createSession method and no session ID provided`,
    };
  }

  return { valid: true };
}

/**
 * Logs session coordination information for debugging
 *
 * @param sessionId Final session ID being used (can be undefined)
 * @param provider Provider adapter
 * @param config Pipeline configuration
 */
export function logSessionInfo<T>(
  sessionId: string | undefined,
  provider: ProviderAdapter,
  config: ProcessedConfiguration<T>
): void {
  info('Session coordination completed', {
    hasSession: Boolean(sessionId),
    sessionId: sessionId || null,
    provider: provider.name,
    supportsSession: provider.supportsSession,
    hasContext: Boolean(config.context),
    contextLength: config.context?.length || 0,
  });
}

/**
 * Translates a SessionManager ID to a provider session ID if applicable
 *
 * @param sessionId The session ID that might be a SessionManager ID
 * @param provider The provider adapter being used
 * @returns Provider session ID if translation successful, null if not needed or failed
 */
async function translateSessionId(
  sessionId: string,
  provider: ProviderAdapter
): Promise<string | null> {
  try {
    // Create a temporary session manager to check if this ID exists in our session store
    const sessionManager = createSessionManager();
    const session = await sessionManager.getSession(sessionId);

    // If no session found, assume it's already a direct provider session ID
    if (!session) {
      debug('Session not found in SessionManager, assuming direct provider session', {
        sessionId,
        provider: provider.name,
      });
      return null; // Use the original ID as-is
    }

    // If session exists but is for a different provider, this is an error
    if (session.metadata.provider !== provider.name) {
      logError('Session provider mismatch detected', {
        sessionId,
        sessionProvider: session.metadata.provider,
        requestedProvider: provider.name,
      });
      return null; // Use original ID, let provider handle the error
    }

    // Extract the provider session ID from session data
    const providerSessionId = session.providerData?.providerSessionId as string;
    if (!providerSessionId) {
      debug('No provider session ID found in session data', {
        sessionId,
        provider: provider.name,
        hasProviderData: Boolean(session.providerData),
      });
      return null; // Use original ID, might be a direct provider session
    }

    info('Successfully translated SessionManager ID to provider session ID', {
      sessionManagerId: sessionId,
      providerSessionId,
      provider: provider.name,
    });

    return providerSessionId;
  } catch (error) {
    logError('Failed to translate session ID', {
      sessionId,
      provider: provider.name,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null; // Use original ID as fallback
  }
}
