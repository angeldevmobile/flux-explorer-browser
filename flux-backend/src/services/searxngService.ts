import { env } from "../config/env";

const SEARXNG_URL = env.SEARXNG_URL || "http://localhost:8080";

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  publishedDate: string | null;
  thumbnail: string;
  img_src?: string;       // imagen real (resultados de tipo images)
  thumbnail_src?: string; // miniatura (resultados de tipo images)
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  number_of_results: number;
}

// Caché en memoria: clave = "query:page:category", valor = {data, expiresAt}
const searchCache = new Map<string, { data: SearchResponse; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export async function searchWeb(query: string, page = 1, category = "general"): Promise<SearchResponse> {
  const cacheKey = `${query.toLowerCase()}:${page}:${category}`;
  const cached = searchCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&language=es&pageno=${page}&categories=${category}`;

  const response = await fetch(url, {
    headers: {
      "X-Forwarded-For": "127.0.0.1",
      "User-Agent": "OrionBrowser/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`SearXNG error: ${response.status}`);
  }

  const data = await response.json() as SearchResponse;
  searchCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

  return data;
}
