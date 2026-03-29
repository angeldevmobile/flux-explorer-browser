import { useState, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  Search,
  TrendingUp,
  Clock,
  Newspaper,
  ExternalLink,
  Zap,
  Flame,
  ArrowRight,
  Globe,
  Sparkles,
  Loader2,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { BubbleBackground } from "./BubbleBackground";
import { useTheme } from "@/hooks/useTheme";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
interface QuickAccessItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface WeatherData {
  temp: string;
  feelsLike: string;
  humidity: string;
  windKmph: string;
  uvIndex: string;
  description: string;
  city?: string;
}

interface NewTabPageProps {
  voiceState: "idle" | "listening" | "processing" | "results";
  transcription: string;
  audioLevels: number[];
  suggestions: string[];
  quickAccess: QuickAccessItem[];
  recentSearches: string[];
  tabsCount: number;
  onVoiceCommand: () => void;
  onNavigate: (url: string) => void;
}

interface NewsItem {
  title: string;
  source: string;
  url: string;
  image?: string;
  category: string;
  time: string;
}

interface TrendRelatedNews {
  title: string;
  url: string;
  source: string;
  image?: string;
  snippet?: string;
}

interface TrendItem {
  title: string;
  searches: string;
  url: string;
  image?: string;
  time?: string;
  relatedNews?: TrendRelatedNews[];
}

/* ═══════════════════════════════════════════
   SERVICE COLORS
   ═══════════════════════════════════════════ */
const SERVICE_STYLES: Record<
  string,
  { gradient: string; glow: string; color: string }
> = {
  "youtube.com": {
    gradient: "from-red-600 to-red-500",
    glow: "shadow-red-500/25",
    color: "text-red-400",
  },
  "github.com": {
    gradient: "from-slate-600 to-slate-500",
    glow: "shadow-slate-400/20",
    color: "text-slate-300",
  },
  "twitter.com": {
    gradient: "from-sky-500 to-sky-400",
    glow: "shadow-sky-500/25",
    color: "text-sky-400",
  },
  "gmail.com": {
    gradient: "from-amber-500 to-orange-400",
    glow: "shadow-amber-500/25",
    color: "text-amber-400",
  },
  "netflix.com": {
    gradient: "from-red-700 to-red-600",
    glow: "shadow-red-600/25",
    color: "text-red-400",
  },
  "spotify.com": {
    gradient: "from-emerald-600 to-green-500",
    glow: "shadow-emerald-500/25",
    color: "text-emerald-400",
  },
  "linkedin.com": {
    gradient: "from-blue-600 to-blue-500",
    glow: "shadow-blue-500/25",
    color: "text-blue-400",
  },
  "reddit.com": {
    gradient: "from-orange-600 to-orange-500",
    glow: "shadow-orange-500/25",
    color: "text-orange-400",
  },
};

const DEFAULT_STYLE = {
  gradient: "from-cyan-500 to-teal-400",
  glow: "shadow-cyan-500/25",
  color: "text-cyan-400",
};

/* ═══════════════════════════════════════════
   CATEGORY COLORS
   ═══════════════════════════════════════════ */
const CATEGORY_COLORS: Record<string, string> = {
  Tech: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  Science: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  Business: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  World: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Sports: "bg-rose-500/15 text-rose-400 border-rose-500/20",
  Entertainment: "bg-pink-500/15 text-pink-400 border-pink-500/20",
};

/* ═══════════════════════════════════════════
   CATEGORY DETECTION
   ═══════════════════════════════════════════ */
function detectCategory(title: string): string {
  const t = title.toLowerCase();
  if (/tecnolog|inteligencia artificial|\bia\b|robot|software|app|google|apple|microsoft|samsung|cpu|gpu|tech|cibersegur/.test(t)) return "Tech";
  if (/ciencia|espacio|nasa|clima|salud|covid|virus|estudio|investigaci|astronom/.test(t)) return "Science";
  if (/econom|mercado|bolsa|banco|financ|empresa|precio|criptomoneda|bitcoin|crypto/.test(t)) return "Business";
  if (/deporte|fútbol|baloncesto|tenis|olimp|mundial|liga|gol/.test(t)) return "Sports";
  if (/cine|música|entretenimiento|celebridad|película|serie|netflix|spotify/.test(t)) return "Entertainment";
  return "World";
}

/* ═══════════════════════════════════════════
   FALLBACK DATA (mientras cargan las APIs)
   ═══════════════════════════════════════════ */
const MOCK_NEWS: NewsItem[] = [
  {
    title: "OpenAI lanza GPT-5 con capacidades multimodales avanzadas",
    source: "TechCrunch",
    url: "https://techcrunch.com",
    category: "Tech",
    time: "Hace 2h",
    image:
      "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=200&fit=crop",
  },
  {
    title: "SpaceX completa su misión número 100 de Starlink en 2026",
    source: "Space.com",
    url: "https://space.com",
    category: "Science",
    time: "Hace 3h",
    image:
      "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=400&h=200&fit=crop",
  },
  {
    title: "El mercado cripto supera los $5 trillones por primera vez",
    source: "CoinDesk",
    url: "https://coindesk.com",
    category: "Business",
    time: "Hace 4h",
    image:
      "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=200&fit=crop",
  },
  {
    title: "La UE aprueba nueva regulación global de inteligencia artificial",
    source: "Reuters",
    url: "https://reuters.com",
    category: "World",
    time: "Hace 5h",
    image:
      "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=200&fit=crop",
  },
  {
    title: "React 20 introduce compilación nativa para web y móvil",
    source: "Dev.to",
    url: "https://dev.to",
    category: "Tech",
    time: "Hace 6h",
  },
  {
    title: "Nuevo telescopio Webb descubre señales de vida en exoplaneta",
    source: "NASA",
    url: "https://nasa.gov",
    category: "Science",
    time: "Hace 7h",
  },
];

const MOCK_TRENDS: TrendItem[] = [
  {
    title: "Claude 4 release date",
    searches: "2.1M",
    url: "https://google.com/search?q=claude+4",
  },
  {
    title: "React Server Components",
    searches: "890K",
    url: "https://google.com/search?q=react+server+components",
  },
  {
    title: "Tailwind CSS v4",
    searches: "650K",
    url: "https://google.com/search?q=tailwind+v4",
  },
  {
    title: "Rust programming language",
    searches: "520K",
    url: "https://google.com/search?q=rust+programming",
  },
  {
    title: "Web Assembly 2.0",
    searches: "410K",
    url: "https://google.com/search?q=wasm+2.0",
  },
];

/* ═══════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════ */
function useGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return { text: "Buenas noches", emoji: "🌙" };
  if (hour < 12) return { text: "Buenos días", emoji: "☀️" };
  if (hour < 18) return { text: "Buenas tardes", emoji: "🌤️" };
  return { text: "Buenas noches", emoji: "🌙" };
}

function useDateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
}

function useWeather() {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("http://localhost:3000/api/weather")
      .then((r) => r.json())
      .then((w) => {
        if (w.temp) setData(w as WeatherData);
      })
      .catch(() => {});
  }, []);

  return data;
}

function useNews() {
  const [news, setNews] = useState<NewsItem[]>(MOCK_NEWS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3000/api/news")
      .then((r) => r.json())
      .then((data: NewsItem[]) => {
        if (Array.isArray(data) && data.length > 0) setNews(data);
      })
      .catch(() => {/* usa mock */})
      .finally(() => setLoading(false));
  }, []);

  return { news, loading };
}

function useTrends() {
  const [trends, setTrends] = useState<TrendItem[]>(MOCK_TRENDS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3000/api/trends")
      .then((r) => r.json())
      .then((data: { title: string; traffic: string; link: string }[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setTrends(
            data.map((t) => ({
              title: t.title,
              searches: t.traffic || "",
              url: t.link || `https://www.google.com/search?q=${encodeURIComponent(t.title)}`,
            }))
          );
        }
      })
      .catch(() => {/* usa mock */})
      .finally(() => setLoading(false));
  }, []);

  return { trends, loading };
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export const NewTabPage = ({
  voiceState,
  transcription,
  audioLevels,
  suggestions,
  quickAccess,
  recentSearches,
  tabsCount,
  onVoiceCommand,
  onNavigate,
}: NewTabPageProps) => {
  const greeting = useGreeting();
  const dateTime = useDateTime();
  const weather = useWeather();
  const { news, loading: newsLoading } = useNews();
  const { trends, loading: trendsLoading } = useTrends();
  const { colors } = useTheme();
  const [searchValue, setSearchValue] = useState("");
  const [activeNewsTab, setActiveNewsTab] = useState<"news" | "trends">("news");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNewsSection, setShowNewsSection] = useState(() => {
    return localStorage.getItem("orion_show_news") !== "false";
  });

  const toggleNewsSection = () => {
    setShowNewsSection((prev) => {
      const next = !prev;
      localStorage.setItem("orion_show_news", String(next));
      return next;
    });
  };

  const isVoiceActive = voiceState !== "idle";

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchValue.trim()) {
        onNavigate(searchValue.trim());
        setSearchValue("");
      }
    },
    [searchValue, onNavigate]
  );

  // Determine search bar border color based on voice state
  const getSearchBorderStyle = () => {
    if (voiceState === "listening") return "border-cyan-500/60 shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)]";
    if (voiceState === "processing") return "border-violet-500/60 shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]";
    if (voiceState === "results") return "border-emerald-500/60 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]";
    if (searchFocused) return "border-cyan-500/30";
    return "border-[var(--orion-border)]";
  };


  return (
    <div className="h-full overflow-y-auto bg-transparent scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      {/* ═══ Bubble Background ═══ */}
      <BubbleBackground
        colorFrom={colors.accentGradient[0]}
        colorTo={colors.accentGradient[1]}
      />

      {/* ═══ Content ═══ */}
      <div className="relative max-w-[1200px] mx-auto px-6 py-8">
        {/* ── Hero: Greeting + Search ── */}
        <div className="max-w-3xl mx-auto text-center mb-10">
          {/* Date & Time (compact top line) */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-sm text-[var(--orion-textMuted)]">{dateTime.date}</span>
            <span className="text-[var(--orion-textMuted)]">•</span>
            <span className="text-sm font-semibold text-[var(--orion-textSecondary)]">
              {dateTime.time}
            </span>
          </div>

          {/* Greeting */}
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--orion-textPrimary)] mb-2 tracking-tight">
            {greeting.text}{" "}
            <span className="inline-block">{greeting.emoji}</span>
          </h1>
          <p className="text-base text-[var(--orion-textMuted)] mb-8">
            ¿Qué quieres{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent font-semibold">
              explorar
            </span>{" "}
            hoy?
          </p>

          {/* ═══ UNIFIED SEARCH BAR with VOICE ═══ */}
          <form onSubmit={handleSearch} className="relative group search-container">
            {/* Focus ring — renders outside the bar */}
            <div className="search-focus-ring rounded-2xl" />

            {/* Voice-state glow */}
            <div
              className={`absolute -inset-1 rounded-2xl blur-lg transition-all duration-500 pointer-events-none ${
                voiceState === "listening"
                  ? "bg-gradient-to-r from-cyan-500/25 via-teal-500/15 to-cyan-500/25 opacity-100"
                  : voiceState === "processing"
                  ? "bg-gradient-to-r from-violet-500/25 via-purple-500/15 to-violet-500/25 opacity-100"
                  : voiceState === "results"
                  ? "bg-gradient-to-r from-emerald-500/20 via-green-500/12 to-emerald-500/20 opacity-100"
                  : "opacity-0"
              }`}
            />

            {/* Main bar container */}
            <div
              className={`relative flex items-center rounded-2xl border transition-all duration-300 search-glass ${getSearchBorderStyle()}`}
            >
              {/* Search Icon */}
              <div className="pl-5 flex-shrink-0">
                <Search
                  className={`h-5 w-5 transition-colors duration-300 ${
                    isVoiceActive || searchFocused
                      ? "text-cyan-400"
                      : "text-[var(--orion-textMuted)]"
                  }`}
                />
              </div>

              {/* Input / Voice transcription */}
              <div className="flex-1 relative min-w-0">
                {isVoiceActive ? (
                  /* Voice feedback inline */
                  <div className="flex items-center gap-3 px-4 py-4">
                    {/* Mini audio bars inside the search bar */}
                    {voiceState === "listening" && (
                      <div className="flex items-end gap-[2px] h-5 w-16 flex-shrink-0">
                        {audioLevels.slice(0, 10).map((level, i) => (
                          <div
                            key={i}
                            className="w-1 rounded-full bg-gradient-to-t from-cyan-500 to-teal-400 transition-all duration-75"
                            style={{
                              height: `${Math.max(20, level * 0.8)}%`,
                              opacity: 0.5 + level / 200,
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {voiceState === "processing" && (
                      <Loader2 className="w-5 h-5 text-violet-400 animate-spin flex-shrink-0" />
                    )}

                    <span
                      className={`text-[15px] truncate ${
                        voiceState === "listening"
                          ? "text-cyan-300 animate-pulse"
                          : voiceState === "processing"
                          ? "text-violet-300"
                          : "text-emerald-300"
                      }`}
                    >
                      {voiceState === "listening" && !transcription
                        ? "Escuchando… habla ahora"
                        : voiceState === "processing"
                        ? `Procesando: "${transcription}"`
                        : voiceState === "results"
                        ? `✓ "${transcription}"`
                        : `"${transcription}"`}
                    </span>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Buscar en la web, escribir URL o hablar…"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full px-4 py-4 bg-transparent text-[var(--orion-textSecondary)] placeholder-[var(--orion-textMuted)] text-[15px] focus:outline-none"
                  />
                )}
              </div>

              {/* Right side actions */}
              <div className="flex items-center gap-2 pr-3 flex-shrink-0">
                {/* Search submit button (only when typing) */}
                {searchValue && !isVoiceActive && (
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-sm font-medium text-white hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 active:scale-95"
                  >
                    Buscar
                  </button>
                )}

                {/* Divider */}
                <div
                  className={`w-px h-7 transition-colors duration-300 bg-[var(--orion-border)]`}
                />

                {/* Voice Button — embedded */}
                <button
                  type="button"
                  onClick={onVoiceCommand}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    voiceState === "listening"
                      ? "bg-gradient-to-br from-cyan-500 to-teal-400 text-white shadow-lg shadow-cyan-500/30 scale-110"
                      : voiceState === "processing"
                      ? "bg-gradient-to-br from-violet-500 to-purple-400 text-white shadow-lg shadow-violet-500/30 scale-105"
                      : voiceState === "results"
                      ? "bg-gradient-to-br from-emerald-500 to-green-400 text-white shadow-lg shadow-emerald-500/30 scale-105"
                      : "text-[var(--orion-textMuted)] hover:text-cyan-400 hover:bg-[var(--orion-bgTertiary)] active:scale-95"
                  }`}
                >
                  {/* Pulse ring when active */}
                  {isVoiceActive && (
                    <div
                      className={`absolute inset-0 rounded-xl ${
                        voiceState === "listening"
                          ? "bg-cyan-500/40"
                          : voiceState === "processing"
                          ? "bg-violet-500/40"
                          : "bg-emerald-500/40"
                      }`}
                      style={{
                        animation: "searchbar-pulse 2s ease-in-out infinite",
                      }}
                    />
                  )}

                  {voiceState === "listening" ? (
                    <MicOff className="w-4.5 h-4.5 relative z-10" />
                  ) : voiceState === "processing" ? (
                    <Loader2 className="w-4.5 h-4.5 relative z-10 animate-spin" />
                  ) : (
                    <Mic className="w-4.5 h-4.5 relative z-10" />
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Voice suggestions chips */}
          {suggestions.length > 0 && voiceState === "results" && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center animate-in">
              <span className="text-xs text-[var(--orion-textMuted)] mr-1 self-center">
                Sugerencias:
              </span>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(s)}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] hover:border-cyan-500/30 hover:bg-cyan-500/[0.06] text-xs text-[var(--orion-textSecondary)] hover:text-cyan-400 transition-all duration-200"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Keyboard shortcut hint */}
          {!isVoiceActive && !searchValue && (
            <div className="mt-3 flex items-center justify-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--orion-textMuted)]">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] text-[var(--orion-textMuted)] font-mono text-[10px]">
                  /
                </kbd>
                para buscar
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--orion-textMuted)]">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] text-[var(--orion-textMuted)] font-mono text-[10px]">
                  Alt+V
                </kbd>
                para voz
              </span>
            </div>
          )}
        </div>

        {/* ── Quick Access ── */}
        <section className="mb-8">
          <SectionHeader
            icon={<Zap className="w-4 h-4" />}
            title="Acceso rápido"
            accent="cyan"
          />
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {quickAccess.map((item, i) => {
              const style = SERVICE_STYLES[item.url] || DEFAULT_STYLE;
              return (
                <button
                  key={i}
                  onClick={() => onNavigate(`https://${item.url}`)}
                  className="group flex flex-col items-center gap-2.5 py-4 px-2 rounded-2xl hover:bg-[var(--orion-bgSecondary)] transition-all duration-250"
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-lg ${style.glow} group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}
                  >
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[11px] text-[var(--orion-textMuted)] group-hover:text-[var(--orion-textSecondary)] transition-colors font-medium">
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Recent Searches ── */}
        {recentSearches.length > 0 && (
          <section className="mb-8">
            <SectionHeader
              icon={<Clock className="w-4 h-4" />}
              title="Recientes"
              accent="slate"
            />
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((query, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(query)}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] hover:bg-[var(--orion-bgTertiary)] hover:border-[var(--orion-borderHover)] transition-all duration-200"
                >
                  <Clock className="h-3.5 w-3.5 text-[var(--orion-textMuted)] group-hover:text-[var(--orion-textSecondary)] transition-colors" />
                  <span className="text-sm text-[var(--orion-textSecondary)] group-hover:text-[var(--orion-textPrimary)] transition-colors truncate max-w-[200px]">
                    {query
                      .replace("https://", "")
                      .replace("http://", "")
                      .replace("www.", "")}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Main Grid: News + Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* News column (2/3) */}
          <div className="lg:col-span-2">
            {/* Tab switcher + toggle */}
            <div className="flex items-center justify-between mb-5">
              {showNewsSection ? (
                <div className="flex items-center gap-1 p-1 bg-[var(--orion-bgSecondary)] rounded-xl border border-[var(--orion-border)] w-fit">
                  <button
                    onClick={() => setActiveNewsTab("news")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeNewsTab === "news"
                        ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                        : "text-[var(--orion-textMuted)] hover:text-[var(--orion-textSecondary)] border border-transparent"
                    }`}
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    Noticias
                  </button>
                  <button
                    onClick={() => setActiveNewsTab("trends")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeNewsTab === "trends"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                        : "text-[var(--orion-textMuted)] hover:text-[var(--orion-textSecondary)] border border-transparent"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    Tendencias
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[var(--orion-textMuted)]">Noticias y tendencias ocultas</p>
              )}
              {/* Toggle button */}
              <button
                onClick={toggleNewsSection}
                title={showNewsSection ? "Ocultar sección" : "Mostrar sección"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--orion-textMuted)] hover:text-[var(--orion-textSecondary)] hover:bg-[var(--orion-bgSecondary)] border border-transparent hover:border-[var(--orion-border)] transition-all duration-200"
              >
                {showNewsSection ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    Ocultar
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Mostrar
                  </>
                )}
              </button>
            </div>

            {showNewsSection && (
              activeNewsTab === "news" ? (
                newsLoading ? (
                  <div className="space-y-3">
                    <div className="h-48 rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] animate-pulse" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-28 rounded-xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] animate-pulse" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {news[0] && (
                      <FeaturedNewsCard
                        item={news[0]}
                        onClick={() => onNavigate(news[0].url)}
                      />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {news.slice(1).map((item, i) => (
                        <NewsCard
                          key={i}
                          item={item}
                          onClick={() => onNavigate(item.url)}
                        />
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {trendsLoading
                    ? [...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 rounded-xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] animate-pulse" />
                      ))
                    : trends.map((trend, i) => (
                    <TrendCard
                      key={i}
                      rank={i + 1}
                      item={trend}
                      onClick={() => onNavigate(trend.url)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )
            )}
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-5">
            <WeatherWidget data={weather} />
            <TipWidget />
            <StatsWidget tabsCount={tabsCount} visitedCount={recentSearches.length} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes searchbar-pulse {
          0%, 100% { opacity: 0; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        .animate-in { animation: fadeSlideIn 0.4s ease-out forwards; }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

function SectionHeader({
  icon,
  title,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
}) {
  const accentColors: Record<string, string> = {
    cyan: "from-cyan-500 to-teal-400",
    slate: "from-slate-500 to-slate-400",
    amber: "from-amber-500 to-orange-400",
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${
          accentColors[accent] || accentColors.cyan
        } flex items-center justify-center shadow-sm text-white`}
      >
        {icon}
      </div>
      <h2 className="text-base font-bold text-[var(--orion-textPrimary)]">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-[var(--orion-border)] to-transparent" />
    </div>
  );
}

/* ── Featured News Card ── */
function FeaturedNewsCard({
  item,
  onClick,
}: {
  item: NewsItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left rounded-2xl overflow-hidden border border-[var(--orion-border)] hover:border-[var(--orion-borderHover)] transition-all duration-300"
    >
      {item.image && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={item.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--orion-bgPrimary)] via-[var(--orion-bgPrimary)]/50 to-transparent" />
          <div className="absolute top-3 left-3">
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                CATEGORY_COLORS[item.category] ||
                "bg-slate-500/15 text-slate-400 border-slate-500/20"
              }`}
            >
              {item.category}
            </span>
          </div>
        </div>
      )}

      <div className="p-5 bg-[var(--orion-bgSecondary)]">
        <h3 className="text-lg font-bold text-[var(--orion-textSecondary)] group-hover:text-[var(--orion-textPrimary)] transition-colors leading-snug mb-3">
          {item.title}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Globe className="w-3.5 h-3.5 text-[var(--orion-textMuted)]" />
            <span className="text-xs text-[var(--orion-textMuted)] font-medium">
              {item.source}
            </span>
            <span className="text-xs text-[var(--orion-textMuted)]">•</span>
            <span className="text-xs text-[var(--orion-textMuted)]">{item.time}</span>
          </div>
          <ExternalLink className="w-4 h-4 text-[var(--orion-textMuted)] group-hover:text-cyan-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

/* ── News Card (compact) ── */
function NewsCard({
  item,
  onClick,
}: {
  item: NewsItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex gap-4 p-4 rounded-xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] hover:bg-[var(--orion-bgTertiary)] hover:border-[var(--orion-borderHover)] transition-all duration-250 text-left w-full"
    >
      {item.image ? (
        <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={item.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-lg bg-[var(--orion-bgTertiary)] border border-[var(--orion-border)] flex items-center justify-center flex-shrink-0">
          <Newspaper className="w-6 h-6 text-[var(--orion-textMuted)]" />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <span
          className={`self-start px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border mb-1.5 ${
            CATEGORY_COLORS[item.category] ||
            "bg-slate-500/15 text-slate-400 border-slate-500/20"
          }`}
        >
          {item.category}
        </span>
        <h4 className="text-sm font-semibold text-[var(--orion-textSecondary)] group-hover:text-[var(--orion-textPrimary)] transition-colors leading-snug line-clamp-2">
          {item.title}
        </h4>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-[var(--orion-textMuted)]">{item.source}</span>
          <span className="text-[11px] text-[var(--orion-textMuted)]">•</span>
          <span className="text-[11px] text-[var(--orion-textMuted)]">{item.time}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Trend Card ── */
function TrendCard({
  rank,
  item,
  onClick,
  onNavigate,
}: {
  rank: number;
  item: TrendItem;
  onClick: () => void;
  onNavigate: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTop3 = rank <= 3;
  const hasRelated = (item.relatedNews?.length ?? 0) > 0;

  return (
    <div className="rounded-xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] hover:border-amber-500/20 transition-all duration-200 overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        {/* Rank badge */}
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
            isTop3
              ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20"
              : "bg-[var(--orion-bgTertiary)] border border-[var(--orion-border)] text-[var(--orion-textMuted)]"
          }`}
        >
          {rank}
        </div>

        {/* Thumbnail */}
        {item.image && (
          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
            <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}

        {/* Info */}
        <button onClick={onClick} className="flex-1 min-w-0 text-left group">
          <p className="text-sm font-semibold text-[var(--orion-textSecondary)] group-hover:text-[var(--orion-textPrimary)] transition-colors truncate">
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] text-amber-500/80 font-medium">
                {item.searches} búsquedas
              </span>
            </div>
            {item.time && (
              <>
                <span className="text-[var(--orion-textMuted)] text-[10px]">•</span>
                <span className="text-[11px] text-[var(--orion-textMuted)]">{item.time}</span>
              </>
            )}
          </div>
        </button>

        {/* Expand toggle */}
        {hasRelated && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--orion-textMuted)] hover:text-amber-400 hover:bg-amber-500/10 transition-all duration-150"
          >
            <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
          </button>
        )}
      </div>

      {/* Related news (expandable) */}
      {expanded && hasRelated && (
        <div className="border-t border-[var(--orion-border)] divide-y divide-[var(--orion-border)]">
          {item.relatedNews!.map((news, i) => (
            <button
              key={i}
              onClick={() => onNavigate(news.url)}
              className="group flex items-center gap-3 w-full px-4 py-3 hover:bg-[var(--orion-bgTertiary)] transition-colors text-left"
            >
              {news.image && (
                <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0">
                  <img src={news.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[var(--orion-textSecondary)] group-hover:text-[var(--orion-textPrimary)] transition-colors line-clamp-2 leading-snug">
                  {news.title}
                </p>
                <span className="text-[10px] text-[var(--orion-textMuted)] mt-0.5 block">{news.source}</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--orion-textMuted)] group-hover:text-amber-400 flex-shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Weather Widget ── */
function WeatherWidget({ data }: { data: WeatherData | null }) {
  const WEATHER_EMOJI: Record<string, string> = {
    sunny: "☀️", clear: "🌙", "partly cloudy": "⛅", cloudy: "☁️",
    overcast: "☁️", mist: "🌫️", fog: "🌫️", rain: "🌧️", drizzle: "🌦️",
    snow: "❄️", thunderstorm: "⛈️", blizzard: "🌨️",
  };
  const emoji = data
    ? WEATHER_EMOJI[data.description.toLowerCase()] ?? "🌡️"
    : "⛅";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/10 via-blue-500/5 to-indigo-500/10 border border-sky-500/10 p-5 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl" />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[11px] text-sky-400/60 uppercase tracking-wider font-medium mb-1">
              {data?.city ? data.city : "Clima"}
            </p>
            <p className="text-3xl font-bold text-[var(--orion-textPrimary)]">
              {data ? `${data.temp}°C` : "—"}
            </p>
          </div>
          <span className="text-4xl">{emoji}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          <span className="text-[11px] text-[var(--orion-textSecondary)]">
            {data ? data.description : "Cargando…"}
          </span>
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--orion-border)]">
          <div>
            <p className="text-[10px] text-[var(--orion-textMuted)]">Humedad</p>
            <p className="text-xs text-[var(--orion-textSecondary)] font-medium">
              {data ? `${data.humidity}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--orion-textMuted)]">Viento</p>
            <p className="text-xs text-[var(--orion-textSecondary)] font-medium">
              {data ? `${data.windKmph} km/h` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--orion-textMuted)]">UV</p>
            <p className="text-xs text-[var(--orion-textSecondary)] font-medium">
              {data ? data.uvIndex : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tip Widget ── */
function TipWidget() {
  const tips = [
    "Usa Ctrl+T para abrir una nueva pestaña rápidamente.",
    "Habla con el asistente de voz para navegar sin teclado.",
    "Guarda tus sitios favoritos con la estrella ⭐.",
    "Escribe directamente en la barra para buscar con Flux Search.",
  ];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);

  return (
    <div className="rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <span className="text-xs font-bold text-[var(--orion-textSecondary)]">
          Consejo del día
        </span>
      </div>
      <p className="text-sm text-[var(--orion-textSecondary)] leading-relaxed">{tip}</p>
    </div>
  );
}

/* ── Stats Widget ── */
function StatsWidget({ tabsCount, visitedCount }: { tabsCount: number; visitedCount: number }) {
  return (
    <div className="rounded-2xl bg-[var(--orion-bgSecondary)] border border-[var(--orion-border)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <span className="text-xs font-bold text-[var(--orion-textSecondary)]">Tu actividad</span>
      </div>

      <div className="space-y-3">
        <StatRow label="Pestañas abiertas" value={String(tabsCount)} color="cyan" />
        <StatRow label="Sitios visitados hoy" value={String(visitedCount)} color="violet" />
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    cyan: "text-cyan-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--orion-textMuted)]">{label}</span>
      <span
        className={`text-sm font-bold ${colors[color] || "text-[var(--orion-textSecondary)]"}`}
      >
        {value}
      </span>
    </div>
  );
}