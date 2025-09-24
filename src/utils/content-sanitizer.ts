/**
 * Content Sanitizer Module
 * 
 * Sanitizes raw content for safe display in terminals by removing
 * escape sequences and filtering sensitive information.
 */

// ANSI escape sequence pattern

/**
 * Configuration for content sanitization
 */
export interface SanitizationConfig {
  /** Remove ANSI escape sequences (default: true) */
  removeAnsiEscapes?: boolean;
  
  /** Filter sensitive data patterns (default: true) */
  filterSensitive?: boolean;
  
  /** Maximum content length before truncation (default: unlimited) */
  maxLength?: number;
  
  /** Custom sensitive patterns to filter */
  customPatterns?: RegExp[];
}

/**
 * Common sensitive data patterns
 */
const SENSITIVE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  replacement: string;
}> = [
  // API Keys (common formats)
  {
    pattern: /\b(api[_-]?key|apikey|api_secret|api[_-]?token)[\s:=]+["']?([a-zA-Z0-9\-_]{20,})["']?/gi,
    replacement: '$1=***REDACTED_API_KEY***'
  },
  // Bearer tokens
  {
    pattern: /\b(Bearer|Authorization)[\s:]+["']?([a-zA-Z0-9\-_.~+/]+=*)["']?/gi,
    replacement: '$1 ***REDACTED_TOKEN***'
  },
  // AWS Keys
  {
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    replacement: '***REDACTED_AWS_KEY***'
  },
  // AWS Secret Keys (high entropy strings)
  {
    pattern: /\b([a-zA-Z0-9+/]{40})\b/g,
    replacement: '***REDACTED_SECRET***'
  },
  // Private keys
  {
    pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi,
    replacement: '***REDACTED_PRIVATE_KEY***'
  },
  // Email addresses (optional - may want to keep for debugging)
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '***EMAIL***'
  },
  // Credit card numbers (basic pattern)
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '***REDACTED_CARD***'
  },
  // Social Security Numbers
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '***REDACTED_SSN***'
  },
  // Generic passwords in JSON/config
  {
    pattern: /"(password|passwd|pwd|pass|secret)"\s*:\s*"[^"]+"/gi,
    replacement: '"$1": "***REDACTED***"'
  },
  // Connection strings with passwords
  {
    pattern: /(mongodb|mysql|postgres|postgresql|redis):\/\/[^:]+:([^@]+)@/gi,
    replacement: '$1://***:***REDACTED***@'
  }
];


/**
 * Sanitize content for safe terminal display
 * 
 * @param content - Raw content to sanitize
 * @param config - Sanitization configuration
 * @returns Sanitized content safe for display
 */
export function sanitizeContent(
  content: string,
  config: SanitizationConfig = {}
): string {
  const {
    removeAnsiEscapes = true,
    filterSensitive = true,
    maxLength,
    customPatterns = []
  } = config;
  
  let sanitized = content;
  
  // Remove ANSI escape sequences
  if (removeAnsiEscapes) {
    sanitized = removeAnsiEscapeSequences(sanitized);
  }
  
  // Filter sensitive data
  if (filterSensitive) {
    sanitized = filterSensitiveData(sanitized, customPatterns);
  }
  
  // Truncate if needed
  if (maxLength && sanitized.length > maxLength) {
    sanitized = `${sanitized.substring(0, maxLength)}... [truncated]`;
  }
  
  return sanitized;
}

/**
 * Remove ANSI escape sequences from content
 * 
 * @param content - Content with potential ANSI escapes
 * @returns Content with ANSI escapes removed
 */
export function removeAnsiEscapeSequences(content: string): string {
  // Pattern to match ANSI escape codes
  // Covers most common ANSI sequences including colors, cursor movement, etc.
  // eslint-disable-next-line no-control-regex
  const ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?(\x07|\x1b\\)|\x1b[PX^_].*?(\x1b\\|\x07)|\x1b\[[0-9;]*m/g;
  return content.replace(ansiPattern, '');
}

/**
 * Filter sensitive data from content
 * 
 * @param content - Content potentially containing sensitive data
 * @param customPatterns - Additional patterns to filter
 * @returns Content with sensitive data redacted
 */
export function filterSensitiveData(
  content: string,
  customPatterns: RegExp[] = []
): string {
  let filtered = content;
  
  // Apply built-in sensitive patterns
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    if (typeof replacement === 'string') {
      filtered = filtered.replace(pattern, replacement);
    } else {
      filtered = filtered.replace(pattern, replacement);
    }
  }
  
  // Apply custom patterns
  for (const pattern of customPatterns) {
    filtered = filtered.replace(pattern, '***CUSTOM_REDACTED***');
  }
  
  return filtered;
}

/**
 * Check if content contains sensitive data
 * 
 * @param content - Content to check
 * @returns True if sensitive data is detected
 */
export function containsSensitiveData(content: string): boolean {
  // Check built-in patterns
  for (const { pattern } of SENSITIVE_PATTERNS) {
    if (pattern.test(content)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Escape special regex characters in a string
 * 
 * @param str - String to escape
 * @returns Escaped string safe for regex
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a custom sensitive data pattern
 * 
 * @param keywords - Keywords to match (will be case-insensitive)
 * @returns RegExp pattern for matching
 */
export function createSensitivePattern(keywords: string[]): RegExp {
  const escaped = keywords.map(escapeRegex);
  const pattern = `\\b(${escaped.join('|')})[\\s:=]+["']?([^\\s"']+)["']?`;
  return new RegExp(pattern, 'gi');
}