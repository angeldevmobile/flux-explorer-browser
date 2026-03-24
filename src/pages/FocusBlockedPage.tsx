import { Brain, ArrowLeft, Clock } from "lucide-react";

interface FocusBlockedPageProps {
  domain: string;
  timeRemaining: string;
  onGoBack: () => void;
}

export function FocusBlockedPage({ domain, timeRemaining, onGoBack }: FocusBlockedPageProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0e17]">
      <div className="text-center max-w-md px-6">
        {/* Icono */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
          <Brain className="w-10 h-10 text-violet-400" />
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Sitio bloqueado
        </h1>
        <p className="text-slate-400 mb-6">
          <span className="text-violet-400 font-semibold">{domain}</span> está
          bloqueado durante tu sesión de Focus.
        </p>

        {/* Tiempo restante */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/15 mb-8">
          <Clock className="w-4 h-4 text-violet-400" />
          <span className="text-sm text-violet-300 font-mono font-bold">
            {timeRemaining}
          </span>
          <span className="text-xs text-violet-400/60">restantes</span>
        </div>

        {/* Mensaje motivacional */}
        <p className="text-sm text-slate-600 mb-8">
          🧠 Mantén el enfoque. Puedes visitar este sitio cuando termine tu sesión.
        </p>

        {/* Botón volver */}
        <button
          onClick={onGoBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 hover:bg-white/[0.08] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver atrás
        </button>
      </div>
    </div>
  );
}