/**
 * Privacy Filter Module
 * 
 * Provides intelligent masking and redaction of sensitive data in logs.
 * Supports pattern-based detection, field-specific redaction, and
 * configurable privacy levels.
 */

/**
 * Privacy level determines how aggressive the masking is
 */
export enum PrivacyLevel {
  OFF = 0,      // No masking
  MINIMAL = 1,  // Only mask obvious sensitive data (tokens, keys)
  STANDARD = 2, // Mask PII and credentials
  STRICT = 3,   // Mask all potential sensitive data
  PARANOID = 4, // Maximum masking, including metadata
}

/**
 * Types of sensitive data to detect
 */
export enum SensitiveDataType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  API_KEY = 'api_key',
  TOKEN = 'token',
  PASSWORD = 'password',
  IP_ADDRESS = 'ip_address',
  URL_WITH_PARAMS = 'url_with_params',
  FILEPATH = 'filepath',
  USERNAME = 'username',
  CUSTOM = 'custom',
}

/**
 * Pattern definition for sensitive data detection
 */
interface SensitivePattern {
  type: SensitiveDataType;
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  minPrivacyLevel: PrivacyLevel;
  description: string;
}

/**
 * Configuration for privacy filtering
 */
export interface PrivacyConfig {
  level: PrivacyLevel;
  customPatterns?: SensitivePattern[];
  redactedFields?: string[];
  allowedDomains?: string[];
  preserveStructure?: boolean;
  maskChar?: string;
  showPartial?: boolean;
}

/**
 * Built-in sensitive data patterns
 */
const BUILT_IN_PATTERNS: SensitivePattern[] = [
  {
    type: SensitiveDataType.EMAIL,
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: (match) => {
      const parts = match.split('@');
      if (parts.length !== 2) return '****@****.***';
      const [local, domain] = parts;
      if (!local || !domain) return '****@****.***';
      return `${local.substring(0, Math.min(2, local.length))}****@${domain.substring(0, Math.min(2, domain.length))}****.***`;
    },
    minPrivacyLevel: PrivacyLevel.STANDARD,
    description: 'Email addresses',
  },
  {
    type: SensitiveDataType.PHONE,
    pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: (match) => {
      const digits = match.replace(/\D/g, '');
      return `***-***-${digits.slice(-4)}`;
    },
    minPrivacyLevel: PrivacyLevel.STANDARD,
    description: 'Phone numbers',
  },
  {
    type: SensitiveDataType.SSN,
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '***-**-****',
    minPrivacyLevel: PrivacyLevel.MINIMAL,
    description: 'Social Security Numbers',
  },
  {
    type: SensitiveDataType.CREDIT_CARD,
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: (match) => {
      const digits = match.replace(/\D/g, '');
      return `****-****-****-${digits.slice(-4)}`;
    },
    minPrivacyLevel: PrivacyLevel.MINIMAL,
    description: 'Credit card numbers',
  },
  {
    type: SensitiveDataType.API_KEY,
    // eslint-disable-next-line no-useless-escape
    pattern: /\b(?:api[_-]?key|apikey|api_token|access[_-]?token)["\s]*[:=]["\s]*["']?([A-Za-z0-9_\-]{20,})["']?\b/gi,
    replacement: '$1=<REDACTED_API_KEY>',
    minPrivacyLevel: PrivacyLevel.MINIMAL,
    description: 'API keys and tokens',
  },
  {
    type: SensitiveDataType.TOKEN,
    // eslint-disable-next-line no-useless-escape
    pattern: /\b(?:Bearer\s+)?([A-Za-z0-9_\-\.]{40,})\b/g,
    replacement: (match) => {
      if (match.startsWith('Bearer')) {
        return 'Bearer <REDACTED_TOKEN>';
      }
      return '<REDACTED_TOKEN>';
    },
    minPrivacyLevel: PrivacyLevel.STANDARD,
    description: 'Authentication tokens',
  },
  {
    type: SensitiveDataType.PASSWORD,
    pattern: /\b(?:password|passwd|pwd)["\s]*[:=]["\s]*["']?([^"'\s,}]+)["']?\b/gi,
    replacement: '$1=<REDACTED_PASSWORD>',
    minPrivacyLevel: PrivacyLevel.MINIMAL,
    description: 'Passwords',
  },
  {
    type: SensitiveDataType.IP_ADDRESS,
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: (match) => {
      const parts = match.split('.');
      return `${parts[0]}.***.***.***`;
    },
    minPrivacyLevel: PrivacyLevel.STRICT,
    description: 'IP addresses',
  },
  {
    type: SensitiveDataType.URL_WITH_PARAMS,
    pattern: /https?:\/\/[^\s]+\?[^\s]+/g,
    replacement: (match) => {
      const url = new URL(match);
      return `${url.protocol}//${url.hostname}${url.pathname}?<PARAMS_REDACTED>`;
    },
    minPrivacyLevel: PrivacyLevel.STANDARD,
    description: 'URLs with query parameters',
  },
  {
    type: SensitiveDataType.FILEPATH,
    // eslint-disable-next-line no-useless-escape
    pattern: /(?:\/Users\/[^\/\s]+|\/home\/[^\/\s]+|C:\\\\Users\\\\[^\\\s]+)/g,
    replacement: (match) => {
      if (match.startsWith('/Users/')) return '/Users/<USER>';
      if (match.startsWith('/home/')) return '/home/<USER>';
      if (match.startsWith('C:\\Users\\')) return 'C:\\Users\\<USER>';
      return match;
    },
    minPrivacyLevel: PrivacyLevel.STRICT,
    description: 'User-specific file paths',
  },
];

/**
 * Privacy filter for masking sensitive data
 */
export class PrivacyFilter {
  private config: Required<PrivacyConfig>;
  private patterns: SensitivePattern[];
  
  constructor(config: PrivacyConfig = { level: PrivacyLevel.STANDARD }) {
    this.config = {
      level: config.level,
      customPatterns: config.customPatterns ?? [],
      redactedFields: config.redactedFields ?? [],
      allowedDomains: config.allowedDomains ?? [],
      preserveStructure: config.preserveStructure ?? true,
      maskChar: config.maskChar ?? '*',
      showPartial: config.showPartial ?? true,
    };
    
    // Combine built-in and custom patterns
    this.patterns = [
      ...BUILT_IN_PATTERNS,
      ...this.config.customPatterns,
    ];
  }
  
  /**
   * Filter a string for sensitive data
   */
  filterString(input: string): string {
    if (this.config.level === PrivacyLevel.OFF) {
      return input;
    }
    
    let filtered = input;
    
    // Apply patterns based on privacy level
    for (const pattern of this.patterns) {
      if (pattern.minPrivacyLevel <= this.config.level) {
        if (typeof pattern.replacement === 'string') {
          filtered = filtered.replace(pattern.pattern, pattern.replacement);
        } else {
          filtered = filtered.replace(pattern.pattern, pattern.replacement);
        }
      }
    }
    
    return filtered;
  }
  
  /**
   * Filter an object recursively
   */
  filterObject(obj: any, path: string = ''): any {
    if (this.config.level === PrivacyLevel.OFF) {
      return obj;
    }
    
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    // Handle primitives
    if (typeof obj !== 'object') {
      if (typeof obj === 'string') {
        return this.filterString(obj);
      }
      return obj;
    }
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item, index) => 
        this.filterObject(item, `${path}[${index}]`)
      );
    }
    
    // Handle objects
    const filtered: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      
      // Check if field should be completely redacted
      if (this.shouldRedactField(key, fieldPath)) {
        filtered[key] = this.redactValue(value);
      } else {
        filtered[key] = this.filterObject(value, fieldPath);
      }
    }
    
    return filtered;
  }
  
  /**
   * Check if a field should be redacted
   */
  private shouldRedactField(key: string, path: string): boolean {
    // Check exact field names
    const sensitiveFieldNames = [
      'password', 'passwd', 'pwd', 'secret', 'token', 'apiKey', 'api_key',
      'auth', 'authorization', 'credential', 'private', 'privateKey', 'private_key',
    ];
    
    if (this.config.level >= PrivacyLevel.STANDARD) {
      if (sensitiveFieldNames.some(name => 
        key.toLowerCase().includes(name.toLowerCase())
      )) {
        return true;
      }
    }
    
    // Check configured redacted fields
    return this.config.redactedFields.some(field => {
      if (field.includes('.')) {
        // Path-based matching
        return path === field || path.startsWith(`${field}.`);
      }
      // Key-based matching
      return key === field;
    });
  }
  
  /**
   * Redact a value while preserving type information
   */
  private redactValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    const type = typeof value;
    
    if (!this.config.preserveStructure) {
      return '<REDACTED>';
    }
    
    switch (type) {
      case 'string':
        if (this.config.showPartial && value.length > 4) {
          return value.substring(0, 2) + this.config.maskChar.repeat(value.length - 4) + value.substring(value.length - 2);
        }
        return this.config.maskChar.repeat(8);
        
      case 'number':
        return this.config.level >= PrivacyLevel.PARANOID ? 0 : value.toString().replace(/\d/g, this.config.maskChar);
        
      case 'boolean':
        return this.config.level >= PrivacyLevel.PARANOID ? false : value;
        
      case 'object':
        if (Array.isArray(value)) {
          return this.config.level >= PrivacyLevel.PARANOID ? [] : [`<${value.length} items redacted>`];
        }
        return this.config.level >= PrivacyLevel.PARANOID ? {} : { _redacted: true };
        
      default:
        return '<REDACTED>';
    }
  }
  
  /**
   * Create a sanitized copy of log context
   */
  sanitizeContext(context: Record<string, any>): Record<string, any> {
    return this.filterObject(context);
  }
  
  /**
   * Check if content contains sensitive data
   */
  containsSensitiveData(input: string): boolean {
    if (this.config.level === PrivacyLevel.OFF) {
      return false;
    }
    
    for (const pattern of this.patterns) {
      if (pattern.minPrivacyLevel <= this.config.level) {
        if (pattern.pattern.test(input)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Get a report of detected sensitive data types
   */
  detectSensitiveData(input: string): Map<SensitiveDataType, number> {
    const detected = new Map<SensitiveDataType, number>();
    
    for (const pattern of this.patterns) {
      if (pattern.minPrivacyLevel <= this.config.level) {
        const matches = input.match(pattern.pattern);
        if (matches && matches.length > 0) {
          detected.set(pattern.type, matches.length);
        }
      }
    }
    
    return detected;
  }
  
  /**
   * Update privacy level
   */
  setLevel(level: PrivacyLevel): void {
    this.config.level = level;
  }
  
  /**
   * Add custom pattern
   */
  addCustomPattern(pattern: SensitivePattern): void {
    this.patterns.push(pattern);
    this.config.customPatterns.push(pattern);
  }
  
  /**
   * Add field to redaction list
   */
  addRedactedField(field: string): void {
    if (!this.config.redactedFields.includes(field)) {
      this.config.redactedFields.push(field);
    }
  }
  
  /**
   * Get current configuration
   */
  getConfig(): Readonly<Required<PrivacyConfig>> {
    return { ...this.config };
  }
}

/**
 * Global privacy filter instance
 */
let globalPrivacyFilter: PrivacyFilter | null = null;

/**
 * Get the global privacy filter
 */
export function getGlobalPrivacyFilter(): PrivacyFilter {
  if (!globalPrivacyFilter) {
    globalPrivacyFilter = new PrivacyFilter();
  }
  return globalPrivacyFilter;
}

/**
 * Set the global privacy filter
 */
export function setGlobalPrivacyFilter(filter: PrivacyFilter): void {
  globalPrivacyFilter = filter;
}

/**
 * Helper to filter sensitive data from a string
 */
export function filterSensitive(input: string, level?: PrivacyLevel): string {
  const filter = getGlobalPrivacyFilter();
  if (level !== undefined) {
    const tempFilter = new PrivacyFilter({ level });
    return tempFilter.filterString(input);
  }
  return filter.filterString(input);
}

/**
 * Helper to sanitize log context
 */
export function sanitizeLogContext(context: Record<string, any>): Record<string, any> {
  return getGlobalPrivacyFilter().sanitizeContext(context);
}