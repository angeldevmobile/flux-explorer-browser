// src/hooks/useNavigationHistory.ts
import { useState, useCallback } from 'react';

interface HistoryEntry {
  url: string;
  title?: string;
}

interface NavState {
  history: HistoryEntry[];
  currentIndex: number;
}

export function useNavigationHistory(initialUrl: string = '') {
  const [navState, setNavState] = useState<NavState>({
    history: initialUrl ? [{ url: initialUrl }] : [],
    currentIndex: 0,
  });

  const push = useCallback((url: string, title?: string) => {
    setNavState((prev) => {
      const newHistory = prev.history.slice(0, prev.currentIndex + 1);
      newHistory.push({ url, title });
      return { history: newHistory, currentIndex: prev.currentIndex + 1 };
    });
  }, []);

  const back = useCallback(() => {
    setNavState((prev) => ({
      ...prev,
      currentIndex: Math.max(0, prev.currentIndex - 1),
    }));
  }, []);

  const forward = useCallback(() => {
    setNavState((prev) => ({
      ...prev,
      currentIndex: Math.min(prev.history.length - 1, prev.currentIndex + 1),
    }));
  }, []);

  const { history, currentIndex } = navState;
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  return {
    currentUrl: history[currentIndex]?.url || '',
    canGoBack,
    canGoForward,
    back,
    forward,
    push,
    history,
    currentIndex,
  };
}
