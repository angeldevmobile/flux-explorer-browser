import { ChevronLeft, ChevronRight, Home, Menu } from "lucide-react";

interface NavigationControlsProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onHome: () => void;
  onMenu: () => void;
}

export const NavigationControls = ({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onHome,
  onMenu,
}: NavigationControlsProps) => {
  const btnBase =
    "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200";
  const btnEnabled =
    "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] active:scale-95";
  const btnDisabled = "text-slate-700 cursor-not-allowed";

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onBack}
        disabled={!canGoBack}
        className={`${btnBase} ${canGoBack ? btnEnabled : btnDisabled}`}
      >
        <ChevronLeft className="h-[18px] w-[18px]" />
      </button>

      <button
        onClick={onForward}
        disabled={!canGoForward}
        className={`${btnBase} ${canGoForward ? btnEnabled : btnDisabled}`}
      >
        <ChevronRight className="h-[18px] w-[18px]" />
      </button>

      <button onClick={onHome} className={`${btnBase} ${btnEnabled}`}>
        <Home className="h-4 w-4" />
      </button>

      <div className="w-px h-5 bg-white/[0.06] mx-1" />

      <button onClick={onMenu} className={`${btnBase} ${btnEnabled}`}>
        <Menu className="h-4 w-4" />
      </button>
    </div>
  );
};
