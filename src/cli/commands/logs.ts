/**
 * Log Management CLI Commands
 * 
 * Main entry point for log command setup
 */

import { Command } from 'commander';
import {
  viewLogs,
  searchLogs,
  cleanLogs,
  showStats,
  showPerformance,
  privacyScan,
  configureLogging,
  tailLogs,
} from './logs-commands.js';

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