import { Clock, Globe, Shield, TrendingUp, Calendar } from "lucide-react";
import { MenuContent, StatCard } from "./ShareSectionUtils";
import type { TodayStats, WeeklyStats } from "@/hooks/useMenuData";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Period = "today" | "7d";

interface StatsSectionProps {
  stats: TodayStats | null;
  weeklyStats: WeeklyStats | null;
}

// ── Tooltip personalizado ──
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-lg bg-[#151b2b] border border-white/10 shadow-xl">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold text-slate-200">
          {p.dataKey === "minutes" ? `${p.value}m navegando` : p.dataKey === "trackers" ? `${p.value} trackers` : `${p.value} sitios`}
        </p>
      ))}
    </div>
  );
}

// ── Mini sparkline SVG ──
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data?.length || data.every((d) => d === 0)) {
    return <div className="w-20 h-6 rounded bg-white/[0.03]" />;
  }
  const max = Math.max(...data, 1);
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * w,
    y: h - (v / max) * (h - 4) - 2,
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <defs>
        <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${color})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Colores para top sites ──
const SITE_COLORS = ["#22d3ee", "#a78bfa", "#fb923c"];

export function StatsSection({ stats, weeklyStats }: StatsSectionProps) {
  const [period, setPeriod] = useState<Period>("today");

  const todayMinutes = stats?.minutesBrowsed || 0;
  const sitesVisited = stats?.sitesVisited || 0;
  const trackersBlocked = stats?.trackersBlocked || 0;
  const hourlyUsage = stats?.hourlyUsage || [];

  const wk = weeklyStats;
  const isWeekly = period === "7d";

  // Stats según período
  const displayMinutes = isWeekly ? (wk?.totals?.minutes || 0) : todayMinutes;
  const displaySites = isWeekly ? (wk?.totals?.sites || 0) : sitesVisited;
  const displayTrackers = isWeekly ? (wk?.totals?.trackers || 0) : trackersBlocked;

  return (
    <MenuContent title="Mi actividad" subtitle="Dashboard de navegación">
      {/* ── Period Toggle ── */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06] mb-4">
        {([
          { key: "today" as Period, label: "Hoy", icon: Clock },
          { key: "7d" as Period, label: "7 días", icon: Calendar },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
              period === key
                ? "bg-cyan-500/15 text-cyan-400 shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard
          icon={<Clock className="w-4 h-4 text-cyan-400" />}
          label="Tiempo"
          value={displayMinutes >= 60 ? `${Math.floor(displayMinutes / 60)}h ${displayMinutes % 60}m` : `${displayMinutes}m`}
          accent="cyan"
        />
        <StatCard
          icon={<Globe className="w-4 h-4 text-violet-400" />}
          label="Sitios"
          value={displaySites.toString()}
          accent="violet"
        />
        <StatCard
          icon={<Shield className="w-4 h-4 text-emerald-400" />}
          label="Trackers"
          value={displayTrackers.toString()}
          accent="emerald"
        />
      </div>

      {/* ── Gráfico principal ── */}
      {isWeekly && wk ? (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-300">Actividad semanal</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[9px] text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> minutos
              </span>
              <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> trackers
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={wk.timeline} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTrackers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="minutes" stroke="#22d3ee" strokeWidth={2} fill="url(#gradMinutes)" dot={false} activeDot={{ r: 3, fill: "#22d3ee" }} />
              <Area type="monotone" dataKey="trackers" stroke="#34d399" strokeWidth={1.5} fill="url(#gradTrackers)" dot={false} activeDot={{ r: 3, fill: "#34d399" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* ── Barras horarias (vista Hoy) ── */
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-4">
          <p className="text-xs font-bold text-slate-300 mb-3">Uso por hora</p>
          <div className="flex items-end gap-[3px] h-20">
            {(hourlyUsage.length > 0
              ? hourlyUsage
              : Array.from({ length: 24 }, (_, i) => ({ hour: i, percentage: 0 }))
            ).map((h) => {
              const current = new Date().getHours() === h.hour;
              return (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-sm transition-all duration-300 ${
                      current
                        ? "bg-gradient-to-t from-cyan-500 to-teal-400"
                        : h.percentage > 0
                          ? "bg-cyan-500/30"
                          : "bg-white/[0.06]"
                    }`}
                    style={{ height: `${Math.max(h.percentage, 2)}%` }}
                    title={`${h.hour}:00 — ${h.percentage}%`}
                  />
                  {h.hour % 6 === 0 && (
                    <span className="text-[7px] text-slate-700">{h.hour}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Top Sites con sparklines ── */}
      {isWeekly && wk && wk.topSites.length > 0 ? (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <p className="text-xs font-bold text-slate-300">Top sitios — 7 días</p>
          </div>
          <div className="space-y-2.5">
            {wk.topSites.map((site, i) => (
              <div key={site.domain} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold"
                  style={{ backgroundColor: `${SITE_COLORS[i]}15`, color: SITE_COLORS[i] }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-300 truncate">
                    {site.domain}
                  </p>
                  <p className="text-[9px] text-slate-600">{site.totalMinutes}m total</p>
                </div>
                <Sparkline data={site.trend} color={SITE_COLORS[i]} />
              </div>
            ))}
          </div>
        </div>
      ) : !isWeekly && stats?.topSites && stats.topSites.length > 0 ? (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <p className="text-xs font-bold text-slate-300">Top sitios — Hoy</p>
          </div>
          <div className="space-y-2">
            {stats.topSites.slice(0, 5).map((site, i) => (
              <div key={site.domain} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold"
                    style={{
                      backgroundColor: `${SITE_COLORS[i % 3]}15`,
                      color: SITE_COLORS[i % 3],
                    }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">{site.domain}</p>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0">{site.minutes}m</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </MenuContent>
  );
}