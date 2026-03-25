import { useState, useEffect, useCallback } from "react";
import {
  Download, X, FolderOpen, ExternalLink, CheckCircle2,
  XCircle, ChevronDown, Trash2,
} from "lucide-react";
import type { DownloadEntry } from "@/lib/window";
import { useAuth } from "@/hooks/useAuth";
import { mediaService } from "@/services/api";

interface DownloadsPanelProps {
  onNavigate: (url: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function DownloadItem({ dl, onOpen, onFolder, onCancel }: {
  dl: DownloadEntry;
  onOpen: () => void;
  onFolder: () => void;
  onCancel: () => void;
}) {
  const progress = dl.totalBytes > 0 ? (dl.receivedBytes / dl.totalBytes) * 100 : 0;
  const isActive = dl.state === "progressing";
  const isDone = dl.state === "completed";
  const isFailed = dl.state === "cancelled" || dl.state === "interrupted";

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/[0.04] transition-colors group">
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {isFailed && <XCircle className="w-4 h-4 text-rose-400" />}
        {isActive && (
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{dl.filename}</p>
        {isActive && (
          <>
            <div className="w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatBytes(dl.receivedBytes)}
              {dl.totalBytes > 0 && ` / ${formatBytes(dl.totalBytes)}`}
              {dl.speed > 0 && ` · ${formatSpeed(dl.speed)}`}
            </p>
          </>
        )}
        {isDone && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatBytes(dl.totalBytes)}</p>
        )}
        {isFailed && (
          <p className="text-[10px] text-rose-400 mt-0.5">Cancelado o interrumpido</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isDone && (
          <>
            <button onClick={onOpen} title="Abrir archivo"
              className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button onClick={onFolder} title="Mostrar en carpeta"
              className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {isActive && (
          <button onClick={onCancel} title="Cancelar"
            className="p-1 rounded-md hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function inferType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mkv", "avi", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "audio";
  return "file";
}

export function DownloadsPanel({ onNavigate }: DownloadsPanelProps) {
  const { isAuthenticated } = useAuth();
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  // Merge helper — mantiene activos + historial sin duplicados
  const merge = useCallback((updates: DownloadEntry[]) => {
    setDownloads((prev) => {
      const map = new Map(prev.map((d) => [d.id, d]));
      for (const d of updates) map.set(d.id, d);
      return Array.from(map.values()).sort((a, b) => b.startTime - a.startTime);
    });
  }, []);

  useEffect(() => {
    // Cargar historial desde BD si está autenticado
    if (isAuthenticated) {
      mediaService.getDownloadHistory().then((items) => {
        if (!items) return;
        const mapped: DownloadEntry[] = items.map((item: { id: string; url: string; title: string; size?: number; createdAt: string }) => ({
          id: item.id,
          filename: item.title,
          url: item.url,
          savePath: "",
          state: "completed" as const,
          receivedBytes: item.size ?? 0,
          totalBytes: item.size ?? 0,
          speed: 0,
          startTime: new Date(item.createdAt).getTime(),
          endTime: new Date(item.createdAt).getTime(),
        }));
        setDownloads(mapped);
      }).catch(() => {});
    }

    // Escuchar eventos IPC que Rust despacha al chrome WebView
    const onStarted = (e: Event) => {
      const d = (e as CustomEvent<DownloadEntry>).detail;
      merge([d]);
      setHasNew(true);
      setIsOpen(true);
    };
    const onProgress = (e: Event) => {
      merge([(e as CustomEvent<DownloadEntry>).detail]);
    };
    const onDone = (e: Event) => {
      const d = (e as CustomEvent<DownloadEntry>).detail;
      merge([d]);
      setHasNew(true);
      if (isAuthenticated && d.state === "completed") {
        mediaService.recordDownload({
          url: d.url,
          title: d.filename,
          type: inferType(d.filename),
          size: d.totalBytes,
          sourceUrl: d.url,
        }).catch(() => {});
      }
    };

    window.addEventListener("orion:download:started", onStarted);
    window.addEventListener("orion:download:progress", onProgress);
    window.addEventListener("orion:download:done", onDone);

    return () => {
      window.removeEventListener("orion:download:started", onStarted);
      window.removeEventListener("orion:download:progress", onProgress);
      window.removeEventListener("orion:download:done", onDone);
    };
  }, [isAuthenticated, merge]);

  const activeCount = downloads.filter((d) => d.state === "progressing").length;

  const handleClearHistory = () => {
    setDownloads((prev) => prev.filter((d) => d.state === "progressing"));
  };

  if (downloads.length === 0 && !isOpen) return null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => { setIsOpen(!isOpen); setHasNew(false); }}
        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
          isOpen
            ? "bg-primary/15 text-primary border-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-hoverBg border-transparent hover:border-border"
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        {activeCount > 0 && (
          <span className="text-[10px] font-bold text-primary">{activeCount}</span>
        )}
        {hasNew && activeCount === 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-browser-chrome border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-xs font-semibold text-foreground">
              Descargas {activeCount > 0 && <span className="text-primary">({activeCount} activas)</span>}
            </span>
            <div className="flex items-center gap-1">
              {downloads.some((d) => d.state !== "progressing") && (
                <button onClick={handleClearHistory}
                  className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="Limpiar historial">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => { onNavigate("flux://settings/downloads"); setIsOpen(false); }}
                className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Ver todas las descargas">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsOpen(false)}
                className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {downloads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Download className="w-6 h-6 mb-2 opacity-30" />
                <p className="text-xs">Sin descargas</p>
              </div>
            ) : (
              downloads.slice(0, 20).map((dl) => (
                <DownloadItem
                  key={dl.id}
                  dl={dl}
                  onOpen={() => {
                    if (dl.savePath) window.open("file://" + dl.savePath);
                  }}
                  onFolder={() => {
                    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
                    ipc?.postMessage(JSON.stringify({ cmd: "show_in_folder", path: dl.savePath }));
                  }}
                  onCancel={() => {
                    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
                    ipc?.postMessage(JSON.stringify({ cmd: "cancel_download", id: dl.id }));
                    setDownloads((prev) => prev.filter((d) => d.id !== dl.id));
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
