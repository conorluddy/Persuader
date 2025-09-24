/**
 * JSONL Rotation Module
 * 
 * Enhanced JSONL file writer with automatic rotation, compression,
 * and 7-day cleanup policy. Ensures logs don't consume excessive disk space
 * while maintaining audit trails.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream, type WriteStream } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';

/**
 * Configuration for JSONL rotation
 */
export interface RotationConfig {
  logsDirectory: string;
  maxFileSize: number; // Bytes
  maxFiles: number;
  maxAge: number; // Days
  compress: boolean;
  compressionLevel?: number; // 1-9, higher = better compression
  prefix?: string;
  autoCleanup?: boolean;
  cleanupInterval?: number; // Ms, how often to check for old files
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  category?: string;
  message: string;
  context?: Record<string, any>;
  sessionId?: string;
  requestId?: string;
  source?: string;
}

/**
 * File metadata for rotation tracking
 */
interface FileMetadata {
  path: string;
  size: number;
  createdAt: Date;
  isCompressed: boolean;
  index: number;
}

/**
 * JSONL writer with rotation and cleanup
 */
export class JSONLRotationWriter {
  private config: Required<RotationConfig>;
  private currentStream: WriteStream | null = null;
  private currentFile: FileMetadata | null = null;
  private fileIndex: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private writeQueue: LogEntry[] = [];
  private isWriting: boolean = false;
  
  constructor(config: RotationConfig) {
    this.config = {
      logsDirectory: config.logsDirectory,
      maxFileSize: config.maxFileSize,
      maxFiles: config.maxFiles,
      maxAge: config.maxAge,
      compress: config.compress,
      compressionLevel: config.compressionLevel ?? 6,
      prefix: config.prefix ?? 'persuader',
      autoCleanup: config.autoCleanup ?? true,
      cleanupInterval: config.cleanupInterval ?? 3600000, // 1 hour default
    };
  }
  
  /**
   * Initialize the writer
   */
  async initialize(): Promise<void> {
    // Ensure logs directory exists
    await fs.mkdir(this.config.logsDirectory, { recursive: true });
    
    // Find the next available index
    await this.findNextIndex();
    
    // Create initial file
    await this.createNewFile();
    
    // Start cleanup timer if enabled
    if (this.config.autoCleanup) {
      this.startCleanupTimer();
    }
  }
  
  /**
   * Find the next available file index
   */
  private async findNextIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logsDirectory);
      const pattern = new RegExp(`^${this.config.prefix}\\.(\\d+)\\.jsonl(?:\\.gz)?$`);
      
      let maxIndex = -1;
      for (const file of files) {
        const match = pattern.exec(file);
        if (match) {
          const index = parseInt(match[1], 10);
          if (index > maxIndex) {
            maxIndex = index;
          }
        }
      }
      
      this.fileIndex = maxIndex + 1;
    } catch {
      this.fileIndex = 0;
    }
  }
  
  /**
   * Create a new log file
   */
  private async createNewFile(): Promise<void> {
    // Close current file if open
    await this.closeCurrentFile();
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${this.config.prefix}.${this.fileIndex}.${timestamp}.jsonl`;
    const filePath = path.join(this.config.logsDirectory, filename);
    
    // Create write stream
    this.currentStream = createWriteStream(filePath, { flags: 'a' });
    
    // Track metadata
    this.currentFile = {
      path: filePath,
      size: 0,
      createdAt: new Date(),
      isCompressed: false,
      index: this.fileIndex,
    };
    
    this.fileIndex++;
  }
  
  /**
   * Close current file
   */
  private async closeCurrentFile(): Promise<void> {
    if (this.currentStream) {
      await new Promise<void>((resolve, reject) => {
        this.currentStream!.end((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      this.currentStream = null;
      
      // Compress if configured and file is complete
      if (this.config.compress && this.currentFile && !this.currentFile.isCompressed) {
        await this.compressFile(this.currentFile.path);
      }
    }
  }
  
  /**
   * Compress a log file
   */
  private async compressFile(filePath: string): Promise<void> {
    const compressedPath = `${filePath}.gz`;
    
    try {
      const source = createReadStream(filePath);
      const destination = createWriteStream(compressedPath);
      const gzip = createGzip({ level: this.config.compressionLevel });
      
      await pipeline(source, gzip, destination);
      
      // Remove original file after successful compression
      await fs.unlink(filePath);
      
      // Update metadata
      if (this.currentFile && this.currentFile.path === filePath) {
        this.currentFile.path = compressedPath;
        this.currentFile.isCompressed = true;
      }
    } catch (error) {
      console.error(`Failed to compress log file ${filePath}:`, error);
    }
  }
  
  /**
   * Write a log entry
   */
  async writeEntry(entry: LogEntry): Promise<void> {
    // Add to queue
    this.writeQueue.push(entry);
    
    // Process queue if not already processing
    if (!this.isWriting) {
      await this.processQueue();
    }
  }
  
  /**
   * Process write queue
   */
  private async processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }
    
    this.isWriting = true;
    
    try {
      while (this.writeQueue.length > 0) {
        const entry = this.writeQueue.shift()!;
        await this.writeEntryInternal(entry);
      }
    } finally {
      this.isWriting = false;
    }
  }
  
  /**
   * Internal write implementation
   */
  private async writeEntryInternal(entry: LogEntry): Promise<void> {
    if (!this.currentStream || !this.currentFile) {
      await this.createNewFile();
    }
    
    const line = JSON.stringify(entry) + '\n';
    const bytes = Buffer.byteLength(line);
    
    // Check if rotation is needed
    if (this.currentFile!.size + bytes > this.config.maxFileSize) {
      await this.rotate();
    }
    
    // Write to current file
    if (this.currentStream && this.currentFile) {
      await new Promise<void>((resolve, reject) => {
        this.currentStream!.write(line, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      this.currentFile.size += bytes;
    }
  }
  
  /**
   * Rotate log files
   */
  private async rotate(): Promise<void> {
    await this.closeCurrentFile();
    await this.createNewFile();
    await this.enforceMaxFiles();
  }
  
  /**
   * Enforce maximum number of files
   */
  private async enforceMaxFiles(): Promise<void> {
    try {
      const files = await this.getLogFiles();
      
      // Sort by creation time (oldest first)
      files.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      // Remove excess files
      while (files.length > this.config.maxFiles) {
        const oldFile = files.shift()!;
        try {
          await fs.unlink(oldFile.path);
        } catch (error) {
          console.error(`Failed to delete old log file ${oldFile.path}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to enforce max files:', error);
    }
  }
  
  /**
   * Get all log files with metadata
   */
  private async getLogFiles(): Promise<FileMetadata[]> {
    const files: FileMetadata[] = [];
    
    try {
      const entries = await fs.readdir(this.config.logsDirectory);
      const pattern = new RegExp(`^${this.config.prefix}\\.(\\d+)\\..*\\.jsonl(?:\\.gz)?$`);
      
      for (const entry of entries) {
        const match = pattern.exec(entry);
        if (match) {
          const filePath = path.join(this.config.logsDirectory, entry);
          const stats = await fs.stat(filePath);
          
          files.push({
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            isCompressed: entry.endsWith('.gz'),
            index: parseInt(match[1], 10),
          });
        }
      }
    } catch (error) {
      console.error('Failed to get log files:', error);
    }
    
    return files;
  }
  
  /**
   * Clean up old log files
   */
  async cleanupOldFiles(): Promise<number> {
    const maxAgeMs = this.config.maxAge * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;
    let deletedCount = 0;
    
    try {
      const files = await this.getLogFiles();
      
      for (const file of files) {
        if (file.createdAt.getTime() < cutoffTime) {
          try {
            await fs.unlink(file.path);
            deletedCount++;
          } catch (error) {
            console.error(`Failed to delete expired log file ${file.path}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old files:', error);
    }
    
    return deletedCount;
  }
  
  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      const deleted = await this.cleanupOldFiles();
      if (deleted > 0) {
        console.log(`Cleaned up ${deleted} old log file(s)`);
      }
    }, this.config.cleanupInterval);
    
    // Run cleanup immediately on start
    this.cleanupOldFiles().catch(console.error);
  }
  
  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
  
  /**
   * Get statistics about log files
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: Date;
    newestFile?: Date;
    compressedFiles: number;
    uncompressedFiles: number;
  }> {
    const files = await this.getLogFiles();
    
    if (files.length === 0) {
      return {
        totalFiles: 0,
        totalSize: 0,
        compressedFiles: 0,
        uncompressedFiles: 0,
      };
    }
    
    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      oldestFile: files.reduce((oldest, f) => 
        f.createdAt < oldest ? f.createdAt : oldest, 
        files[0].createdAt
      ),
      newestFile: files.reduce((newest, f) => 
        f.createdAt > newest ? f.createdAt : newest, 
        files[0].createdAt
      ),
      compressedFiles: files.filter(f => f.isCompressed).length,
      uncompressedFiles: files.filter(f => !f.isCompressed).length,
    };
    
    return stats;
  }
  
  /**
   * Search logs for specific patterns
   */
  async search(options: {
    pattern?: RegExp;
    startTime?: Date;
    endTime?: Date;
    sessionId?: string;
    requestId?: string;
    level?: string;
    limit?: number;
  }): Promise<LogEntry[]> {
    const results: LogEntry[] = [];
    const files = await this.getLogFiles();
    
    // Filter files by time range if specified
    const relevantFiles = files.filter(f => {
      if (options.startTime && f.createdAt < options.startTime) return false;
      if (options.endTime && f.createdAt > options.endTime) return false;
      return true;
    });
    
    // Placeholder for implementation
    void relevantFiles; // Mark as intentionally unused
    
    return results.slice(0, options.limit ?? 100);
  }
  
  /**
   * Close the writer and cleanup
   */
  async close(): Promise<void> {
    // Stop cleanup timer
    this.stopCleanupTimer();
    
    // Process remaining queue
    await this.processQueue();
    
    // Close current file
    await this.closeCurrentFile();
  }
}

/**
 * Create a rotation writer with default settings
 */
export function createRotationWriter(config?: Partial<RotationConfig>): JSONLRotationWriter {
  return new JSONLRotationWriter({
    logsDirectory: config?.logsDirectory ?? './logs',
    maxFileSize: config?.maxFileSize ?? 10485760, // 10MB
    maxFiles: config?.maxFiles ?? 10,
    maxAge: config?.maxAge ?? 7,
    compress: config?.compress ?? true,
    compressionLevel: config?.compressionLevel ?? 6,
    prefix: config?.prefix ?? 'persuader',
    autoCleanup: config?.autoCleanup ?? true,
    cleanupInterval: config?.cleanupInterval ?? 3600000,
  });
}

// Fix missing import
import { createReadStream } from 'fs';