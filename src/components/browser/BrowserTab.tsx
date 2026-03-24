import { X } from "lucide-react";

interface BrowserTabProps {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  favicon?: string;
  discarded?: boolean;
  isLoading?: boolean;
}

export const BrowserTab = ({
  title,
  isActive,
  onSelect,
  onClose,
  favicon,
  discarded,
  isLoading,
}: BrowserTabProps) => {
  return (
    <div
      onClick={onSelect}
      className={`
        group relative flex items-center gap-2.5 pl-3.5 pr-2 py-2 min-w-[140px] max-w-[220px]
        cursor-pointer transition-all duration-200 select-none
        ${
          isActive
            ? "bg-slate-900/80 border border-white/[0.08] border-b-transparent rounded-t-xl shadow-[0_-2px_12px_-4px_rgba(6,182,212,0.15)] z-10 -mb-px"
            : "bg-transparent hover:bg-white/[0.04] rounded-t-lg border border-transparent"
        }
      `}
    >
      {/* Indicador activo */}
      {isActive && (
        <div className="absolute top-0 left-3 right-3 h-[2px] bg-gradient-to-r from-cyan-500 via-cyan-400 to-teal-400 rounded-b-full" />
      )}

      {/* Favicon / spinner / indicador de descarte */}
      <div className="flex-shrink-0 relative w-4 h-4">
        {isLoading ? (
          <svg
            className="w-4 h-4 animate-spin text-cyan-400"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="8" cy="8" r="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="28"
              strokeDashoffset="10"
              strokeLinecap="round"
              opacity="0.3"
            />
            <circle
              cx="8" cy="8" r="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="9"
              strokeDashoffset="0"
              strokeLinecap="round"
            />
          </svg>
        ) : favicon && !discarded ? (
          <img src={favicon} alt="" className="w-4 h-4 rounded-sm" />
        ) : (
          <div
            className={`w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold ${
              discarded
                ? "bg-slate-800 text-slate-500"
                : isActive
                ? "bg-gradient-to-br from-cyan-500 to-teal-400 text-white shadow-sm shadow-cyan-500/30"
                : "bg-slate-700 text-slate-400"
            }`}
          >
            {discarded ? "💤" : title.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Title */}
      <span
        className={`text-[13px] truncate flex-1 transition-colors duration-200 ${
          isActive
            ? "text-slate-200 font-medium"
            : "text-slate-500 group-hover:text-slate-300"
        }`}
      >
        {title}
      </span>

      {/* Close */}
      <button
        className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-150
          ${
            isActive
              ? "text-slate-500 hover:text-slate-200 hover:bg-white/[0.08]"
              : "opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 hover:bg-white/[0.08]"
          }
        `}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};
