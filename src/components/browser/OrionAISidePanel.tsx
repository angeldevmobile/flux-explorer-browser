import { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Send, Bot, User, Copy, Check, Sparkles,
  ChevronDown, Globe, RotateCcw,
} from "lucide-react";
import { chatWithAssistant } from "@/services/geminiClient";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  typing?: boolean;
}

interface OrionAISidePanelProps {
  open: boolean;
  onClose: () => void;
  currentUrl: string;
  currentTitle?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function FormattedText({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return <p key={i} className="text-xs font-semibold text-foreground mt-2">{line.slice(3)}</p>;
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <div key={i} className="flex items-start gap-1.5 text-[12px] text-foreground/80 leading-relaxed">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-cyan-400/70 shrink-0" />
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        if (line.trim() === "") return <div key={i} className="h-0.5" />;
        return <p key={i} className="text-[12px] text-foreground/80 leading-relaxed">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function TypeWriter({ text, onDone }: { text: string; onDone: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    let i = 0;
    doneRef.current = false;
    setDisplayed("");
    const id = setInterval(() => {
      i += 5;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        setDisplayed(text);
        clearInterval(id);
        if (!doneRef.current) { doneRef.current = true; onDone(); }
      }
    }, 14);
    return () => clearInterval(id);
  }, [text, onDone]);

  return (
    <div className="relative">
      <FormattedText text={displayed} />
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-3.5 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors px-1 py-0.5 rounded"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

// Preguntas de contexto según el dominio de la URL
function getContextPrompts(url: string, title?: string): string[] {
  const domain = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; } })();
  const titleSnippet = title ? `"${title.slice(0, 40)}"` : "esta página";

  if (domain.includes("youtube")) return [
    "Resume este video", "¿Cuál es el tema principal?", "¿Qué aprendo aquí?"
  ];
  if (domain.includes("github")) return [
    "¿Qué hace este repositorio?", "¿Cómo lo instalo?", "¿Cuáles son los requisitos?"
  ];
  if (domain.includes("wikipedia")) return [
    "Resume este artículo", "¿Cuáles son los puntos clave?", "Dame más contexto"
  ];
  if (domain.includes("reddit")) return [
    "¿Cuál es el tema del hilo?", "Resume los comentarios", "¿Cuál es la conclusión?"
  ];
  return [
    `Explícame ${titleSnippet}`,
    "¿Cuáles son los puntos clave?",
    "Dame un resumen rápido",
  ];
}

// ── Componente principal ──────────────────────────────────────────────────────

export function OrionAISidePanel({ open, onClose, currentUrl, currentTitle }: OrionAISidePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const domain = (() => { try { return new URL(currentUrl).hostname.replace("www.", ""); } catch { return ""; } })();
  const contextPrompts = getContextPrompts(currentUrl, currentTitle);

  const scrollDown = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 60);
  }, []);

  // Reset al cambiar de página
  useEffect(() => {
    setMessages([]);
    setInput("");
    setTypingId(null);
  }, [currentUrl]);

  // Focus al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    scrollDown();

    // Añadir contexto de la página actual
    const contextualText = domain
      ? `[Estoy navegando en: ${currentUrl}${currentTitle ? ` — "${currentTitle}"` : ""}]\n\n${text}`
      : text;

    try {
      const res = await chatWithAssistant(contextualText);
      const aiText = res.response || "No pude obtener una respuesta.";
      const aiId = `a-${Date.now()}`;
      setMessages(prev => [...prev, { id: aiId, role: "ai", text: aiText, typing: true }]);
      setTypingId(aiId);
      scrollDown();
    } catch {
      const aiId = `a-err-${Date.now()}`;
      setMessages(prev => [...prev, { id: aiId, role: "ai", text: "No se pudo conectar con Flux AI. Verifica que el servidor esté activo.", typing: true }]);
      setTypingId(aiId);
    } finally {
      setLoading(false);
    }
  }, [loading, currentUrl, currentTitle, domain, scrollDown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  if (!open) return null;

  return (
    <div className="h-full w-[340px] flex-shrink-0 flex flex-col bg-[#0b0e14] border-l border-white/8 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Flux AI</p>
            {domain && (
              <div className="flex items-center gap-1">
                <Globe className="w-2.5 h-2.5 text-muted-foreground/50" />
                <p className="text-[10px] text-muted-foreground/60 truncate max-w-[160px]">{domain}</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setTypingId(null); }}
              className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              title="Nueva conversación"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/8 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4 min-h-0">

        {/* Estado vacío — sugerencias contextuales */}
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center pt-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-cyan-500/15 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
              <p className="text-xs font-medium text-foreground">¿En qué te ayudo?</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Pregunta cualquier cosa sobre esta página o cualquier tema
              </p>
            </div>

            {/* Sugerencias contextuales */}
            {domain && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Sugerencias</p>
                {contextPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/6 hover:border-cyan-500/20 rounded-xl text-[12px] text-foreground/70 hover:text-foreground transition-all flex items-center gap-2 group"
                  >
                    <ChevronDown className="w-3 h-3 text-cyan-400/50 group-hover:text-cyan-400 rotate-[-90deg] flex-shrink-0 transition-colors" />
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mensajes */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === "ai"
                ? "bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/15"
                : "bg-white/8 border border-white/10"
            }`}>
              {msg.role === "ai"
                ? <Sparkles className="w-3 h-3 text-cyan-400" />
                : <User className="w-3 h-3 text-muted-foreground" />
              }
            </div>

            {/* Bubble */}
            <div className={`flex-1 min-w-0 ${msg.role === "user" ? "flex justify-end" : ""}`}>
              {msg.role === "user" ? (
                <div className="inline-block max-w-[85%] px-3 py-2 bg-cyan-500/10 border border-cyan-500/15 rounded-2xl rounded-tr-md">
                  <p className="text-[12px] text-foreground/90">{msg.text}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {msg.typing && typingId === msg.id ? (
                    <TypeWriter text={msg.text} onDone={() => setTypingId(null)} />
                  ) : (
                    <FormattedText text={msg.text} />
                  )}
                  {typingId !== msg.id && (
                    <CopyBtn text={msg.text} />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-white/[0.03] border border-white/6 rounded-2xl rounded-tl-md">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3.5 py-3 border-t border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl focus-within:border-cyan-500/30 transition-colors">
          <Bot className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta algo..."
            disabled={loading}
            className="flex-1 bg-transparent text-[12px] text-foreground placeholder-muted-foreground/40 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="p-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 text-center mt-1.5">
          Flux AI · Powered by Gemini
        </p>
      </div>
    </div>
  );
}
