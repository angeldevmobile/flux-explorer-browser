import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Sparkles,
  Shield,
  Zap,
  ChevronRight,
  X,
  Search,
  BookOpen,
  Download,
  Bot,
} from "lucide-react";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface Step {
  id: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  highlight: "address-bar" | "tabs" | "ai" | "menu" | "security" | null;
  cursorTarget: { x: number; y: number } | null;
  mockUI: React.ReactNode;
}

/* ─────────────────────────────────────────
   Mock UI pieces shown in each slide
───────────────────────────────────────── */
function MockAddressBar({ pulse }: { pulse: boolean }) {
  return (
    <div
      className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 border transition-all duration-500 ${
        pulse
          ? "border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          : "border-slate-600/40"
      }`}
    >
      <Search className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="text-slate-300 text-sm font-mono">flux://newtab</span>
      <div
        className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${
          pulse ? "opacity-100 animate-[pulse_2s_ease-in-out_infinite]" : "opacity-0"
        } bg-gradient-to-r from-cyan-500/10 to-teal-500/10`}
      />
    </div>
  );
}

function MockTabs({ active }: { active: boolean }) {
  const tabs = ["Nueva pestaña", "GitHub", "YouTube"];
  return (
    <div className="flex gap-1 items-end">
      {tabs.map((t, i) => (
        <div
          key={t}
          className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-all duration-500 ${
            i === 0
              ? active
                ? "bg-slate-700 text-cyan-300 border-t border-cyan-500/50 shadow-[0_-2px_8px_rgba(34,211,238,0.2)]"
                : "bg-slate-700 text-slate-300"
              : "bg-slate-800/60 text-slate-500"
          }`}
        >
          {t}
        </div>
      ))}
      <div
        className={`ml-1 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
          active
            ? "bg-cyan-500/20 text-cyan-400 scale-110"
            : "bg-slate-700/50 text-slate-500"
        }`}
      >
        +
      </div>
    </div>
  );
}

function MockAIPanel({ visible }: { visible: boolean }) {
  return (
    <div
      className={`transition-all duration-700 ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
      } bg-slate-800/90 border border-slate-600/40 rounded-2xl p-4 w-56`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-200">Flux AI</span>
      </div>
      <div className="space-y-2">
        {["Resumir página", "Traducir", "Buscar con IA"].map((item, i) => (
          <div
            key={item}
            className="px-3 py-2 rounded-lg bg-slate-700/50 text-xs text-slate-300 flex items-center gap-2"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MockSecurityBadge({ active }: { active: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative w-20 h-20 rounded-2xl transition-all duration-700 ${
          active
            ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-110"
            : "bg-slate-700/40 border-slate-600/30"
        } border flex items-center justify-center`}
      >
        <Shield
          className={`w-10 h-10 transition-colors duration-500 ${
            active ? "text-emerald-400" : "text-slate-500"
          }`}
        />
        {active && (
          <div className="absolute inset-0 rounded-2xl animate-ping bg-emerald-400/10" />
        )}
      </div>
      <div className="flex gap-3">
        {["Rastreadores", "Anuncios", "Cookies"].map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div
              className={`text-lg font-bold transition-colors duration-500 ${
                active ? "text-emerald-400" : "text-slate-500"
              }`}
            >
              {active ? ["0", "0", "3"][i] : "--"}
            </div>
            <div className="text-[10px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockDownloads({ active }: { active: boolean }) {
  return (
    <div
      className={`transition-all duration-500 bg-slate-800/80 border border-slate-600/40 rounded-xl p-3 w-52`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Download className={`w-4 h-4 ${active ? "text-cyan-400" : "text-slate-500"}`} />
        <span className="text-xs text-slate-300 font-medium">Descargas</span>
      </div>
      <div className="space-y-2">
        {[
          { name: "archivo.pdf", size: "2.3 MB", done: true },
          { name: "imagen.png", size: "840 KB", done: false, progress: 65 },
        ].map((f) => (
          <div key={f.name} className="text-xs">
            <div className="flex justify-between text-slate-400 mb-1">
              <span>{f.name}</span>
              <span>{f.size}</span>
            </div>
            {!f.done && (
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    active ? "bg-cyan-400" : "bg-slate-600"
                  }`}
                  style={{ width: active ? `${f.progress}%` : "0%" }}
                />
              </div>
            )}
            {f.done && (
              <div className="text-emerald-400 text-[10px]">Completado</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Animated Cursor
───────────────────────────────────────── */
function AnimatedCursor({
  position,
  visible,
}: {
  position: { x: number; y: number };
  visible: boolean;
}) {
  return (
    <div
      className={`absolute pointer-events-none transition-all duration-700 ease-in-out z-20 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      {/* Cursor SVG */}
      <div className="relative">
        <svg
          width="24"
          height="28"
          viewBox="0 0 24 28"
          className="drop-shadow-[0_2px_8px_rgba(34,211,238,0.6)]"
        >
          <path
            d="M 0 0 L 0 20 L 5 15 L 9 24 L 12 23 L 8 14 L 14 14 Z"
            fill="white"
            stroke="rgba(34,211,238,0.8)"
            strokeWidth="1.5"
          />
        </svg>
        {/* Ripple */}
        <div className="absolute -top-1 -left-1 w-6 h-6 rounded-full border border-cyan-400/60 animate-ping" />
        <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full border border-cyan-400/30 animate-ping [animation-delay:0.3s]" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   3D Floating Logo (slide 0)
───────────────────────────────────────── */
function FluxLogo3D() {
  return (
    <div className="relative flex items-center justify-center" style={{ perspective: "600px" }}>
      {/* Rings 3D */}
      <div
        className="absolute w-40 h-40 rounded-full border border-cyan-500/20 animate-[spin_8s_linear_infinite]"
        style={{ transform: "rotateX(75deg)" }}
      />
      <div
        className="absolute w-28 h-28 rounded-full border border-teal-500/30 animate-[spin_5s_linear_infinite_reverse]"
        style={{ transform: "rotateX(75deg) rotateZ(30deg)" }}
      />
      {/* Core */}
      <div
        className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500 via-teal-400 to-blue-600 flex items-center justify-center shadow-[0_0_60px_rgba(34,211,238,0.5),0_0_120px_rgba(34,211,238,0.2)] animate-[float_3s_ease-in-out_infinite]"
        style={{ transform: "translateZ(20px)" }}
      >
        <span className="text-4xl font-black text-white select-none" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.3)" }}>
          F
        </span>
        {/* Shine */}
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 to-transparent" />
      </div>
      {/* Orbiting dot */}
      <div
        className="absolute w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-[orbit_4s_linear_infinite]"
        style={{ transformOrigin: "50px 0" }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────
   Step Dots
───────────────────────────────────────── */
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`transition-all duration-300 rounded-full ${
            i === current
              ? "w-6 h-2 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
              : i < current
              ? "w-2 h-2 bg-cyan-600"
              : "w-2 h-2 bg-slate-600"
          }`}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Main component
───────────────────────────────────────── */
const STORAGE_KEY = "flux_onboarding_done";

export function WelcomeOnboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Fade in
    const t = setTimeout(() => setShow(true), 50);
    return () => clearTimeout(t);
  }, []);

  const steps: Step[] = [
    {
      id: 0,
      icon: <Globe className="w-5 h-5" />,
      title: "Bienvenido a Flux",
      subtitle: "Tu navegador inteligente",
      description:
        "Flux combina velocidad, privacidad y la potencia de la IA para que navegues sin límites. Sin distracciones. Solo tú y la web.",
      highlight: null,
      cursorTarget: null,
      mockUI: <FluxLogo3D />,
    },
    {
      id: 1,
      icon: <Search className="w-5 h-5" />,
      title: "Barra inteligente",
      subtitle: "Busca o navega en un solo lugar",
      description:
        "Escribe una URL o una pregunta directamente. Flux detecta automáticamente si quieres navegar a un sitio o hacer una búsqueda.",
      highlight: "address-bar",
      cursorTarget: { x: 50, y: 40 },
      mockUI: <MockAddressBar pulse />,
    },
    {
      id: 2,
      icon: <Zap className="w-5 h-5" />,
      title: "Pestañas & grupos",
      subtitle: "Organiza tu sesión como quieras",
      description:
        "Crea nuevas pestañas con un clic, agrúpalas por proyecto y nunca pierdas el hilo de lo que estás haciendo.",
      highlight: "tabs",
      cursorTarget: { x: 75, y: 20 },
      mockUI: (
        <div className="flex flex-col gap-3 items-center">
          <MockTabs active />
          <div className="text-xs text-slate-400">
            Clic en <span className="text-cyan-400 font-medium">+</span> para nueva pestaña
          </div>
        </div>
      ),
    },
    {
      id: 3,
      icon: <Bot className="w-5 h-5" />,
      title: "Flux IA integrada",
      subtitle: "Tu copiloto de navegación",
      description:
        "Activa Flux AI para resumir páginas, traducir, hacer preguntas sobre el contenido o buscar con inteligencia artificial.",
      highlight: "ai",
      cursorTarget: { x: 88, y: 60 },
      mockUI: <MockAIPanel visible />,
    },
    {
      id: 4,
      icon: <Shield className="w-5 h-5" />,
      title: "Privacidad por defecto",
      subtitle: "Bloqueo activo de rastreadores",
      description:
        "Flux bloquea rastreadores, anuncios invasivos y cookies de terceros automáticamente. Tu historial solo existe en tu dispositivo.",
      highlight: "security",
      cursorTarget: { x: 15, y: 70 },
      mockUI: <MockSecurityBadge active />,
    },
    {
      id: 5,
      icon: <Download className="w-5 h-5" />,
      title: "Descargas integradas",
      subtitle: "Gestiona todo desde el navegador",
      description:
        "El panel de descargas muestra el progreso en tiempo real. Accede a tus archivos sin salir de Flux.",
      highlight: null,
      cursorTarget: null,
      mockUI: <MockDownloads active />,
    },
    {
      id: 6,
      icon: <Sparkles className="w-5 h-5" />,
      title: "¡Listo para explorar!",
      subtitle: "Todo configurado",
      description:
        "Flux está listo. Empieza a navegar, activa el modo lector, usa Flux AI o personaliza tu experiencia desde Configuración.",
      highlight: null,
      cursorTarget: null,
      mockUI: (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-3">
            {[BookOpen, Bot, Shield, Download].map((Icon, i) => (
              <div
                key={i}
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/40 flex items-center justify-center animate-[float_3s_ease-in-out_infinite]"
                style={{ animationDelay: `${i * 0.3}s` }}
              >
                <Icon className="w-5 h-5 text-cyan-400" />
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 text-center max-w-48">
            Todo listo. Puedes revisar este tour desde{" "}
            <span className="text-cyan-400">Configuración → Ayuda</span>
          </div>
        </div>
      ),
    },
  ];

  const TOTAL = steps.length;
  const current = steps[step];

  const goNext = useCallback(() => {
    if (animating) return;
    if (step === TOTAL - 1) {
      finish();
      return;
    }
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 280);
  }, [step, animating, TOTAL]);

  const finish = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
    setTimeout(onDone, 400);
  }, [onDone]);

  const isLast = step === TOTAL - 1;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-400 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      style={{ perspective: "1200px" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/95 to-slate-950 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-[float_6s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl animate-[float_8s_ease-in-out_infinite_reverse]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-teal-500/3 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
      </div>

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-lg mx-4 transition-all duration-300 ${
          animating
            ? "opacity-0 scale-95 translate-y-2"
            : "opacity-100 scale-100 translate-y-0"
        }`}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Glass card */}
        <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] overflow-hidden">

          {/* Top gradient bar */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />

          {/* Skip button */}
          {step < TOTAL - 1 && (
            <button
              onClick={finish}
              className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all duration-200 group"
            >
              <span>Omitir</span>
              <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
            </button>
          )}

          {/* Step badge */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] text-slate-400 font-medium">
              {step + 1} / {TOTAL}
            </span>
          </div>

          {/* Visual demo area */}
          <div className="relative h-52 flex items-center justify-center px-8 pt-12 pb-4 overflow-hidden">
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            {/* Animated cursor */}
            {current.cursorTarget && (
              <AnimatedCursor
                position={current.cursorTarget}
                visible={!animating}
              />
            )}
            {/* Mock UI */}
            <div
              className={`transition-all duration-500 ${
                animating ? "opacity-0 scale-90" : "opacity-100 scale-100"
              }`}
            >
              {current.mockUI}
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            {/* Icon + title */}
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                {current.icon}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {current.title}
                </h2>
                <p className="text-sm text-cyan-400/80 font-medium mt-0.5">
                  {current.subtitle}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              {current.description}
            </p>

            {/* Bottom row: dots + buttons */}
            <div className="flex items-center justify-between">
              <StepDots total={TOTAL} current={step} />

              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={() => {
                      if (animating) return;
                      setAnimating(true);
                      setTimeout(() => {
                        setStep((s) => s - 1);
                        setAnimating(false);
                      }, 280);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all duration-200"
                  >
                    Atrás
                  </button>
                )}
                <button
                  onClick={goNext}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isLast
                      ? "bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-900 hover:shadow-[0_4px_20px_rgba(34,211,238,0.4)] hover:scale-105 active:scale-95"
                      : "bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/30 hover:to-teal-500/30 hover:border-cyan-400/50 hover:text-cyan-200"
                  }`}
                >
                  {isLast ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Comenzar
                    </>
                  ) : (
                    <>
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom gradient bar */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-600/40 to-transparent" />
        </div>

        {/* Outer glow */}
        <div className="absolute inset-0 -z-10 rounded-3xl blur-2xl bg-cyan-500/5 scale-110" />
      </div>
    </div>
  );
}

export function shouldShowOnboarding(): boolean {
  return !localStorage.getItem(STORAGE_KEY);
}
