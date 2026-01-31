/**
 * Structured logging utility
 * 
 * Provides JSON-structured logs with correlation IDs, user context, and request tracing
 */

import { randomUUID } from 'crypto';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  orgId?: string;
  ticketId?: string;
  action?: string;
  duration?: number;
  status?: string;
  ipAddress?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
}

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Structured logger class
 */
export class Logger {
  private correlationId?: string;
  private context: LogContext;

  constructor(correlationId?: string, initialContext: LogContext = {}) {
    this.correlationId = correlationId || generateCorrelationId();
    this.context = {
      correlationId: this.correlationId,
      ...initialContext,
    };
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger(this.correlationId, {
      ...this.context,
      ...additionalContext,
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
    };

    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorContext.error = String(error);
    }

    this.log('error', message, errorContext);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.context,
        ...context,
      },
    };

    // Output as JSON in production, formatted in development
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      const prefix = `[${logEntry.timestamp}] [${level.toUpperCase()}]`;
      console.log(prefix, message, logEntry.context);
    }
  }

  /**
   * Get the correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId!;
  }
}

/**
 * Create a logger instance
 */
export function createLogger(correlationId?: string, context?: LogContext): Logger {
  return new Logger(correlationId, context);
}

/**
 * Get logger from request headers (for Next.js middleware/API routes)
 */
export function getLoggerFromHeaders(headers: Headers): Logger {
  const correlationId = headers.get('x-correlation-id') || undefined;
  return createLogger(correlationId);
}

