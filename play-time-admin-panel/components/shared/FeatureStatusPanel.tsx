import React, { useEffect, useState } from 'react';
import { FeatureFlags, FeatureMode, FeatureModuleKey } from '../../types';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  DEFAULT_COMING_SOON_MESSAGE,
  DEFAULT_COMING_SOON_TITLE,
  FEATURE_MODULE_LABELS,
  mergeFeatureFlags,
} from '../../utils/featureFlags';
import { getFirebaseErrorMessage } from '../../utils/errorUtils';

interface FeatureStatusPanelProps {
  /** Single module panel (for page tops). Omit for full Features settings. */
  moduleKey?: FeatureModuleKey;
  /** Compact layout for embedding at top of module pages */
  compact?: boolean;
  className?: string;
}

const FeatureStatusPanel: React.FC<FeatureStatusPanelProps> = ({
  moduleKey,
  compact = false,
  className = '',
}) => {
  const { isSuperAdmin } = useAuth();
  const { settings, loading, updateSettings } = useAppSettings(true);
  const { showSuccess, showError, showWarning } = useToast();
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<FeatureFlags>(() =>
    mergeFeatureFlags(settings.featureFlags)
  );

  useEffect(() => {
    if (!loading) {
      setFlags(mergeFeatureFlags(settings.featureFlags));
    }
  }, [settings.featureFlags, loading]);

  if (!isSuperAdmin) {
    return null;
  }

  const updateModule = (
    key: FeatureModuleKey,
    patch: Partial<FeatureFlags[FeatureModuleKey]>
  ) => {
    setFlags((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const handleSave = async (keys?: FeatureModuleKey[]) => {
    try {
      setSaving(true);
      const next = mergeFeatureFlags(flags);
      if (keys) {
        // Keep other modules from latest settings, only overwrite edited ones
        const base = mergeFeatureFlags(settings.featureFlags);
        for (const key of keys) {
          base[key] = next[key];
        }
        base.defaultComingSoonTitle = next.defaultComingSoonTitle;
        base.defaultComingSoonMessage = next.defaultComingSoonMessage;
        await updateSettings({ featureFlags: base });
        setFlags(base);
      } else {
        await updateSettings({ featureFlags: next });
      }
      showSuccess('Feature settings saved. Customer app will update shortly.');
    } catch (err) {
      showError(getFirebaseErrorMessage(err, 'Failed to save feature settings'));
    } finally {
      setSaving(false);
    }
  };

  const renderModuleEditor = (key: FeatureModuleKey) => {
    const cfg = flags[key];
    const label = FEATURE_MODULE_LABELS[key];
    const mode = cfg.mode || 'enabled';

    return (
      <div
        key={key}
        className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-gray-100">
            {label} Status
          </h4>
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
              mode === 'enabled'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : mode === 'disabled_hide'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
          >
            {mode === 'enabled'
              ? 'Enabled'
              : mode === 'disabled_hide'
                ? 'Disabled & Hidden'
                : 'Coming Soon'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              ['enabled', 'Enable'],
              ['disabled_hide', 'Disable & Hide'],
              ['disabled_coming_soon', 'Disable & Coming Soon'],
            ] as [FeatureMode, string][]
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => updateModule(key, { mode: value })}
              className={`h-11 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                mode === value
                  ? 'bg-primary text-primary-content border-primary shadow-sm'
                  : 'bg-white dark:bg-surface-dark text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary/50'
              }`}
            >
              {text}
            </button>
          ))}
        </div>

        {mode === 'disabled_coming_soon' && (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
                Coming Soon Title
              </label>
              <input
                type="text"
                value={cfg.comingSoonTitle || ''}
                placeholder={flags.defaultComingSoonTitle || DEFAULT_COMING_SOON_TITLE}
                onChange={(e) =>
                  updateModule(key, { comingSoonTitle: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
                Coming Soon Message
              </label>
              <textarea
                value={cfg.comingSoonMessage || ''}
                placeholder={
                  flags.defaultComingSoonMessage || DEFAULT_COMING_SOON_MESSAGE
                }
                onChange={(e) =>
                  updateModule(key, { comingSoonMessage: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm"
              />
            </div>
          </div>
        )}

        {compact && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (!isSuperAdmin) {
                showWarning('Only super admins can update feature settings');
                return;
              }
              void handleSave([key]);
            }}
            className="h-10 px-5 bg-primary text-primary-content text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Loading feature settings…
      </div>
    );
  }

  if (moduleKey) {
    return (
      <div className={className}>
        <div className="mb-2">
          <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 tracking-tight">
            Feature Status
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Control visibility of {FEATURE_MODULE_LABELS[moduleKey]} in the
            customer app without releasing an update.
          </p>
        </div>
        {renderModuleEditor(moduleKey)}
      </div>
    );
  }

  return (
    <section
      className={`bg-white dark:bg-surface-dark rounded-3xl border border-gray-100 dark:border-gray-700 p-4 sm:p-8 shadow-sm space-y-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">tune</span>
            Customer Feature Controls
          </h3>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Enable, hide, or show Coming Soon for major modules. Changes sync to
            the mobile app immediately.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="h-11 px-6 bg-primary text-primary-content text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
            Default Coming Soon Title
          </label>
          <input
            type="text"
            value={flags.defaultComingSoonTitle || ''}
            onChange={(e) =>
              setFlags((prev) => ({
                ...prev,
                defaultComingSoonTitle: e.target.value,
              }))
            }
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
            Default Coming Soon Message
          </label>
          <textarea
            value={flags.defaultComingSoonMessage || ''}
            onChange={(e) =>
              setFlags((prev) => ({
                ...prev,
                defaultComingSoonMessage: e.target.value,
              }))
            }
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(Object.keys(FEATURE_MODULE_LABELS) as FeatureModuleKey[]).map(
          (key) => renderModuleEditor(key)
        )}
      </div>
    </section>
  );
};

export default FeatureStatusPanel;
