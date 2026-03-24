import { useState } from "react";
import { Star, Trash2, ExternalLink, Search, Globe } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorite";

interface BookmarksPageProps {
  onNavigate: (url: string) => void;
}

const CARD_GRADIENTS = [
  "from-cyan-500/20 to-teal-500/20 border-cyan-500/15",
  "from-violet-500/20 to-purple-500/20 border-violet-500/15",
  "from-amber-500/20 to-orange-500/20 border-amber-500/15",
  "from-rose-500/20 to-pink-500/20 border-rose-500/15",
  "from-emerald-500/20 to-green-500/20 border-emerald-500/15",
  "from-blue-500/20 to-sky-500/20 border-blue-500/15",
];

const ICON_COLORS = [
  "text-cyan-400",
  "text-violet-400",
  "text-amber-400",
  "text-rose-400",
  "text-emerald-400",
  "text-blue-400",
];

export const BookmarksPage = ({ onNavigate }: BookmarksPageProps) => {
  const { favorites, removeFavorite } = useFavorites();
  const [search, setSearch] = useState("");

  const filtered = favorites.filter(
    (f) =>
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto bg-[var(--orion-bgPrimary)] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Star className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--orion-textPrimary)]">
              Favoritos
            </h1>
            <p className="text-xs text-[var(--orion-textMuted)]">
              {favorites.length}{" "}
              {favorites.length === 1 ? "sitio guardado" : "sitios guardados"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--orion-textMuted)]" />
          <input
            type="text"
            placeholder="Buscar en favoritos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] text-sm text-[var(--orion-textPrimary)] placeholder-[var(--orion-textMuted)] focus:outline-none focus:border-amber-500/40 transition-colors"
          />
        </div>

        {/* Empty */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] flex items-center justify-center mb-4">
              <Star className="w-7 h-7 text-[var(--orion-textMuted)]" />
            </div>
            <p className="text-base font-medium text-[var(--orion-textSecondary)]">
              {search ? "Sin resultados" : "Sin favoritos aún"}
            </p>
            <p className="text-sm text-[var(--orion-textMuted)] mt-1">
              {search
                ? `No se encontraron resultados para "${search}"`
                : "Haz clic en la estrella de la barra de direcciones para guardar sitios"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((fav, i) => {
              const colorIdx = i % CARD_GRADIENTS.length;
              return (
                <div
                  key={fav.id}
                  className={`group relative flex flex-col p-4 rounded-2xl bg-gradient-to-br ${CARD_GRADIENTS[colorIdx]} border hover:scale-[1.02] transition-all duration-200 cursor-pointer`}
                  onClick={() => onNavigate(fav.url)}
                >
                  {/* Icon + title */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-xl bg-[var(--orion-bgPrimary)]/60 flex items-center justify-center flex-shrink-0`}>
                      <Globe className={`w-4 h-4 ${ICON_COLORS[colorIdx]}`} />
                    </div>
                    <p className="text-sm font-semibold text-[var(--orion-textPrimary)] truncate flex-1">
                      {fav.title}
                    </p>
                  </div>

                  {/* URL */}
                  <p className="text-[11px] text-[var(--orion-textMuted)] truncate mb-3">
                    {fav.url.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-auto">
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate(fav.url); }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--orion-textSecondary)] hover:text-[var(--orion-textPrimary)] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Abrir
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFavorite(fav.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--orion-textMuted)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
