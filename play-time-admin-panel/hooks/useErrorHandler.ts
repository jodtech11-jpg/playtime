import { useCallback } from 'react';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage, getFirebaseErrorMessage, isNetworkError, retryWithBackoff } from '../utils/errorUtils';

interface UseErrorHandlerOptions {
  showToast?: boolean;
  logError?: boolean;
  retry?: boolean;
  maxRetries?: number;
}

export const useErrorHandler = (options: UseErrorHandlerOptions = {}) => {
  const { showError, showSuccess } = useToast();
  const {
    showToast = true,
    logError = true,
    retry = false,
    maxRetries = 3,
  } = options;

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const errorMessage = getFirebaseErrorMessage(error) || getErrorMessage(error);

      if (logError) {
        console.error(`[${context || 'Error'}]`, error);
      }

      if (showToast) {
        showError(errorMessage);
      }

      return errorMessage;
    },
    [showError, showToast, logError]
  );

  const handleAsyncError = useCallback(
    async <T>(
      asyncFn: () => Promise<T>,
      context?: string,
      onSuccess?: (result: T) => void,
      successMessage?: string
    ): Promise<T | null> => {
      try {
        const result = retry
          ? await retryWithBackoff(asyncFn, maxRetries)
          : await asyncFn();

        if (onSuccess) {
          onSuccess(result);
        }

        if (successMessage) {
          showSuccess(successMessage);
        }

        return result;
      } catch (error) {
        handleError(error, context);
        return null;
      }
    },
    [handleError, showSuccess, retry, maxRetries]
  );

  return {
    handleError,
    handleAsyncError,
  };
};

