/**
 * Console Buffer Module
 * 
 * Optimizes console.log performance by batching writes and
 * implementing a write buffer to reduce I/O overhead.
 */

/**
 * Configuration for console buffering
 */
export interface ConsoleBufferConfig {
  /** Maximum buffer size before flush (default: 50) */
  maxBufferSize: number;
  
  /** Maximum time in ms before automatic flush (default: 100ms) */
  flushInterval: number;
  
  /** Enable buffering (default: true in production) */
  enabled: boolean;
}

/**
 * Buffered console writer for optimized performance
 */
export class ConsoleBuffer {
  private readonly config: ConsoleBufferConfig;
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  
  constructor(config: Partial<ConsoleBufferConfig> = {}) {
    this.config = {
      maxBufferSize: config.maxBufferSize ?? 50,
      flushInterval: config.flushInterval ?? 100,
      enabled: config.enabled ?? (process.env.NODE_ENV === 'production'),
    };
  }
  
  /**
   * Write to console with buffering
   * 
   * @param message - Message to write
   */
  write(message: string): void {
    if (!this.config.enabled) {
      // Direct write when buffering disabled
      console.log(message);
      return;
    }
    
    // Add to buffer
    this.buffer.push(message);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush();
    } else {
      // Schedule flush if not already scheduled
      this.scheduleFlush();
    }
  }
  
  /**
   * Schedule an automatic flush
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      return; // Already scheduled
    }
    
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.config.flushInterval);
  }
  
  /**
   * Flush the buffer to console
   */
  flush(): void {
    if (this.isFlushing || this.buffer.length === 0) {
      return;
    }
    
    this.isFlushing = true;
    
    // Clear timer if set
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Batch write all buffered messages
    const messages = this.buffer.splice(0);
    const batchedOutput = messages.join('\n');
    
    try {
      console.log(batchedOutput);
    } finally {
      this.isFlushing = false;
    }
  }
  
  /**
   * Clear the buffer without writing
   */
  clear(): void {
    this.buffer = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
  
  /**
   * Get buffer statistics
   * 
   * @returns Buffer stats
   */
  getStats(): {
    bufferedMessages: number;
    enabled: boolean;
    maxBufferSize: number;
  } {
    return {
      bufferedMessages: this.buffer.length,
      enabled: this.config.enabled,
      maxBufferSize: this.config.maxBufferSize,
    };
  }
}

// Global console buffer instance
let globalBuffer: ConsoleBuffer | null = null;

/**
 * Get the global console buffer
 * 
 * @returns Global console buffer instance
 */
export function getConsoleBuffer(): ConsoleBuffer {
  if (!globalBuffer) {
    globalBuffer = new ConsoleBuffer();
  }
  return globalBuffer;
}

/**
 * Configure the global console buffer
 * 
 * @param config - Buffer configuration
 */
export function configureConsoleBuffer(config: Partial<ConsoleBufferConfig>): void {
  globalBuffer = new ConsoleBuffer(config);
}

/**
 * Flush the global console buffer
 */
export function flushConsoleBuffer(): void {
  getConsoleBuffer().flush();
}