import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";

export function MenuContent({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function ToolCard({ icon, title, desc, accent, onClick }: { icon: React.ReactNode; title: string; desc: string; accent: string; onClick: () => void }) {
  const borderColors: Record<string, string> = {
    sky: "hover:border-sky-500/20", violet: "hover:border-violet-500/20", rose: "hover:border-rose-500/20",
    amber: "hover:border-amber-500/20", emerald: "hover:border-emerald-500/20", cyan: "hover:border-cyan-500/20",
    orange: "hover:border-orange-500/20", indigo: "hover:border-indigo-500/20", red: "hover:border-red-500/20",
    pink: "hover:border-pink-500/20", slate: "hover:border-slate-500/20",
  };
  return (
    <button onClick={onClick} className={`flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] ${borderColors[accent] || ""} transition-all duration-200 text-left group`}>
      <div className="mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform duration-200">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{title}</p>
        <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </button>
  );
}

export function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = { emerald: "text-emerald-400", amber: "text-amber-400", cyan: "text-cyan-400" };
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${colors[color] || "text-slate-300"}`}>{value}</p>
      <p className="text-[10px] text-slate-600">{label}</p>
    </div>
  );
}

export function PrivacyToggle({ icon, title, desc, initialOn = false, onChange }: { icon: React.ReactNode; title: string; desc: string; initialOn?: boolean; onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(initialOn);

  useEffect(() => {
    setOn(initialOn);
  }, [initialOn]);

  const handleToggle = () => {
    const newVal = !on;
    setOn(newVal);
    onChange?.(newVal);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
      <span className="text-slate-500 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300">{title}</p>
        <p className="text-[10px] text-slate-600">{desc}</p>
      </div>
      <button
        onClick={handleToggle}
        className={`w-10 rounded-full transition-all duration-300 flex-shrink-0 relative ${on ? "bg-emerald-500" : "bg-white/[0.1]"}`}
        style={{ height: 22 }}
      >
        <div
          className={`absolute rounded-full bg-white shadow-sm transition-all duration-300 ${on ? "left-[calc(100%-20px)]" : "left-0.5"}`}
          style={{ width: 18, height: 18, top: 2 }}
        />
      </button>
    </div>
  );
}

export function StatCard({ icon, label, value, subtitle, accent }: { icon: React.ReactNode; label: string; value: string; subtitle?: string; accent: string }) {
  const bgColors: Record<string, string> = {
    cyan: "from-cyan-500/10 to-cyan-500/5 border-cyan-500/15",
    violet: "from-violet-500/10 to-violet-500/5 border-violet-500/15",
    orange: "from-orange-500/10 to-orange-500/5 border-orange-500/15",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/15",
  };
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br border ${bgColors[accent] || ""}`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-lg font-bold text-white">{value}</p>
      {subtitle && <p className="text-[10px] text-slate-500">{subtitle}</p>}
      <p className="text-[11px] text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export function ShareOption({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 text-left group">
      <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">{title}</p>
        <p className="text-[11px] text-slate-600 truncate">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors flex-shrink-0" />
    </button>
  );
}

export function SettingsLink({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full px-3.5 py-3 rounded-xl hover:bg-white/[0.04] transition-all duration-200 text-left group">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors flex-1">{title}</span>
      <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors" />
    </button>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-700">
      {icon}
      <p className="text-sm mt-3">{text}</p>
    </div>
  );
}

export function QuickActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl hover:bg-white/[0.06] transition-all text-slate-500 hover:text-slate-200 group">
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  );
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}