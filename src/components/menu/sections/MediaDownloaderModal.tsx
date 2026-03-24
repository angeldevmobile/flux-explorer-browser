import { useState } from "react";
import { Download, Music, Video, X, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

interface MediaDownloaderModalProps {
  open: boolean;
  onClose: () => void;
  currentUrl: string;
}

type Format = "mp4" | "mp3" | "m4a";
type Quality = "4K" | "1440p" | "1080p" | "720p" | "480p";

const SUPPORTED_SITES = [
  { name: "YouTube", icon: "🎬", color: "text-red-400" },
  { name: "Twitter / X", icon: "🐦", color: "text-sky-400" },
  { name: "Instagram", icon: "📷", color: "text-pink-400" },
  { name: "TikTok", icon: "🎵", color: "text-purple-400" },
  { name: "Vimeo", icon: "🎞️", color: "text-blue-400" },
  { name: "SoundCloud", icon: "🎧", color: "text-orange-400" },
  { name: "Twitch", icon: "🟣", color: "text-violet-400" },
  { name: "Dailymotion", icon: "📺", color: "text-indigo-400" },
  { name: "Reddit", icon: "🔴", color: "text-rose-400" },
  { name: "Facebook", icon: "📘", color: "text-blue-500" },
  { name: "+1000 sitios", icon: "✨", color: "text-emerald-400" },
];

const VIDEO_QUALITIES: { value: Quality; label: string; badge?: string }[] = [
  { value: "4K", label: "4K", badge: "2160p" },
  { value: "1440p", label: "1440p", badge: "QHD" },
  { value: "1080p", label: "1080p", badge: "FHD" },
  { value: "720p", label: "720p", badge: "HD" },
  { value: "480p", label: "480p" },
];

export function MediaDownloaderModal({ open, onClose, currentUrl }: MediaDownloaderModalProps) {
  const [format, setFormat] = useState<Format>("mp4");
  const [quality, setQuality] = useState<Quality>("1080p");
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isAudio = format === "mp3" || format === "m4a";

  const sendDownload = () => {
    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
    if (!ipc) {
      setError("Motor nativo no disponible. El navegador debe ejecutarse como app nativa.");
      return;
    }
    if (!currentUrl || currentUrl === "about:blank" || currentUrl.startsWith("orion://")) {
      setError("Navega a un video o audio antes de descargar.");
      return;
    }

    setError(null);
    setDownloading(true);

    ipc.postMessage(JSON.stringify({
      cmd: "download_media",
      url: currentUrl,
      format,
      quality: isAudio ? "best" : quality,
    }));

    // Escuchar confirmación de inicio
    const onStarted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id?.startsWith("ytdl-")) {
        setDone(true);
        setDownloading(false);
        window.removeEventListener("orion:download:started", onStarted);
        setTimeout(() => {
          setDone(false);
          onClose();
        }, 1500);
      }
    };

    const onDone = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id?.startsWith("ytdl-") && detail.state === "interrupted") {
        setDownloading(false);
        setError(`Error al descargar: ${detail.filename || 'archivo desconocido'}`);
        window.removeEventListener("orion:download:done", onDone);
      }
    };

    window.addEventListener("orion:download:started", onStarted);
    window.addEventListener("orion:download:done", onDone);

    // Timeout safety
    setTimeout(() => {
      window.removeEventListener("orion:download:started", onStarted);
      window.removeEventListener("orion:download:done", onDone);
      if (downloading) setDownloading(false);
    }, 30000);
  };

  const handleClose = () => {
    if (!downloading) {
      setError(null);
      setDone(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-[480px] max-h-[90vh] overflow-y-auto bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <Download className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Descargar medios</h2>
              <p className="text-[11px] text-muted-foreground">Descarga video o audio de cualquier sitio</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={downloading}
            className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* URL actual */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">URL actual</p>
            <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/8 rounded-lg">
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-foreground truncate font-mono">
                {currentUrl || "Sin página activa"}
              </p>
            </div>
          </div>

          {/* Tipo de descarga */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tipo</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "mp4" as Format, icon: <Video className="w-4 h-4" />, label: "Video", ext: "MP4" },
                { value: "mp3" as Format, icon: <Music className="w-4 h-4" />, label: "Audio", ext: "MP3" },
                { value: "m4a" as Format, icon: <Music className="w-4 h-4" />, label: "Audio HD", ext: "M4A" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    format === opt.value
                      ? "bg-sky-500/15 border-sky-500/40 text-sky-400"
                      : "bg-white/[0.03] border-white/8 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  }`}
                >
                  {opt.icon}
                  <span className="text-[11px] font-medium">{opt.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    format === opt.value ? "bg-sky-500/20 text-sky-300" : "bg-white/8 text-muted-foreground"
                  }`}>{opt.ext}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Calidad (solo video) */}
          {!isAudio && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Calidad</p>
              <div className="flex flex-wrap gap-2">
                {VIDEO_QUALITIES.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => setQuality(q.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      quality === q.value
                        ? "bg-sky-500/15 border-sky-500/40 text-sky-400"
                        : "bg-white/[0.03] border-white/8 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                    }`}
                  >
                    {q.label}
                    {q.badge && (
                      <span className="text-[10px] opacity-60">{q.badge}</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Si la calidad seleccionada no está disponible, se descargará la mejor opción inferior.
              </p>
            </div>
          )}

          {/* Sitios soportados */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Sitios soportados</p>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_SITES.map((site) => (
                <span
                  key={site.name}
                  className="flex items-center gap-1 px-2 py-1 bg-white/[0.04] border border-white/8 rounded-lg text-[11px] text-muted-foreground"
                >
                  <span>{site.icon}</span>
                  <span className={site.color}>{site.name}</span>
                </span>
              ))}
            </div>
          </div>


          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 bg-rose-500/8 border border-rose-500/20 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-300">{error}</p>
            </div>
          )}

          {/* Éxito */}
          {done && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-[11px] text-emerald-300">Descarga iniciada. Revisa el panel de descargas.</p>
            </div>
          )}

          {/* Botón */}
          <button
            onClick={sendDownload}
            disabled={downloading || done || !currentUrl || currentUrl === "about:blank"}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
              done
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Iniciando descarga...
              </>
            ) : done ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Descarga en progreso
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Descargar {isAudio ? "audio" : `video ${quality}`}
              </>
            )}
          </button>

          <p className="text-[11px] text-muted-foreground text-center">
            La descarga aparecerá en el panel de descargas de la barra superior
          </p>
        </div>
      </div>
    </div>
  );
}
