import { Settings, Keyboard, Palette, Shield, Globe, Download, Smartphone, Info } from "lucide-react";
import { MenuContent, SettingsLink } from "./ShareSectionUtils";

interface SettingsSectionProps {
  onNavigate: (url: string) => void;
  onClose: () => void;
}

export function SettingsSection({ onNavigate, onClose }: SettingsSectionProps) {
  return (
    <MenuContent title="Configuración" subtitle="Personaliza Flux">
      <div className="space-y-2">
        <SettingsLink icon={<Settings className="w-4 h-4 text-slate-300" />} title="Configuración general" onClick={() => { onNavigate("flux://settings"); onClose(); }} />
        <SettingsLink icon={<Keyboard className="w-4 h-4 text-cyan-400" />} title="Atajos de teclado" onClick={() => { onNavigate("flux://settings/shortcuts"); onClose(); }} />
        <SettingsLink icon={<Palette className="w-4 h-4 text-violet-400" />} title="Apariencia y temas" onClick={() => { onNavigate("flux://settings/appearance"); onClose(); }} />
        <SettingsLink icon={<Shield className="w-4 h-4 text-emerald-400" />} title="Privacidad y seguridad" onClick={() => { onNavigate("flux://settings/privacy"); onClose(); }} />
        <SettingsLink icon={<Globe className="w-4 h-4 text-amber-400" />} title="Motor de búsqueda" onClick={() => { onNavigate("flux://settings/search"); onClose(); }} />
        <SettingsLink icon={<Download className="w-4 h-4 text-sky-400" />} title="Descargas" onClick={() => { onNavigate("flux://settings/downloads"); onClose(); }} />
        <SettingsLink icon={<Smartphone className="w-4 h-4 text-rose-400" />} title="Sincronización" onClick={() => { onNavigate("flux://settings/sync"); onClose(); }} />
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <SettingsLink icon={<Info className="w-4 h-4 text-slate-500" />} title="Acerca de Flux" onClick={() => { onNavigate("flux://about"); onClose(); }} />
        </div>
      </div>
    </MenuContent>
  );
}