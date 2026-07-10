/**
 * Error Utilities
 * Provides consistent, professional error messages — never expose Firebase/SDK jargon.
 */

const FIREBASE_NOISE = [
  /firebase/i,
  /firestore/i,
  /cloud[_ ]?firestore/i,
  /missing or insufficient permissions/i,
  /permission[- ]denied/i,
  /failed-precondition/i,
  /requires an index/i,
  /the query requires an index/i,
  /firebaseerror/i,
  /auth\//i,
  /functions\//i,
  /storage\//i,
  /https:\/\/console\.firebase/i,
  /https:\/\/console\.cloud\.google/i,
  /rpc error/i,
  /grpc/i,
  /status\s*=\s*['"]?PERMISSION_DENIED/i,
  /code=permission-denied/i,
  /\[code=/i,
];

const looksTechnical = (message: string): boolean => {
  if (!message || !message.trim()) return true;
  return FIREBASE_NOISE.some((re) => re.test(message));
};

/**
 * Get user-friendly error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  return getFirebaseErrorMessage(error);
};

/**
 * Get a professional, user-facing error message.
 * Never returns raw Firebase / Firestore / Auth SDK text.
 */
export const getFirebaseErrorMessage = (error: unknown, fallback?: string): string => {
  const defaultFallback = fallback || 'Something went wrong. Please try again.';

  if (error == null) {
    return defaultFallback;
  }

  if (typeof error === 'string') {
    return looksTechnical(error) ? defaultFallback : error;
  }

  const err = error as Record<string, any>;
  const errorCode = String(err.code || err.error?.code || '').replace(/^firestore\//i, '');
  const rawMessage = String(err.message || err.error?.message || '');

  // Firebase Auth errors
  if (errorCode.startsWith('auth/')) {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with these credentials.';
      case 'auth/wrong-password':
      case 'auth/invalid-login-credentials':
        return 'Incorrect email or password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email is already registered.';
      case 'auth/weak-password':
        return 'Please choose a stronger password (at least 6 characters).';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/invalid-verification-code':
        return 'Invalid verification code. Please try again.';
      case 'auth/code-expired':
        return 'Verification code has expired. Please request a new one.';
      case 'auth/popup-blocked':
        return 'Sign-in popup was blocked. Allow popups for this site and try again.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled. Please try again.';
      case 'auth/account-exists-with-different-credential':
        return 'This email is already registered with a different sign-in method.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized for sign-in. Please contact support.';
      case 'auth/operation-not-supported-in-this-environment':
        return 'This sign-in method is not supported in your browser.';
      case 'auth/invalid-credential':
        return 'Sign-in failed. Please check your credentials and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact an administrator.';
      case 'auth/requires-recent-login':
        return 'For security, please sign in again before continuing.';
      case 'auth/expired-action-code':
        return 'This link has expired. Please request a new one.';
      case 'auth/invalid-action-code':
        return 'This link is invalid or has already been used.';
      default:
        return 'Authentication failed. Please try again.';
    }
  }

  // Firestore / permission
  if (
    errorCode === 'permission-denied' ||
    errorCode.includes('permission-denied') ||
    /missing or insufficient permissions/i.test(rawMessage)
  ) {
    return 'You do not have permission to perform this action.';
  }

  if (
    errorCode === 'failed-precondition' ||
    /requires an index/i.test(rawMessage)
  ) {
    return 'This feature is still being set up. Please try again in a few minutes.';
  }

  if (errorCode === 'not-found' || errorCode.startsWith('not-found')) {
    return 'The requested item could not be found.';
  }

  if (errorCode === 'already-exists') {
    return 'This item already exists.';
  }

  if (errorCode === 'resource-exhausted' || errorCode === 'quota-exceeded') {
    return 'Service limit reached. Please try again later.';
  }

  if (errorCode === 'unavailable' || errorCode.startsWith('unavailable')) {
    return 'Service temporarily unavailable. Please try again shortly.';
  }

  if (errorCode === 'deadline-exceeded' || errorCode === 'cancelled') {
    return 'The request timed out. Please try again.';
  }

  if (errorCode === 'aborted' || errorCode === 'conflict') {
    return 'This action conflicted with another update. Please refresh and try again.';
  }

  if (errorCode === 'invalid-argument' || errorCode === 'out-of-range') {
    return 'Some of the information provided is invalid. Please check and try again.';
  }

  if (errorCode === 'unauthenticated') {
    return 'Your session has expired. Please sign in again.';
  }

  // Storage
  if (errorCode.startsWith('storage/')) {
    switch (errorCode) {
      case 'storage/unauthorized':
        return 'You do not have permission to upload this file.';
      case 'storage/canceled':
        return 'Upload was cancelled.';
      case 'storage/quota-exceeded':
        return 'Storage limit reached. Please contact support.';
      case 'storage/object-not-found':
        return 'The file could not be found.';
      case 'storage/retry-limit-exceeded':
        return 'Upload failed after several attempts. Please try again.';
      default:
        return 'File upload failed. Please try again.';
    }
  }

  // Cloud Functions
  if (errorCode.startsWith('functions/')) {
    switch (errorCode) {
      case 'functions/unauthenticated':
        return 'Please sign in to continue.';
      case 'functions/permission-denied':
        return 'You do not have permission to perform this action.';
      case 'functions/not-found':
        return 'The requested service is unavailable.';
      case 'functions/deadline-exceeded':
        return 'The request timed out. Please try again.';
      case 'functions/resource-exhausted':
        return 'Too many requests. Please try again later.';
      case 'functions/invalid-argument':
        return 'Invalid request. Please check your input and try again.';
      case 'functions/already-exists':
        return 'This item already exists.';
      case 'functions/failed-precondition':
        return 'This action cannot be completed right now.';
      case 'functions/internal':
        return 'A server error occurred. Please try again later.';
      default:
        return 'Unable to complete this request. Please try again.';
    }
  }

  // Razorpay
  if (errorCode === 'BAD_REQUEST_ERROR') {
    return 'Invalid payment request. Please check your details.';
  }
  if (errorCode === 'GATEWAY_ERROR') {
    return 'Payment gateway error. Please try again.';
  }
  if (errorCode === 'SERVER_ERROR') {
    return 'Payment server error. Please try again later.';
  }

  // Network
  if (
    /network/i.test(rawMessage) ||
    /failed to fetch/i.test(rawMessage) ||
    /networkerror/i.test(rawMessage) ||
    err.name === 'NetworkError'
  ) {
    return 'Network error. Please check your internet connection.';
  }

  // App-thrown Error with a clean message — keep it
  if (error instanceof Error && rawMessage && !looksTechnical(rawMessage)) {
    return rawMessage;
  }

  // Object with a clean message
  if (rawMessage && !looksTechnical(rawMessage)) {
    return rawMessage;
  }

  return defaultFallback;
};

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      /network/i.test(error.message) ||
      /failed to fetch/i.test(error.message) ||
      /fetch/i.test(error.message)
    );
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    return code.includes('network') || code.includes('unavailable');
  }

  return false;
};

/**
 * Check if error is a permission error
 */
export const isPermissionError = (error: unknown): boolean => {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    return code.includes('permission') || code.includes('unauthorized');
  }

  if (error instanceof Error) {
    return /permission|unauthorized/i.test(error.message);
  }

  return false;
};

/**
 * Format error for logging (keeps technical detail for developers)
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

      if (isPermissionError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};
