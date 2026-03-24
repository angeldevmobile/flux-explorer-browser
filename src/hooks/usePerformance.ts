import type { PerformanceConfig, PerfProfileId } from '@/lib/window';

// usePerformance — stub sin electron; devuelve valores por defecto.
export function usePerformance() {
  return {
    loading: false,
    hardwareProfile: null,
    config: null as PerformanceConfig | null,
    liveMetrics: { cpuUsage: 0, memUsedPct: 0 },
    schedulerStats: null,
    cacheSizeMB: 0,
    setProfile: async (_profile: PerfProfileId) => {},
    clearCache: async () => {},
    refresh: async () => {},
  };
}
