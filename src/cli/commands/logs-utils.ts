/**
 * Utility functions for log management
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import type { LogEntry } from '../../utils/logging/jsonl-rotation.js';
import type { ViewLogsOptions, SearchLogsOptions, StatsOptions } from './logs-types.js';

/**
 * Get log files from directory
 */
export async function getLogFiles(directory: string): Promise<string[]> {
  try {
    const files = await fs.readdir(directory);
    return files
      .filter(f => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
      .map(f => path.join(directory, f));
  } catch {
    return [];
  }
}

/**
 * Read entries from log file
 */
export async function readLogFile(_filepath: string): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  
  // TODO: Implement proper JSONL reading with gz support
  // For now, return empty array
  return entries;
}

/**
 * Filter log entries based on options
 */
export function filterEntries(entries: LogEntry[], options: ViewLogsOptions | SearchLogsOptions): LogEntry[] {
  let filtered = entries;
  
  if ('session' in options && options.session) {
    filtered = filtered.filter(e => e.sessionId === options.session);
  }
  
  if ('request' in options && options.request) {
    filtered = filtered.filter(e => e.requestId === options.request);
  }
  
  if ('level' in options && options.level) {
    filtered = filtered.filter(e => e.level === options.level);
  }
  
  if ('category' in options && options.category) {
    filtered = filtered.filter(e => e.category === options.category);
  }
  
  if (options.since) {
    const sinceTime = parseSinceTime(options.since);
    filtered = filtered.filter(e => new Date(e.timestamp) >= sinceTime);
  }
  
  return filtered;
}

/**
 * Display log entries with formatting
 */
export function displayEntries(entries: LogEntry[], _options: ViewLogsOptions | SearchLogsOptions | StatsOptions): void {
  for (const entry of entries) {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelColor = getLevelColor(entry.level || 'info');
    const level = levelColor((entry.level || 'info').toUpperCase().padEnd(5));
    
    console.log(`[${chalk.gray(timestamp)}] ${level} ${entry.message}`);
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log(chalk.dim(JSON.stringify(entry.context, null, 2)));
    }
  }
}

/**
 * Get color function for log level
 */
export function getLevelColor(level: string): (text: string) => string {
  switch (level.toLowerCase()) {
    case 'error': return chalk.red;
    case 'warn': return chalk.yellow;
    case 'info': return chalk.blue;
    case 'debug': return chalk.gray;
    default: return chalk.white;
  }
}

/**
 * Parse relative time strings
 */
export function parseSinceTime(since: string | undefined): Date {
  if (!since) return new Date();
  // Handle relative times like "10m", "1h", "2d"
  const match = since.match(/^(\d+)([mhd])$/);
  if (match) {
    const [, num, unit] = match;
    const value = parseInt(num!, 10);
    const now = Date.now();
    
    switch (unit) {
      case 'm': return new Date(now - value * 60 * 1000);
      case 'h': return new Date(now - value * 60 * 60 * 1000);
      case 'd': return new Date(now - value * 24 * 60 * 60 * 1000);
    }
  }
  
  // Try to parse as date
  return new Date(since);
}

/**
 * Format bytes for human readability
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * Format duration for human readability
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Escape regex special characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}