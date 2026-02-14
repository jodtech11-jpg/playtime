/**
 * Error Utilities
 * Provides consistent error message formatting and handling
 */

/**
 * Get user-friendly error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Get user-friendly error message for Firebase errors
 */
export const getFirebaseErrorMessage = (error: any): string => {
  if (!error) {
    return 'An unexpected error occurred.';
  }

  const errorCode = error.code || error.error?.code || '';
  const errorMessage = error.message || error.error?.message || '';

  // Firebase Auth errors
  if (errorCode.startsWith('auth/')) {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'User account not found.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use a stronger password.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many requests. Please try again later.';
      case 'auth/invalid-verification-code':
        return 'Invalid OTP code. Please try again.';
      case 'auth/code-expired':
        return 'OTP code has expired. Please request a new one.';
      default:
        return errorMessage || 'Authentication error. Please try again.';
    }
  }

  // Firestore errors
  if (errorCode.startsWith('permission-denied')) {
    return 'You do not have permission to perform this action.';
  }

  if (errorCode.startsWith('not-found')) {
    return 'The requested resource was not found.';
  }

  if (errorCode.startsWith('unavailable')) {
    return 'Service temporarily unavailable. Please try again later.';
  }

  if (errorCode.startsWith('deadline-exceeded')) {
    return 'Request timed out. Please try again.';
  }

  // Razorpay errors
  if (errorCode === 'BAD_REQUEST_ERROR') {
    return 'Invalid payment request. Please check your details.';
  }

  if (errorCode === 'GATEWAY_ERROR') {
    return 'Payment gateway error. Please try again.';
  }

  if (errorCode === 'SERVER_ERROR') {
    return 'Payment server error. Please try again later.';
  }

  // Generic error message
  if (errorMessage) {
    return errorMessage;
  }

  return 'An unexpected error occurred. Please try again.';
};

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message.includes('network') ||
      error.message.includes('Network') ||
      error.message.includes('fetch') ||
      error.message.includes('Failed to fetch')
    );
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    return code.includes('network') || code.includes('unavailable');
  }

  return false;
};

/**
 * Check if error is a permission error
 */
export const isPermissionError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    return code.includes('permission') || code.includes('unauthorized');
  }

  return false;
};

/**
 * Format error for logging
 */
export const formatErrorForLogging = (error: unknown, context?: string): string => {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}] ` : '';
  const errorStr = error instanceof Error ? error.stack || error.message : String(error);
  return `${timestamp} ${contextStr}${errorStr}`;
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on permission errors
      if (isPermissionError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying (exponential backoff)
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

