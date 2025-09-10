/**
 * Error Recovery for Runner Pipeline
 *
 * Provides specialized error handling and recovery strategies for runner-specific
 * failures. Includes error classification, recovery recommendations, and fallback
 * strategies for different types of pipeline failures.
 */

import type {
  ProviderAdapter,
  ProviderError,
  ValidationError,
} from '../../types/index.js';
import { error as logError, warn } from '../../utils/logger.js';

/**
 * Error recovery strategy recommendation
 */
export interface RecoveryStrategy {
  readonly strategy:
    | 'retry'
    | 'session_reset'
    | 'configuration_change'
    | 'manual_intervention';
  readonly reason: string;
  readonly suggestions: string[];
  readonly retryable: boolean;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly category: 'transient' | 'configuration' | 'provider' | 'system';
  readonly recoverable: boolean;
  readonly userActionRequired: boolean;
}

/**
 * Analyzes errors and provides recovery strategy recommendations
 *
 * Examines pipeline errors to determine the best recovery approach,
 * considering error type, provider capabilities, and execution context.
 *
 * @param error Error to analyze
 * @param provider Provider adapter being used
 * @param attemptNumber Current attempt number
 * @returns Recovery strategy recommendation
 */
export function analyzeErrorRecovery(
  error: ValidationError | ProviderError,
  provider: ProviderAdapter,
  attemptNumber: number
): RecoveryStrategy {
  const classification = classifyError(error);

  warn('Analyzing error for recovery strategy', {
    errorType: error.type,
    errorCode: error.code,
    severity: classification.severity,
    category: classification.category,
    attemptNumber,
    provider: provider.name,
  });

  // Handle provider errors
  if (error.type === 'provider') {
    return analyzeProviderErrorRecovery(
      error,
      provider,
      attemptNumber,
      classification
    );
  }

  // Handle validation errors
  if (error.type === 'validation') {
    return analyzeValidationErrorRecovery(
      error,
      provider,
      attemptNumber,
      classification
    );
  }

  // Fallback for unknown error types
  return {
    strategy: 'manual_intervention',
    reason: 'Unknown error type requires manual analysis',
    suggestions: [
      'Check error logs for additional context',
      'Verify pipeline configuration',
      'Consider contacting support if issue persists',
    ],
    retryable: false,
  };
}

/**
 * Classifies errors by severity and category
 *
 * @param error Error to classify
 * @returns Error classification
 */
export function classifyError(
  error: ValidationError | ProviderError
): ErrorClassification {
  if (error.type === 'provider') {
    return classifyProviderError(error);
  }

  if (error.type === 'validation') {
    return classifyValidationError(error);
  }

  return {
    severity: 'critical',
    category: 'system',
    recoverable: false,
    userActionRequired: true,
  };
}

/**
 * Handles error recovery logic specifically for provider errors
 *
 * @param error Provider error to analyze
 * @param provider Provider adapter being used
 * @param attemptNumber Current attempt number
 * @param classification Error classification
 * @returns Provider-specific recovery strategy
 */
function analyzeProviderErrorRecovery(
  error: ProviderError,
  _provider: ProviderAdapter,
  attemptNumber: number,
  _classification: ErrorClassification
): RecoveryStrategy {
  // Session-related errors
  if (
    error.code === 'session_creation_failed' ||
    error.code === 'session_not_supported'
  ) {
    return {
      strategy: 'configuration_change',
      reason: 'Session management issue detected',
      suggestions: [
        'Disable session usage by not providing sessionId',
        'Verify provider session support capabilities',
        'Check provider authentication and permissions',
      ],
      retryable: false,
    };
  }

  // Rate limiting or temporary provider issues
  if (error.code === 'rate_limited' || error.code === 'provider_unavailable') {
    return {
      strategy: 'retry',
      reason: 'Transient provider issue - retry with backoff',
      suggestions: [
        'Wait before retrying to respect rate limits',
        'Consider reducing request frequency',
        'Check provider status page for ongoing issues',
      ],
      retryable: true,
    };
  }

  // Authentication or configuration errors
  if (
    error.code === 'authentication_failed' ||
    error.code === 'invalid_configuration'
  ) {
    return {
      strategy: 'manual_intervention',
      reason: 'Provider configuration or authentication issue',
      suggestions: [
        'Verify API keys and authentication credentials',
        'Check provider configuration settings',
        'Ensure provider is properly installed and accessible',
      ],
      retryable: false,
    };
  }

  // Generic provider call failures
  if (error.code === 'provider_call_failed' && attemptNumber < 3) {
    return {
      strategy: 'retry',
      reason: 'Transient provider communication failure',
      suggestions: [
        'Retry with exponential backoff',
        'Check network connectivity',
        'Monitor for persistent failures',
      ],
      retryable: true,
    };
  }

  // Fallback for other provider errors
  return {
    strategy: 'manual_intervention',
    reason: 'Unrecognized provider error requires investigation',
    suggestions: [
      'Check provider documentation for error details',
      'Verify provider service availability',
      'Consider switching to an alternative provider',
    ],
    retryable: false,
  };
}

/**
 * Handles error recovery logic specifically for validation errors
 *
 * @param error Validation error to analyze
 * @param provider Provider adapter being used
 * @param attemptNumber Current attempt number
 * @param classification Error classification
 * @returns Validation-specific recovery strategy
 */
function analyzeValidationErrorRecovery(
  error: ValidationError,
  provider: ProviderAdapter,
  attemptNumber: number,
  _classification: ErrorClassification
): RecoveryStrategy {
  // Persistent validation failures suggest schema or prompt issues
  if (attemptNumber >= 3) {
    if (provider.supportsSession) {
      return {
        strategy: 'session_reset',
        reason: 'Multiple validation failures suggest context confusion',
        suggestions: [
          'Reset session to clear potentially confusing context',
          'Review schema complexity and clarity',
          'Consider providing more specific examples',
          'Verify that the task is achievable with current LLM capabilities',
        ],
        retryable: true,
      };
    } else {
      return {
        strategy: 'configuration_change',
        reason: 'Multiple validation failures without session support',
        suggestions: [
          'Review and simplify schema definition',
          'Provide clearer input examples',
          'Consider breaking complex schemas into smaller parts',
          'Adjust prompt template for better guidance',
        ],
        retryable: false,
      };
    }
  }

  // Early validation failures - try retry with feedback
  if (
    error.retryStrategy === 'add_examples' ||
    error.retryStrategy === 'demand_json_format'
  ) {
    return {
      strategy: 'retry',
      reason: 'Validation error with clear feedback - retry with guidance',
      suggestions: [...(error.suggestions || [])],
      retryable: true,
    };
  }

  // JSON parsing or structural errors
  if (error.code === 'invalid_json' || error.code === 'schema_mismatch') {
    return {
      strategy: 'retry',
      reason: 'Structural output error - retry with format clarification',
      suggestions: [
        'Emphasize JSON format requirements in prompt',
        'Provide concrete output examples',
        'Check for common JSON formatting issues',
      ],
      retryable: true,
    };
  }

  // Fallback for validation errors
  return {
    strategy: 'retry',
    reason: 'General validation failure - attempt retry with feedback',
    suggestions: [
      'Review validation error details',
      'Adjust input or prompt based on feedback',
      'Consider simplifying the requested output format',
    ],
    retryable: true,
  };
}

/**
 * Classifies provider errors by severity and category
 *
 * @param error Provider error to classify
 * @returns Provider error classification
 */
function classifyProviderError(error: ProviderError): ErrorClassification {
  switch (error.code) {
    case 'rate_limited':
    case 'provider_unavailable':
      return {
        severity: 'low',
        category: 'transient',
        recoverable: true,
        userActionRequired: false,
      };

    case 'session_creation_failed':
    case 'provider_call_failed':
      return {
        severity: 'medium',
        category: 'provider',
        recoverable: true,
        userActionRequired: false,
      };

    case 'authentication_failed':
    case 'invalid_configuration':
      return {
        severity: 'high',
        category: 'configuration',
        recoverable: false,
        userActionRequired: true,
      };

    default:
      return {
        severity: 'medium',
        category: 'provider',
        recoverable: error.retryable,
        userActionRequired: !error.retryable,
      };
  }
}

/**
 * Classifies validation errors by severity and category
 *
 * @param error Validation error to classify
 * @returns Validation error classification
 */
function classifyValidationError(error: ValidationError): ErrorClassification {
  switch (error.code) {
    case 'invalid_json':
    case 'empty_response':
      return {
        severity: 'medium',
        category: 'transient',
        recoverable: true,
        userActionRequired: false,
      };

    case 'schema_mismatch':
    case 'validation_failed':
      return {
        severity: 'medium',
        category: 'provider',
        recoverable: true,
        userActionRequired: false,
      };

    case 'context_confusion':
    case 'format_confusion':
      return {
        severity: 'low',
        category: 'transient',
        recoverable: true,
        userActionRequired: false,
      };

    default:
      return {
        severity: 'medium',
        category: 'system',
        recoverable: error.retryable,
        userActionRequired: !error.retryable,
      };
  }
}

/**
 * Logs error recovery analysis for debugging
 *
 * @param error Error being analyzed
 * @param strategy Recovery strategy recommendation
 * @param classification Error classification
 */
export function logErrorRecoveryAnalysis(
  error: ValidationError | ProviderError,
  strategy: RecoveryStrategy,
  classification: ErrorClassification
): void {
  logError('Error recovery analysis completed', {
    errorType: error.type,
    errorCode: error.code,
    errorMessage: error.message,
    severity: classification.severity,
    category: classification.category,
    recoverable: classification.recoverable,
    userActionRequired: classification.userActionRequired,
    recommendedStrategy: strategy.strategy,
    strategyReason: strategy.reason,
    retryable: strategy.retryable,
    suggestionCount: strategy.suggestions.length,
  });
}
