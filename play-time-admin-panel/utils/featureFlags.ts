import {
  FeatureFlags,
  FeatureMode,
  FeatureModuleConfig,
  FeatureModuleKey,
} from '../types';

export const DEFAULT_COMING_SOON_TITLE = 'Coming Soon';
export const DEFAULT_COMING_SOON_MESSAGE =
  'This feature is currently under development and will be available soon.';

export const DEFAULT_FEATURE_MODULE: FeatureModuleConfig = {
  mode: 'enabled',
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  tournament: { ...DEFAULT_FEATURE_MODULE },
  wallet: { ...DEFAULT_FEATURE_MODULE },
  teamUp: { ...DEFAULT_FEATURE_MODULE },
  joinMatch: { ...DEFAULT_FEATURE_MODULE },
  matches: { ...DEFAULT_FEATURE_MODULE },
  communityPolls: { ...DEFAULT_FEATURE_MODULE },
  feed: { ...DEFAULT_FEATURE_MODULE },
  favourite: { ...DEFAULT_FEATURE_MODULE },
  notifications: { ...DEFAULT_FEATURE_MODULE },
  defaultComingSoonTitle: DEFAULT_COMING_SOON_TITLE,
  defaultComingSoonMessage: DEFAULT_COMING_SOON_MESSAGE,
};

export const FEATURE_MODULE_LABELS: Record<FeatureModuleKey, string> = {
  tournament: 'Tournament',
  wallet: 'Wallet',
  teamUp: 'Team Up',
  joinMatch: 'Join Match',
  matches: 'Matches',
  communityPolls: 'Community Polls',
  feed: 'Feed',
  favourite: 'Favourite',
  notifications: 'Notifications',
};

export const FEATURE_MODULE_KEYS = Object.keys(
  FEATURE_MODULE_LABELS
) as FeatureModuleKey[];

export function mergeFeatureFlags(
  partial?: Partial<FeatureFlags> | null
): FeatureFlags {
  const merged: FeatureFlags = {
    ...DEFAULT_FEATURE_FLAGS,
    ...partial,
    defaultComingSoonTitle:
      partial?.defaultComingSoonTitle || DEFAULT_COMING_SOON_TITLE,
    defaultComingSoonMessage:
      partial?.defaultComingSoonMessage || DEFAULT_COMING_SOON_MESSAGE,
  };

  for (const key of FEATURE_MODULE_KEYS) {
    merged[key] = {
      ...DEFAULT_FEATURE_MODULE,
      ...(partial?.[key] || {}),
      mode: (partial?.[key]?.mode as FeatureMode) || 'enabled',
    };
  }

  return merged;
}

/** Public-safe payload for the mobile app. */
export function toPublicFeatureFlags(flags: FeatureFlags) {
  return {
    featureFlags: mergeFeatureFlags(flags),
  };
}
