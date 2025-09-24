/**
 * Performance Monitor Module
 * 
 * Tracks and aggregates performance metrics for logging operations,
 * LLM interactions, and overall system performance. Provides insights
 * for optimization and debugging.
 */

import { performance } from 'perf_hooks';

/**
 * Performance metric types
 */
export enum MetricType {
  OPERATION_DURATION = 'operation_duration',
  TOKEN_USAGE = 'token_usage',
  MEMORY_USAGE = 'memory_usage',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput',
  LATENCY = 'latency',
  CACHE_HIT = 'cache_hit',
  RETRY_COUNT = 'retry_count',
}

/**
 * Performance metric data point
 */
export interface MetricPoint {
  type: MetricType;
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated metric statistics
 */
export interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

/**
 * Operation timing tracker
 */
export interface OperationTimer {
  name: string;
  startTime: number;
  endTime?: number;
  tags?: Record<string, string>;
  children: Map<string, OperationTimer>;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of operations to track
  aggregationInterval: number; // Ms, how often to compute aggregates
  retentionPeriod: number; // Ms, how long to keep raw metrics
  slowThreshold: number; // Ms, threshold for slow operation warnings
  memoryCheckInterval?: number; // Ms, how often to check memory
  exportInterval?: number; // Ms, how often to export metrics
}

/**
 * Performance monitor for tracking system metrics
 */
export class PerformanceMonitor {
  private config: Required<PerformanceConfig>;
  private metrics: Map<string, MetricPoint[]>;
  private activeOperations: Map<string, OperationTimer>;
  private aggregatedStats: Map<string, MetricStats>;
  private aggregationTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private memoryTimer: NodeJS.Timeout | null = null;
  private startTime: number;
  private operationCounter: number = 0;
  
  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      sampleRate: config.sampleRate ?? 1.0,
      aggregationInterval: config.aggregationInterval ?? 60000, // 1 minute
      retentionPeriod: config.retentionPeriod ?? 3600000, // 1 hour
      slowThreshold: config.slowThreshold ?? 5000, // 5 seconds
      memoryCheckInterval: config.memoryCheckInterval ?? 30000, // 30 seconds
      exportInterval: config.exportInterval ?? 300000, // 5 minutes
    };
    
    this.metrics = new Map();
    this.activeOperations = new Map();
    this.aggregatedStats = new Map();
    this.startTime = Date.now();
    
    if (this.config.enabled) {
      this.startTimers();
    }
  }
  
  /**
   * Start background timers
   */
  private startTimers(): void {
    // Aggregation timer
    this.aggregationTimer = setInterval(() => {
      this.computeAggregates();
    }, this.config.aggregationInterval);
    
    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, this.config.retentionPeriod / 10); // Check more frequently
    
    // Memory monitoring timer
    if (this.config.memoryCheckInterval) {
      this.memoryTimer = setInterval(() => {
        this.recordMemoryUsage();
      }, this.config.memoryCheckInterval);
    }
  }
  
  /**
   * Stop background timers
   */
  private stopTimers(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    if (this.memoryTimer) {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
    }
  }
  
  /**
   * Check if should sample this operation
   */
  private shouldSample(): boolean {
    if (!this.config.enabled) return false;
    if (this.config.sampleRate >= 1.0) return true;
    return Math.random() < this.config.sampleRate;
  }
  
  /**
   * Start timing an operation
   */
  startOperation(name: string, tags?: Record<string, string>): string {
    if (!this.shouldSample()) {
      return '';
    }
    
    const operationId = `${name}_${++this.operationCounter}_${Date.now()}`;
    
    const operation: OperationTimer = {
      name,
      startTime: performance.now(),
      children: new Map(),
    };
    
    if (tags) {
      operation.tags = tags;
    }
    
    this.activeOperations.set(operationId, operation);
    
    return operationId;
  }
  
  /**
   * Start a child operation
   */
  startChildOperation(
    parentId: string,
    childName: string,
    tags?: Record<string, string>
  ): string {
    const parent = this.activeOperations.get(parentId);
    if (!parent) return '';
    
    const childId = `${childName}_${++this.operationCounter}_${Date.now()}`;
    
    const childOperation: OperationTimer = {
      name: childName,
      startTime: performance.now(),
      children: new Map(),
    };
    
    if (tags) {
      childOperation.tags = tags;
    }
    
    parent.children.set(childId, childOperation);
    
    return childId;
  }
  
  /**
   * End an operation and record its duration
   */
  endOperation(operationId: string, metadata?: Record<string, unknown>): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    
    operation.endTime = performance.now();
    const duration = operation.endTime - operation.startTime;
    
    // Record metric
    const metric: MetricPoint = {
      type: MetricType.OPERATION_DURATION,
      name: operation.name,
      value: duration,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        childCount: operation.children.size,
      },
    };
    
    if (operation.tags) {
      metric.tags = operation.tags;
    }
    
    this.recordMetric(metric);
    
    // Check for slow operations
    if (duration > this.config.slowThreshold) {
      this.handleSlowOperation(operation, duration);
    }
    
    // Clean up
    this.activeOperations.delete(operationId);
  }
  
  /**
   * Record a metric
   */
  recordMetric(metric: MetricPoint): void {
    if (!this.config.enabled) return;
    
    const key = this.getMetricKey(metric);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(metric);
  }
  
  /**
   * Record token usage
   */
  recordTokenUsage(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number
  ): void {
    this.recordMetric({
      type: MetricType.TOKEN_USAGE,
      name: 'token_usage',
      value: totalTokens,
      timestamp: new Date(),
      tags: { provider, model },
      metadata: { inputTokens, outputTokens },
    });
  }
  
  /**
   * Record an error
   */
  recordError(
    errorType: string,
    operation: string,
    isRetryable: boolean
  ): void {
    this.recordMetric({
      type: MetricType.ERROR_RATE,
      name: 'error',
      value: 1,
      timestamp: new Date(),
      tags: { errorType, operation },
      metadata: { isRetryable },
    });
  }
  
  /**
   * Record a retry
   */
  recordRetry(
    operation: string,
    attemptNumber: number,
    reason: string
  ): void {
    this.recordMetric({
      type: MetricType.RETRY_COUNT,
      name: 'retry',
      value: attemptNumber,
      timestamp: new Date(),
      tags: { operation, reason },
    });
  }
  
  /**
   * Record cache hit/miss
   */
  recordCacheAccess(hit: boolean, cacheType: string): void {
    this.recordMetric({
      type: MetricType.CACHE_HIT,
      name: 'cache_access',
      value: hit ? 1 : 0,
      timestamp: new Date(),
      tags: { cacheType, result: hit ? 'hit' : 'miss' },
    });
  }
  
  /**
   * Record memory usage
   */
  private recordMemoryUsage(): void {
    const usage = process.memoryUsage();
    
    this.recordMetric({
      type: MetricType.MEMORY_USAGE,
      name: 'memory_heap_used',
      value: usage.heapUsed,
      timestamp: new Date(),
      metadata: {
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss,
      },
    });
  }
  
  /**
   * Handle slow operation detection
   */
  private handleSlowOperation(operation: OperationTimer, duration: number): void {
    console.warn(`Slow operation detected: ${operation.name} took ${duration.toFixed(2)}ms`);
    
    // Log child operations if any
    if (operation.children.size > 0) {
      const childDurations = Array.from(operation.children.values())
        .filter(child => child.endTime)
        .map(child => ({
          name: child.name,
          duration: child.endTime! - child.startTime,
        }))
        .sort((a, b) => b.duration - a.duration);
      
      console.warn('Slowest child operations:', childDurations.slice(0, 3));
    }
  }
  
  /**
   * Get metric key for grouping
   */
  private getMetricKey(metric: MetricPoint): string {
    const tags = metric.tags ? Object.entries(metric.tags).sort().map(([k, v]) => `${k}=${v}`).join(',') : '';
    return `${metric.type}:${metric.name}:${tags}`;
  }
  
  /**
   * Compute aggregated statistics
   */
  private computeAggregates(): void {
    for (const [key, points] of this.metrics.entries()) {
      if (points.length === 0) continue;
      
      const values = points.map(p => p.value).sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      
      // Compute standard deviation
      const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(avgSquaredDiff);
      
      const min = values[0] ?? 0;
      const max = values[values.length - 1] ?? 0;
      const median = values[Math.floor(values.length / 2)] ?? 0;
      const p95 = values[Math.floor(values.length * 0.95)] ?? 0;
      const p99 = values[Math.floor(values.length * 0.99)] ?? 0;
      
      this.aggregatedStats.set(key, {
        count: values.length,
        sum,
        min,
        max,
        mean,
        median,
        p95,
        p99,
        stdDev,
      });
    }
  }
  
  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    
    for (const [key, points] of this.metrics.entries()) {
      const filtered = points.filter(p => p.timestamp.getTime() > cutoff);
      
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else if (filtered.length < points.length) {
        this.metrics.set(key, filtered);
      }
    }
  }
  
  /**
   * Get current statistics
   */
  getStats(metricName?: string): Map<string, MetricStats> {
    if (metricName) {
      const filtered = new Map<string, MetricStats>();
      for (const [key, stats] of this.aggregatedStats.entries()) {
        if (key.includes(metricName)) {
          filtered.set(key, stats);
        }
      }
      return filtered;
    }
    
    return new Map(this.aggregatedStats);
  }
  
  /**
   * Get recent metrics
   */
  getRecentMetrics(
    type?: MetricType,
    limit: number = 100
  ): MetricPoint[] {
    const results: MetricPoint[] = [];
    
    for (const points of this.metrics.values()) {
      for (const point of points) {
        if (!type || point.type === type) {
          results.push(point);
        }
      }
    }
    
    return results
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
  
  /**
   * Get performance summary
   */
  getSummary(): {
    uptime: number;
    totalOperations: number;
    activeOperations: number;
    errorRate: number;
    avgResponseTime: number;
    totalTokens: number;
    memoryUsage: number;
  } {
    const uptime = Date.now() - this.startTime;
    const activeOperations = this.activeOperations.size;
    
    // Calculate error rate
    const errorMetrics = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.type === MetricType.ERROR_RATE);
    const errorRate = errorMetrics.length / Math.max(1, this.operationCounter);
    
    // Calculate average response time
    const durationMetrics = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.type === MetricType.OPERATION_DURATION);
    const avgResponseTime = durationMetrics.length > 0
      ? durationMetrics.reduce((sum, m) => sum + m.value, 0) / durationMetrics.length
      : 0;
    
    // Calculate total tokens
    const tokenMetrics = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.type === MetricType.TOKEN_USAGE);
    const totalTokens = tokenMetrics.reduce((sum, m) => sum + m.value, 0);
    
    // Get current memory usage
    const memoryUsage = process.memoryUsage().heapUsed;
    
    return {
      uptime,
      totalOperations: this.operationCounter,
      activeOperations,
      errorRate,
      avgResponseTime,
      totalTokens,
      memoryUsage,
    };
  }
  
  /**
   * Export metrics in a specific format
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        summary: this.getSummary(),
        stats: Array.from(this.getStats().entries()).map(([key, stats]) => ({
          key,
          ...stats,
        })),
        recentMetrics: this.getRecentMetrics(),
      }, null, 2);
    }
    
    // Prometheus format
    const lines: string[] = [];
    const summary = this.getSummary();
    
    lines.push(`# HELP persuader_uptime_seconds System uptime in seconds`);
    lines.push(`# TYPE persuader_uptime_seconds gauge`);
    lines.push(`persuader_uptime_seconds ${summary.uptime / 1000}`);
    
    lines.push(`# HELP persuader_operations_total Total number of operations`);
    lines.push(`# TYPE persuader_operations_total counter`);
    lines.push(`persuader_operations_total ${summary.totalOperations}`);
    
    lines.push(`# HELP persuader_error_rate Current error rate`);
    lines.push(`# TYPE persuader_error_rate gauge`);
    lines.push(`persuader_error_rate ${summary.errorRate}`);
    
    return lines.join('\n');
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.activeOperations.clear();
    this.aggregatedStats.clear();
    this.operationCounter = 0;
    this.startTime = Date.now();
  }
  
  /**
   * Shutdown the monitor
   */
  shutdown(): void {
    this.stopTimers();
    this.reset();
  }
}

/**
 * Global performance monitor instance
 */
let globalMonitor: PerformanceMonitor | null = null;

/**
 * Get the global performance monitor
 */
export function getGlobalPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
  }
  return globalMonitor;
}

/**
 * Set the global performance monitor
 */
export function setGlobalPerformanceMonitor(monitor: PerformanceMonitor): void {
  globalMonitor = monitor;
}

/**
 * Helper to start timing an operation
 */
export function startTimer(name: string, tags?: Record<string, string>): string {
  return getGlobalPerformanceMonitor().startOperation(name, tags);
}

/**
 * Helper to end timing an operation
 */
export function endTimer(operationId: string, metadata?: Record<string, any>): void {
  getGlobalPerformanceMonitor().endOperation(operationId, metadata);
}

/**
 * Helper decorator for timing functions
 */
export function timed(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const monitor = getGlobalPerformanceMonitor();
      const operationName = name || `${target.constructor.name}.${propertyKey}`;
      const timerId = monitor.startOperation(operationName);
      
      try {
        const result = await originalMethod.apply(this, args);
        monitor.endOperation(timerId, { success: true });
        return result;
      } catch (error) {
        monitor.endOperation(timerId, { success: false, error: (error as any).message || 'Unknown error' });
        throw error;
      }
    };
    
    return descriptor;
  };
}