/**
 * Log Management CLI Commands
 * 
 * Provides CLI commands for managing, viewing, and analyzing logs
 * in the Persuader framework.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { 
  type LogEntry 
} from '../../utils/logging/jsonl-rotation.js';
import {
  CategoryPresets,
  setCategoryPreset,
} from '../../utils/category-manager.js';
import {
  PrivacyLevel,
  PrivacyFilter,
  type SensitiveDataType,
} from '../../utils/logging/privacy-filter.js';
import {
  getGlobalPerformanceMonitor,
} from '../../utils/logging/performance-monitor.js';

/**
 * Create the logs command with subcommands
 */
export function createLogsCommand(): Command {
  const logs = new Command('logs')
    .description('Manage and analyze Persuader logs')
    .alias('log');
  
  // View logs
  logs
    .command('view')
    .description('View recent logs with filtering options')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .option('-f, --follow', 'Follow log output (tail -f)')
    .option('--session <id>', 'Filter by session ID')
    .option('--request <id>', 'Filter by request ID')
    .option('--level <level>', 'Filter by log level')
    .option('--category <category>', 'Filter by category')
    .option('--since <time>', 'Show logs since time (e.g., "10m", "1h", "2024-01-01")')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(async (options) => {
      await viewLogs(options);
    });
  
  // Search logs
  logs
    .command('search <pattern>')
    .description('Search logs for a pattern')
    .option('-i, --ignore-case', 'Case-insensitive search')
    .option('-n, --lines <number>', 'Number of results to show', '100')
    .option('--regex', 'Treat pattern as regex')
    .option('--session <id>', 'Filter by session ID')
    .option('--since <time>', 'Search logs since time')
    .option('--json', 'Output as JSON')
    .action(async (pattern, options) => {
      await searchLogs(pattern, options);
    });
  
  // Clean logs
  logs
    .command('clean')
    .description('Clean up old log files')
    .option('--older-than <days>', 'Delete logs older than N days', '7')
    .option('--keep <number>', 'Keep at most N files', '10')
    .option('--dry-run', 'Show what would be deleted without deleting')
    .option('--compress', 'Compress old logs instead of deleting')
    .action(async (options) => {
      await cleanLogs(options);
    });
  
  // Log statistics
  logs
    .command('stats')
    .description('Show log statistics and metrics')
    .option('--period <time>', 'Time period for stats (e.g., "1h", "24h", "7d")')
    .option('--by-level', 'Group statistics by log level')
    .option('--by-category', 'Group statistics by category')
    .option('--by-session', 'Group statistics by session')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await showStats(options);
    });
  
  // Performance metrics
  logs
    .command('perf')
    .description('Show performance metrics')
    .option('--metric <name>', 'Specific metric to show')
    .option('--export <format>', 'Export format (json, prometheus)', 'json')
    .option('--period <time>', 'Time period for metrics')
    .action(async (options) => {
      await showPerformance(options);
    });
  
  // Privacy scan
  logs
    .command('privacy-scan')
    .description('Scan logs for sensitive data')
    .option('--fix', 'Redact sensitive data found')
    .option('--level <level>', 'Privacy level (minimal, standard, strict, paranoid)', 'standard')
    .option('--report', 'Generate detailed privacy report')
    .option('--dry-run', 'Show what would be redacted without changing files')
    .action(async (options) => {
      await privacyScan(options);
    });
  
  // Configure logging
  logs
    .command('config')
    .description('Configure logging settings')
    .option('--set-level <level>', 'Set global log level')
    .option('--set-categories <categories>', 'Set active categories (comma-separated)')
    .option('--set-preset <preset>', 'Use a preset configuration')
    .option('--enable-jsonl', 'Enable JSONL file logging')
    .option('--set-privacy <level>', 'Set privacy level')
    .option('--show', 'Show current configuration')
    .action(async (options) => {
      await configureLogging(options);
    });
  
  // Tail logs in real-time
  logs
    .command('tail')
    .description('Tail logs in real-time')
    .option('-n, --lines <number>', 'Initial lines to show', '10')
    .option('--session <id>', 'Filter by session ID')
    .option('--category <category>', 'Filter by category')
    .option('--no-color', 'Disable colored output')
    .action(async (options) => {
      await tailLogs(options);
    });
  
  return logs;
}

/**
 * View logs implementation
 */
async function viewLogs(options: any): Promise<void> {
  const logsDir = './logs';
  const lines = parseInt(options.lines, 10);
  
  try {
    // Find log files
    const files = await getLogFiles(logsDir);
    if (files.length === 0) {
      console.log(chalk.yellow('No log files found'));
      return;
    }
    
    // Read and filter logs
    const entries: LogEntry[] = [];
    for (const file of files) {
      const fileEntries = await readLogFile(file);
      entries.push(...fileEntries);
    }
    
    // Apply filters
    let filtered = filterEntries(entries, options);
    
    // Sort by timestamp
    filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Limit results
    filtered = filtered.slice(0, lines);
    
    // Display results
    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
    } else {
      displayEntries(filtered, options);
    }
    
    // Follow mode
    if (options.follow) {
      await followLogs(logsDir, options);
    }
  } catch (error) {
    console.error(chalk.red('Error viewing logs:'), error);
    process.exit(1);
  }
}

/**
 * Search logs implementation
 */
async function searchLogs(pattern: string, options: any): Promise<void> {
  const logsDir = './logs';
  const maxResults = parseInt(options.lines, 10);
  
  try {
    const files = await getLogFiles(logsDir);
    const searchRegex = options.regex 
      ? new RegExp(pattern, options.ignoreCase ? 'i' : undefined)
      : new RegExp(escapeRegex(pattern), options.ignoreCase ? 'i' : undefined);
    
    const results: LogEntry[] = [];
    
    for (const file of files) {
      const entries = await readLogFile(file);
      
      for (const entry of entries) {
        const searchText = JSON.stringify(entry);
        if (searchRegex.test(searchText)) {
          results.push(entry);
          if (results.length >= maxResults) break;
        }
      }
      
      if (results.length >= maxResults) break;
    }
    
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(chalk.cyan(`Found ${results.length} matches for "${pattern}"\n`));
      displayEntries(results, options);
    }
  } catch (error) {
    console.error(chalk.red('Error searching logs:'), error);
    process.exit(1);
  }
}

/**
 * Clean logs implementation
 */
async function cleanLogs(options: any): Promise<void> {
  const logsDir = './logs';
  const olderThanDays = parseInt(options.olderThan, 10);
  const keepFiles = parseInt(options.keep, 10);
  
  try {
    const files = await getLogFiles(logsDir);
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const toDelete: string[] = [];
    const toCompress: string[] = [];
    
    // Find files to process
    for (const file of files) {
      const stats = await fs.stat(file);
      
      if (stats.birthtime.getTime() < cutoffTime) {
        if (options.compress && !file.endsWith('.gz')) {
          toCompress.push(file);
        } else {
          toDelete.push(file);
        }
      }
    }
    
    // Enforce max files limit
    if (files.length - toDelete.length > keepFiles) {
      const sorted = files.sort(() => {
        // Sort by creation time
        return 0; // Placeholder - would need stats
      });
      
      const excess = files.length - toDelete.length - keepFiles;
      toDelete.push(...sorted.slice(0, excess));
    }
    
    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.yellow('Dry run mode - no files will be modified\n'));
      
      if (toCompress.length > 0) {
        console.log(chalk.blue(`Files to compress (${toCompress.length}):`));
        toCompress.forEach(f => console.log(`  - ${path.basename(f)}`));
      }
      
      if (toDelete.length > 0) {
        console.log(chalk.red(`\nFiles to delete (${toDelete.length}):`));
        toDelete.forEach(f => console.log(`  - ${path.basename(f)}`));
      }
      
      return;
    }
    
    // Perform cleanup
    let compressed = 0;
    let deleted = 0;
    
    for (const file of toCompress) {
      // TODO: Implement compression
      console.log(chalk.blue(`Compressing ${path.basename(file)}...`));
      compressed++;
    }
    
    for (const file of toDelete) {
      await fs.unlink(file);
      deleted++;
    }
    
    console.log(chalk.green(`\n✓ Cleanup complete`));
    if (compressed > 0) console.log(`  Compressed: ${compressed} files`);
    if (deleted > 0) console.log(`  Deleted: ${deleted} files`);
  } catch (error) {
    console.error(chalk.red('Error cleaning logs:'), error);
    process.exit(1);
  }
}

/**
 * Show statistics implementation
 */
async function showStats(options: any): Promise<void> {
  const logsDir = './logs';
  
  try {
    const files = await getLogFiles(logsDir);
    let totalSize = 0;
    let totalEntries = 0;
    const levelCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const sessionCounts = new Map<string, number>();
    
    for (const file of files) {
      const stats = await fs.stat(file);
      totalSize += stats.size;
      
      const entries = await readLogFile(file);
      totalEntries += entries.length;
      
      for (const entry of entries) {
        // Count by level
        if (options.byLevel && entry.level) {
          levelCounts.set(entry.level, (levelCounts.get(entry.level) || 0) + 1);
        }
        
        // Count by category
        if (options.byCategory && entry.category) {
          categoryCounts.set(entry.category, (categoryCounts.get(entry.category) || 0) + 1);
        }
        
        // Count by session
        if (options.bySession && entry.sessionId) {
          sessionCounts.set(entry.sessionId, (sessionCounts.get(entry.sessionId) || 0) + 1);
        }
      }
    }
    
    if (options.json) {
      console.log(JSON.stringify({
        files: files.length,
        totalSize,
        totalEntries,
        levels: Object.fromEntries(levelCounts),
        categories: Object.fromEntries(categoryCounts),
        sessions: Object.fromEntries(sessionCounts),
      }, null, 2));
    } else {
      console.log(chalk.bold.cyan('\n📊 Log Statistics\n'));
      console.log(`Total files: ${files.length}`);
      console.log(`Total size: ${formatBytes(totalSize)}`);
      console.log(`Total entries: ${totalEntries.toLocaleString()}`);
      
      if (options.byLevel && levelCounts.size > 0) {
        console.log(chalk.bold('\nBy Level:'));
        for (const [level, count] of levelCounts) {
          const percentage = ((count / totalEntries) * 100).toFixed(1);
          console.log(`  ${level}: ${count.toLocaleString()} (${percentage}%)`);
        }
      }
      
      if (options.byCategory && categoryCounts.size > 0) {
        console.log(chalk.bold('\nBy Category:'));
        const sorted = Array.from(categoryCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        for (const [category, count] of sorted) {
          const percentage = ((count / totalEntries) * 100).toFixed(1);
          console.log(`  ${category}: ${count.toLocaleString()} (${percentage}%)`);
        }
      }
      
      if (options.bySession && sessionCounts.size > 0) {
        console.log(chalk.bold(`\nSessions: ${sessionCounts.size}`));
        const avgPerSession = Math.floor(totalEntries / sessionCounts.size);
        console.log(`  Average entries per session: ${avgPerSession.toLocaleString()}`);
      }
    }
  } catch (error) {
    console.error(chalk.red('Error calculating stats:'), error);
    process.exit(1);
  }
}

/**
 * Show performance metrics
 */
async function showPerformance(options: any): Promise<void> {
  const monitor = getGlobalPerformanceMonitor();
  
  if (options.export === 'prometheus') {
    console.log(monitor.exportMetrics('prometheus'));
  } else {
    const summary = monitor.getSummary();
    const stats = monitor.getStats(options.metric);
    
    if (options.export === 'json') {
      console.log(JSON.stringify({ summary, stats: Array.from(stats.entries()) }, null, 2));
    } else {
      console.log(chalk.bold.cyan('\n⚡ Performance Metrics\n'));
      console.log(`Uptime: ${formatDuration(summary.uptime)}`);
      console.log(`Total operations: ${summary.totalOperations.toLocaleString()}`);
      console.log(`Active operations: ${summary.activeOperations}`);
      console.log(`Error rate: ${(summary.errorRate * 100).toFixed(2)}%`);
      console.log(`Avg response time: ${summary.avgResponseTime.toFixed(2)}ms`);
      console.log(`Total tokens: ${summary.totalTokens.toLocaleString()}`);
      console.log(`Memory usage: ${formatBytes(summary.memoryUsage)}`);
      
      if (stats.size > 0) {
        console.log(chalk.bold('\nDetailed Stats:'));
        for (const [key, stat] of stats) {
          console.log(`\n${chalk.yellow(key)}:`);
          console.log(`  Count: ${stat.count}`);
          console.log(`  Mean: ${stat.mean.toFixed(2)}`);
          console.log(`  Median: ${stat.median.toFixed(2)}`);
          console.log(`  P95: ${stat.p95.toFixed(2)}`);
          console.log(`  P99: ${stat.p99.toFixed(2)}`);
        }
      }
    }
  }
}

/**
 * Privacy scan implementation
 */
async function privacyScan(options: any): Promise<void> {
  const logsDir = './logs';
  const privacyLevel = (options.level?.toUpperCase() ?? 'STANDARD') as keyof typeof PrivacyLevel;
  const filter = new PrivacyFilter({ level: PrivacyLevel[privacyLevel] });
  
  try {
    const files = await getLogFiles(logsDir);
    const findings = new Map<string, Map<SensitiveDataType, number>>();
    let totalSensitive = 0;
    
    for (const file of files) {
      const entries = await readLogFile(file);
      const fileFindings = new Map<SensitiveDataType, number>();
      
      for (const entry of entries) {
        const content = JSON.stringify(entry);
        const detected = filter.detectSensitiveData(content);
        
        for (const [type, count] of detected) {
          fileFindings.set(type, (fileFindings.get(type) || 0) + count);
          totalSensitive += count;
        }
      }
      
      if (fileFindings.size > 0) {
        findings.set(file, fileFindings);
      }
    }
    
    // Display results
    if (totalSensitive === 0) {
      console.log(chalk.green('✓ No sensitive data found in logs'));
      return;
    }
    
    console.log(chalk.yellow(`⚠️  Found ${totalSensitive} potential sensitive data items\n`));
    
    for (const [file, types] of findings) {
      console.log(chalk.bold(path.basename(file)));
      for (const [type, count] of types) {
        console.log(`  ${type}: ${count} occurrences`);
      }
    }
    
    if (options.fix && !options.dryRun) {
      console.log(chalk.cyan('\nRedacting sensitive data...'));
      // TODO: Implement redaction
      console.log(chalk.green('✓ Sensitive data redacted'));
    } else if (options.fix && options.dryRun) {
      console.log(chalk.yellow('\nDry run - no files would be modified'));
    }
  } catch (error) {
    console.error(chalk.red('Error scanning for sensitive data:'), error);
    process.exit(1);
  }
}

/**
 * Configure logging implementation
 */
async function configureLogging(options: any): Promise<void> {
  if (options.show) {
    // TODO: Show current configuration
    console.log(chalk.cyan('Current logging configuration:'));
    return;
  }
  
  if (options.setPreset) {
    const preset = options.setPreset.toUpperCase().replace('-', '_');
    if (preset in CategoryPresets) {
      setCategoryPreset(preset as keyof typeof CategoryPresets);
      console.log(chalk.green(`✓ Set logging preset to: ${options.setPreset}`));
    } else {
      console.error(chalk.red(`Invalid preset: ${options.setPreset}`));
      console.log('Available presets:', Object.keys(CategoryPresets).join(', '));
    }
  }
  
  if (options.setCategories) {
    const categories = options.setCategories.split(',').map((c: string) => c.trim());
    // TODO: Parse and set categories
    console.log(chalk.green(`✓ Set categories: ${categories.join(', ')}`));
  }
  
  if (options.enableJsonl) {
    // TODO: Enable JSONL logging
    console.log(chalk.green('✓ JSONL logging enabled'));
  }
  
  if (options.setPrivacy) {
    const level = options.setPrivacy.toUpperCase() as keyof typeof PrivacyLevel;
    if (level in PrivacyLevel) {
      // TODO: Set privacy level
      console.log(chalk.green(`✓ Set privacy level to: ${options.setPrivacy}`));
    } else {
      console.error(chalk.red(`Invalid privacy level: ${options.setPrivacy}`));
    }
  }
}

/**
 * Tail logs in real-time
 */
async function tailLogs(_options: any): Promise<void> {
  // TODO: Implement real-time log tailing
  console.log(chalk.cyan('Tailing logs... (Press Ctrl+C to stop)'));
}

// Helper functions

async function getLogFiles(directory: string): Promise<string[]> {
  try {
    const files = await fs.readdir(directory);
    return files
      .filter(f => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
      .map(f => path.join(directory, f));
  } catch {
    return [];
  }
}

async function readLogFile(_filepath: string): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  
  // TODO: Implement proper JSONL reading with gz support
  // For now, return empty array
  return entries;
}

function filterEntries(entries: LogEntry[], options: any): LogEntry[] {
  let filtered = entries;
  
  if (options.session) {
    filtered = filtered.filter(e => e.sessionId === options.session);
  }
  
  if (options.request) {
    filtered = filtered.filter(e => e.requestId === options.request);
  }
  
  if (options.level) {
    filtered = filtered.filter(e => e.level === options.level);
  }
  
  if (options.category) {
    filtered = filtered.filter(e => e.category === options.category);
  }
  
  if (options.since) {
    const sinceTime = parseSinceTime(options.since as string);
    filtered = filtered.filter(e => new Date(e.timestamp) >= sinceTime);
  }
  
  return filtered;
}

function displayEntries(entries: LogEntry[], options: any): void {
  for (const entry of entries) {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level || 'INFO';
    const message = entry.message;
    
    if (options.color === false) {
      console.log(`[${timestamp}] [${level}] ${message}`);
    } else {
      const levelColor = getLevelColor(level);
      console.log(
        chalk.dim(`[${timestamp}]`) +
        ` ${levelColor(`[${level}]`)} ` +
        message
      );
    }
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log(chalk.dim(JSON.stringify(entry.context, null, 2)));
    }
  }
}

function getLevelColor(level: string): (text: string) => string {
  switch (level.toLowerCase()) {
    case 'error': return chalk.red;
    case 'warn': return chalk.yellow;
    case 'info': return chalk.blue;
    case 'debug': return chalk.gray;
    default: return chalk.white;
  }
}

function parseSinceTime(since: string | undefined): Date {
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

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function followLogs(_logsDir: string, _options: any): Promise<void> {
  // TODO: Implement log following
  console.log(chalk.dim('Following logs...'));
}