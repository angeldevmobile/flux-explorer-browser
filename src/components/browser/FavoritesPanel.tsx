import { Star, Trash2, ExternalLink } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorite";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface FavoritesPanelProps {
  onNavigate: (url: string) => void;
}

const GRADIENTS = [
  "from-cyan-500/20 to-teal-500/20 border-cyan-500/15",
  "from-violet-500/20 to-purple-500/20 border-violet-500/15",
  "from-amber-500/20 to-orange-500/20 border-amber-500/15",
  "from-rose-500/20 to-pink-500/20 border-rose-500/15",
  "from-emerald-500/20 to-green-500/20 border-emerald-500/15",
  "from-blue-500/20 to-sky-500/20 border-blue-500/15",
];

const ICON_COLORS = [
  "text-cyan-400", "text-violet-400", "text-amber-400",
  "text-rose-400", "text-emerald-400", "text-blue-400",
];

export const FavoritesPanel = ({ onNavigate }: FavoritesPanelProps) => {
  const { favorites, removeFavorite } = useFavorites();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-400 hover:bg-white/[0.06] transition-all duration-200">
          <Star className="h-4 w-4" />
          {favorites.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan-500 text-[10px] font-bold text-white flex items-center justify-center">
              {favorites.length}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[380px] sm:w-[420px] bg-[#0d1117] border-l border-white/[0.06] p-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-slate-200">
                Favoritos
              </SheetTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {favorites.length}{" "}
                {favorites.length === 1 ? "sitio guardado" : "sitios guardados"}
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-4">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                  <Star className="h-7 w-7 text-slate-700" />
                </div>
                <p className="text-sm font-medium text-slate-400">
                  Sin favoritos aún
                </p>
                <p className="text-xs text-slate-600 mt-1.5 max-w-[220px]">
                  Haz clic en la estrella de la barra de direcciones para guardar sitios
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {favorites.map((fav, i) => {
                  const ci = i % GRADIENTS.length;
                  return (
                    <div
                      key={fav.id}
                      className={`group flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${GRADIENTS[ci]} border hover:opacity-90 transition-all duration-200`}
                    >
                      {/* Initial icon */}
                      <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center flex-shrink-0">
                        <span className={`text-[11px] font-bold ${ICON_COLORS[ci]}`}>
                          {fav.title.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                          {fav.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {fav.url.replace(/^https?:\/\//, "").replace(/^www\./, "")}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          onClick={() => onNavigate(fav.url)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-150"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeFavorite(fav.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
