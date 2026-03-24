import { env } from "../config/env";

const SEARXNG_URL = env.SEARXNG_URL || "http://localhost:8080";

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  publishedDate: string | null;
  thumbnail: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  number_of_results: number;
}

export async function searchWeb(query: string, page = 1): Promise<SearchResponse> {
  const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json&language=es&pageno=${page}`;

  const response = await fetch(url, {
    headers: {
      "X-Forwarded-For": "127.0.0.1",
      "User-Agent": "OrionBrowser/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`SearXNG error: ${response.status}`);
  }

  return response.json() as Promise<SearchResponse>;
}
