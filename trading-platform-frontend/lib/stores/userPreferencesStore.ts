/**
 * User Preferences Store — persists UI preferences to localStorage.
 * Theme is handled by next-themes; this store covers everything else.
 */

import { create } from 'zustand';

const STORAGE_KEY = 'user_preferences';

export interface UserPreferences {
  /** Avatar as a base64 data-URL (stored in localStorage) */
  avatarUrl: string | null;
  /** Default currency for display */
  currency: string;
  /** Date format pattern */
  dateFormat: string;
  /** Timezone */
  timezone: string;
  /** Notification toggles */
  notifications: {
    backtestCompleted: boolean;
    weeklyReport: boolean;
    riskAlerts: boolean;
    productUpdates: boolean;
  };
}

interface UserPreferencesState extends UserPreferences {
  setAvatarUrl: (url: string | null) => void;
  setCurrency: (currency: string) => void;
  setDateFormat: (format: string) => void;
  setTimezone: (tz: string) => void;
  setNotification: (key: keyof UserPreferences['notifications'], value: boolean) => void;
  reset: () => void;
}

const defaults: UserPreferences = {
  avatarUrl: null,
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timezone: 'EST',
  notifications: {
    backtestCompleted: true,
    weeklyReport: true,
    riskAlerts: true,
    productUpdates: true,
  },
};

function loadFromStorage(): UserPreferences {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...defaults, ...parsed, notifications: { ...defaults.notifications, ...parsed.notifications } };
  } catch {
    return defaults;
  }
}

function persist(state: UserPreferences) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useUserPreferences = create<UserPreferencesState>((set, get) => ({
  ...loadFromStorage(),

  setAvatarUrl: (url) => {
    set({ avatarUrl: url });
    persist({ ...get(), avatarUrl: url });
  },

  setCurrency: (currency) => {
    set({ currency });
    persist({ ...get(), currency });
  },

  setDateFormat: (dateFormat) => {
    set({ dateFormat });
    persist({ ...get(), dateFormat });
  },

  setTimezone: (timezone) => {
    set({ timezone });
    persist({ ...get(), timezone });
  },

  setNotification: (key, value) => {
    const notifications = { ...get().notifications, [key]: value };
    set({ notifications });
    persist({ ...get(), notifications });
  },

  reset: () => {
    set(defaults);
    persist(defaults);
  },
}));
