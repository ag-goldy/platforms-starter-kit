/**
 * Format error messages for user display
 * Never exposes internal error details
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Check for known error types
    if (error.message.includes('Unauthorized') || error.message.includes('authorization')) {
      return 'You do not have permission to perform this action.';
    }

    if (error.message.includes('not found') || error.message.includes('404')) {
      return 'The requested resource was not found.';
    }

    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return 'Please check your input and try again.';
    }

    const lowerMessage = error.message.toLowerCase();
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    // For development, show more details (remove in production)
    if (process.env.NODE_ENV === 'development') {
      return error.message;
    }
  }

  // Generic fallback - never expose internal errors
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if an error is a known user-facing error
 */
export function isUserFacingError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('required') ||
      message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('permission') ||
      message.includes('unauthorized')
    );
  }
  return false;
}

/**
 * Extract error code from error if available
 */
export function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code);
  }
  return null;
}

