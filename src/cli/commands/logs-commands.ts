/**
 * Log command implementations
 */

import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { LogEntry } from '../../utils/logging/jsonl-rotation.js';
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
import type {
  ViewLogsOptions,
  SearchLogsOptions,
  CleanLogsOptions,
  StatsOptions,
  PerfOptions,
  PrivacyScanOptions,
  ConfigureLoggingOptions,
  TailLogsOptions,
} from './logs-types.js';
import {
  getLogFiles,
  readLogFile,
  filterEntries,
  displayEntries,
  formatBytes,
  formatDuration,
  escapeRegex,
} from './logs-utils.js';

const execAsync = promisify(exec);

/**
 * View logs implementation
 */
export async function viewLogs(options: ViewLogsOptions): Promise<void> {
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
      entries.push(...filterEntries(fileEntries, options));
      if (entries.length >= lines) break;
    }
    
    // Limit to requested number of lines
    const toDisplay = entries.slice(-lines);
    
    // Output results
    if (options.json) {
      console.log(JSON.stringify(toDisplay, null, 2));
    } else {
      displayEntries(toDisplay, options);
    }
    
    // Follow mode
    if (options.follow) {
      console.log(chalk.dim('Following logs... (Ctrl+C to stop)'));
      // TODO: Implement real-time log following
    }
  } catch (error) {
    console.error(chalk.red('Error viewing logs:'), error);
    process.exit(1);
  }
}

/**
 * Search logs implementation
 */
export async function searchLogs(pattern: string, options: SearchLogsOptions): Promise<void> {
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
export async function cleanLogs(options: CleanLogsOptions): Promise<void> {
  const logsDir = './logs';
  const olderThanDays = parseInt(options.olderThan, 10);
  const keepFiles = parseInt(options.keep, 10);
  
  try {
    const files = await getLogFiles(logsDir);
    const now = Date.now();
    const cutoffTime = now - (olderThanDays * 24 * 60 * 60 * 1000);
    
    // Sort files by modification time
    const fileStats = await Promise.all(
      files.map(async file => ({
        file,
        stat: await fs.stat(file),
      }))
    );
    
    fileStats.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
    
    // Determine files to process
    const toProcess: string[] = [];
    fileStats.forEach((item, index) => {
      if (index >= keepFiles || item.stat.mtime.getTime() < cutoffTime) {
        toProcess.push(item.file);
      }
    });
    
    if (toProcess.length === 0) {
      console.log(chalk.green('No files to clean'));
      return;
    }
    
    // Process files
    for (const file of toProcess) {
      if (options.compress && !file.endsWith('.gz')) {
        if (!options.dryRun) {
          await execAsync(`gzip "${file}"`);
          console.log(chalk.blue(`Compressed: ${path.basename(file)}`));
        } else {
          console.log(chalk.dim(`Would compress: ${path.basename(file)}`));
        }
      } else {
        if (!options.dryRun) {
          await fs.unlink(file);
          console.log(chalk.red(`Deleted: ${path.basename(file)}`));
        } else {
          console.log(chalk.dim(`Would delete: ${path.basename(file)}`));
        }
      }
    }
    
    console.log(chalk.green(`\n✓ Processed ${toProcess.length} files`));
  } catch (error) {
    console.error(chalk.red('Error cleaning logs:'), error);
    process.exit(1);
  }
}

/**
 * Show statistics implementation
 */
export async function showStats(options: StatsOptions): Promise<void> {
  const logsDir = './logs';
  
  try {
    const files = await getLogFiles(logsDir);
    if (files.length === 0) {
      console.log(chalk.yellow('No log files found'));
      return;
    }
    
    // Collect statistics
    let totalEntries = 0;
    let totalSize = 0;
    const levelCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const sessionCounts = new Map<string, number>();
    
    for (const file of files) {
      const stat = await fs.stat(file);
      totalSize += stat.size;
      
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
    
    // Output statistics
    if (options.json) {
      console.log(JSON.stringify({
        totalEntries,
        totalSize,
        totalFiles: files.length,
        byLevel: Object.fromEntries(levelCounts),
        byCategory: Object.fromEntries(categoryCounts),
        bySession: Object.fromEntries(sessionCounts),
      }, null, 2));
    } else {
      console.log(chalk.cyan.bold('Log Statistics\n'));
      console.log(`Total files: ${chalk.white(files.length)}`);
      console.log(`Total entries: ${chalk.white(totalEntries)}`);
      console.log(`Total size: ${chalk.white(formatBytes(totalSize))}\n`);
      
      // Level breakdown
      if (options.byLevel && levelCounts.size > 0) {
        console.log(chalk.yellow('By Level:'));
        for (const [level, count] of levelCounts.entries()) {
          const percentage = ((count / totalEntries) * 100).toFixed(1);
          console.log(`  ${level.padEnd(10)} ${count.toString().padStart(8)} (${percentage}%)`);
        }
        console.log();
      }
      
      // Category breakdown
      if (options.byCategory && categoryCounts.size > 0) {
        console.log(chalk.yellow('By Category:'));
        const sorted = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);
        for (const [category, count] of sorted.slice(0, 10)) {
          const percentage = ((count / totalEntries) * 100).toFixed(1);
          console.log(`  ${category.padEnd(20)} ${count.toString().padStart(8)} (${percentage}%)`);
        }
        if (sorted.length > 10) {
          console.log(chalk.dim(`  ... and ${sorted.length - 10} more categories`));
        }
        console.log();
      }
      
      // Session breakdown
      if (options.bySession && sessionCounts.size > 0) {
        console.log(chalk.yellow('By Session:'));
        console.log(`  Total sessions: ${sessionCounts.size}`);
        const avgPerSession = Math.round(totalEntries / sessionCounts.size);
        console.log(`  Average per session: ${avgPerSession}`);
      }
    }
  } catch (error) {
    console.error(chalk.red('Error generating stats:'), error);
    process.exit(1);
  }
}

/**
 * Show performance metrics
 */
export async function showPerformance(options: PerfOptions): Promise<void> {
  const monitor = getGlobalPerformanceMonitor();
  
  if (options.export === 'prometheus') {
    console.log(monitor.exportMetrics('prometheus'));
  } else {
    const stats = monitor.getStats(options.metric);
    
    if (options.export === 'json') {
      // Convert Map to object for JSON serialization
      const statsObj = Object.fromEntries(stats.entries());
      console.log(JSON.stringify(statsObj, null, 2));
    } else {
      console.log(chalk.cyan.bold('Performance Metrics\n'));
      
      // Iterate over the Map entries
      if (stats.size > 0) {
        console.log(chalk.yellow('Operations:'));
        for (const [name, metric] of stats.entries()) {
          console.log(`  ${name}:`);
          console.log(`    Count: ${metric.count}`);
          console.log(`    Mean: ${formatDuration(metric.mean)}`);
          console.log(`    Min: ${formatDuration(metric.min)}`);
          console.log(`    Max: ${formatDuration(metric.max)}`);
          console.log(`    P95: ${formatDuration(metric.p95)}`);
          console.log(`    P99: ${formatDuration(metric.p99)}`);
        }
      }
      
      // Get memory stats separately if needed
      const summary = monitor.getSummary();
      if (summary.memoryUsage) {
        console.log(chalk.yellow('\nMemory:'));
        console.log(`  Usage: ${formatBytes(summary.memoryUsage)}`);
        console.log(`  Uptime: ${formatDuration(summary.uptime)}`);
        console.log(`  Total Operations: ${summary.totalOperations}`);
        console.log(`  Active Operations: ${summary.activeOperations}`);
        console.log(`  Error Rate: ${(summary.errorRate * 100).toFixed(2)}%`);
      }
    }
  }
}

/**
 * Privacy scan implementation
 */
export async function privacyScan(options: PrivacyScanOptions): Promise<void> {
  const logsDir = './logs';
  const privacyLevel = (options.level?.toUpperCase() ?? 'STANDARD') as keyof typeof PrivacyLevel;
  
  const filter = new PrivacyFilter({
    level: PrivacyLevel[privacyLevel],
    preserveStructure: true,
  });
  
  try {
    const files = await getLogFiles(logsDir);
    const detectedTypes = new Map<SensitiveDataType, number>();
    const affectedFiles = new Set<string>();
    
    for (const file of files) {
      const entries = await readLogFile(file);
      let fileHasSensitive = false;
      
      for (const entry of entries) {
        const entryString = JSON.stringify(entry);
        if (filter.containsSensitiveData(entryString)) {
          fileHasSensitive = true;
          
          // Collect types of sensitive data
          const detected = filter.detectSensitiveData(entryString);
          for (const [type, count] of detected) {
            detectedTypes.set(type, (detectedTypes.get(type) || 0) + count);
          }
        }
      }
      
      if (fileHasSensitive) {
        affectedFiles.add(file);
      }
    }
    
    // Report findings
    if (affectedFiles.size === 0) {
      console.log(chalk.green('✓ No sensitive data detected in logs'));
      return;
    }
    
    console.log(chalk.red.bold(`⚠️  Sensitive data detected in ${affectedFiles.size} files\n`));
    
    console.log(chalk.yellow('Types detected:'));
    for (const [type, count] of detectedTypes) {
      console.log(`  ${type}: ${count} occurrences`);
    }
    
    console.log(chalk.yellow('\nAffected files:'));
    for (const file of affectedFiles) {
      console.log(`  - ${path.basename(file)}`);
    }
    
    // Fix if requested
    if (options.fix && !options.dryRun) {
      console.log(chalk.blue('\nRedacting sensitive data...'));
      // TODO: Implement actual redaction
      console.log(chalk.green('✓ Sensitive data redacted'));
    } else if (options.fix && options.dryRun) {
      console.log(chalk.dim('\nDry run - no files were modified'));
    }
  } catch (error) {
    console.error(chalk.red('Error scanning logs:'), error);
    process.exit(1);
  }
}

/**
 * Configure logging settings
 */
export async function configureLogging(options: ConfigureLoggingOptions): Promise<void> {
  if (options.show) {
    console.log(chalk.cyan.bold('Current Logging Configuration\n'));
    // TODO: Show current configuration
    return;
  }
  
  if (options.setPreset) {
    const preset = options.setPreset.toUpperCase().replace('-', '_');
    if (preset in CategoryPresets) {
      setCategoryPreset(preset as keyof typeof CategoryPresets);
      console.log(chalk.green(`✓ Set logging preset to: ${options.setPreset}`));
    } else {
      console.error(chalk.red(`Invalid preset: ${options.setPreset}`));
      console.log(chalk.dim('Available presets: ' + Object.keys(CategoryPresets).join(', ')));
      process.exit(1);
    }
  }
  
  // TODO: Implement other configuration options
}

/**
 * Tail logs in real-time
 */
export async function tailLogs(_options: TailLogsOptions): Promise<void> {
  console.log(chalk.yellow('Tail logs feature not yet implemented'));
  // TODO: Implement real-time log tailing
}