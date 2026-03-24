import { useState, useEffect, useCallback } from "react";
import {
  notesService,
  tasksService,
  focusService,
  statsService,
  preferencesService,
} from "@/services/api";

export interface MenuNote {
  id: string;
  text: string;
  url: string;
  color: string;
  createdAt: string;
}

export interface MenuTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface BlockedSite {
  id: string;
  domain: string;
}

export interface TodayStats {
  minutesBrowsed: number;
  sitesVisited: number;
  trackersBlocked: number;
  dataSavedBytes: string;
  topSites: { domain: string; minutes: number }[];
  hourlyUsage: { hour: number; percentage: number }[];
}

export interface WeeklyStats {
  timeline: { date: string; day: string; minutes: number; sites: number; trackers: number }[];
  topSites: { domain: string; totalMinutes: number; trend: number[] }[];
  totals: { minutes: number; sites: number; trackers: number };
}

export interface UserPrefs {
  theme: string;
  defaultZoom: number;
  blockTrackers: boolean;
  blockThirdPartyCookies: boolean;
  antiFingerprint: boolean;
  forceHttps: boolean;
  blockMining: boolean;
}

export function useMenuData(isOpen: boolean) {
  const [notes, setNotes] = useState<MenuNote[]>([]);
  const [tasks, setTasks] = useState<MenuTask[]>([]);
  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([]);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    Promise.all([
      notesService.getAll().catch(() => []),
      tasksService.getAll().catch(() => []),
      focusService.getBlockedSites().catch(() => []),
      statsService.getToday().catch(() => null),
      preferencesService.get().catch(() => null),
      statsService.getWeekly(7).catch(() => null),
    ]).then(([n, t, b, s, p, w]) => {
      setNotes(n);
      setTasks(t);
      setBlockedSites(b);
      setStats(s);
      setPrefs(p);
      setWeeklyStats(w);
      setLoading(false);
    });
  }, [isOpen]);

  const addNote = useCallback(async (text: string, url: string, color: string) => {
    const note = await notesService.create({ text, url, color });
    setNotes((prev) => [note, ...prev]);
    return note;
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    await notesService.delete(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addTask = useCallback(async (text: string) => {
    const task = await tasksService.create(text);
    setTasks((prev) => [task, ...prev]);
    return task;
  }, []);

  const toggleTask = useCallback(async (id: string) => {
    const updated = await tasksService.toggle(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await tasksService.delete(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addBlockedSite = useCallback(async (domain: string) => {
    const site = await focusService.addBlockedSite(domain);
    setBlockedSites((prev) => [...prev, site]);
    return site;
  }, []);

  const removeBlockedSite = useCallback(async (id: string) => {
    await focusService.removeBlockedSite(id);
    setBlockedSites((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const startFocusSession = useCallback(async (durationMs: number) => {
    return await focusService.startSession(durationMs);
  }, []);

  const endFocusSession = useCallback(async (id: string, elapsedMs: number, completed: boolean) => {
    await focusService.endSession(id, elapsedMs, completed);
  }, []);

  const updatePreference = useCallback(async (key: string, value: unknown) => {
    const updated = await preferencesService.update({ [key]: value });
    setPrefs(updated);
    return updated;
  }, []);

  return {
    loading,
    notes,
    tasks,
    blockedSites,
    stats,
    prefs,
    addNote,
    deleteNote,
    addTask,
    toggleTask,
    deleteTask,
    addBlockedSite,
    removeBlockedSite,
    startFocusSession,
    endFocusSession,
    updatePreference,
    weeklyStats,
  };
}