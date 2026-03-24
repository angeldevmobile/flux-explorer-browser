import { TrendingUp, Clock, Search } from "lucide-react";

interface SearchSuggestionProps {
  text: string;
  type: "trending" | "recent" | "suggestion";
  onClick: () => void;
}

const TYPE_STYLES = {
  trending: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: "text-amber-400",
    label: "Tendencia",
    labelColor: "text-amber-500/60",
  },
  recent: {
    bg: "bg-slate-500/10",
    border: "border-slate-500/15",
    icon: "text-slate-400",
    label: "Reciente",
    labelColor: "text-slate-600",
  },
  suggestion: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    icon: "text-cyan-400",
    label: "Sugerencia",
    labelColor: "text-cyan-500/60",
  },
};

const ICONS = {
  trending: TrendingUp,
  recent: Clock,
  suggestion: Search,
};

export const SearchSuggestion = ({
  text,
  type,
  onClick,
}: SearchSuggestionProps) => {
  const style = TYPE_STYLES[type];
  const Icon = ICONS[type];

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl
        hover:bg-white/[0.04] transition-all duration-200 text-left"
    >
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg ${style.bg} border ${style.border} flex items-center justify-center flex-shrink-0
          group-hover:scale-105 transition-transform duration-200`}
      >
        <Icon className={`h-3.5 w-3.5 ${style.icon}`} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">
          {text}
        </p>
      </div>

      {/* Type label */}
      <span
        className={`text-[10px] uppercase tracking-wider font-medium ${style.labelColor} flex-shrink-0`}
      >
        {style.label}
      </span>

      {/* Arrow on hover */}
      <svg
        className="w-3.5 h-3.5 text-slate-700 opacity-0 group-hover:opacity-100 group-hover:text-slate-400 transition-all duration-200 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
};
