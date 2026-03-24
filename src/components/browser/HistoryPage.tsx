import { useState, useEffect, useCallback } from "react";
import {
  History,
  Search,
  Trash2,
  ExternalLink,
  Globe,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { historyService } from "@/services/api";

interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt?: string;
  createdAt?: string;
}

interface HistoryPageProps {
  onNavigate: (url: string) => void;
}

function groupByDate(entries: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, HistoryEntry[]> = {};

  for (const entry of entries) {
    const d = new Date(entry.visitedAt ?? entry.createdAt ?? Date.now());
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "Hoy";
    else if (d.getTime() === yesterday.getTime()) label = "Ayer";
    else
      label = d.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export const HistoryPage = ({ onNavigate }: HistoryPageProps) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const data = await historyService.getHistory(q, 200);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => load(search || undefined), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const handleDelete = async (id: string) => {
    try {
      await historyService.deleteHistory(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {}
  };

  const handleClearAll = async () => {
    try {
      await historyService.clearHistory();
      setEntries([]);
      setShowClearConfirm(false);
    } catch {}
  };

  const groups = groupByDate(entries);

  return (
    <div className="h-full overflow-y-auto bg-[var(--orion-bgPrimary)] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--orion-textPrimary)]">
                Historial
              </h1>
              <p className="text-xs text-[var(--orion-textMuted)]">
                {entries.length} sitios visitados
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all duration-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Borrar todo
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--orion-textMuted)]" />
          <input
            type="text"
            placeholder="Buscar en el historial…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] text-sm text-[var(--orion-textPrimary)] placeholder-[var(--orion-textMuted)] focus:outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>

        {/* Confirm clear */}
        {showClearConfirm && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">
                ¿Borrar todo el historial? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--orion-textMuted)] hover:text-[var(--orion-textSecondary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, g) => (
              <div key={g}>
                <div className="h-4 w-16 rounded bg-[var(--orion-bgSecondary)] animate-pulse mb-3" />
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-[var(--orion-bgSecondary)] animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] flex items-center justify-center mb-4">
              <Clock className="w-7 h-7 text-[var(--orion-textMuted)]" />
            </div>
            <p className="text-base font-medium text-[var(--orion-textSecondary)]">
              {search ? "Sin resultados" : "Historial vacío"}
            </p>
            <p className="text-sm text-[var(--orion-textMuted)] mt-1">
              {search
                ? `No se encontraron resultados para "${search}"`
                : "Los sitios que visites aparecerán aquí"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(({ label, items }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-[var(--orion-textMuted)] uppercase tracking-wider mb-2 px-1">
                  {label}
                </p>
                <div className="space-y-1">
                  {items.map((entry) => (
                    <div
                      key={entry.id}
                      className="group flex items-center gap-3 p-3 rounded-xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] hover:border-[var(--orion-borderHover)] transition-all duration-200"
                    >
                      {/* Favicon */}
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/15 to-purple-500/15 border border-violet-500/10 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-3.5 h-3.5 text-violet-400" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--orion-textSecondary)] truncate group-hover:text-[var(--orion-textPrimary)] transition-colors">
                          {entry.title || entry.url}
                        </p>
                        <p className="text-[11px] text-[var(--orion-textMuted)] truncate">
                          {entry.url}
                        </p>
                      </div>

                      {/* Time */}
                      <span className="text-[10px] text-[var(--orion-textMuted)] flex-shrink-0 hidden sm:block">
                        {new Date(entry.visitedAt ?? entry.createdAt ?? "").toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {/* Actions */}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onNavigate(entry.url)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--orion-textMuted)] hover:text-violet-400 hover:bg-violet-500/10 transition-all duration-150"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--orion-textMuted)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
