/**
 * Structured Logger Service
 *
 * Provides consistent, structured logging across the application
 * Supports multiple log levels: trace, debug, info, warn, error, fatal
 * Outputs JSON format for easy parsing and aggregation
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

export interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  module?: string;
  requestId?: string;
  userId?: number;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: LogContext;
}

class Logger {
  private minLevel: LogLevel;
  private module: string;

  constructor(module: string = "App") {
    this.module = module;
    const envLevel = process.env.LOG_LEVEL || "info";
    this.minLevel = LogLevel[envLevel.toUpperCase() as keyof typeof LogLevel] ?? LogLevel.INFO;
  }

  /**
   * Create a child logger with a specific module name
   */
  static create(module: string): Logger {
    return new Logger(module);
  }

  /**
   * Log with context (request ID, user ID, etc.)
   */
  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    // Skip if below minimum level
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      module: this.module,
    };
    const requestId = context?.requestId;
    const userId = context?.userId;
    const duration = context?.duration;
    if (requestId) {
      entry.requestId = String(requestId);
    }
    if (typeof userId === "number") {
      entry.userId = userId;
    }
    if (typeof duration === "number") {
      entry.duration = duration;
    }

    // Add error details
    if (error) {
      entry.error = {
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        code: (error as any).code,
      };
    }

    // Add additional metadata
    if (context && Object.keys(context).length > 0) {
      const metadata = { ...context };
      delete metadata.requestId;
      delete metadata.userId;
      delete metadata.duration;
      if (Object.keys(metadata).length > 0) {
        entry.metadata = metadata;
      }
    }

    // Output log
    const output = JSON.stringify(entry);
    this.output(level, output);
  }

  /**
   * Write log to appropriate stream
   */
  private output(level: LogLevel, output: string): void {
    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  // ============================================================================
  // Log Level Methods
  // ============================================================================

  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, "TRACE", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, "DEBUG", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, "INFO", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, "WARN", message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, "ERROR", message, context, error);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, "FATAL", message, context, error);
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Log HTTP request
   */
  logRequest(
    method: string,
    path: string,
    statusCode?: number,
    duration?: number,
    context?: LogContext,
  ): void {
    this.info(
      `${method} ${path} ${statusCode ? `→ ${statusCode}` : ""}`,
      {
        method,
        path,
        statusCode,
        duration,
        ...context,
      },
    );
  }

  /**
   * Log database operation
   */
  logDatabase(
    operation: string,
    table: string,
    duration?: number,
    context?: LogContext,
  ): void {
    this.debug(
      `DB ${operation} ${table}`,
      {
        operation,
        table,
        duration,
        ...context,
      },
    );
  }

  /**
   * Log performance metric
   */
  logPerformance(
    operation: string,
    duration: number,
    context?: LogContext,
  ): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    if (level >= this.minLevel) {
      this.log(level, level === LogLevel.WARN ? "WARN" : "DEBUG", operation, {
        duration,
        ...context,
      });
    }
  }

  /**
   * Log business event
   */
  logEvent(
    eventType: string,
    eventName: string,
    context?: LogContext,
  ): void {
    this.info(`Event: ${eventType} - ${eventName}`, {
      eventType,
      eventName,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = Logger.create("App");

// Export Logger class for creating module-specific loggers
export default Logger;
