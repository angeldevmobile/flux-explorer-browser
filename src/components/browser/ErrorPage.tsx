import { WifiOff, ShieldAlert, Globe, RefreshCw, ArrowLeft, Bug } from "lucide-react";

export type ErrorCode =
  | "ERR_NAME_NOT_RESOLVED"
  | "ERR_CONNECTION_REFUSED"
  | "ERR_CONNECTION_TIMED_OUT"
  | "ERR_NETWORK_CHANGED"
  | "ERR_SSL_PROTOCOL_ERROR"
  | "ERR_CERT_AUTHORITY_INVALID"
  | "ERR_ABORTED"
  | "CRASH"
  | string;

interface ErrorPageProps {
  url: string;
  code?: ErrorCode;
  onRetry: () => void;
  onBack: () => void;
}

function getErrorInfo(code?: ErrorCode): {
  Icon: typeof WifiOff;
  title: string;
  desc: string;
  iconColor: string;
  glowColor: string;
  borderColor: string;
} {
  switch (code) {
    case "ERR_NAME_NOT_RESOLVED":
      return {
        Icon: Globe,
        title: "No se encontró el sitio",
        desc: "El dominio no existe o no se pudo resolver. Revisa que la dirección esté bien escrita.",
        iconColor: "text-amber-400",
        glowColor: "bg-amber-500/5",
        borderColor: "border-amber-500/20",
      };
    case "ERR_CONNECTION_REFUSED":
      return {
        Icon: Bug,
        title: "Conexión rechazada",
        desc: "El servidor rechazó la conexión. Es posible que el sitio esté caído o bloqueado.",
        iconColor: "text-rose-400",
        glowColor: "bg-rose-500/5",
        borderColor: "border-rose-500/20",
      };
    case "ERR_CONNECTION_TIMED_OUT":
    case "ERR_NETWORK_CHANGED":
      return {
        Icon: WifiOff,
        title: "Sin conexión",
        desc: "No se pudo conectar al sitio. Verifica tu conexión a internet e inténtalo de nuevo.",
        iconColor: "text-slate-400",
        glowColor: "bg-slate-500/5",
        borderColor: "border-slate-500/20",
      };
    case "ERR_SSL_PROTOCOL_ERROR":
    case "ERR_CERT_AUTHORITY_INVALID":
      return {
        Icon: ShieldAlert,
        title: "Conexión no segura",
        desc: "El certificado SSL del sitio no es válido. No es seguro continuar.",
        iconColor: "text-red-400",
        glowColor: "bg-red-500/5",
        borderColor: "border-red-500/20",
      };
    case "CRASH":
      return {
        Icon: Bug,
        title: "La página falló",
        desc: "El motor de renderizado tuvo un error inesperado. Inténtalo de nuevo.",
        iconColor: "text-rose-400",
        glowColor: "bg-rose-500/5",
        borderColor: "border-rose-500/20",
      };
    default:
      return {
        Icon: WifiOff,
        title: "No se pudo cargar",
        desc: "Ocurrió un error al intentar cargar esta página.",
        iconColor: "text-slate-400",
        glowColor: "bg-slate-500/5",
        borderColor: "border-slate-500/20",
      };
  }
}

export function ErrorPage({ url, code, onRetry, onBack }: ErrorPageProps) {
  const { Icon, title, desc, iconColor, glowColor, borderColor } = getErrorInfo(code);

  let displayUrl = url;
  try {
    displayUrl = new URL(url).hostname;
  } catch { /* use raw url */ }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0e1a] px-6 text-center">
      {/* Icon */}
      <div className="relative mb-8">
        <div className={`w-24 h-24 rounded-3xl ${glowColor} border ${borderColor} flex items-center justify-center`}>
          <Icon className={`w-10 h-10 ${iconColor}`} />
        </div>
        <div className={`absolute -inset-3 rounded-[32px] ${glowColor} blur-2xl`} />
      </div>

      {/* Text */}
      <h2 className="text-2xl font-bold text-slate-100 mb-3">{title}</h2>
      <p className="text-sm text-slate-500 leading-relaxed max-w-xs mb-2">{desc}</p>

      {/* URL pill */}
      <div className="mb-8 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-xs text-slate-600 font-mono truncate max-w-[280px]">{displayUrl}</p>
      </div>

      {/* Error code badge */}
      {code && (
        <p className="text-[10px] text-slate-700 font-mono mb-6">{code}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-sm text-slate-400 hover:text-slate-200 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Atrás
        </button>
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    </div>
  );
}
