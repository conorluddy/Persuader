/**
 * Configuration File Parser
 * 
 * Multi-format parser for .persuader configuration files
 * supporting JSON, YAML, JavaScript, and TypeScript formats.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PersuaderConfig,
  validateConfig,
  type ConfigValidationResult
} from './schema.js';
import type { ConfigFileFormat } from './file-discovery.js';

export interface ParseResult extends ConfigValidationResult {
  /** Original file path */
  filePath: string;
  
  /** Detected file format */
  format: ConfigFileFormat;
  
  /** Raw file content */
  rawContent: string | undefined;
  
  /** Parse time in milliseconds */
  parseTimeMs: number;
  
  /** File size in bytes */
  fileSizeBytes: number;
}

export interface ParseOptions {
  /** Allow JavaScript execution for .js/.ts files */
  allowExecution?: boolean;
  
  /** Include raw content in result (for debugging) */
  includeRawContent?: boolean;
  
  /** Validate configuration against schema */
  validate?: boolean;
  
  /** Environment variables for interpolation */
  env?: Record<string, string>;
}

/**
 * Parse JSON configuration file
 */
async function parseJsonConfig(
  content: string, 
  options: ParseOptions
): Promise<Omit<ParseResult, 'filePath' | 'format' | 'parseTimeMs' | 'fileSizeBytes'>> {
  try {
    const rawConfig = JSON.parse(content);
    
    if (options.validate !== false) {
      const validation = validateConfig(rawConfig);
      return {
        ...validation,
        rawContent: options.includeRawContent ? content : undefined,
        warnings: validation.warnings
      };
    }
    
    return {
      valid: true,
      config: rawConfig as PersuaderConfig,
      errors: undefined,
      errorMessages: undefined,
      rawContent: options.includeRawContent ? content : undefined,
      warnings: undefined
    };
  } catch (error) {
    return {
      valid: false,
      config: undefined,
      errors: undefined,
      errorMessages: [`JSON parse error: ${error instanceof Error ? error.message : 'Invalid JSON'}`],
      rawContent: options.includeRawContent ? content : undefined,
      warnings: undefined
    };
  }
}

/**
 * Parse YAML configuration file
 */
async function parseYamlConfig(
  content: string, 
  options: ParseOptions
): Promise<Omit<ParseResult, 'filePath' | 'format' | 'parseTimeMs' | 'fileSizeBytes'>> {
  try {
    // For now, we'll use a simple YAML parser
    // In a full implementation, we'd use a proper YAML library like js-yaml
    // but avoiding additional dependencies for this implementation
    
    // Basic YAML-to-JSON conversion for simple cases
    const jsonContent = convertSimpleYamlToJson(content);
    const rawConfig = JSON.parse(jsonContent);
    
    if (options.validate !== false) {
      const validation = validateConfig(rawConfig);
      return {
        ...validation,
        rawContent: options.includeRawContent ? content : undefined,
        warnings: validation.warnings
      };
    }
    
    return {
      valid: true,
      config: rawConfig as PersuaderConfig,
      errors: undefined,
      errorMessages: undefined,
      rawContent: options.includeRawContent ? content : undefined,
      warnings: undefined
    };
  } catch (error) {
    return {
      valid: false,
      config: undefined,
      errors: undefined,
      errorMessages: [`YAML parse error: ${error instanceof Error ? error.message : 'Invalid YAML'}`],
      rawContent: options.includeRawContent ? content : undefined,
      warnings: undefined
    };
  }
}

/**
 * Simple YAML to JSON converter for basic cases
 * Note: This is a simplified implementation. In production, use js-yaml
 */
function convertSimpleYamlToJson(yaml: string): string {
  // This is a very basic YAML parser for simple key-value pairs
  // For a full implementation, we'd use js-yaml or similar
  const lines = yaml.split('\n');
  const result: any = {};
  let currentPath: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Calculate indentation level
    const indent = line.length - line.trimStart().length;
    const indentLevel = Math.floor(indent / 2);
    
    // Adjust current path based on indentation
    currentPath = currentPath.slice(0, indentLevel);
    
    if (trimmed.includes(':')) {
      const [keyPart, ...valueParts] = trimmed.split(':');
      const key = keyPart?.trim();
      const value = valueParts.join(':').trim();
      
      if (key) {
        if (value) {
          // Simple value
          setNestedValue(result, [...currentPath, key], parseYamlValue(value));
        } else {
          // Object key - add to path
          currentPath.push(key);
          setNestedValue(result, currentPath, {});
        }
      }
    }
  }
  
  return JSON.stringify(result);
}

/**
 * Parse YAML value to appropriate JavaScript type
 */
function parseYamlValue(value: string): any {
  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  // Boolean values
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  
  // Numbers
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  
  // Arrays (simple comma-separated)
  if (value.startsWith('[') && value.endsWith(']')) {
    const items = value.slice(1, -1).split(',').map(item => parseYamlValue(item.trim()));
    return items;
  }
  
  return value;
}

/**
 * Set nested object value
 */
function setNestedValue(obj: any, path: string[], value: any): void {
  if (path.length === 0) return;
  
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!key) continue;
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  const lastKey = path[path.length - 1];
  if (lastKey) {
    current[lastKey] = value;
  }
}

/**
 * Parse JavaScript/TypeScript configuration file
 */
async function parseJsConfig(
  filePath: string, 
  content: string, 
  options: ParseOptions
): Promise<Omit<ParseResult, 'filePath' | 'format' | 'parseTimeMs' | 'fileSizeBytes'>> {
  if (!options.allowExecution) {
    return {
      valid: false,
      config: undefined,
      errors: undefined,
      errorMessages: ['JavaScript/TypeScript execution not allowed. Set allowExecution: true in parse options.'],
      rawContent: options.includeRawContent ? content : undefined,
      warnings: undefined
    };
  }

  try {
    // Convert to file URL for dynamic import
    const fileUrl = pathToFileURL(filePath).href;
    
    // Clear module cache to ensure fresh load
    if (filePath in require.cache) {
      delete require.cache[filePath];
    }
    
    // Dynamic import the config file
    const module = await import(fileUrl);
    const rawConfig = module.default || module;
    
    if (options.validate !== false) {
      const validation = validateConfig(rawConfig);
      return {
        ...validation,
        rawContent: options.includeRawContent ? content : undefined,
        warnings: validation.warnings
      };
    }
    
    return {
      valid: true,
      config: rawConfig as PersuaderConfig,
      errors: undefined,
      errorMessages: undefined,
      rawContent: options.includeRawContent ? content : undefined,
      warnings: undefined
    };
  } catch (error) {
    return {
      valid: false,
      config: undefined,
      errors: undefined,
      errorMessages: [`JavaScript/TypeScript execution error: ${error instanceof Error ? error.message : 'Execution failed'}`],
      rawContent: options.includeRawContent ? content : undefined,
      warnings: undefined
    };
  }
}

/**
 * Detect configuration file format from extension
 */
export function detectConfigFormat(filePath: string): ConfigFileFormat {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.json': return 'json';
    case '.yaml':
    case '.yml': return 'yaml';
    case '.js': return 'js';
    case '.ts': return 'ts';
    default:
      // For extensionless files, try to detect from content
      // Default to JSON for .persuader files
      return 'json';
  }
}

/**
 * Parse configuration file of any supported format
 */
export async function parseConfigFile(
  filePath: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const startTime = Date.now();
  
  try {
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    const stats = await fs.stat(filePath);
    const format = detectConfigFormat(filePath);
    
    // Parse based on format
    let parseResult: Omit<ParseResult, 'filePath' | 'format' | 'parseTimeMs' | 'fileSizeBytes'>;
    
    switch (format) {
      case 'json':
        parseResult = await parseJsonConfig(content, options);
        break;
      case 'yaml':
        parseResult = await parseYamlConfig(content, options);
        break;
      case 'js':
      case 'ts':
        parseResult = await parseJsConfig(filePath, content, options);
        break;
      default:
        // Try JSON first for extensionless files
        parseResult = await parseJsonConfig(content, options);
        break;
    }
    
    return {
      ...parseResult,
      filePath,
      format,
      parseTimeMs: Date.now() - startTime,
      fileSizeBytes: stats.size
    };
  } catch (error) {
    return {
      valid: false,
      config: undefined,
      errors: undefined,
      filePath,
      format: detectConfigFormat(filePath),
      parseTimeMs: Date.now() - startTime,
      fileSizeBytes: 0,
      errorMessages: [`File read error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rawContent: undefined,
      warnings: undefined
    };
  }
}

/**
 * Validate configuration file without parsing
 */
export async function validateConfigFile(filePath: string): Promise<ParseResult> {
  return parseConfigFile(filePath, { validate: true, allowExecution: false });
}

/**
 * Quick check if file appears to be a valid config
 */
export async function isValidConfigFile(filePath: string): Promise<boolean> {
  try {
    const result = await validateConfigFile(filePath);
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Parse configuration with environment variable interpolation
 */
export async function parseConfigWithEnv(
  filePath: string,
  env: Record<string, string> = process.env as Record<string, string>
): Promise<ParseResult> {
  // First parse normally
  const result = await parseConfigFile(filePath, { 
    allowExecution: true, 
    validate: true,
    env 
  });
  
  if (!result.valid || !result.config) {
    return result;
  }
  
  // Apply environment variable interpolation
  const interpolatedConfig = interpolateEnvironmentVariables(result.config, env);
  
  // Re-validate after interpolation
  const validation = validateConfig(interpolatedConfig);
  
  return {
    ...result,
    valid: validation.valid,
    config: validation.config || interpolatedConfig,
    errors: validation.errors,
    errorMessages: validation.errorMessages,
    warnings: validation.warnings
  };
}

/**
 * Interpolate environment variables in configuration
 * Supports ${VAR_NAME} and ${VAR_NAME:-default} syntax
 */
function interpolateEnvironmentVariables(
  config: any, 
  env: Record<string, string>
): any {
  if (typeof config === 'string') {
    return config.replace(/\$\{([^}]+)\}/g, (match, varExpr) => {
      const [varName, defaultValue] = varExpr.split(':-');
      return env[varName] ?? defaultValue ?? match;
    });
  }
  
  if (Array.isArray(config)) {
    return config.map(item => interpolateEnvironmentVariables(item, env));
  }
  
  if (config && typeof config === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(config)) {
      result[key] = interpolateEnvironmentVariables(value, env);
    }
    return result;
  }
  
  return config;
}

/**
 * Performance metrics for configuration parsing
 */
export interface ParserMetrics {
  totalFiles: number;
  averageParseTime: number;
  successRate: number;
  formatDistribution: Record<ConfigFileFormat, number>;
  averageFileSize: number;
}

// Simple metrics tracking
const parserMetrics = {
  totalFiles: 0,
  totalParseTime: 0,
  successCount: 0,
  formatCounts: { json: 0, yaml: 0, js: 0, ts: 0 } as Record<ConfigFileFormat, number>,
  totalFileSize: 0
};

/**
 * Get parser performance metrics
 */
export function getParserMetrics(): ParserMetrics {
  const totalFiles = parserMetrics.totalFiles;
  
  return {
    totalFiles,
    averageParseTime: totalFiles > 0 ? parserMetrics.totalParseTime / totalFiles : 0,
    successRate: totalFiles > 0 ? parserMetrics.successCount / totalFiles : 0,
    formatDistribution: parserMetrics.formatCounts,
    averageFileSize: totalFiles > 0 ? parserMetrics.totalFileSize / totalFiles : 0
  };
}

