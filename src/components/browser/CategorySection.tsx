import {
  LucideIcon,
  Code,
  BookOpen,
  Wrench,
  Calendar,
  FileText,
  Cloud,
  Palette,
  Image,
  Sparkles,
} from "lucide-react";

interface CategoryItem {
  title: string;
  url: string;
  icon: string;
}

interface CategorySectionProps {
  title: string;
  items: CategoryItem[];
  onNavigate: (url: string) => void;
}

const iconMap: Record<string, LucideIcon> = {
  Code,
  BookOpen,
  Wrench,
  Calendar,
  FileText,
  Cloud,
  Palette,
  Image,
  Sparkles,
};

/** Colores rotativos para darle variedad visual */
const ACCENT_COLORS = [
  { bg: "bg-cyan-500/10",   border: "border-cyan-500/20",   text: "text-cyan-400",    hover: "group-hover:border-cyan-500/40" },
  { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400",  hover: "group-hover:border-indigo-500/40" },
  { bg: "bg-teal-500/10",   border: "border-teal-500/20",   text: "text-teal-400",    hover: "group-hover:border-teal-500/40" },
  { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400",  hover: "group-hover:border-violet-500/40" },
  { bg: "bg-amber-500/10",  border: "border-amber-500/20",  text: "text-amber-400",   hover: "group-hover:border-amber-500/40" },
  { bg: "bg-rose-500/10",   border: "border-rose-500/20",   text: "text-rose-400",    hover: "group-hover:border-rose-500/40" },
];

export const CategorySection = ({
  title,
  items,
  onNavigate,
}: CategorySectionProps) => {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-base font-bold text-slate-200">{title}</h3>
        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
        <span className="text-[11px] text-slate-600">{items.length} sitios</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {items.map((item, i) => {
          const IconComponent = iconMap[item.icon] || Code;
          const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];

          return (
            <button
              key={i}
              onClick={() => onNavigate(`https://${item.url}`)}
              className={`group flex items-center gap-3 p-3.5 rounded-xl
                bg-white/[0.02] border border-white/[0.06]
                hover:bg-white/[0.05] ${accent.hover}
                transition-all duration-250 text-left`}
            >
              {/* Icon */}
              <div
                className={`w-9 h-9 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center flex-shrink-0
                  group-hover:scale-105 transition-transform duration-200`}
              >
                <IconComponent className={`h-4 w-4 ${accent.text}`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-200 group-hover:text-white transition-colors truncate">
                  {item.title}
                </p>
                <p className="text-[11px] text-slate-600 group-hover:text-slate-400 transition-colors truncate">
                  {item.url}
                </p>
              </div>

              {/* Subtle arrow */}
              <svg
                className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
};