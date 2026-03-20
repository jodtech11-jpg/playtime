import React, { useState, useCallback } from 'react';
import ConfirmDialog from '../components/shared/ConfirmDialog';

export type OpenConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void | Promise<void>;
};

/**
 * In-app replacement for window.confirm(). Render `confirmDialog` once in the component tree.
 */
export function useConfirmDialog() {
  const [cfg, setCfg] = useState<OpenConfirmOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const openConfirm = useCallback((options: OpenConfirmOptions) => {
    setCfg(options);
  }, []);

  const closeConfirm = useCallback(() => {
    setCfg(null);
    setLoading(false);
  }, []);

  const confirmDialog = (
    <ConfirmDialog
      isOpen={!!cfg}
      title={cfg?.title ?? ''}
      message={cfg?.message ?? ''}
      confirmLabel={cfg?.confirmLabel}
      cancelLabel={cfg?.cancelLabel}
      variant={cfg?.variant ?? 'danger'}
      loading={loading}
      onConfirm={async () => {
        if (!cfg) return;
        setLoading(true);
        try {
          await cfg.onConfirm();
          setCfg(null);
        } finally {
          setLoading(false);
        }
      }}
      onCancel={() => {
        if (loading) return;
        closeConfirm();
      }}
    />
  );

  return { openConfirm, confirmDialog, closeConfirm };
}
