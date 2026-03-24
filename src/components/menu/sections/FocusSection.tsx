import { useState } from "react";
import { Brain, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MenuContent, getErrorMessage } from "./ShareSectionUtils";
import type { BlockedSite } from "@/hooks/useMenuData";

interface FocusSectionProps {
  focusMode: boolean;
  focusTimer: number | null;
  focusElapsed: number;
  blockedSites: BlockedSite[];
  formatTimer: (ms: number) => string;
  onStartFocus: (minutes: number) => Promise<void>;
  onStopFocus: () => Promise<void>;
  onAddBlockedSite: (domain: string) => Promise<void>;
  onRemoveBlockedSite: (id: string) => Promise<void>;
}

export function FocusSection({
  focusMode,
  focusTimer,
  focusElapsed,
  blockedSites,
  formatTimer,
  onStartFocus,
  onStopFocus,
  onAddBlockedSite,
  onRemoveBlockedSite,
}: FocusSectionProps) {
  const [newBlockedSite, setNewBlockedSite] = useState("");
  const { toast } = useToast();

  const handleAddBlockedSite = async () => {
    const site = newBlockedSite.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!site) return;
    try {
      await onAddBlockedSite(site);
      setNewBlockedSite("");
      toast({ title: "Sitio bloqueado en Focus Mode", description: site });
    } catch (err: unknown) {
      toast({ title: "Error", description: getErrorMessage(err) });
    }
  };

  return (
    <MenuContent title="Focus Mode" subtitle="Concentración sin distracciones">
      {!focusMode ? (
        <div className="p-5 rounded-xl bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-indigo-500/10 border border-violet-500/15 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-8 h-8 text-violet-400" />
            <div>
              <p className="text-base font-bold text-white">Iniciar sesión de focus</p>
              <p className="text-xs text-slate-500">Bloquea sitios distractores y cuenta tu tiempo</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[15, 25, 45, 60].map((min) => (
              <button
                key={min}
                onClick={() => onStartFocus(min)}
                className="py-3 rounded-xl bg-violet-500/15 border border-violet-500/20 text-violet-300 font-bold text-sm hover:bg-violet-500/25 transition-all"
              >
                {min}m
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-gradient-to-br from-violet-500/15 via-purple-500/10 to-indigo-500/15 border border-violet-500/20 mb-4 text-center">
          <Brain className="w-10 h-10 text-violet-400 mx-auto mb-3" />
          <p className="text-3xl font-mono font-bold text-white mb-1">
            {formatTimer(focusTimer! - focusElapsed)}
          </p>
          <p className="text-xs text-violet-400/60 mb-4">Focus en progreso</p>
          <button onClick={onStopFocus} className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400 hover:bg-red-500/20 transition-all">
            Detener sesión
          </button>
        </div>
      )}

      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <p className="text-xs font-bold text-slate-300 mb-3">Sitios bloqueados durante focus</p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Agregar sitio (ej: twitter.com)"
            value={newBlockedSite}
            onChange={(e) => setNewBlockedSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddBlockedSite()}
            className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/30"
          />
          <button onClick={handleAddBlockedSite} className="px-3 py-2 rounded-lg bg-violet-500/15 border border-violet-500/20 text-xs text-violet-400 font-medium hover:bg-violet-500/25 transition-all">
            Agregar
          </button>
        </div>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {blockedSites.map((site) => (
            <div key={site.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] group">
              <span className="text-xs text-slate-400">{site.domain}</span>
              <button onClick={() => onRemoveBlockedSite(site.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </MenuContent>
  );
}