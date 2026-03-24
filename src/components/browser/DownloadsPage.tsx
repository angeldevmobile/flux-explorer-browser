import { useState, useEffect, useCallback } from "react";
import {
  Download, X, FolderOpen, ExternalLink,
  CheckCircle2, XCircle, Trash2, Search,
} from "lucide-react";
import type { DownloadEntry } from "@/lib/window";
import { useAuth } from "@/hooks/useAuth";
import { mediaService } from "@/services/api";

interface DownloadsPageProps {
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

function inferType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mkv", "avi", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "audio";
  return "file";
}

function getFileIcon(filename: string): string {
  const type = inferType(filename);
  if (type === "image") return "🖼️";
  if (type === "video") return "🎬";
  if (type === "audio") return "🎵";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "📄";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
  if (["exe", "msi", "dmg"].includes(ext)) return "⚙️";
  return "📁";
}

export function DownloadsPage({ onNavigate: _onNavigate }: DownloadsPageProps) {
  const { isAuthenticated } = useAuth();
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const merge = useCallback((updates: DownloadEntry[]) => {
    setDownloads((prev) => {
      const map = new Map(prev.map((d) => [d.id, d]));
      for (const d of updates) map.set(d.id, d);
      return Array.from(map.values()).sort((a, b) => b.startTime - a.startTime);
    });
  }, []);

  useEffect(() => {
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
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    const onStarted = (e: Event) => merge([(e as CustomEvent<DownloadEntry>).detail]);
    const onProgress = (e: Event) => merge([(e as CustomEvent<DownloadEntry>).detail]);
    const onDone = (e: Event) => {
      const d = (e as CustomEvent<DownloadEntry>).detail;
      merge([d]);
      if (isAuthenticated && d.state === "completed") {
        mediaService.recordDownload({
          url: d.url, title: d.filename,
          type: inferType(d.filename), size: d.totalBytes, sourceUrl: d.url,
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

  const filtered = downloads.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = downloads.filter((d) => d.state === "progressing").length;

  const handleClearCompleted = () => {
    setDownloads((prev) => prev.filter((d) => d.state === "progressing"));
  };

  const handleCancel = (id: string) => {
    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
    ipc?.postMessage(JSON.stringify({ cmd: "cancel_download", id }));
    setDownloads((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--orion-bgPrimary)] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--orion-textPrimary)]">Descargas</h1>
              <p className="text-xs text-[var(--orion-textMuted)]">
                {activeCount > 0 ? `${activeCount} activa${activeCount > 1 ? "s" : ""}` : `${downloads.length} archivos`}
              </p>
            </div>
          </div>

          {downloads.some((d) => d.state !== "progressing") && (
            <button
              onClick={handleClearCompleted}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-[var(--orion-textMuted)] border border-[var(--orion-border)] hover:bg-[var(--orion-bgSecondary)] transition-all duration-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar completadas
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--orion-textMuted)]" />
          <input
            type="text"
            placeholder="Buscar descargas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] text-sm text-[var(--orion-textPrimary)] placeholder-[var(--orion-textMuted)] focus:outline-none focus:border-emerald-500/40 transition-colors"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-[var(--orion-bgSecondary)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] flex items-center justify-center mb-4">
              <Download className="w-7 h-7 text-[var(--orion-textMuted)]" />
            </div>
            <p className="text-base font-medium text-[var(--orion-textSecondary)]">
              {search ? "Sin resultados" : "Sin descargas"}
            </p>
            <p className="text-sm text-[var(--orion-textMuted)] mt-1">
              {search ? `No hay archivos que coincidan con "${search}"` : "Los archivos que descargues aparecerán aquí"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((dl) => {
              const isActive = dl.state === "progressing";
              const isDone = dl.state === "completed";
              const isFailed = dl.state === "cancelled" || dl.state === "interrupted";
              const progress = dl.totalBytes > 0 ? (dl.receivedBytes / dl.totalBytes) * 100 : 0;

              return (
                <div
                  key={dl.id}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] hover:border-[var(--orion-borderHover)] transition-all duration-200"
                >
                  {/* File type icon */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/10 flex items-center justify-center flex-shrink-0 text-lg">
                    {getFileIcon(dl.filename)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--orion-textSecondary)] truncate group-hover:text-[var(--orion-textPrimary)] transition-colors">
                      {dl.filename}
                    </p>

                    {isActive && (
                      <div className="mt-1.5">
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--orion-textMuted)] mt-1">
                          {formatBytes(dl.receivedBytes)}
                          {dl.totalBytes > 0 && ` / ${formatBytes(dl.totalBytes)}`}
                          {dl.speed > 0 && ` · ${formatSpeed(dl.speed)}`}
                        </p>
                      </div>
                    )}

                    {isDone && (
                      <p className="text-[11px] text-emerald-400/80 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Completado · {dl.totalBytes > 0 ? formatBytes(dl.totalBytes) : ""}
                      </p>
                    )}

                    {isFailed && (
                      <p className="text-[11px] text-red-400/80 mt-0.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Cancelado o interrumpido
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {isDone && dl.savePath && (
                      <>
                        <button
                          onClick={() => window.open("file://" + dl.savePath)}
                          title="Abrir archivo"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--orion-textMuted)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-150"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
                            ipc?.postMessage(JSON.stringify({ cmd: "show_in_folder", path: dl.savePath }));
                          }}
                          title="Mostrar en carpeta"
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--orion-textMuted)] hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-150"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {isActive && (
                      <button
                        onClick={() => handleCancel(dl.id)}
                        title="Cancelar"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--orion-textMuted)] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
