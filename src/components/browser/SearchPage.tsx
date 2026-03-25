import { Globe, ExternalLink, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight, Mic, Sparkles } from "lucide-react";
import { useOrionSearch } from "@/hooks/useOrionSearch";
import { OrionLogo } from "@/components/browser/OrionLogo";
import { useRef, useState, useEffect, useCallback } from "react";

interface SearchPageProps {
  query: string;
  onNavigate: (url: string) => void;
}

function getFavicon(url: string) {
  try {
    const domain = new URL(url).hostname;
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  } catch {
    return null;
  }
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// Genera la lista de páginas a mostrar (con "..." si hay muchas)
function buildPageNumbers(page: number, maxPage: number): (number | "...")[] {
  if (maxPage <= 7) {
    return Array.from({ length: maxPage }, (_, i) => i + 1);
  }
  const pages: (number | "...")[] = [1];
  if (page > 3) pages.push("...");
  for (let i = Math.max(2, page - 1); i <= Math.min(maxPage - 1, page + 1); i++) {
    pages.push(i);
  }
  if (page < maxPage - 2) pages.push("...");
  if (maxPage > 1) pages.push(maxPage);
  return pages;
}

export const SearchPage = ({ query, onNavigate }: SearchPageProps) => {
  const { results, loading, error, page, hasMore, maxPage, nextPage, prevPage, goToPage } =
    useOrionSearch(query);
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback((val: string) => {
    if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);
    if (!val.trim()) { setSuggestions([]); return; }
    suggestionsTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/suggestions?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch { setSuggestions([]); }
    }, 180);
  }, []);

  useEffect(() => () => { if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current); }, []);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = inputRef.current?.value.trim();
    if (input) {
      setShowSuggestions(false);
      onNavigate(`flux://search?q=${encodeURIComponent(input)}`);
    }
  };

  const selectSuggestion = (s: string) => {
    if (inputRef.current) inputRef.current.value = s;
    setShowSuggestions(false);
    onNavigate(`flux://search?q=${encodeURIComponent(s)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((p) => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((p) => Math.max(p - 1, -1));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const pageNumbers = buildPageNumbers(page, maxPage);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ═══════════════════════════════════════════════════
          HEADER — Logo fijo · Input centrado con sugerencias
      ═══════════════════════════════════════════════════ */}
      <header
        className="flex-shrink-0 flex items-center px-8 gap-6"
        style={{
          height: "64px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* ── Logo: espacio propio fijo ── */}
        <div className="flex items-center gap-3 select-none flex-shrink-0 w-[160px]">
          <OrionLogo size={32} />
          <div className="leading-none">
            <p className="text-[18px] font-bold text-white tracking-tight leading-none">Flux</p>
            <p className="text-[9px] text-cyan-400/60 uppercase tracking-[0.3em] font-semibold mt-0.5">Search</p>
          </div>
        </div>

        {/* ── Barra de búsqueda centrada con sugerencias ── */}
        <form
          onSubmit={handleSearch}
          className="flex-1 flex justify-center"
          style={{ position: "relative" }}
        >
          {/* Input container con botón Buscar adentro */}
          <div
            className="flex items-center gap-2 px-4 rounded-full group transition-all duration-200 focus-within:border-cyan-500/30"
            style={{
              width: "min(580px, 100%)",
              height: "42px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0 text-white/25 group-focus-within:text-cyan-400/60 transition-colors" />
            <input
              ref={inputRef}
              name="q"
              defaultValue={query}
              autoComplete="off"
              className="flex-1 min-w-0 bg-transparent text-[14px] text-white/85
                placeholder:text-white/20 focus:outline-none caret-cyan-400"
              placeholder="Buscar en la web…"
              onChange={(e) => {
                fetchSuggestions(e.target.value);
                setShowSuggestions(true);
                setActiveSuggestion(-1);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="flex-shrink-0 flex items-center justify-center w-6 h-6
                text-white/20 hover:text-white/50 transition-colors"
              title="Buscar por voz"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
            {/* Divisor */}
            <div className="w-px h-5 bg-white/10 flex-shrink-0" />
            {/* Botón Buscar dentro del input */}
            <button
              type="submit"
              className="flex-shrink-0 flex items-center justify-center h-[30px] px-4
                rounded-full text-[12px] font-semibold transition-all duration-150"
              style={{
                background: "linear-gradient(135deg, rgba(6,182,212,0.3), rgba(14,165,233,0.2))",
                border: "1px solid rgba(6,182,212,0.35)",
                color: "rgba(6,182,212,1)",
              }}
            >
              Buscar
            </button>
          </div>

          {/* Dropdown de sugerencias */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute top-[46px] left-1/2 -translate-x-1/2 z-50 overflow-hidden"
              style={{
                width: "min(580px, 100%)",
                background: "rgba(15,20,30,0.97)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "16px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => selectSuggestion(s)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-left transition-colors"
                  style={{
                    background: i === activeSuggestion ? "rgba(6,182,212,0.08)" : "transparent",
                    color: i === activeSuggestion ? "rgba(6,182,212,1)" : "rgba(255,255,255,0.75)",
                    borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}
                >
                  <Search className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* ── Spinner ── */}
        <div className="flex-shrink-0 w-6 flex items-center justify-center">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400/70" />
            : <Sparkles className="w-4 h-4 text-white/10" />}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════
          ÁREA DE RESULTADOS
      ═══════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="mx-auto px-10 py-5"
          style={{ maxWidth: "860px" }}
        >

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-3 p-4 rounded-2xl mb-5"
              style={{
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <AlertCircle className="w-4 h-4 text-red-400/80 flex-shrink-0" />
              <p className="text-sm text-red-400/80">{error}</p>
            </div>
          )}

          {/* ── Skeleton ── */}
          {loading && results.length === 0 && (
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-sm bg-white/6" />
                    <div className="h-2.5 rounded-full w-32 bg-white/6" />
                  </div>
                  <div className="h-4 rounded-full w-3/4 bg-white/8 mb-2" />
                  <div className="h-3 rounded-full w-full bg-white/5 mb-1.5" />
                  <div className="h-3 rounded-full w-5/6 bg-white/4" />
                </div>
              ))}
            </div>
          )}

          {/* ── Resultados ── */}
          <div className="space-y-0">
            {results.map((result, i) => {
              const favicon = getFavicon(result.url);
              const domain = getDomain(result.url);
              return (
                <button
                  key={i}
                  onClick={() => onNavigate(result.url)}
                  className="w-full text-left group py-4 transition-all duration-150"
                  style={{
                    borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}
                >
                  {/* Dominio */}
                  <div className="flex items-center gap-2 mb-1.5">
                    {favicon ? (
                      <img
                        src={favicon}
                        className="w-[18px] h-[18px] rounded-sm flex-shrink-0"
                        style={{ opacity: 0.75 }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <Globe className="w-[18px] h-[18px] flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
                    )}
                    <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {domain}
                    </span>
                    <ExternalLink
                      className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "rgba(6,182,212,0.55)" }}
                    />
                  </div>

                  {/* Título */}
                  <p
                    className="text-[17px] font-semibold leading-snug mb-1.5 line-clamp-1 transition-colors duration-150"
                    style={{ color: "rgba(6,182,212,0.9)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(103,232,249,1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(6,182,212,0.9)")}
                  >
                    {result.title}
                  </p>

                  {/* Descripción */}
                  {result.content && (
                    <p
                      className="text-[14px] line-clamp-2 leading-relaxed"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {result.content}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sin resultados */}
          {!loading && !error && results.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(6,182,212,0.05)",
                  border: "1px solid rgba(6,182,212,0.1)",
                }}
              >
                <Search className="w-6 h-6" style={{ color: "rgba(6,182,212,0.3)" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Sin resultados
                </p>
                <p className="text-[12px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                  para "{query}"
                </p>
              </div>
            </div>
          )}

          {/* ── Paginación numerada ── */}
          {!loading && results.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 pt-6 pb-8">
              {/* Anterior */}
              <button
                onClick={prevPage}
                disabled={page === 1}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-150
                  disabled:opacity-20 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.5)",
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.borderColor = "rgba(6,182,212,0.35)";
                    e.currentTarget.style.color = "rgba(6,182,212,1)";
                    e.currentTarget.style.background = "rgba(6,182,212,0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Números de página */}
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="w-9 h-9 flex items-center justify-center text-[13px]"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className="w-9 h-9 rounded-full text-[13px] font-medium transition-all duration-150"
                    style={
                      p === page
                        ? {
                            background: "linear-gradient(135deg, rgba(6,182,212,0.3), rgba(14,165,233,0.2))",
                            border: "1px solid rgba(6,182,212,0.5)",
                            color: "rgba(6,182,212,1)",
                            fontWeight: 700,
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            color: "rgba(255,255,255,0.45)",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (p !== page) {
                        e.currentTarget.style.borderColor = "rgba(6,182,212,0.3)";
                        e.currentTarget.style.color = "rgba(6,182,212,0.85)";
                        e.currentTarget.style.background = "rgba(6,182,212,0.06)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (p !== page) {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                        e.currentTarget.style.color = "rgba(255,255,255,0.45)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      }
                    }}
                  >
                    {p}
                  </button>
                )
              )}

              {/* Siguiente */}
              <button
                onClick={nextPage}
                disabled={!hasMore}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-150
                  disabled:opacity-20 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.5)",
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.borderColor = "rgba(6,182,212,0.35)";
                    e.currentTarget.style.color = "rgba(6,182,212,1)";
                    e.currentTarget.style.background = "rgba(6,182,212,0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
