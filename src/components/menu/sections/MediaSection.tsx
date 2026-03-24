import { Video, VolumeX, Volume2, Cast, Image, Music, Download } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { MenuContent, ToolCard } from "./ShareSectionUtils";
import { MediaGalleryModal } from "./MediaGalleryModal";
import { SongDetectorModal } from "./SongDetectorModal";
import { MediaDownloaderModal } from "./MediaDownloaderModal";

interface MediaSectionProps {
  currentUrl: string;
  currentTitle?: string;
  onClose: () => void;
  tabs: { id: string; title: string; url: string; favicon?: string }[];
}

export function MediaSection({ currentUrl, currentTitle, onClose, tabs }: MediaSectionProps) {
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSongDetector, setShowSongDetector] = useState(false);
  const [showDownloader, setShowDownloader] = useState(false);

  // isMuted state starts false — no web API for querying tab mute state


  const handlePip = async () => {
    try {
      const video = document.querySelector("video");
      if (video && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          toast({ title: "PiP desactivado" });
        } else {
          await video.requestPictureInPicture();
          toast({ title: "PiP activado" });
        }
      } else {
        toast({ title: "No hay video disponible en esta página" });
      }
    } catch {
      toast({ title: "No se pudo activar PiP" });
    }
    onClose();
  };

  const handleToggleMute = () => {
    // No web API for muting a tab — send IPC command to the native engine
    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
    if (ipc) {
      const next = !isMuted;
      ipc.postMessage(JSON.stringify({ cmd: "set_mute", muted: next }));
      setIsMuted(next);
      toast({ title: next ? "Pestaña silenciada" : "Audio restaurado" });
    } else {
      toast({ title: "Silencio de pestaña solo disponible en motor nativo" });
    }
    onClose();
  };

  const handleCast = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast({
        title: "URL copiada al portapapeles",
        description: "Pégala en tu TV, móvil u otro dispositivo",
      });
    } catch {
      toast({ title: "No se pudo copiar la URL" });
    }
    onClose();
  };

  const handleOpenGallery = () => {
    setShowGallery(true);
  };

  const handleOpenSongDetector = () => {
    setShowSongDetector(true);
  };

  const handleDownloadMedia = () => {
    setShowDownloader(true);
  };

  return (
    <>
      <MenuContent title="Media Center" subtitle="Control multimedia">
        <div className="grid grid-cols-2 gap-2">
          <ToolCard
            icon={<Video className="w-5 h-5 text-red-400" />}
            title="Picture in Picture"
            desc="Video flotante mientras navegas"
            accent="red"
            onClick={handlePip}
          />
          <ToolCard
            icon={isMuted ? <Volume2 className="w-5 h-5 text-amber-400" /> : <VolumeX className="w-5 h-5 text-amber-400" />}
            title={isMuted ? "Restaurar audio" : "Silenciar pestaña"}
            desc={isMuted ? "Activar audio" : "Silenciar audio de esta página"}
            accent="amber"
            onClick={handleToggleMute}
          />
          <ToolCard
            icon={<Cast className="w-5 h-5 text-indigo-400" />}
            title="Enviar a dispositivo"
            desc="Copia URL para otro equipo"
            accent="indigo"
            onClick={handleCast}
          />
          <ToolCard
            icon={<Image className="w-5 h-5 text-emerald-400" />}
            title="Galería de medios"
            desc="Ver todas las imágenes/videos"
            accent="emerald"
            onClick={handleOpenGallery}
          />
          <ToolCard
            icon={<Music className="w-5 h-5 text-pink-400" />}
            title="Detectar canción"
            desc="Identifica la música que suena"
            accent="pink"
            onClick={handleOpenSongDetector}
          />
          <ToolCard
            icon={<Download className="w-5 h-5 text-sky-400" />}
            title="Descargar medios"
            desc="Descargar videos e imágenes"
            accent="sky"
            onClick={handleDownloadMedia}
          />
        </div>
      </MenuContent>

      {/* Modales */}
      <MediaGalleryModal open={showGallery} onClose={() => setShowGallery(false)} />
      <MediaDownloaderModal
        open={showDownloader}
        onClose={() => setShowDownloader(false)}
        currentUrl={currentUrl}
      />
      <SongDetectorModal
        open={showSongDetector}
        onClose={() => setShowSongDetector(false)}
        currentUrl={currentUrl}
        currentTitle={currentTitle}
        tabs={tabs}
      />
    </>
  );
}