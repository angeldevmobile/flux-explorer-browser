import { Camera, Sparkles, Palette, Ruler, ScanLine, FileText, PenTool, Globe, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MenuContent, ToolCard } from "./ShareSectionUtils";

interface ToolsSectionProps {
  currentZoom: number;
  onZoomChange?: (zoom: number) => void;
  onClose: () => void;
  onOpenOCR?: () => void;
}

export function ToolsSection({ currentZoom, onZoomChange, onClose, onOpenOCR }: ToolsSectionProps) {
  const { toast } = useToast();

  const handleCapture = () => {
    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
    if (ipc) {
      ipc.postMessage(JSON.stringify({ cmd: "capture_page" }));
      toast({ title: "Capturando pantalla..." });
    } else {
      toast({ title: "Captura no disponible en modo web" });
    }
    onClose();
  };

  const handleColorPicker = async () => {
    if ("EyeDropper" in window) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dropper = new (window as any).EyeDropper();
        onClose();
        const result = await dropper.open();
        await navigator.clipboard.writeText(result.sRGBHex);
        toast({ title: `Color copiado: ${result.sRGBHex}` });
      } catch {
        // usuario canceló
      }
    } else {
      toast({ title: "EyeDropper no soportado en este navegador" });
      onClose();
    }
  };

  const handlePdf = () => {
    window.print();
    toast({ title: "Usa el diálogo de impresión para guardar como PDF" });
    onClose();
  };

  const handleReaderMode = () => {
    const style = document.createElement("style");
    style.id = "orion-reader-mode";
    style.textContent = `
      body { max-width: 700px !important; margin: 40px auto !important; padding: 0 20px !important;
             font-family: Georgia, serif !important; font-size: 18px !important; line-height: 1.8 !important;
             color: #e2e8f0 !important; background: #0a0e1a !important; }
      img { max-width: 100% !important; height: auto !important; }
      nav, header, footer, aside, .sidebar, .ad, [class*="banner"], [class*="popup"] { display: none !important; }
    `;
    const existing = document.getElementById("orion-reader-mode");
    if (existing) {
      existing.remove();
      toast({ title: "Modo lectura desactivado" });
    } else {
      document.head.appendChild(style);
      toast({ title: "Modo lectura activado" });
    }
    onClose();
  };

  return (
    <MenuContent title="Herramientas" subtitle="Potencia tu navegación">
      <div className="grid grid-cols-2 gap-2">
        <ToolCard icon={<Camera className="w-5 h-5 text-sky-400" />} title="Captura de pantalla" desc="Capturar página completa o zona" accent="sky" onClick={handleCapture} />
        <ToolCard icon={<Sparkles className="w-5 h-5 text-violet-400" />} title="Modo lectura" desc="Leer sin distracciones" accent="violet" onClick={handleReaderMode} />
        <ToolCard icon={<Palette className="w-5 h-5 text-rose-400" />} title="Color Picker" desc="Extraer colores de la página" accent="rose" onClick={handleColorPicker} />
        <ToolCard icon={<Ruler className="w-5 h-5 text-amber-400" />} title="Medidor de página" desc="Medir distancias en la web" accent="amber" onClick={() => { toast({ title: "Modo medición activado" }); onClose(); }} />
        <ToolCard icon={<ScanLine className="w-5 h-5 text-emerald-400" />} title="Texto de imagen (OCR)" desc="Extraer texto de imágenes con IA" accent="emerald" onClick={onOpenOCR} />
        <ToolCard icon={<FileText className="w-5 h-5 text-cyan-400" />} title="Guardar como PDF" desc="Exportar página a PDF" accent="cyan" onClick={handlePdf} />
        <ToolCard icon={<PenTool className="w-5 h-5 text-orange-400" />} title="Anotar en página" desc="Dibujar y subrayar contenido" accent="orange" onClick={() => { toast({ title: "Modo anotación activado" }); onClose(); }} />
        <ToolCard icon={<Globe className="w-5 h-5 text-indigo-400" />} title="Traducir página" desc="Traducción automática completa" accent="indigo" onClick={() => { toast({ title: "Traduciendo página…" }); onClose(); }} />
      </div>

      <div className="mt-5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <p className="text-xs font-bold text-slate-300 mb-3">Zoom de página</p>
        <div className="flex items-center gap-3">
          <button onClick={() => onZoomChange?.(Math.max(50, currentZoom - 10))} className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all">
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] relative">
            <div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-200" style={{ width: `${((currentZoom - 50) / 150) * 100}%` }} />
          </div>
          <button onClick={() => onZoomChange?.(Math.min(200, currentZoom + 10))} className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => onZoomChange?.(100)} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-300 font-mono font-bold hover:bg-white/[0.08] transition-all min-w-[48px] text-center">
            {currentZoom}%
          </button>
        </div>
      </div>
    </MenuContent>
  );
}
