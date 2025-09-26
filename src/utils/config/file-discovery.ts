/**
 * Configuration File Discovery System
 * 
 * Implements intelligent discovery of .persuader configuration files
 * following standard RC file patterns and directory traversal.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface ConfigDiscoveryOptions {
  /** Starting directory for discovery (defaults to cwd) */
  startDir?: string;
  /** Explicit config file path (skips discovery) */
  configPath?: string;
  /** Stop at package.json boundary (default: true) */
  stopAtPackageJson?: boolean;
  /** Maximum directory levels to traverse upward */
  maxTraversalDepth?: number;
}

export interface ConfigDiscoveryResult {
  /** Path to discovered config file, null if not found */
  configPath: string | null;
  /** Format of the discovered file */
  format: ConfigFileFormat | null;
  /** Discovery method used */
  discoveryMethod: DiscoveryMethod | null;
  /** Search paths that were attempted */
  searchedPaths: string[];
  /** Time taken for discovery in milliseconds */
  discoveryTimeMs: number;
}

export type ConfigFileFormat = 'json' | 'yaml' | 'js' | 'ts';
export type DiscoveryMethod = 'explicit' | 'cwd' | 'traversal' | 'home' | 'system';

/**
 * Standard config filenames in priority order
 */
export const CONFIG_FILENAMES = [
  '.persuader',
  '.persuader.json', 
  '.persuader.yaml',
  '.persuader.yml',
  '.persuader.js',
  '.persuader.ts',
  'persuader.config.js',
  'persuader.config.ts',
  'persuader.config.json',
  'persuader.config.yaml',
  'persuader.config.yml',
] as const;

/**
 * Get file format from extension
 */
function getFormatFromPath(filePath: string): ConfigFileFormat {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.json': return 'json';
    case '.yaml':
    case '.yml': return 'yaml';
    case '.js': return 'js';
    case '.ts': return 'ts';
    default:
      // For extensionless files like .persuader, try to detect content
      // Default to json for now
      return 'json';
  }
}

/**
 * Check if a file exists and is readable
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find config files in a specific directory
 */
async function findConfigInDirectory(dirPath: string): Promise<string | null> {
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.resolve(dirPath, filename);
    if (await fileExists(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Check if directory contains package.json (project boundary)
 */
async function hasPackageJson(dirPath: string): Promise<boolean> {
  const packagePath = path.resolve(dirPath, 'package.json');
  return await fileExists(packagePath);
}

/**
 * Get system-wide config paths
 */
function getSystemConfigPaths(): string[] {
  const paths: string[] = [];
  
  // User home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    paths.push(
      path.resolve(homeDir, '.persuader'),
      path.resolve(homeDir, '.config', 'persuader', 'config.json'),
      path.resolve(homeDir, '.config', 'persuader', 'config.yaml')
    );
  }
  
  // System-wide paths (Unix-like systems)
  if (process.platform !== 'win32') {
    paths.push(
      '/etc/persuader/config.json',
      '/etc/persuader/config.yaml',
      '/usr/local/etc/persuader/config.json'
    );
  }
  
  return paths;
}

/**
 * Discover configuration file using intelligent search strategy
 */
export async function discoverConfigFile(
  options: ConfigDiscoveryOptions = {}
): Promise<ConfigDiscoveryResult> {
  const startTime = Date.now();
  const searchedPaths: string[] = [];
  const {
    startDir = process.cwd(),
    configPath,
    stopAtPackageJson = true,
    maxTraversalDepth = 10
  } = options;

  // 1. Explicit path provided
  if (configPath) {
    const resolvedPath = path.resolve(configPath);
    searchedPaths.push(resolvedPath);
    
    if (await fileExists(resolvedPath)) {
      return {
        configPath: resolvedPath,
        format: getFormatFromPath(resolvedPath),
        discoveryMethod: 'explicit',
        searchedPaths,
        discoveryTimeMs: Date.now() - startTime
      };
    }
  }

  // 2. Current working directory
  let currentDir = path.resolve(startDir);
  const configInCwd = await findConfigInDirectory(currentDir);
  
  // Track CWD search paths
  for (const filename of CONFIG_FILENAMES) {
    searchedPaths.push(path.resolve(currentDir, filename));
  }
  
  if (configInCwd) {
    return {
      configPath: configInCwd,
      format: getFormatFromPath(configInCwd),
      discoveryMethod: 'cwd',
      searchedPaths,
      discoveryTimeMs: Date.now() - startTime
    };
  }

  // 3. Traverse up directory tree
  let depth = 0;
  const rootDir = path.parse(currentDir).root;
  
  while (currentDir !== rootDir && depth < maxTraversalDepth) {
    currentDir = path.dirname(currentDir);
    depth++;
    
    // Stop at package.json boundary if requested
    if (stopAtPackageJson && await hasPackageJson(currentDir)) {
      const configInProject = await findConfigInDirectory(currentDir);
      
      // Track traversal search paths
      for (const filename of CONFIG_FILENAMES) {
        searchedPaths.push(path.resolve(currentDir, filename));
      }
      
      if (configInProject) {
        return {
          configPath: configInProject,
          format: getFormatFromPath(configInProject),
          discoveryMethod: 'traversal',
          searchedPaths,
          discoveryTimeMs: Date.now() - startTime
        };
      }
      break; // Stop traversal at package.json
    }
    
    const configInParent = await findConfigInDirectory(currentDir);
    
    // Track traversal search paths
    for (const filename of CONFIG_FILENAMES) {
      searchedPaths.push(path.resolve(currentDir, filename));
    }
    
    if (configInParent) {
      return {
        configPath: configInParent,
        format: getFormatFromPath(configInParent),
        discoveryMethod: 'traversal',
        searchedPaths,
        discoveryTimeMs: Date.now() - startTime
      };
    }
  }

  // 4. System-wide and home directory paths
  const systemPaths = getSystemConfigPaths();
  for (const systemPath of systemPaths) {
    searchedPaths.push(systemPath);
    
    if (await fileExists(systemPath)) {
      return {
        configPath: systemPath,
        format: getFormatFromPath(systemPath),
        discoveryMethod: systemPath.includes(process.env.HOME || '') ? 'home' : 'system',
        searchedPaths,
        discoveryTimeMs: Date.now() - startTime
      };
    }
  }

  // No config file found
  return {
    configPath: null,
    format: null,
    discoveryMethod: null,
    searchedPaths,
    discoveryTimeMs: Date.now() - startTime
  };
}

/**
 * Quick check if any config file exists in current directory
 */
export async function hasConfigFile(dirPath: string = process.cwd()): Promise<boolean> {
  return (await findConfigInDirectory(dirPath)) !== null;
}

/**
 * Get the expected config file path for the current directory
 */
export function getDefaultConfigPath(dirPath: string = process.cwd()): string {
  return path.resolve(dirPath, '.persuader');
}

/**
 * Validate config file path and format
 */
export function validateConfigPath(configPath: string): { valid: boolean; error?: string } {
  if (!configPath) {
    return { valid: false, error: 'Config path is required' };
  }
  
  const resolvedPath = path.resolve(configPath);
  const filename = path.basename(resolvedPath);
  
  // Check if filename matches expected patterns
  const isValidFilename = CONFIG_FILENAMES.some(pattern => {
    if (pattern.includes('*')) {
      // Handle glob patterns if we add them
      return false;
    }
    return filename === pattern || resolvedPath.endsWith(pattern);
  });
  
  if (!isValidFilename) {
    return { 
      valid: false, 
      error: `Invalid config filename. Expected one of: ${CONFIG_FILENAMES.join(', ')}` 
    };
  }
  
  return { valid: true };
}

/**
 * Performance metrics for config discovery
 */
export interface DiscoveryMetrics {
  averageDiscoveryTime: number;
  cacheHitRate: number;
  totalDiscoveries: number;
  pathsSearchedPerDiscovery: number;
}

// Simple metrics tracking (can be enhanced with proper metrics system later)
const discoveryMetrics = {
  totalTime: 0,
  totalDiscoveries: 0,
  totalPathsSearched: 0
};

export function getDiscoveryMetrics(): DiscoveryMetrics {
  const totalDiscoveries = discoveryMetrics.totalDiscoveries;
  return {
    averageDiscoveryTime: totalDiscoveries > 0 ? discoveryMetrics.totalTime / totalDiscoveries : 0,
    cacheHitRate: 0, // Will be implemented with caching
    totalDiscoveries,
    pathsSearchedPerDiscovery: totalDiscoveries > 0 ? discoveryMetrics.totalPathsSearched / totalDiscoveries : 0
  };
}