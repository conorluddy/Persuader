/**
 * JSONL File Writer Utility
 *
 * Thread-safe JSONL (JSON Lines) file writer with automatic rotation
 * and directory management for persistent logging.
 */

import { createWriteStream, promises as fs, type WriteStream } from 'node:fs';
import path from 'node:path';

export interface JsonlWriterConfig {
  /** Directory to write log files */
  logsDirectory: string;

  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxFileSize: number;

  /** Maximum number of log files to keep (default: 10) */
  maxFiles: number;

  /** Base filename (default: 'persuader') */
  baseFilename: string;
}

export interface JsonlLogEntry {
  /** ISO timestamp */
  timestamp: string;

  /** Log level */
  level: string;

  /** Log message */
  message: string;

  /** Structured context data */
  context?: Record<string, unknown>;

  /** Request ID for tracing */
  requestId?: string;

  /** Session ID for grouping */
  sessionId?: string;

  /** Source component/module */
  source?: string;
}

/**
 * Thread-safe JSONL writer with automatic file rotation
 */
export class JsonlWriter {
  private config: Required<JsonlWriterConfig>;
  private currentStream: WriteStream | null = null;
  private currentFilePath: string | null = null;
  private currentFileSize: number = 0;
  private writeQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  constructor(config: Partial<JsonlWriterConfig> = {}) {
    this.config = {
      logsDirectory: './logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      baseFilename: 'persuader',
      ...config,
    };
  }

  /**
   * Initialize the writer and ensure directories exist
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.logsDirectory, { recursive: true });
      await this.rotateIfNeeded();
    } catch (error) {
      throw new Error(
        `Failed to initialize JSONL writer: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Write a JSONL entry to the current log file
   */
  async writeEntry(entry: JsonlLogEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push(async () => {
        try {
          await this.ensureStream();
          const jsonLine = `${JSON.stringify(entry)}\n`;
          const buffer = Buffer.from(jsonLine, 'utf8');

          await this.writeToStream(buffer);
          this.currentFileSize += buffer.length;

          // Check if rotation is needed
          if (this.currentFileSize >= this.config.maxFileSize) {
            await this.rotate();
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Close the writer and cleanup resources
   */
  async close(): Promise<void> {
    return new Promise(resolve => {
      this.writeQueue.push(async () => {
        if (this.currentStream) {
          this.currentStream.end();
          this.currentStream = null;
        }
        resolve();
      });

      this.processQueue();
    });
  }

  /**
   * Get the current log file path
   */
  getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  /**
   * Process the write queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.writeQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.writeQueue.length > 0) {
      const writeOp = this.writeQueue.shift();
      if (writeOp) {
        try {
          await writeOp();
        } catch (error) {
          console.error('JSONL write error:', error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Ensure a write stream is available
   */
  private async ensureStream(): Promise<void> {
    if (!this.currentStream || !this.currentFilePath) {
      await this.rotateIfNeeded();
    }
  }

  /**
   * Write buffer to the current stream
   */
  private async writeToStream(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentStream) {
        reject(new Error('No active stream'));
        return;
      }

      this.currentStream.write(buffer, error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Generate a new log file path with timestamp
   */
  private generateFilePath(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .split('T')
      .join('-')
      .slice(0, -5); // Remove milliseconds and Z

    return path.join(
      this.config.logsDirectory,
      `${this.config.baseFilename}-${timestamp}.jsonl`
    );
  }

  /**
   * Get the current file size
   */
  private async getCurrentFileSize(): Promise<number> {
    if (!this.currentFilePath) return 0;

    try {
      const stats = await fs.stat(this.currentFilePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Rotate to a new log file if needed
   */
  private async rotateIfNeeded(): Promise<void> {
    if (!this.currentFilePath) {
      await this.rotate();
      return;
    }

    const currentSize = await this.getCurrentFileSize();
    if (currentSize >= this.config.maxFileSize) {
      await this.rotate();
    }
  }

  /**
   * Rotate to a new log file
   */
  private async rotate(): Promise<void> {
    // Close current stream
    if (this.currentStream) {
      await new Promise<void>(resolve => {
        this.currentStream?.end(() => {
          resolve();
        });
      });
      this.currentStream = null;
    }

    // Clean up old files
    await this.cleanupOldFiles();

    // Create new file
    const newFilePath = this.generateFilePath();
    this.currentFilePath = newFilePath;
    this.currentFileSize = 0;

    // Create new stream
    this.currentStream = createWriteStream(newFilePath, {
      flags: 'a', // append mode
      encoding: 'utf8',
    });

    // Handle stream errors
    this.currentStream.on('error', error => {
      console.error('JSONL stream error:', error);
    });
  }

  /**
   * Clean up old log files beyond maxFiles limit
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logsDirectory);
      const logFiles = files
        .filter(
          file =>
            file.startsWith(this.config.baseFilename) && file.endsWith('.jsonl')
        )
        .map(file => ({
          name: file,
          path: path.join(this.config.logsDirectory, file),
        }));

      // Sort by creation time (newest first)
      const sortedFiles = await Promise.all(
        logFiles.map(async file => {
          const stats = await fs.stat(file.path);
          return { ...file, mtime: stats.mtime };
        })
      );

      sortedFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove files beyond the limit
      const filesToRemove = sortedFiles.slice(this.config.maxFiles);
      for (const file of filesToRemove) {
        try {
          await fs.unlink(file.path);
        } catch (_error) {
          console.warn(`Failed to remove old log file ${file.name}`);
        }
      }
    } catch (_error) {
      console.warn('Failed to cleanup old log files');
    }
  }
}

/**
 * Create a JSONL writer instance with the given configuration
 */
export function createJsonlWriter(
  config?: Partial<JsonlWriterConfig>
): JsonlWriter {
  return new JsonlWriter(config);
}
