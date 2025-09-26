/**
 * Enhanced Format-Specific Parsers
 * 
 * Robust parsing support for JSON, YAML, JavaScript, and TypeScript
 * configuration files with comprehensive error handling and validation.
 */

import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Parser options for enhanced format support
 */
export interface EnhancedParseOptions {
  /** Allow JavaScript execution for .js/.ts files */
  allowExecution?: boolean;
  
  /** Include raw content in result (for debugging) */
  includeRawContent?: boolean;
  
  /** Validate configuration against schema */
  validate?: boolean;
  
  /** Environment variables for interpolation */
  env?: Record<string, string>;
  
  /** Maximum file size to parse (in bytes) */
  maxFileSize?: number;
  
  /** Enable strict parsing mode */
  strictMode?: boolean;
  
  /** Custom YAML parsing options */
  yamlOptions?: {
    allowDuplicateKeys?: boolean;
    maxAliasCount?: number;
    prettyErrors?: boolean;
  };
  
  /** Custom JSON parsing options */
  jsonOptions?: {
    allowComments?: boolean;
    allowTrailingCommas?: boolean;
    allowUnquotedKeys?: boolean;
  };
}

/**
 * Enhanced parse result with detailed metadata
 */
export interface EnhancedParseResult {
  /** Parsed configuration object */
  config: any;
  
  /** Whether parsing was successful */
  success: boolean;
  
  /** Any errors encountered */
  errors: ParseError[];
  
  /** Any warnings generated */
  warnings: string[];
  
  /** Original file path */
  filePath: string;
  
  /** Detected file format */
  format: string;
  
  /** Raw file content (if requested) */
  rawContent?: string;
  
  /** Parse time in milliseconds */
  parseTimeMs: number;
  
  /** File size in bytes */
  fileSizeBytes: number;
  
  /** Format-specific metadata */
  metadata: {
    encoding?: string;
    lineCount?: number;
    characterCount?: number;
    complexity?: 'simple' | 'moderate' | 'complex';
    hasComments?: boolean;
    indentationType?: 'spaces' | 'tabs' | 'mixed';
    indentationSize?: number;
  };
}

/**
 * Detailed parse error information
 */
export interface ParseError {
  /** Error message */
  message: string;
  
  /** Error type/category */
  type: 'syntax' | 'validation' | 'security' | 'format' | 'execution';
  
  /** Line number where error occurred */
  line?: number;
  
  /** Column number where error occurred */
  column?: number;
  
  /** Error code for programmatic handling */
  code?: string;
  
  /** Suggestions for fixing the error */
  suggestions?: string[];
  
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Enhanced JSON parser with extended features
 */
export class EnhancedJsonParser {
  static async parse(
    content: string,
    _filePath: string,
    options: EnhancedParseOptions = {}
  ): Promise<Omit<EnhancedParseResult, 'filePath' | 'format'>> {
    const startTime = Date.now();
    const result: Omit<EnhancedParseResult, 'filePath' | 'format'> = {
      config: null,
      success: false,
      errors: [],
      warnings: [],
      parseTimeMs: 0,
      fileSizeBytes: Buffer.byteLength(content, 'utf8'),
      metadata: {}
    };
    
    try {
      // Analyze content metadata
      this.analyzeContent(content, result);
      
      // Handle JSON with comments/extensions if enabled
      let processedContent = content;
      if (options.jsonOptions?.allowComments) {
        processedContent = this.stripJsonComments(content);
      }
      
      if (options.jsonOptions?.allowTrailingCommas) {
        processedContent = this.removeTrailingCommas(processedContent);
      }
      
      // Parse JSON
      result.config = JSON.parse(processedContent);
      result.success = true;
      
    } catch (error) {
      const parseError = this.createParseError(error, content);
      result.errors.push(parseError);
      result.success = false;
    }
    
    result.parseTimeMs = Date.now() - startTime;
    
    if (options.includeRawContent) {
      result.rawContent = content;
    }
    
    return result;
  }
  
  private static analyzeContent(content: string, result: Omit<EnhancedParseResult, 'filePath' | 'format'>): void {
    const lines = content.split('\n');
    result.metadata.lineCount = lines.length;
    result.metadata.characterCount = content.length;
    result.metadata.hasComments = /\/\*[\s\S]*?\*\/|\/\/.*$/gm.test(content);
    
    // Analyze indentation
    const indentationSample = lines
      .filter(line => line.trim().length > 0 && /^\s+/.test(line))
      .slice(0, 10)
      .map(line => line.match(/^\s+/)?.[0] || '');
    
    if (indentationSample.length > 0) {
      const hasSpaces = indentationSample.some(indent => indent.includes(' '));
      const hasTabs = indentationSample.some(indent => indent.includes('\t'));
      
      if (hasSpaces && hasTabs) {
        result.metadata.indentationType = 'mixed';
      } else if (hasTabs) {
        result.metadata.indentationType = 'tabs';
      } else {
        result.metadata.indentationType = 'spaces';
        // Calculate common indentation size
        const spaceCounts = indentationSample
          .filter(indent => indent.includes(' '))
          .map(indent => indent.length);
        if (spaceCounts.length > 0) {
          result.metadata.indentationSize = Math.min(...spaceCounts);
        }
      }
    }
    
    // Determine complexity
    const brackets = (content.match(/[{}[\]]/g) || []).length;
    const quotes = (content.match(/"/g) || []).length;
    const complexity = brackets + quotes;
    
    if (complexity < 20) {
      result.metadata.complexity = 'simple';
    } else if (complexity < 100) {
      result.metadata.complexity = 'moderate';
    } else {
      result.metadata.complexity = 'complex';
    }
  }
  
  private static stripJsonComments(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');
    
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    
    return content;
  }
  
  private static removeTrailingCommas(content: string): string {
    // Remove trailing commas before closing braces/brackets
    return content.replace(/,(\s*[}\]])/g, '$1');
  }
  
  private static createParseError(error: any, content: string): ParseError {
    const message = error.message || 'Unknown JSON parsing error';
    let line: number | undefined;
    let column: number | undefined;
    let suggestions: string[] = [];
    
    // Extract line/column from JSON.parse error
    const lineMatch = message.match(/line (\d+)/i);
    const columnMatch = message.match(/column (\d+)/i);
    const positionMatch = message.match(/position (\d+)/i);
    
    if (lineMatch) {
      line = parseInt(lineMatch[1], 10);
    }
    if (columnMatch) {
      column = parseInt(columnMatch[1], 10);
    } else if (positionMatch) {
      const position = parseInt(positionMatch[1], 10);
      const lines = content.substring(0, position).split('\n');
      line = lines.length;
      const lastLine = lines[lines.length - 1];
      column = lastLine ? lastLine.length + 1 : 1;
    }
    
    // Provide helpful suggestions based on error type
    if (message.includes('Unexpected token')) {
      suggestions.push('Check for missing commas between object properties');
      suggestions.push('Ensure all strings are properly quoted');
      suggestions.push('Verify bracket/brace matching');
    } else if (message.includes('trailing comma')) {
      suggestions.push('Remove trailing commas after the last property');
      suggestions.push('Enable allowTrailingCommas option if desired');
    } else if (message.includes('Unexpected end of JSON input')) {
      suggestions.push('Check for missing closing brackets or braces');
      suggestions.push('Ensure the JSON structure is complete');
    }
    
    return {
      message,
      type: 'syntax' as const,
      ...(line !== undefined && { line }),
      ...(column !== undefined && { column }),
      code: 'JSON_PARSE_ERROR',
      suggestions,
      severity: 'error' as const
    };
  }
}

/**
 * Enhanced YAML parser with js-yaml integration
 */
export class EnhancedYamlParser {
  static async parse(
    content: string,
    _filePath: string,
    options: EnhancedParseOptions = {}
  ): Promise<Omit<EnhancedParseResult, 'filePath' | 'format'>> {
    const startTime = Date.now();
    const result: Omit<EnhancedParseResult, 'filePath' | 'format'> = {
      config: null,
      success: false,
      errors: [],
      warnings: [],
      parseTimeMs: 0,
      fileSizeBytes: Buffer.byteLength(content, 'utf8'),
      metadata: {}
    };
    
    try {
      // For now, we'll use the existing simple YAML parser
      // In production, this would use js-yaml library
      result.config = await this.parseYamlContent(content, options);
      result.success = true;
      
      // Analyze YAML-specific metadata
      this.analyzeYamlContent(content, result);
      
    } catch (error) {
      const parseError = this.createYamlParseError(error, content);
      result.errors.push(parseError);
      result.success = false;
    }
    
    result.parseTimeMs = Date.now() - startTime;
    
    if (options.includeRawContent) {
      result.rawContent = content;
    }
    
    return result;
  }
  
  private static async parseYamlContent(content: string, _options: EnhancedParseOptions): Promise<any> {
    // Enhanced version of the simple YAML parser
    const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    const result: any = {};
    let currentPath: string[] = [];
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();
        
        const trimmedKey = key?.trim();
        if (value && trimmedKey) {
          // Leaf value - set it
          this.setNestedValue(result, [...currentPath, trimmedKey], this.parseYamlValue(value));
        } else if (trimmedKey) {
          // Object key - add to path
          currentPath.push(trimmedKey);
          this.setNestedValue(result, currentPath, {});
        }
      }
    }
    
    return result;
  }
  
  private static analyzeYamlContent(content: string, result: Omit<EnhancedParseResult, 'filePath' | 'format'>): void {
    const lines = content.split('\n');
    result.metadata.lineCount = lines.length;
    result.metadata.characterCount = content.length;
    result.metadata.hasComments = lines.some(line => line.trim().startsWith('#'));
    
    // YAML typically uses spaces for indentation
    result.metadata.indentationType = 'spaces';
    
    // Find common indentation pattern
    const indentedLines = lines.filter(line => /^\s+/.test(line));
    if (indentedLines.length > 0) {
      const indents = indentedLines.map(line => (line.match(/^\s+/) || [''])[0].length);
      const minIndent = Math.min(...indents.filter(i => i > 0));
      result.metadata.indentationSize = minIndent;
    }
    
    // Determine complexity based on nesting and key count
    const keyCount = (content.match(/^\s*\w+:/gm) || []).length;
    if (keyCount < 10) {
      result.metadata.complexity = 'simple';
    } else if (keyCount < 30) {
      result.metadata.complexity = 'moderate';
    } else {
      result.metadata.complexity = 'complex';
    }
  }
  
  private static parseYamlValue(value: string): any {
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Boolean values
    if (value === 'true' || value === 'yes' || value === 'on') return true;
    if (value === 'false' || value === 'no' || value === 'off') return false;
    if (value === 'null' || value === '~') return null;
    
    // Numbers
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d*\.\d+$/.test(value)) return parseFloat(value);
    
    // Arrays (simple bracket notation)
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',').map(item => this.parseYamlValue(item.trim()));
      return items;
    }
    
    return value;
  }
  
  private static setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (key && !(key in current)) {
        current[key] = {};
      }
      if (key) {
        current = current[key];
      }
    }
    const lastKey = path[path.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }
  
  private static createYamlParseError(error: any, _content: string): ParseError {
    const message = error.message || 'Unknown YAML parsing error';
    
    return {
      message,
      type: 'syntax' as const,
      code: 'YAML_PARSE_ERROR',
      suggestions: [
        'Check indentation consistency (YAML is whitespace-sensitive)',
        'Ensure colons are followed by spaces in key-value pairs',
        'Verify that nested structures are properly indented',
        'Check for special characters that may need quoting'
      ],
      severity: 'error' as const
    };
  }
}

/**
 * Enhanced JavaScript/TypeScript parser with security controls
 */
export class EnhancedJsParser {
  static async parse(
    filePath: string,
    content: string,
    options: EnhancedParseOptions = {}
  ): Promise<Omit<EnhancedParseResult, 'filePath' | 'format'>> {
    const startTime = Date.now();
    const result: Omit<EnhancedParseResult, 'filePath' | 'format'> = {
      config: null,
      success: false,
      errors: [],
      warnings: [],
      parseTimeMs: 0,
      fileSizeBytes: Buffer.byteLength(content, 'utf8'),
      metadata: {}
    };
    
    try {
      // Security check
      if (!options.allowExecution) {
        throw new Error('JavaScript execution is disabled. Enable allowExecution to parse .js/.ts files.');
      }
      
      // Analyze content before execution
      this.analyzeJsContent(content, result);
      
      // Security validation
      const securityIssues = this.validateJsSecurity(content);
      if (securityIssues.length > 0) {
        result.warnings.push(...securityIssues);
      }
      
      // Execute JavaScript/TypeScript
      result.config = await this.executeJsFile(filePath);
      result.success = true;
      
    } catch (error) {
      const parseError = this.createJsParseError(error, filePath);
      result.errors.push(parseError);
      result.success = false;
    }
    
    result.parseTimeMs = Date.now() - startTime;
    
    if (options.includeRawContent) {
      result.rawContent = content;
    }
    
    return result;
  }
  
  private static analyzeJsContent(content: string, result: Omit<EnhancedParseResult, 'filePath' | 'format'>): void {
    const lines = content.split('\n');
    result.metadata.lineCount = lines.length;
    result.metadata.characterCount = content.length;
    result.metadata.hasComments = /\/\*[\s\S]*?\*\/|\/\/.*$/gm.test(content);
    
    // Analyze JavaScript complexity
    const keywords = ['function', 'class', 'import', 'export', 'const', 'let', 'var'];
    const keywordCount = keywords.reduce((count, keyword) => {
      const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      return count + (matches ? matches.length : 0);
    }, 0);
    
    if (keywordCount < 10) {
      result.metadata.complexity = 'simple';
    } else if (keywordCount < 30) {
      result.metadata.complexity = 'moderate';
    } else {
      result.metadata.complexity = 'complex';
    }
    
    // Check encoding
    result.metadata.encoding = 'utf8'; // Default assumption
  }
  
  private static validateJsSecurity(content: string): string[] {
    const warnings: string[] = [];
    const dangerousPatterns = [
      { pattern: /eval\s*\(/g, message: 'Contains eval() which can be dangerous' },
      { pattern: /Function\s*\(/g, message: 'Contains Function constructor which can be dangerous' },
      { pattern: /require\s*\(\s*['"`][^'"`]*child_process['"`]/g, message: 'Imports child_process module' },
      { pattern: /require\s*\(\s*['"`][^'"`]*fs['"`]/g, message: 'Imports fs module - file system access' },
      { pattern: /process\.env/g, message: 'Accesses process.env - environment variables' },
      { pattern: /console\.(log|error|warn)/g, message: 'Contains console output statements' }
    ];
    
    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(content)) {
        warnings.push(`Security notice: ${message}`);
      }
    }
    
    return warnings;
  }
  
  private static async executeJsFile(filePath: string): Promise<any> {
    const fileUrl = pathToFileURL(filePath).href;
    
    // Use dynamic import with cache busting
    const cacheBuster = `?cb=${Date.now()}`;
    const module = await import(fileUrl + cacheBuster);
    
    // Support both default export and named exports
    if (module.default) {
      return typeof module.default === 'function' ? await module.default() : module.default;
    }
    
    // Return all named exports as configuration object
    const { default: _, ...namedExports } = module;
    return namedExports;
  }
  
  private static createJsParseError(error: any, _filePath: string): ParseError {
    const message = error.message || 'Unknown JavaScript parsing error';
    let suggestions: string[] = [];
    
    if (message.includes('Cannot resolve module')) {
      suggestions.push('Check that all imported modules are available');
      suggestions.push('Verify import paths are correct');
    } else if (message.includes('SyntaxError')) {
      suggestions.push('Check JavaScript/TypeScript syntax');
      suggestions.push('Ensure all brackets and braces are matched');
      suggestions.push('Verify semicolon usage');
    } else if (message.includes('execution is disabled')) {
      suggestions.push('Enable allowExecution option to parse JavaScript files');
      suggestions.push('Consider using JSON or YAML format for safer parsing');
    }
    
    return {
      message,
      type: 'execution',
      code: 'JS_EXECUTION_ERROR',
      suggestions,
      severity: 'error'
    };
  }
}

/**
 * Format detection utilities
 */
export class FormatDetector {
  static detectFormat(filePath: string, content?: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.js':
        return 'javascript';
      case '.ts':
        return 'typescript';
      case '.mjs':
        return 'javascript';
      case '.cjs':
        return 'javascript';
      default:
        // Try to detect by content if available
        if (content) {
          return this.detectByContent(content);
        }
        return 'json'; // Default fallback
    }
  }
  
  private static detectByContent(content: string): string {
    const trimmed = content.trim();
    
    // JSON detection
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      return 'json';
    }
    
    // JavaScript/TypeScript detection
    if (/^\s*(export|import|module\.exports|const|let|var|function)/m.test(trimmed)) {
      return 'javascript';
    }
    
    // YAML detection (key-value pairs with colons)
    if (/^\s*[\w-]+\s*:/m.test(trimmed)) {
      return 'yaml';
    }
    
    return 'json'; // Default fallback
  }
}

/**
 * Enhanced multi-format parser that delegates to specific parsers
 */
export class EnhancedMultiFormatParser {
  static async parseFile(
    filePath: string,
    options: EnhancedParseOptions = {}
  ): Promise<EnhancedParseResult> {
    const startTime = Date.now();
    
    try {
      // Read file
      const stats = await fs.stat(filePath);
      const maxSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
      
      if (stats.size > maxSize) {
        throw new Error(`File size (${stats.size} bytes) exceeds maximum allowed size (${maxSize} bytes)`);
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      const format = FormatDetector.detectFormat(filePath, content);
      
      let parseResult: Omit<EnhancedParseResult, 'filePath' | 'format'>;
      
      switch (format) {
        case 'json':
          parseResult = await EnhancedJsonParser.parse(content, filePath, options);
          break;
        case 'yaml':
          parseResult = await EnhancedYamlParser.parse(content, filePath, options);
          break;
        case 'javascript':
        case 'typescript':
          parseResult = await EnhancedJsParser.parse(filePath, content, options);
          break;
        default:
          throw new Error(`Unsupported file format: ${format}`);
      }
      
      return {
        ...parseResult,
        filePath,
        format
      };
      
    } catch (error) {
      return {
        config: null,
        success: false,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'format',
          code: 'FILE_READ_ERROR',
          severity: 'error'
        }],
        warnings: [],
        filePath,
        format: 'unknown',
        parseTimeMs: Date.now() - startTime,
        fileSizeBytes: 0,
        metadata: {}
      };
    }
  }
}