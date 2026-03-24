import { useState, useEffect } from "react";
import { X, Download, CheckSquare, Square, Image, Video, Music2, ExternalLink } from "lucide-react";
import { useMediaGallery } from "@/hooks/useMediaGallery";
import type { MediaItem } from "@/services/api";

interface MediaGalleryModalProps {
  open: boolean;
  onClose: () => void;
}

type TabType = "all" | "image" | "video" | "audio";

export function MediaGalleryModal({ open, onClose }: MediaGalleryModalProps) {
  const {
    media, images, videos, audios,
    loading, selected, scanPage,
    toggleSelect, selectAll, clearSelection,
    downloadSingle, downloadSelected,
  } = useMediaGallery();
  const [tab, setTab] = useState<TabType>("all");

  // Auto-escanear al abrir
  useEffect(() => {
    if (open) scanPage();
  }, [open, scanPage]);

  if (!open) return null;

  const filtered = tab === "all" ? media
    : tab === "image" ? images
    : tab === "video" ? videos
    : audios;

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "all", label: "Todo", icon: null, count: media.length },
    { key: "image", label: "Imágenes", icon: <Image className="w-3.5 h-3.5" />, count: images.length },
    { key: "video", label: "Videos", icon: <Video className="w-3.5 h-3.5" />, count: videos.length },
    { key: "audio", label: "Audio", icon: <Music2 className="w-3.5 h-3.5" />, count: audios.length },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-[90vw] max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-white">Galería de medios</h2>
            <p className="text-xs text-slate-500">{media.length} elementos encontrados</p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={downloadSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar ({selected.size})
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-white/[0.06]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === t.key
                  ? "bg-white/10 text-white"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              {t.icon}
              {t.label}
              <span className="text-[10px] opacity-60">({t.count})</span>
            </button>
          ))}
          <div className="flex-1" />
          {media.length > 0 && (
            <button
              onClick={selected.size === media.length ? clearSelection : selectAll}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-300 transition"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {selected.size === media.length ? "Deseleccionar" : "Seleccionar todo"}
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
              <Image className="w-10 h-10 mb-2" />
              <p className="text-sm">No se encontraron medios</p>
              <button onClick={() => scanPage()} className="mt-2 text-xs text-sky-400 hover:underline">
                Volver a escanear
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map((item, i) => {
                const globalIndex = media.indexOf(item);
                const isSelected = selected.has(globalIndex);
                return (
                  <MediaCard
                    key={`${item.src}-${i}`}
                    item={item}
                    isSelected={isSelected}
                    onToggle={() => toggleSelect(globalIndex)}
                    onDownload={() => downloadSingle(item)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaCard({
  item, isSelected, onToggle, onDownload,
}: {
  item: MediaItem;
  isSelected: boolean;
  onToggle: () => void;
  onDownload: () => void;
}) {
  const [error, setError] = useState(false);

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer ${
        isSelected
          ? "border-emerald-500/50 ring-1 ring-emerald-500/30"
          : "border-white/[0.06] hover:border-white/20"
      }`}
      onClick={onToggle}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-white/[0.02] flex items-center justify-center">
        {item.type === "image" && !error ? (
          <img
            src={item.src}
            alt={item.alt || ""}
            className="w-full h-full object-cover"
            onError={() => setError(true)}
            loading="lazy"
          />
        ) : item.type === "video" ? (
          <div className="flex flex-col items-center gap-1 text-slate-500">
            <Video className="w-8 h-8" />
            <span className="text-[10px]">Video</span>
          </div>
        ) : item.type === "audio" ? (
          <div className="flex flex-col items-center gap-1 text-slate-500">
            <Music2 className="w-8 h-8" />
            <span className="text-[10px]">Audio</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-600">
            <Image className="w-8 h-8" />
            <span className="text-[10px]">Error</span>
          </div>
        )}
      </div>

      {/* Selection indicator */}
      <div className="absolute top-1.5 left-1.5">
        {isSelected ? (
          <CheckSquare className="w-4 h-4 text-emerald-400" />
        ) : (
          <Square className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition" />
        )}
      </div>

      {/* Actions overlay */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition flex justify-end gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          className="p-1 rounded-md bg-white/10 hover:bg-white/20 transition"
          title="Descargar"
        >
          <Download className="w-3.5 h-3.5 text-white" />
        </button>

        {/* Ocultar "abrir" para blob: URLs — no son accesibles fuera del webview */}
        {!item.src.startsWith("blob:") && (
          <button
            onClick={(e) => { e.stopPropagation(); window.open(item.src, "_blank"); }}
            className="p-1 rounded-md bg-white/10 hover:bg-white/20 transition"
            title="Abrir en nueva pestaña"
          >
            <ExternalLink className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>

      {/* Type badge */}
      {item.type !== "image" && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-slate-300 uppercase">
          {item.src.startsWith("blob:") ? "stream" : item.type}
        </div>
      )}
    </div>
  );
}