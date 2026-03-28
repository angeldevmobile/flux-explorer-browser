import { Globe, ExternalLink, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight, Mic, Sparkles, Image, Video, LayoutList } from "lucide-react";
import { useOrionSearch } from "@/hooks/useOrionSearch";
import { OrionLogo } from "@/components/browser/OrionLogo";
import { useRef, useState, useEffect, useCallback } from "react";

type SearchTab = "all" | "images" | "videos";

interface SearchPageProps {
  query: string;
  onNavigate: (url: string) => void;
}

function proxyImage(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return url;
    // Rust engine (puerto 4000): zero-copy, Tokio multi-thread, sin GC
    return `http://localhost:4000/image?url=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
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
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const TAB_CATEGORY: Record<SearchTab, string> = { all: "general", images: "images", videos: "videos" };
  const { results, loading, error, page, hasMore, maxPage, nextPage, prevPage, goToPage } =
    useOrionSearch(query, TAB_CATEGORY[activeTab]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
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

  // "¿Quisiste decir?" — busca sugerencia cuando no hay resultados
  useEffect(() => {
    if (loading || results.length > 0) { setDidYouMean(null); return; }
    fetch(`http://localhost:3000/api/suggestions?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        const first: string | undefined = d.suggestions?.[0];
        setDidYouMean(first && first.toLowerCase() !== query.toLowerCase() ? first : null);
      })
      .catch(() => setDidYouMean(null));
  }, [query, loading, results.length]);

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

  // Para images filtramos solo los que tienen thumbnail real.
  // Para videos SearXNG ya devuelve solo videos (category=videos), no filtramos.
  const visibleResults =
    activeTab === "images"
      ? results.filter((r) => r.thumbnail)
      : results;

  const TABS: { id: SearchTab; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: "Todo", icon: <LayoutList className="w-3.5 h-3.5" /> },
    { id: "images", label: "Imágenes", icon: <Image className="w-3.5 h-3.5" /> },
    { id: "videos", label: "Videos", icon: <Video className="w-3.5 h-3.5" /> },
  ];

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
          TABS — Todo · Imágenes · Videos
      ═══════════════════════════════════════════════════ */}
      <div
        className="flex-shrink-0 flex items-center justify-center gap-1"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", height: "42px" }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 h-[30px] rounded-full text-[12px] font-medium transition-all duration-150"
              style={
                active
                  ? {
                      background: "rgba(6,182,212,0.12)",
                      border: "1px solid rgba(6,182,212,0.35)",
                      color: "rgba(6,182,212,1)",
                    }
                  : {
                      background: "transparent",
                      border: "1px solid transparent",
                      color: "rgba(255,255,255,0.35)",
                    }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════
          ÁREA DE RESULTADOS
      ═══════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="mx-auto px-8 py-5"
          style={{ maxWidth: activeTab === "images" ? "1200px" : activeTab === "videos" ? "960px" : "860px" }}
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
          {loading && visibleResults.length === 0 && activeTab === "all" && (
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
          {loading && visibleResults.length === 0 && activeTab === "images" && (
            <div className="grid grid-cols-4 gap-3 animate-pulse">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="bg-white/6" style={{ height: "120px" }} />
                  <div className="px-2.5 py-2 space-y-1.5">
                    <div className="h-2.5 rounded-full bg-white/6 w-full" />
                    <div className="h-2 rounded-full bg-white/4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && visibleResults.length === 0 && activeTab === "videos" && (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex-shrink-0 rounded-xl bg-white/6" style={{ width: "200px", height: "112px" }} />
                  <div className="flex-1 flex flex-col justify-center gap-2">
                    <div className="h-2.5 rounded-full bg-white/6 w-24" />
                    <div className="h-4 rounded-full bg-white/8 w-3/4" />
                    <div className="h-3 rounded-full bg-white/5 w-full" />
                    <div className="h-3 rounded-full bg-white/4 w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Resultados ── */}
          <div className={activeTab === "images" ? "grid grid-cols-4 gap-3" : "space-y-0"}>
            {visibleResults.map((result, i) => {
              const favicon = getFavicon(result.url);
              const domain = getDomain(result.url);

              /* ── Tarjeta de IMAGEN ── */
              if (activeTab === "images" && result.thumbnail) {
                return (
                  <button
                    key={i}
                    onClick={() => onNavigate(result.url)}
                    className="group rounded-xl overflow-hidden text-left transition-all duration-200 hover:scale-[1.02]"
                    style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="overflow-hidden" style={{ height: "120px" }}>
                      <img
                        src={proxyImage(result.thumbnail)}
                        alt={result.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          el.style.display = "none";
                          el.parentElement!.style.background = "rgba(255,255,255,0.04)";
                        }}
                      />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-[11px] font-medium line-clamp-2 leading-snug" style={{ color: "rgba(6,182,212,0.9)" }}>{result.title}</p>
                      <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.28)" }}>{domain}</p>
                    </div>
                  </button>
                );
              }

              /* ── Tarjeta de VIDEO ── */
              if (activeTab === "videos") {
                return (
                  <button
                    key={i}
                    onClick={() => onNavigate(result.url)}
                    className="w-full text-left group flex gap-4 py-4 transition-all duration-150"
                    style={{ borderBottom: i < visibleResults.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                  >
                    {/* Thumbnail */}
                    <div
                      className="flex-shrink-0 rounded-xl overflow-hidden relative"
                      style={{ width: "200px", height: "112px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {result.thumbnail ? (
                        <img
                          src={proxyImage(result.thumbnail)}
                          alt={result.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-8 h-8" style={{ color: "rgba(255,255,255,0.15)" }} />
                        </div>
                      )}
                      {/* Play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ background: "rgba(0,0,0,0.4)" }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(6,182,212,0.85)" }}>
                          <Video className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        {favicon && (
                          <img src={favicon} className="w-4 h-4 rounded-sm flex-shrink-0" style={{ opacity: 0.7 }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        )}
                        <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>{domain}</span>
                      </div>
                      <p className="text-[15px] font-semibold line-clamp-2 leading-snug mb-2"
                        style={{ color: "rgba(6,182,212,0.9)" }}>
                        {result.title}
                      </p>
                      {result.content && (
                        <p className="text-[13px] line-clamp-2 leading-relaxed"
                          style={{ color: "rgba(255,255,255,0.4)" }}>
                          {result.content}
                        </p>
                      )}
                    </div>
                  </button>
                );
              }

              /* ── Resultado WEB normal ── */
              return (
                <button
                  key={i}
                  onClick={() => onNavigate(result.url)}
                  className="w-full text-left group py-4 transition-all duration-150"
                  style={{
                    borderBottom: i < visibleResults.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
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
          {!loading && !error && visibleResults.length === 0 && (
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
                  Sin resultados para "{query}"
                </p>
                {didYouMean && (
                  <p className="text-[13px] mt-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                    ¿Quisiste decir{" "}
                    <button
                      onClick={() => onNavigate(`flux://search?q=${encodeURIComponent(didYouMean)}`)}
                      className="font-semibold underline underline-offset-2 transition-colors"
                      style={{ color: "rgba(6,182,212,0.9)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(103,232,249,1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(6,182,212,0.9)")}
                    >
                      {didYouMean}
                    </button>
                    ?
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Paginación numerada ── */}
          {!loading && visibleResults.length > 0 && (
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
