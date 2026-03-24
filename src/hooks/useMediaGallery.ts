import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { mediaService, type MediaItem } from "@/services/api";

export function useMediaGallery() {
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const scanPage = useCallback(async (_activeUrl?: string) => {
    setLoading(true);
    try {
      const imgs = Array.from(document.querySelectorAll("img[src]"))
        .filter((el) => (el as HTMLImageElement).naturalWidth > 80)
        .map((el) => {
          const img = el as HTMLImageElement;
          return {
            type: "image" as const,
            src: img.src,
            alt: img.alt,
            width: img.naturalWidth,
            height: img.naturalHeight,
          };
        });

      const vids = Array.from(document.querySelectorAll("video[src], video source[src]"))
        .map((el) => {
          const src = (el as HTMLVideoElement | HTMLSourceElement).src;
          return src && !src.startsWith("blob:")
            ? { type: "video" as const, src, alt: "video", width: 0, height: 0 }
            : null;
        })
        .filter(Boolean) as MediaItem[];

      const audios = Array.from(document.querySelectorAll("audio[src], audio source[src]"))
        .map((el) => {
          const src = (el as HTMLAudioElement | HTMLSourceElement).src;
          return src && !src.startsWith("blob:")
            ? { type: "audio" as const, src, alt: "audio", width: 0, height: 0 }
            : null;
        })
        .filter(Boolean) as MediaItem[];

      const all = [...imgs, ...vids, ...audios];
      setMedia(all);
      if (all.length === 0) {
        toast({ title: "No se encontraron medios en esta página" });
      }
    } catch {
      toast({ title: "Error escaneando medios" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const toggleSelect = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(media.map((_, i) => i)));
  }, [media]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const downloadSingle = useCallback(async (item: MediaItem) => {
    if (item.src.startsWith("blob:")) {
      toast({
        title: "No disponible",
        description: "Los streams no se pueden descargar directamente",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(item.src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.alt || `media-${Date.now()}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Descarga iniciada" });
      mediaService.recordDownload({
        url: item.src,
        title: item.alt || "media",
        type: item.type,
        size: blob.size,
        sourceUrl: item.src,
      }).catch(() => {});
    } catch {
      window.open(item.src, "_blank");
    }
  }, [toast]);

  const downloadSelected = useCallback(async () => {
    const items = Array.from(selected).map((i) => media[i]);
    if (items.length === 0) {
      toast({ title: "Selecciona al menos un archivo" });
      return;
    }
    for (const item of items) {
      await downloadSingle(item);
    }
    clearSelection();
  }, [selected, media, toast, downloadSingle, clearSelection]);

  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");
  const audios = media.filter((m) => m.type === "audio");

  return {
    media, images, videos, audios,
    loading, selected, scanPage,
    toggleSelect, selectAll, clearSelection,
    downloadSingle, downloadSelected,
  };
}