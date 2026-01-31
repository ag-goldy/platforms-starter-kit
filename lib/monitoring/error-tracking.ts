/**
 * Error tracking integration
 * 
 * Wrapper for error tracking with correlation IDs
 * 
 * Note: Sentry integration can be added by installing @sentry/nextjs
 * and updating this file to use Sentry APIs. For now, errors are logged
 * to console with structured context.
 */

export interface ErrorContext {
  userId?: string;
  orgId?: string;
  ticketId?: string;
  action?: string;
  correlationId?: string;
  [key: string]: unknown;
}

type SentryScope = {
  setUser?: (user: { id?: string; email?: string; username?: string }) => void;
  setTag?: (key: string, value: string) => void;
};

type SentryModule = {
  withScope?: (callback: (scope: SentryScope) => void) => void;
  captureException?: (error: unknown) => void;
  captureMessage?: (message: string, level?: string) => void;
  setUser?: (user: { id?: string; email?: string; username?: string } | null) => void;
};

let sentryModule: SentryModule | null | undefined;

function loadSentry(): SentryModule | null {
  if (sentryModule !== undefined) {
    return sentryModule;
  }
  try {
    // eslint-disable-next-line no-eval
    const req = eval('require') as (id: string) => SentryModule;
    sentryModule = req('@sentry/nextjs');
  } catch {
    sentryModule = null;
  }
  return sentryModule;
}

/**
 * Track an error with context
 */
export async function trackError(
  error: Error | unknown,
  context?: ErrorContext
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const logData = {
    level: 'error',
    message: errorMessage,
    stack: errorStack,
    ...context,
    timestamp: new Date().toISOString(),
  };
  
  // Log to console (can be replaced with Sentry when installed)
  if (process.env.NODE_ENV === 'production') {
    console.error(JSON.stringify(logData));
  } else {
    console.error('[Error Tracking]', logData);
  }
  
  // Sentry integration (optional - only if @sentry/nextjs is installed)
  try {
    const Sentry = loadSentry();
    if (Sentry?.withScope) {
      Sentry.withScope((scope) => {
        if (context?.userId && scope.setUser) {
          scope.setUser({ id: context.userId });
        }
        if (context?.correlationId && scope.setTag) {
          scope.setTag('correlationId', context.correlationId);
        }
        Sentry.captureException?.(error);
      });
    }
  } catch {
    // Sentry not installed - that's okay, we'll just use console logging
  }
}

/**
 * Track a message (non-error event)
 */
export async function trackMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): Promise<void> {
  const logData = {
    level,
    message,
    ...context,
    timestamp: new Date().toISOString(),
  };
  
  // Log to console (can be replaced with Sentry when installed)
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(logData));
  } else {
    const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logFn(`[${level.toUpperCase()}]`, logData);
  }
  
  // Sentry integration (optional - only if @sentry/nextjs is installed)
  try {
    const Sentry = loadSentry();
    if (Sentry?.captureMessage) {
      Sentry.captureMessage(
        message,
        level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info'
      );
    }
  } catch {
    // Sentry not installed - that's okay, we'll just use console logging
  }
}

/**
 * Set user context for current scope
 */
export async function setErrorTrackingUser(userId: string, email?: string, name?: string): Promise<void> {
  try {
    const Sentry = loadSentry();
    if (Sentry?.setUser) {
      Sentry.setUser({ id: userId, email, username: name });
    }
  } catch {
    // Sentry not installed - that's okay
  }
}

/**
 * Clear user context
 */
export async function clearErrorTrackingUser(): Promise<void> {
  try {
    const Sentry = loadSentry();
    if (Sentry?.setUser) {
      Sentry.setUser(null);
    }
  } catch {
    // Sentry not installed - that's okay
  }
}
