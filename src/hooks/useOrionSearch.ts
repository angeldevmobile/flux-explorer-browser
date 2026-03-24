import { useState, useEffect, useRef } from "react";

export interface OrionResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  thumbnail: string;
}

export function useOrionSearch(query: string) {
  const [results, setResults] = useState<OrionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [maxPage, setMaxPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  // Reset al cambiar la query
  useEffect(() => {
    setPage(1);
    setMaxPage(1);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasMore(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    fetch(
      `http://localhost:3000/api/search/web?q=${encodeURIComponent(query)}&page=${page}`,
      { signal: abortRef.current.signal }
    )
      .then((res) => res.json())
      .then((data) => {
        const items: OrionResult[] = data.results ?? [];
        const more = items.length >= 8;
        setResults(items);
        setHasMore(more);
        // Actualizar la página máxima conocida
        setMaxPage((prev) => Math.max(prev, more ? page + 1 : page));
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("No se pudo conectar con Flux Search");
          setLoading(false);
        }
      });

    return () => abortRef.current?.abort();
  }, [query, page]);

  const nextPage = () => setPage((p) => p + 1);
  const prevPage = () => setPage((p) => Math.max(1, p - 1));
  const goToPage = (p: number) => setPage(Math.max(1, p));

  return { results, loading, error, page, hasMore, maxPage, nextPage, prevPage, goToPage };
}
