import { Globe, ExternalLink, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useOrionSearch } from "@/hooks/useOrionSearch";
import { OrionLogo } from "@/components/browser/OrionLogo";

interface SearchResultsPanelProps {
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

export const SearchResultsPanel = ({ query, onNavigate }: SearchResultsPanelProps) => {
  const { results, loading, error, page, hasMore, nextPage, prevPage } = useOrionSearch(query);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value.trim();
    if (input) onNavigate(`flux://search?q=${encodeURIComponent(input)}`);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ── HEADER: logo · título · barra de búsqueda en una sola fila ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
        style={{
          background: "linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(0,0,0,0) 60%)",
          borderBottom: "1px solid rgba(6,182,212,0.12)",
        }}
      >
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
          <OrionLogo size={18} />
        </div>

        {/* Título */}
        <div className="flex-shrink-0 leading-tight">
          <p className="text-[11px] font-bold text-foreground tracking-wide">Flux</p>
          <p className="text-[9px] text-cyan-400/50 uppercase tracking-[0.2em]">Search</p>
        </div>

        {/* Divisor */}
        <div className="flex-shrink-0 w-px h-6 bg-border/30" />

        {/* Barra de búsqueda */}
        <form onSubmit={handleSearch} className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-cyan-400/40 pointer-events-none" />
            <input
              name="q"
              defaultValue={query}
              className="w-full bg-muted/15 border border-border/30 rounded-full pl-8 pr-10 py-1.5
                text-xs text-foreground placeholder:text-muted-foreground/30
                focus:outline-none focus:border-cyan-500/40 focus:bg-muted/25
                transition-all duration-200"
              placeholder="Buscar…"
            />
            <button
              type="submit"
              className="absolute right-2 flex items-center justify-center w-5 h-5 rounded-full
                bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/20 hover:border-cyan-500/40
                text-cyan-400/60 hover:text-cyan-300 transition-all duration-150"
            >
              <Search className="w-2.5 h-2.5" />
            </button>
          </div>
        </form>

        {/* Spinner de carga */}
        {loading && (
          <div className="flex-shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400/60" />
          </div>
        )}
      </div>

      {/* ── RESULTADOS ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
        <div className="px-3 py-3 space-y-2">

          {/* Conteo de resultados */}
          {!loading && results.length > 0 && (
            <div className="flex items-center gap-1.5 px-1 pb-1">
              <Zap className="w-3 h-3 text-cyan-400/50" />
              <p className="text-[10px] text-muted-foreground/40">
                <span className="text-cyan-400/70 font-semibold">{results.length}</span> resultados para{" "}
                <span className="text-foreground/50 italic">"{query}"</span>
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/8 border border-red-500/15">
              <AlertCircle className="w-3.5 h-3.5 text-red-400/80 flex-shrink-0" />
              <p className="text-xs text-red-400/80">{error}</p>
            </div>
          )}

          {/* Skeleton */}
          {loading && results.length === 0 && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-border/20 animate-pulse space-y-2"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-md bg-muted/25" />
                    <div className="h-2.5 bg-muted/20 rounded-full w-24" />
                  </div>
                  <div className="h-3 bg-muted/20 rounded-full w-5/6" />
                  <div className="h-2 bg-muted/15 rounded-full w-full" />
                  <div className="h-2 bg-muted/10 rounded-full w-4/5" />
                </div>
              ))}
            </div>
          )}

          {/* Cards de resultados */}
          {results.map((result, i) => {
            const favicon = getFavicon(result.url);
            const domain = getDomain(result.url);
            return (
              <button
                key={i}
                onClick={() => onNavigate(result.url)}
                className="w-full text-left rounded-xl border border-border/20 overflow-hidden
                  hover:border-cyan-500/25 transition-all duration-200 group relative"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                {/* Borde izquierdo luminoso */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: "linear-gradient(180deg, #06b6d4, #0ea5e9)" }}
                />

                <div className="px-3 pt-2.5 pb-2.5 pl-4">
                  {/* Dominio + icono externo */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {favicon ? (
                        <img
                          src={favicon}
                          className="w-3.5 h-3.5 rounded-sm flex-shrink-0 opacity-70"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full truncate"
                        style={{
                          background: "rgba(6,182,212,0.08)",
                          border: "1px solid rgba(6,182,212,0.15)",
                          color: "rgba(6,182,212,0.6)",
                        }}
                      >
                        {domain}
                      </span>
                    </div>
                    <ExternalLink
                      className="w-3 h-3 flex-shrink-0 text-muted-foreground/20
                        group-hover:text-cyan-400/50 transition-colors duration-150"
                    />
                  </div>

                  {/* Título */}
                  <p
                    className="text-[12px] font-semibold leading-snug mb-1 line-clamp-2
                      text-foreground/80 group-hover:text-cyan-300/90 transition-colors duration-150"
                  >
                    {result.title}
                  </p>

                  {/* Descripción */}
                  {result.content && (
                    <p className="text-[10.5px] text-muted-foreground/45 line-clamp-2 leading-relaxed">
                      {result.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })}

          {/* Sin resultados */}
          {!loading && !error && results.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(6,182,212,0.05)",
                  border: "1px solid rgba(6,182,212,0.1)",
                }}
              >
                <Search className="w-5 h-5 text-cyan-400/30" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground/40">Sin resultados</p>
                <p className="text-[10px] text-muted-foreground/30 mt-0.5">para "{query}"</p>
              </div>
            </div>
          )}

          {/* ── Paginación ── */}
          {!loading && results.length > 0 && (
            <div
              className="flex items-center justify-between pt-2 mt-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <button
                onClick={prevPage}
                disabled={page === 1}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px]
                  border border-border/20 text-muted-foreground/40
                  hover:border-cyan-500/25 hover:text-cyan-400 hover:bg-cyan-500/5
                  disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
              >
                <ChevronLeft className="w-3 h-3" />
                Anterior
              </button>

              <div className="flex items-center gap-1.5">
                <OrionLogo size={10} />
                <span className="text-[10px] text-muted-foreground/30">
                  Página <span className="text-cyan-400/60 font-semibold">{page}</span>
                </span>
              </div>

              <button
                onClick={nextPage}
                disabled={!hasMore}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px]
                  border border-border/20 text-muted-foreground/40
                  hover:border-cyan-500/25 hover:text-cyan-400 hover:bg-cyan-500/5
                  disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
              >
                Siguiente
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
