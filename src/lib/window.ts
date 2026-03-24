export {};

export type PerfProfileId = 'auto' | 'high' | 'balanced' | 'eco';

export interface PerformanceConfig {
  profile:              'high' | 'balanced' | 'eco';
  manualOverride:       PerfProfileId;
  hardwareTier:         'high' | 'balanced' | 'eco';
  label:                string;
  maxConcurrentTabs:    number;
  tabSuspendAfterMs:    number;
  preloadNextTab:       boolean;
  animationsEnabled:    boolean;
  hardwareAccelEnabled: boolean;
  cacheMaxMB:           number;
  backgroundThrottle:   boolean;
  imageQuality:         'high' | 'medium' | 'low';
  reason?:              string;
}

interface ProxyConfig {
  enabled: boolean;
  type: 'socks5' | 'http';
  host: string;
  port: number;
  username: string;
  password: string;
}

interface PagePrivacyStats {
  trackersBlocked: number;
  adsBlocked: number;
  cookiesBlocked: number;
  dataSavedBytes: number;
}

interface PrivacyBlockedEvent {
  type: 'tracker' | 'mining';
  hostname: string;
  pageHost: string | null;
  pageStats: PagePrivacyStats | null;
}

interface GoogleTrend {
  title: string;
  traffic: string;
  link: string;
  image?: string;
  time: string;
  relatedNews?: Array<{
    title: string;
    url: string;
    source: string;
    image?: string;
    snippet: string;
  }>;
}

interface WeatherData {
  temp: number;
  condition: string;
  icon?: string;
}

interface NewsItem {
  title: string;
  url: string;
  source?: string;
  image?: string;
  description?: string;
}

export interface DownloadEntry {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  receivedBytes: number;
  totalBytes: number;
  speed: number;
  startTime: number;
  endTime: number | null;
}

// IPC helper type — the bridge Rust/wry exposes to the chrome WebView
declare global {
  interface Window {
    ipc?: { postMessage: (msg: string) => void };
  }
}