import { useState } from "react";
import { Code2, Terminal, Wifi, Bug, Activity, Smartphone, FileText, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MenuContent, ToolCard } from "./ShareSectionUtils";

interface DevToolsSectionProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onClose: () => void;
  onViewSource?: (html: string, url: string) => void;
}

export function DevToolsSection({ currentUrl, onNavigate, onClose, onViewSource }: DevToolsSectionProps) {
  const { toast } = useToast();
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const sendIpc = (cmd: Record<string, unknown>) => {
    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
    ipc?.postMessage(JSON.stringify(cmd));
  };

  const handleOpenDevTools = (panel?: string, label?: string) => {
    if (activePanel === panel) {
      sendIpc({ cmd: "devtools_close" });
      setActivePanel(null);
      toast({ title: label ? `${label} cerrado` : "DevTools cerrado" });
      return;
    }
    sendIpc({ cmd: "devtools", panel: panel || "elements" });
    setActivePanel(panel || null);
    toast({ title: label ? `${label} abierto` : "DevTools abierto" });
  };

  const handleToggleResponsive = () => {
    sendIpc({ cmd: "toggle_device_emulation" });
    toast({ title: "Vista responsiva — requiere soporte en el motor nativo" });
  };

  return (
    <MenuContent title="Desarrollador" subtitle="Para creadores de la web">
      <div className="grid grid-cols-2 gap-2">
        <ToolCard icon={<Code2 className="w-5 h-5 text-emerald-400" />} title="Inspector" desc="Examinar elementos y CSS" accent="emerald" onClick={() => handleOpenDevTools("elements", "Inspector")} />
        <ToolCard icon={<Terminal className="w-5 h-5 text-slate-300" />} title="Consola" desc="JavaScript console" accent="slate" onClick={() => handleOpenDevTools("console", "Consola")} />
        <ToolCard icon={<Wifi className="w-5 h-5 text-cyan-400" />} title="Red" desc="Monitor de peticiones HTTP" accent="cyan" onClick={() => handleOpenDevTools("network", "Monitor de red")} />
        <ToolCard icon={<Bug className="w-5 h-5 text-red-400" />} title="Debugger" desc="Depurador JavaScript" accent="red" onClick={() => handleOpenDevTools("sources", "Debugger")} />
        <ToolCard icon={<Activity className="w-5 h-5 text-violet-400" />} title="Performance" desc="Perfilar rendimiento" accent="violet" onClick={() => handleOpenDevTools("timeline", "Performance")} />
        <ToolCard icon={<Smartphone className="w-5 h-5 text-amber-400" />} title="Vista responsiva" desc="Simular dispositivos móviles" accent="amber" onClick={handleToggleResponsive} />
        <ToolCard
          icon={<Bug className="w-5 h-5 text-orange-400" />}
          title="DevTools Webview"
          desc="Inspeccionar la página cargada"
          accent="orange"
          onClick={() => {
            sendIpc({ cmd: "webview_devtools" });
            toast({ title: "DevTools del webview — requiere soporte en el motor nativo" });
            onClose();
          }}
        />
      </div>

      <button
        onClick={() => {
          const html = document.documentElement.outerHTML;
          onViewSource?.(html, currentUrl);
          onNavigate("orion://view-source");
          onClose();
        }}
        className="mt-4 w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all text-left group"
      >
        <FileText className="w-5 h-5 text-slate-400" />
        <div>
          <p className="text-sm text-slate-300 font-medium group-hover:text-white transition-colors">Ver código fuente</p>
          <p className="text-[11px] text-slate-600">HTML de la página actual</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-700 ml-auto group-hover:text-slate-400 transition-colors" />
      </button>
    </MenuContent>
  );
}