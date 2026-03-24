import { Palette, Sun, Moon, Zap, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import { DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

export const ThemeSelector = () => {
  const { themeId, mode, setTheme, setMode, allThemes, opacity, blur, setOpacity, setBlur } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-9 w-9 transition-all duration-200 hover:scale-110"
        >
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Personalización Avanzada
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Modo Día/Noche */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Modo</span>
            <div className="flex gap-1">
              <Button
                variant={mode === "light" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("light")}
                className="h-8 w-8 p-0"
              >
                <Sun className="h-4 w-4" />
              </Button>
              <Button
                variant={mode === "dark" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("dark")}
                className="h-8 w-8 p-0"
              >
                <Moon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">Temas</DropdownMenuLabel>
        
        {/* Grid de Temas — usa los temas reales */}
        <div className="px-4 py-2 grid grid-cols-4 gap-2">
          {allThemes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`h-10 rounded-lg transition-all flex items-center justify-center ${
                themeId === t.id
                  ? "ring-2 ring-primary scale-105"
                  : "opacity-70 hover:opacity-100"
              }`}
              style={{
                background: `linear-gradient(135deg, ${t.colors.dark.accentGradient[0]}, ${t.colors.dark.accentGradient[1]})`,
              }}
              title={t.name}
            >
              <span
                className="w-4 h-4 text-white"
                dangerouslySetInnerHTML={{ __html: t.iconSvg }}
              />
            </button>
          ))}
        </div>

        <DropdownMenuSeparator />
        
        {/* Controles Deslizantes */}
        <div className="px-4 py-3 space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Opacidad de fondo</label>
              <span className="text-xs text-muted-foreground">{opacity}%</span>
            </div>
            <Slider
              value={[opacity]}
              onValueChange={(val) => setOpacity(val[0])}
              max={100}
              step={10}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Efecto de desenfoque</label>
              <span className="text-xs text-muted-foreground">{blur}px</span>
            </div>
            <Slider
              value={[blur]}
              onValueChange={(val) => setBlur(val[0])}
              max={30}
              step={5}
              className="w-full"
            />
          </div>
        </div>

        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="cursor-pointer">
          <Settings className="h-4 w-4 mr-2" />
          <span>Más configuraciones</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
