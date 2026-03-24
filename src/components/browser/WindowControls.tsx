import { Minus, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const ipc = (cmd: string) =>
  (window as unknown as { ipc?: { postMessage: (m: string) => void } })
    .ipc?.postMessage(JSON.stringify({ cmd }));

export const WindowControls = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMaximize = () => {
    setIsMaximized((prev) => !prev);
    ipc("maximize");
  };

  return (
    <div className="flex items-center gap-1 ml-auto">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => ipc("minimize")}
        className="h-8 w-10 hover:bg-muted rounded-none"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleMaximize}
        className="h-8 w-10 hover:bg-muted rounded-none"
      >
        {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => ipc("close")}
        className="h-8 w-10 hover:bg-destructive hover:text-destructive-foreground rounded-none"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
