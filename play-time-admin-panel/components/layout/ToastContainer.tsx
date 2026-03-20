import React from 'react';
import { useToast } from '../../contexts/ToastContext';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/50',
          border: 'border-emerald-200 dark:border-emerald-800',
          text: 'text-emerald-800 dark:text-emerald-100',
          icon: 'check_circle',
          iconColor: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-950/50',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-800 dark:text-red-100',
          icon: 'error',
          iconColor: 'text-red-600 dark:text-red-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/50',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-800 dark:text-amber-100',
          icon: 'warning',
          iconColor: 'text-amber-600 dark:text-amber-400',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/50',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-100',
          icon: 'info',
          iconColor: 'text-blue-600 dark:text-blue-400',
        };
    }
  };

  return (
    <div className="fixed z-50 space-y-3 w-full max-w-none px-4 sm:px-0 sm:max-w-md sm:w-full top-[max(1rem,env(safe-area-inset-top))] left-0 right-0 sm:left-auto sm:right-4 sm:top-4">
      {toasts.map((toast) => {
        const styles = getToastStyles(toast.type);

        return (
          <div
            key={toast.id}
            className={`
              ${styles.bg} ${styles.border} ${styles.text}
              rounded-xl border shadow-lg p-4
              animate-in slide-in-from-right
              flex items-start gap-3
              transition-all duration-300
            `}
            role="alert"
          >
            <div className={`flex-shrink-0 ${styles.iconColor}`}>
              <span className="material-symbols-outlined text-2xl">
                {styles.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold break-words">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
              aria-label="Close notification"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;

