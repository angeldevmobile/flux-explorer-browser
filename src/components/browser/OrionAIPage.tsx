import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Globe,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Send,
  Copy,
  Check,
  Bot,
  User,
  MessageCircle,
} from "lucide-react";
import { chatWithAssistant } from "@/services/geminiClient";
import { aiHistoryService } from "@/services/api";
import { authService } from "@/services/api";
import { SearchResultsPanel } from "./SearchResultsPanel";

interface OrionAIPageProps {
  query: string;
  onNavigate: (url: string) => void;
}

interface FollowUpMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

// ... (helper functions remain the same)
function extractFollowUps(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences
    .filter((s) => s.trim().endsWith("?") && s.trim().length > 12 && s.trim().length < 100)
    .slice(0, 3)
    .map((s) => s.trim());
}

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function FormattedResponse({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return (
            <h2 key={i} className="text-base font-semibold text-foreground mt-3 mb-1">
              {line.slice(3)}
            </h2>
          );
        if (line.startsWith("# "))
          return (
            <h1 key={i} className="text-lg font-bold text-foreground mt-3 mb-1">
              {line.slice(2)}
            </h1>
          );
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-foreground/85 leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400/70 shrink-0" />
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-sm text-foreground/85 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

function TypedText({
  fullText,
  onDone,
}: {
  fullText: string;
  onDone: () => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);

  useEffect(() => {
    let i = 0;
    doneRef.current = false;
    setDisplayed("");
    const id = setInterval(() => {
      i += 4;
      setDisplayed(fullText.slice(0, i));
      if (i >= fullText.length) {
        setDisplayed(fullText);
        clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }
    }, 16);
    return () => clearInterval(id);
  }, [fullText, onDone]);

  const isTyping = displayed.length < fullText.length;
  return (
    <div className="relative">
      <FormattedResponse text={displayed} />
      {isTyping && (
        <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
      className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted/30"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export const OrionAIPage = ({ query, onNavigate }: OrionAIPageProps) => {
  // ── Main answer state ──
  const [mainAnswer, setMainAnswer] = useState("");
  const [mainTyping, setMainTyping] = useState(false);
  const [mainLoading, setMainLoading] = useState(false);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);

  // ── Follow-up conversation ──
  const [thread, setThread] = useState<FollowUpMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [typingThreadId, setTypingThreadId] = useState<string | null>(null);

  // ── Search bar ──
  const [searchInput, setSearchInput] = useState(query);

  // ── Input follow-up ──
  const [inputValue, setInputValue] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef("");

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 60);
  }, []);

  // ── Fetch initial answer ──
  useEffect(() => {
    if (!query.trim() || query === lastQueryRef.current) return;
    lastQueryRef.current = query;
    setSearchInput(query);
    setMainAnswer("");
    setMainLoading(true);
    setMainTyping(false);
    setFollowUpSuggestions([]);
    setThread([]);
    setTypingThreadId(null);

    chatWithAssistant(query)
      .then((res) => {
        const text = res.response || "No se pudo obtener una respuesta.";
        setMainAnswer(text);
        setMainTyping(true);
        setFollowUpSuggestions(extractFollowUps(text));
        if (authService.isAuthenticated()) {
          aiHistoryService.save(query, text).catch(() => {});
        }
      })
      .catch(() => {
        setMainAnswer("No se pudo conectar con Flux AI. Verifica que el servidor esté corriendo.");
        setMainTyping(true);
      })
      .finally(() => setMainLoading(false));
  }, [query]);

  // ── Send follow-up ──
  const sendFollowUp = useCallback(
    async (text: string) => {
      if (!text.trim() || threadLoading) return;
      const userId = `u-${Date.now()}`;
      setThread((prev) => [...prev, { id: userId, role: "user", text }]);
      setThreadLoading(true);
      scrollToBottom();

      try {
        const res = await chatWithAssistant(text);
        const aiText = res.response || "No se pudo obtener una respuesta.";
        const aiId = `a-${Date.now()}`;
        setThread((prev) => [...prev, { id: aiId, role: "ai", text: aiText }]);
        setTypingThreadId(aiId);
        // Update follow-up chips from latest response
        const newSuggestions = extractFollowUps(aiText);
        if (newSuggestions.length > 0) setFollowUpSuggestions(newSuggestions);
      } catch {
        const aiId = `a-err-${Date.now()}`;
        setThread((prev) => [
          ...prev,
          { id: aiId, role: "ai", text: "No se pudo obtener una respuesta." },
        ]);
        setTypingThreadId(aiId);
      } finally {
        setThreadLoading(false);
        scrollToBottom();
      }
    },
    [threadLoading, scrollToBottom]
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");
    sendFollowUp(text);
  };

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) onNavigate(`orion://ai?q=${encodeURIComponent(q)}`);
  };

  const isMainDone = !mainLoading && !mainTyping;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ══ Header: search bar (sticky) ══ */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-md border-b border-border/60 z-10">
        <div className="px-5 py-3 flex items-center gap-3">
          {/* Logo */}
          <div
            className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-md shadow-cyan-500/20 cursor-pointer"
            onClick={() => onNavigate("orion://newtab")}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>

          {/* Search bar */}
          <form onSubmit={handleNewSearch} className="flex-1">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 group-focus-within:text-cyan-400 transition-colors" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="¿Qué quieres saber?"
                className="w-full bg-muted/20 border border-border rounded-xl pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all placeholder:text-muted-foreground/40"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center transition-all"
              >
                <ChevronRight className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          </form>

          {/* Loading dots */}
          {(mainLoading || threadLoading) && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          )}
        </div>
      </div>

      {/* ══ Main content: 2 columns ══ */}
      <div className="flex-1 flex gap-0 overflow-hidden">

        {/* Left panel: Search Results */}
        <div className="w-80 flex-shrink-0 hidden md:flex">
          <SearchResultsPanel query={query} onNavigate={onNavigate} />
        </div>

        {/* Right panel: AI Response & Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Scrollable content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

              {/* Query title */}
              <div>
                <h1 className="text-2xl font-bold text-foreground leading-snug">{query}</h1>
                <div className="flex items-center gap-1.5 mt-2">
                  <Sparkles className="w-4 h-4 text-cyan-400/70" />
                  <span className="text-xs text-muted-foreground/60">Respuesta de Flux AI</span>
                </div>
              </div>

              {/* ── Main answer card ── */}
              <div className="rounded-2xl border border-border bg-muted/10 overflow-hidden">
                <div className="h-px w-full bg-gradient-to-r from-cyan-500/80 via-teal-400/50 to-transparent" />

                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/40">
                  <div className="flex gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                    <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 bg-background/40 rounded-md px-2 py-0.5 border border-border/30">
                    <Sparkles className="w-2.5 h-2.5 text-cyan-400/60 shrink-0" />
                    <span className="text-[10px] text-muted-foreground/50 font-mono truncate">
                      orion://ai · {query.slice(0, 35)}{query.length > 35 ? "…" : ""}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 min-h-[120px]">
                  {mainLoading ? (
                    <div className="space-y-2.5">
                      {[100, 83, 91, 75, 66].map((w, i) => (
                        <div
                          key={i}
                          className="h-3 bg-muted/60 rounded-full animate-pulse"
                          style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                        />
                      ))}
                    </div>
                  ) : mainTyping ? (
                    <TypedText
                      fullText={mainAnswer}
                      onDone={() => setMainTyping(false)}
                    />
                  ) : (
                    <FormattedResponse text={mainAnswer} />
                  )}
                </div>

                {/* Footer actions */}
                {!mainLoading && mainAnswer && (
                  <div className="flex items-center justify-between px-5 pb-4 pt-1 text-right">
                    <span className="text-[10px] text-muted-foreground/35 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-cyan-400/40" />
                      Flux AI
                    </span>
                    <CopyButton text={mainAnswer} />
                  </div>
                )}
              </div>

              {/* ── Explore more (chips) ── */}
              {isMainDone && followUpSuggestions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                    <ChevronRight className="w-3 h-3" />
                    Profundiza sobre este tema
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {followUpSuggestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInputValue(q);
                          sendFollowUp(q);
                          inputRef.current?.focus();
                        }}
                        disabled={threadLoading}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/10 border border-border hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-xs text-muted-foreground hover:text-foreground group disabled:opacity-50"
                      >
                        <Search className="w-3 h-3 text-cyan-400/40 group-hover:text-cyan-400/80 shrink-0" />
                        <span className="line-clamp-1 max-w-[200px]">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Follow-up thread ── */}
              {thread.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      Conversación
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>

                  {thread.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "ai" && (
                        <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-400/20 border border-cyan-500/20 flex items-center justify-center">
                          <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                      )}

                      <div className={`flex flex-col gap-1 max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start w-full"}`}>
                        {msg.role === "user" ? (
                          <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm bg-cyan-500/12 border border-cyan-500/20">
                            <p className="text-sm text-foreground/90 leading-relaxed">{msg.text}</p>
                          </div>
                        ) : (
                          <div className="rounded-2xl rounded-tl-sm border border-border bg-muted/10 overflow-hidden w-full">
                            <div className="h-px w-full bg-gradient-to-r from-cyan-500/60 via-teal-400/40 to-transparent" />
                            <div className="p-4">
                              {msg.id === typingThreadId ? (
                                <TypedText
                                  fullText={msg.text}
                                  onDone={() => setTypingThreadId(null)}
                                />
                              ) : (
                                <FormattedResponse text={msg.text} />
                              )}
                            </div>
                            <div className="flex justify-end px-4 pb-3">
                              <CopyButton text={msg.text} />
                            </div>
                          </div>
                        )}
                      </div>

                      {msg.role === "user" && (
                        <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-muted/30 border border-border flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-muted-foreground/60" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Thread loading bubble */}
              {threadLoading && (
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-400/20 border border-cyan-500/20 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm border border-border bg-muted/10 overflow-hidden flex-1">
                    <div className="h-px w-full bg-gradient-to-r from-cyan-500/60 via-teal-400/40 to-transparent" />
                    <div className="px-4 py-4 space-y-2 max-w-xs">
                      {[100, 80, 90, 65].map((w, i) => (
                        <div
                          key={i}
                          className="h-2.5 bg-muted/50 rounded-full animate-pulse"
                          style={{ width: `${w}%`, animationDelay: `${i * 70}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="h-4" />
            </div>
          </div>

          {/* ══ Bottom: Input for follow-up ══ */}
          <div className="flex-shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-md">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <form onSubmit={handleSend} className="relative">
                <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={mainLoading || threadLoading}
                  placeholder={
                    mainLoading
                      ? "Flux está procesando tu pregunta…"
                      : threadLoading
                      ? "Flux está pensando…"
                      : "¿Quieres saber más sobre este tema?"
                  }
                  className="w-full bg-muted/15 border border-border rounded-2xl pl-11 pr-12 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all placeholder:text-muted-foreground/35 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={mainLoading || threadLoading || !inputValue.trim()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5 text-cyan-400" />
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};