import React from 'react';
import { useToast } from '../contexts/ToastContext';

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-800',
          icon: 'check_circle',
          iconColor: 'text-emerald-600',
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: 'error',
          iconColor: 'text-red-600',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-800',
          icon: 'warning',
          iconColor: 'text-amber-600',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: 'info',
          iconColor: 'text-blue-600',
        };
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md w-full">
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
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
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

