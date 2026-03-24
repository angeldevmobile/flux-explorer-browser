import { useState, useEffect } from "react";

export type SearchEngineId = "google" | "duckduckgo" | "brave" | "ecosia" | "orion-ai";

export interface SearchEngineConfig {
  id: SearchEngineId;
  name: string;
  searchUrl: (q: string) => string;
  color: string;
  bgColor: string;
  letter: string;
}

export const SEARCH_ENGINES: SearchEngineConfig[] = [
  {
    id: "google",
    name: "Google",
    searchUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    letter: "G",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    searchUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/20",
    letter: "D",
  },
  {
    id: "brave",
    name: "Brave Search",
    searchUrl: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    color: "text-orange-500",
    bgColor: "bg-orange-600/10 border-orange-600/20",
    letter: "B",
  },
  {
    id: "ecosia",
    name: "Ecosia",
    searchUrl: (q) => `https://www.ecosia.org/search?q=${encodeURIComponent(q)}`,
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    letter: "E",
  },
  {
    id: "orion-ai",
    name: "Flux AI",
    searchUrl: (q) => `orion://ai?q=${encodeURIComponent(q)}`,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
    letter: "✦",
  },
];

const STORAGE_KEY = "orion-search-engine";
const ENGINE_CHANGE_EVENT = "orion-engine-change";

export function useSearchEngine() {
  const [engineId, setEngineId] = useState<SearchEngineId>(() => {
    return (localStorage.getItem(STORAGE_KEY) as SearchEngineId) ?? "google";
  });

  // Sync all instances when engine changes in any component
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<SearchEngineId>).detail;
      setEngineId(id);
    };
    window.addEventListener(ENGINE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(ENGINE_CHANGE_EVENT, handler);
  }, []);

  const config = SEARCH_ENGINES.find((e) => e.id === engineId) ?? SEARCH_ENGINES[0];

  const changeEngine = (id: SearchEngineId) => {
    localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(ENGINE_CHANGE_EVENT, { detail: id }));
  };

  return { engineId, config, changeEngine, engines: SEARCH_ENGINES };
}
