import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;

  const confirmStyles = {
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20',
    default: 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20',
  };

  const iconMap = { danger: 'delete_forever', warning: 'warning', default: 'help' };
  const iconBg = {
    danger: 'bg-rose-50 dark:bg-rose-900/20 text-rose-500',
    warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-500',
    default: 'bg-primary/10 text-primary',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
            <span className="material-symbols-outlined text-2xl">{iconMap[variant]}</span>
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-lg font-black text-slate-900 dark:text-white leading-none">
              {title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50 ${confirmStyles[variant]}`}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
