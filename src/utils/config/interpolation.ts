/**
 * Environment Variable Interpolation System
 * 
 * Supports interpolating environment variables in configuration values with:
 * - Basic syntax: ${VAR}
 * - Default values: ${VAR:default}  
 * - Nested interpolation: ${VAR:-${FALLBACK}}
 * - Type coercion for booleans, numbers, and arrays
 * - Security controls and validation
 */

/**
 * Interpolation options
 */
export interface InterpolationOptions {
  /** Environment variables to use (defaults to process.env) */
  env?: Record<string, string | undefined>;
  
  /** Allow undefined variables (returns empty string) */
  allowUndefined?: boolean;
  
  /** Maximum recursion depth for nested interpolation */
  maxDepth?: number;
  
  /** Enable type coercion for strings */
  enableTypeCoercion?: boolean;
  
  /** List of allowed environment variables (security) */
  allowedVariables?: string[];
  
  /** List of forbidden environment variables (security) */
  forbiddenVariables?: string[];
  
  /** Case sensitivity for variable names */
  caseSensitive?: boolean;
}

/**
 * Interpolation result with metadata
 */
export interface InterpolationResult {
  /** Final interpolated value */
  value: any;
  
  /** Variables that were resolved */
  resolvedVariables: string[];
  
  /** Variables that were not found */
  missingVariables: string[];
  
  /** Default values that were used */
  defaultsUsed: Record<string, string>;
  
  /** Type coercions that were applied */
  typeCoercions: Array<{ variable: string; from: string; to: string; originalType: string; }>;
  
  /** Any errors encountered during interpolation */
  errors: string[];
}

/**
 * Environment variable interpolation processor
 */
export class EnvironmentInterpolator {
  private readonly options: Required<InterpolationOptions>;
  
  constructor(options: InterpolationOptions = {}) {
    this.options = {
      env: options.env ?? process.env,
      allowUndefined: options.allowUndefined ?? false,
      maxDepth: options.maxDepth ?? 10,
      enableTypeCoercion: options.enableTypeCoercion ?? true,
      allowedVariables: options.allowedVariables ?? [],
      forbiddenVariables: options.forbiddenVariables ?? [
        'PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'PRIVATE'
      ],
      caseSensitive: options.caseSensitive ?? true
    };
  }
  
  /**
   * Interpolate environment variables in a value
   */
  interpolate(value: any, depth = 0): InterpolationResult {
    const result: InterpolationResult = {
      value,
      resolvedVariables: [],
      missingVariables: [],
      defaultsUsed: {},
      typeCoercions: [],
      errors: []
    };
    
    if (depth > this.options.maxDepth) {
      result.errors.push(`Maximum interpolation depth (${this.options.maxDepth}) exceeded`);
      return result;
    }
    
    if (typeof value === 'string') {
      result.value = this.interpolateString(value, result, depth);
    } else if (Array.isArray(value)) {
      result.value = value.map(item => {
        const itemResult = this.interpolate(item, depth + 1);
        this.mergeResults(result, itemResult);
        return itemResult.value;
      });
    } else if (value && typeof value === 'object') {
      result.value = {};
      for (const [key, val] of Object.entries(value)) {
        // Also interpolate object keys
        const keyResult = this.interpolate(key, depth + 1);
        this.mergeResults(result, keyResult);
        
        const valueResult = this.interpolate(val, depth + 1);
        this.mergeResults(result, valueResult);
        
        result.value[keyResult.value] = valueResult.value;
      }
    }
    
    return result;
  }
  
  /**
   * Interpolate environment variables in a string
   */
  private interpolateString(str: string, result: InterpolationResult, depth: number): any {
    const interpolated = str.replace(/\$\{([^}]+)\}/g, (match, expression) => {
      try {
        return this.resolveExpression(expression.trim(), result, depth);
      } catch (error) {
        result.errors.push(`Failed to resolve ${match}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return match; // Return original if resolution fails
      }
    });
    
    // Apply type coercion if enabled and the entire string was a variable
    if (this.options.enableTypeCoercion && str.startsWith('${') && str.endsWith('}')) {
      return this.coerceType(interpolated, str, result);
    }
    
    return interpolated;
  }
  
  /**
   * Resolve a variable expression like "VAR" or "VAR:default"
   */
  private resolveExpression(expression: string, result: InterpolationResult, depth: number): string {
    // Handle default value syntax: VAR:default or VAR:-default
    const defaultMatch = expression.match(/^([^:]+):(.*)/);
    const variableName = defaultMatch && defaultMatch[1] ? defaultMatch[1].trim() : expression;
    const defaultValue = defaultMatch && defaultMatch[2] ? defaultMatch[2] : undefined;
    
    // Security check
    if (!this.isVariableAllowed(variableName)) {
      throw new Error(`Environment variable '${variableName}' is not allowed`);
    }
    
    // Get variable name with case sensitivity handling
    const actualVariableName = this.findVariableName(variableName);
    const envValue = actualVariableName ? this.options.env[actualVariableName] : undefined;
    
    if (envValue !== undefined && actualVariableName) {
      result.resolvedVariables.push(actualVariableName);
      
      // Recursively interpolate the environment variable value
      if (envValue.includes('${')) {
        const nestedResult = this.interpolate(envValue, depth + 1);
        this.mergeResults(result, nestedResult);
        return String(nestedResult.value);
      }
      
      return envValue;
    }
    
    // Handle missing variable
    if (defaultValue !== undefined) {
      // Handle nested interpolation in default value
      if (defaultValue.includes('${')) {
        const defaultResult = this.interpolate(defaultValue, depth + 1);
        this.mergeResults(result, defaultResult);
        result.defaultsUsed[variableName] = String(defaultResult.value);
        return String(defaultResult.value);
      }
      
      result.defaultsUsed[variableName] = defaultValue;
      return defaultValue;
    }
    
    result.missingVariables.push(variableName);
    
    if (this.options.allowUndefined) {
      return '';
    }
    
    throw new Error(`Environment variable '${variableName}' is not defined`);
  }
  
  /**
   * Find the actual variable name handling case sensitivity
   */
  private findVariableName(name: string): string | undefined {
    if (this.options.caseSensitive) {
      return this.options.env[name] !== undefined ? name : undefined;
    }
    
    // Case insensitive search
    const upperName = name.toUpperCase();
    for (const envName of Object.keys(this.options.env)) {
      if (envName.toUpperCase() === upperName) {
        return envName;
      }
    }
    
    return undefined;
  }
  
  /**
   * Check if a variable is allowed to be accessed
   */
  private isVariableAllowed(variableName: string): boolean {
    const upperName = variableName.toUpperCase();
    
    // Check forbidden list
    if (this.options.forbiddenVariables.some(forbidden => 
      upperName.includes(forbidden.toUpperCase())
    )) {
      return false;
    }
    
    // Check allowed list (if specified)
    if (this.options.allowedVariables.length > 0) {
      return this.options.allowedVariables.some(allowed =>
        this.options.caseSensitive 
          ? variableName === allowed 
          : upperName === allowed.toUpperCase()
      );
    }
    
    return true;
  }
  
  /**
   * Coerce string values to appropriate types
   */
  private coerceType(value: string, originalExpression: string, result: InterpolationResult): any {
    const original = value;
    
    // Boolean coercion
    if (value.toLowerCase() === 'true') {
      result.typeCoercions.push({
        variable: originalExpression,
        from: value,
        to: 'true',
        originalType: 'boolean'
      });
      return true;
    }
    
    if (value.toLowerCase() === 'false') {
      result.typeCoercions.push({
        variable: originalExpression,
        from: value,
        to: 'false',
        originalType: 'boolean'
      });
      return false;
    }
    
    // Number coercion
    if (/^-?\d+$/.test(value)) {
      const num = parseInt(value, 10);
      result.typeCoercions.push({
        variable: originalExpression,
        from: value,
        to: String(num),
        originalType: 'integer'
      });
      return num;
    }
    
    if (/^-?\d*\.\d+$/.test(value)) {
      const num = parseFloat(value);
      result.typeCoercions.push({
        variable: originalExpression,
        from: value,
        to: String(num),
        originalType: 'float'
      });
      return num;
    }
    
    // Array coercion (comma-separated)
    if (value.includes(',')) {
      const array = value.split(',').map(item => item.trim());
      result.typeCoercions.push({
        variable: originalExpression,
        from: value,
        to: JSON.stringify(array),
        originalType: 'array'
      });
      return array;
    }
    
    // JSON coercion
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        const parsed = JSON.parse(value);
        result.typeCoercions.push({
          variable: originalExpression,
          from: value,
          to: JSON.stringify(parsed),
          originalType: 'json'
        });
        return parsed;
      } catch {
        // Fall through to string
      }
    }
    
    return original;
  }
  
  /**
   * Merge results from nested interpolation
   */
  private mergeResults(target: InterpolationResult, source: InterpolationResult): void {
    target.resolvedVariables.push(...source.resolvedVariables);
    target.missingVariables.push(...source.missingVariables);
    target.typeCoercions.push(...source.typeCoercions);
    target.errors.push(...source.errors);
    
    Object.assign(target.defaultsUsed, source.defaultsUsed);
  }
  
  /**
   * Validate interpolation result
   */
  validateResult(result: InterpolationResult): boolean {
    return result.errors.length === 0 && result.missingVariables.length === 0;
  }
  
  /**
   * Get interpolation statistics
   */
  getStats(): {
    envVariableCount: number;
    forbiddenVariables: string[];
    allowedVariables: string[];
    securityEnabled: boolean;
    typeCoercionEnabled: boolean;
  } {
    return {
      envVariableCount: Object.keys(this.options.env).length,
      forbiddenVariables: this.options.forbiddenVariables,
      allowedVariables: this.options.allowedVariables,
      securityEnabled: this.options.allowedVariables.length > 0 || this.options.forbiddenVariables.length > 0,
      typeCoercionEnabled: this.options.enableTypeCoercion
    };
  }
}

/**
 * Global interpolator instance
 */
let globalInterpolator: EnvironmentInterpolator | null = null;

/**
 * Get the global interpolator
 */
export function getGlobalInterpolator(): EnvironmentInterpolator {
  if (!globalInterpolator) {
    globalInterpolator = new EnvironmentInterpolator();
  }
  return globalInterpolator;
}

/**
 * Set global interpolator
 */
export function setGlobalInterpolator(interpolator: EnvironmentInterpolator): void {
  globalInterpolator = interpolator;
}

/**
 * Helper function to interpolate a configuration object
 */
export function interpolateConfig(
  config: any,
  options?: InterpolationOptions
): InterpolationResult {
  const interpolator = options ? new EnvironmentInterpolator(options) : getGlobalInterpolator();
  return interpolator.interpolate(config);
}

/**
 * Helper function to create a secure interpolator for production
 */
export function createSecureInterpolator(allowedVariables: string[]): EnvironmentInterpolator {
  return new EnvironmentInterpolator({
    allowedVariables,
    forbiddenVariables: [
      'PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'PRIVATE', 'AUTH',
      'CREDENTIAL', 'CERT', 'PASSPHRASE', 'HASH', 'SALT'
    ],
    allowUndefined: false,
    enableTypeCoercion: true
  });
}

/**
 * Helper function to create a development interpolator
 */
export function createDevelopmentInterpolator(): EnvironmentInterpolator {
  return new EnvironmentInterpolator({
    allowUndefined: true,
    enableTypeCoercion: true,
    forbiddenVariables: [] // More permissive for development
  });
}

/**
 * Helper function to analyze interpolation patterns in configuration
 */
export function analyzeInterpolationPatterns(config: any): {
  totalVariables: number;
  uniqueVariables: string[];
  nestedVariables: string[];
  defaultValues: Record<string, string>;
  securityRisks: string[];
} {
  const patterns = JSON.stringify(config).match(/\$\{([^}]+)\}/g) || [];
  const uniqueVariables = [...new Set(patterns.map(p => {
    const inner = p.slice(2, -1);
    const colonIndex = inner.indexOf(':');
    return colonIndex >= 0 ? inner.slice(0, colonIndex).trim() : inner.trim();
  }))];
  
  const nestedVariables = patterns
    .filter(p => p.slice(2, -1).includes('${'))
    .map(p => {
      const inner = p.slice(2, -1);
      const colonIndex = inner.indexOf(':');
      return colonIndex >= 0 ? inner.slice(0, colonIndex).trim() : inner.trim();
    });
  
  const defaultValues: Record<string, string> = {};
  patterns.forEach(pattern => {
    const match = pattern.match(/\$\{([^:]+):([^}]+)\}/);
    if (match && match[1] && match[2]) {
      defaultValues[match[1].trim()] = match[2];
    }
  });
  
  const securityRisks = uniqueVariables.filter(variable => {
    const upper = variable.toUpperCase();
    return ['PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'PRIVATE'].some(risk => upper.includes(risk));
  });
  
  return {
    totalVariables: patterns.length,
    uniqueVariables,
    nestedVariables,
    defaultValues,
    securityRisks
  };
}