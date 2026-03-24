import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface BrowserSettings {
  startupPage: string;
  showBookmarksBar: boolean;
  smoothScrolling: boolean;
  hardwareAccel: boolean;
  continuousLoad: boolean;
  language: string;
  clearOnExit: boolean;
  searchSuggestions: boolean;
  instantSearch: boolean;
  askBeforeDownload: boolean;
  openAfterDownload: boolean;
  syncBookmarks: boolean;
  syncHistory: boolean;
  syncPasswords: boolean;
  syncSettingsPref: boolean;
}

export const SETTING_DEFAULTS: BrowserSettings = {
  startupPage: "newtab",
  showBookmarksBar: true,
  smoothScrolling: true,
  hardwareAccel: true,
  continuousLoad: false,
  language: "es",
  clearOnExit: false,
  searchSuggestions: true,
  instantSearch: true,
  askBeforeDownload: true,
  openAfterDownload: false,
  syncBookmarks: true,
  syncHistory: true,
  syncPasswords: false,
  syncSettingsPref: true,
};

const KEYS: Record<keyof BrowserSettings, string> = {
  startupPage: "startup-page",
  showBookmarksBar: "bookmarks-bar",
  smoothScrolling: "smooth-scroll",
  hardwareAccel: "hw-accel",
  continuousLoad: "continuous-load",
  language: "language",
  clearOnExit: "clear-on-exit",
  searchSuggestions: "search-suggestions",
  instantSearch: "instant-search",
  askBeforeDownload: "ask-download",
  openAfterDownload: "open-after-download",
  syncBookmarks: "sync-bookmarks",
  syncHistory: "sync-history",
  syncPasswords: "sync-passwords",
  syncSettingsPref: "sync-settings-pref",
};

function readSetting<T>(key: string, defaultValue: T): T {
  const raw = localStorage.getItem(`orion-setting-${key}`);
  if (raw === null) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function readAll(): BrowserSettings {
  return Object.fromEntries(
    (Object.keys(SETTING_DEFAULTS) as (keyof BrowserSettings)[]).map((k) => [
      k,
      readSetting(KEYS[k], SETTING_DEFAULTS[k]),
    ]),
  ) as BrowserSettings;
}

interface SettingsContextType {
  settings: BrowserSettings;
  set: <K extends keyof BrowserSettings>(key: K, value: BrowserSettings[K]) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrowserSettings>(readAll);

  // Apply smooth scrolling globally
  useEffect(() => {
    document.documentElement.style.scrollBehavior = settings.smoothScrolling
      ? "smooth"
      : "auto";
  }, [settings.smoothScrolling]);

  const set = <K extends keyof BrowserSettings>(
    key: K,
    value: BrowserSettings[K],
  ) => {
    localStorage.setItem(
      `orion-setting-${KEYS[key]}`,
      JSON.stringify(value),
    );
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, set }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
