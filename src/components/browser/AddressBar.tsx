import { useState, useEffect, useRef, useCallback } from "react";
import {
	Search,
	Shield,
	ShieldAlert,
	ShieldCheck,
	Star,
	RotateCw,
	Sparkles,
	Mic,
	MicOff,
	Eye,
	EyeOff,
	Timer,
	Zap,
	Copy,
	Check,
	QrCode,
	Share2,
	ArrowRight,
	Clock,
	TrendingUp,
	Globe,
	Loader2,
	X,
	ChevronDown,
	Bookmark,
	AlertTriangle,
	Wifi,
	WifiOff,
} from "lucide-react";
import { SecurityPanel } from "@/components/browser/SecurityPanel";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/hooks/useFavorite";
import { useToast } from "@/hooks/use-toast";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */
interface AddressBarProps {
	url: string;
	onNavigate: (url: string) => void;
	onRefresh: () => void;
	onStop?: () => void;
	isSecure?: boolean;
	isLoading?: boolean;
	pageTitle?: string;
	onVoiceCommand?: () => void;
	voiceState?: "idle" | "listening" | "processing" | "results";
	// Controlled state desde BrowserWindow
	privacyMode?: boolean;
	onPrivacyModeChange?: (value: boolean) => void;
	readerMode?: boolean;
	onReaderModeChange?: (value: boolean) => void;
	// Panel de Flux AI
	aiPanelOpen?: boolean;
	onToggleAIPanel?: () => void;
}

interface SuggestionItem {
	type: "history" | "suggestion" | "bookmark" | "trending" | "quick-action";
	title: string;
	url?: string;
	icon?: string;
	description?: string;
	action?: () => void;
}

interface GoogleTrend {
	title: string;
	traffic: string;
	link: string;
	image?: string;
	time: string;
	relatedNews?: Array<{
		title: string;
		url: string;
		source: string;
		image?: string;
		snippet: string;
	}>;
}

interface SiteSecurityInfo {
	level: "secure" | "warning" | "danger";
	protocol: string;
	certificate?: string;
	trackers: number;
	cookies: number;
	loadTime: number;
}

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */
const ORION_INTERNAL = [
	"flux://welcome",
	"flux://newtab",
	"flux://settings",
];
const isInternalUrl = (url: string) =>
	ORION_INTERNAL.some((p) => url.startsWith(p));

const toOrionDisplay = (url: string): string => {
	if (isInternalUrl(url)) return url;
	return url.replace(/^https?:\/\//, "flux://");
};

const toRealUrl = (input: string): string => {
	if (isInternalUrl(input)) return input;
	if (input.startsWith("flux://")) return "https://" + input.slice(8);
	return input;
};

const getDomain = (url: string): string => {
	try {
		return new URL(url.replace("flux://", "https://")).hostname;
	} catch {
		return url;
	}
};

/* ═══════════════════════════════════════════
   MOCK SUGGESTIONS — Reemplazar con datos reales
   ═══════════════════════════════════════════ */
const MOCK_SUGGESTIONS: SuggestionItem[] = [
	{
		type: "trending",
		title: "ChatGPT 5 release",
		url: "https://google.com/search?q=chatgpt+5",
		description: "2.1M búsquedas",
	},
	{
		type: "trending",
		title: "React 20 features",
		url: "https://google.com/search?q=react+20",
		description: "890K búsquedas",
	},
];

const QUICK_ACTIONS: SuggestionItem[] = [
	{
		type: "quick-action",
		title: "Modo privado",
		description: "Navegar sin dejar rastro",
		action: () => {},
	},
	{
		type: "quick-action",
		title: "Captura de pantalla",
		description: "Capturar esta página",
		action: () => {},
	},
	{
		type: "quick-action",
		title: "Modo lectura",
		description: "Leer sin distracciones",
		action: () => {},
	},
	{
		type: "quick-action",
		title: "Temporizador de sitio",
		description: "Limitar tiempo en este sitio",
		action: () => {},
	},
];

/* ═══════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════ */
function getSecurityLevel(
	url: string,
	isSecure: boolean,
): {
	level: "secure" | "warning" | "danger";
	protocol: string;
	certificate?: string;
} {
	return {
		level: isSecure
			? "secure"
			: url.startsWith("http://")
			? "danger"
			: "warning",
		protocol: isSecure ? "TLS 1.3" : "Sin cifrar",
		certificate: isSecure ? "Verificado" : undefined,
	};
}

function formatTimeAgo(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 66) return `${m}m`;
	return `${Math.floor(m / 60)}h`;
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export const AddressBar = ({
	url,
	onNavigate,
	onRefresh,
	onStop,
	isSecure = true,
	isLoading = false,
	pageTitle,
	onVoiceCommand,
	voiceState = "idle",
	privacyMode: privacyModeProp,
	onPrivacyModeChange,
	readerMode: readerModeProp,
	onReaderModeChange,
	aiPanelOpen = false,
	onToggleAIPanel,
}: AddressBarProps) => {
	const [inputValue, setInputValue] = useState(toOrionDisplay(url));
	const [isFocused, setIsFocused] = useState(false);
	const [showDropdown, setShowDropdown] = useState(false);
	const [showShareMenu, setShowShareMenu] = useState(false);
	const [copied, setCopied] = useState(false);
	// Si se pasan props controlados, usarlos; si no, estado local
	const [privacyModeLocal, setPrivacyModeLocal] = useState(false);
	const privacyMode = privacyModeProp ?? privacyModeLocal;
	const [readerModeLocal, setReaderModeLocal] = useState(false);
	const readerMode = readerModeProp ?? readerModeLocal;
	const [siteTimer, setSiteTimer] = useState<number | null>(null);
	const [timerElapsed, setTimerElapsed] = useState(0);
	const [filterQuery, setFilterQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [remoteSuggestions, setRemoteSuggestions] = useState<SuggestionItem[]>(
		[],
	);

	const [realTrends, setRealTrends] = useState<SuggestionItem[]>([]);
	const [isFetchingTrends, setIsFetchingTrends] = useState(false);

	const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
	const [showSecurityPanel, setShowSecurityPanel] = useState(false);


	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const barRef = useRef<HTMLFormElement>(null);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { addFavorite, removeFavorite, isFavorite, favorites } = useFavorites();
	const { toast } = useToast();

	const isCurrentFavorite = isFavorite(url);
	const securityInfo = getSecurityLevel(url, isSecure);
	const domain = getDomain(url);
	const isVoiceActive = voiceState !== "idle";

	// ── Ctrl+L (Rust o atajo React) → enfocar barra ──
	useEffect(() => {
		const handler = () => {
			inputRef.current?.focus();
			setTimeout(() => inputRef.current?.select(), 0);
		};
		window.addEventListener("orion:focusaddressbar", handler);
		window.addEventListener("orion:focus-address-bar", handler);
		return () => {
			window.removeEventListener("orion:focusaddressbar", handler);
			window.removeEventListener("orion:focus-address-bar", handler);
		};
	}, []);

	// ── Sync URL changes ──
	useEffect(() => {
		if (!isFocused) {
			setInputValue(toOrionDisplay(url));
		}
	}, [url, isFocused]);

	// ── Site timer ──
	useEffect(() => {
		if (siteTimer !== null) {
			timerRef.current = setInterval(() => {
				setTimerElapsed((prev) => {
					const next = prev + 1000;
					if (next >= siteTimer) {
						toast({
							title: "⏱️ Tiempo cumplido",
							description: `Has estado ${formatTimeAgo(
								siteTimer,
							)} en ${domain}`,
						});
						setSiteTimer(null);
						return 0;
					}
					return next;
				});
			}, 1000);
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [siteTimer, domain, toast]);

	// Reset timer on navigation
	useEffect(() => {
		setTimerElapsed(0);
	}, [url]);

	// ── Close dropdown on outside click ──
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (
				barRef.current &&
				!barRef.current.contains(e.target as Node) &&
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setShowDropdown(false);
				setShowSecurityPanel(false);
				setShowShareMenu(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	useEffect(() => {
		const fetchTrends = async () => {
			setIsFetchingTrends(true);
			try {
				const res = await fetch("http://localhost:3000/api/trends");
				if (res.ok) {
					const trends: GoogleTrend[] = await res.json();
					const formattedTrends: SuggestionItem[] = trends
						.slice(0, 6)
						.map((trend: GoogleTrend) => ({
							type: "trending" as const,
							title: trend.title,
							url:
								trend.link ||
								`https://www.google.com/search?q=${encodeURIComponent(
									trend.title,
								)}`,
							description: trend.traffic || trend.time || "Tendencia",
							icon: trend.image,
						}));
					setRealTrends(formattedTrends);
				}
			} catch (error) {
				console.error("Error fetching trends:", error);
				setRealTrends([]);
			} finally {
				setIsFetchingTrends(false);
			}
		};

		fetchTrends();
	}, []);

	// ── Fetch remote suggestions ──
	const fetchSuggestions = useCallback(
		async (query: string) => {
			if (!query.trim()) {
				setRemoteSuggestions([]);
				return;
			}
			setIsFetchingSuggestions(true);
			try {
				let raw: string[] = [];

				const res = await fetch(
						`http://localhost:3000/api/suggestions?q=${encodeURIComponent(query.trim())}`,
					);
					const data = await res.json();
					raw = data.suggestions ?? [];

				const suggestions: SuggestionItem[] = raw
					.filter((s: string) => s.toLowerCase() !== query.toLowerCase())
					.slice(0, 6)
					.map((s: string) => ({
						type: "suggestion" as const,
						title: s,
						url: `flux://search?q=${encodeURIComponent(s)}`,
						description: "Flux Search",
					}));
				setRemoteSuggestions(suggestions);
			} catch {
				setRemoteSuggestions([]);
			} finally {
				setIsFetchingSuggestions(false);
			}
		},
		[],
	);

	// ── Suggestions filtering ──
	const filteredSuggestions = useCallback((): SuggestionItem[] => {
		const q = filterQuery.toLowerCase();
		if (!q)
			return [
				...QUICK_ACTIONS,
				...(realTrends.length > 0 ? realTrends : MOCK_SUGGESTIONS),
			];

		const results: SuggestionItem[] = [];

		// First: exact search entry
		results.push({
			type: "suggestion",
			title: `Buscar "${filterQuery}"`,
			url: `flux://search?q=${encodeURIComponent(filterQuery)}`,
					description: "Flux Search",
		});

		// Remote API suggestions
		results.push(...remoteSuggestions);

		// Bookmarks matching query
		favorites.forEach((f) => {
			if (
				f.title.toLowerCase().includes(q) ||
				f.url.toLowerCase().includes(q)
			) {
				results.push({
					type: "bookmark",
					title: f.title,
					url: f.url,
					description: toOrionDisplay(f.url),
				});
			}
		});

		// Add matching trending
		const trendsToUse = realTrends.length > 0 ? realTrends : MOCK_SUGGESTIONS;
		trendsToUse.forEach((s) => {
			if (s.title.toLowerCase().includes(q)) results.push(s);
		});

		return results;
	}, [filterQuery, favorites, remoteSuggestions, realTrends]);

	// ── Handlers ──
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = inputValue.trim();
		if (!trimmed) return;

		const realUrl = toRealUrl(trimmed);
		onNavigate(realUrl);
		setIsFocused(false);
		setShowDropdown(false);
		inputRef.current?.blur();
	};

	const handleFocus = () => {
		setIsFocused(true);
		setShowDropdown(true);
		setFilterQuery("");
		setSelectedIndex(-1);
		// Select all text on focus
		setTimeout(() => inputRef.current?.select(), 0);
	};

	const handleBlur = () => {
		// Delay to allow clicks on dropdown
		setTimeout(() => {
			setIsFocused(false);
		}, 200);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setInputValue(val);
		setFilterQuery(val);
		setShowDropdown(true);
		setSelectedIndex(-1);

		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => fetchSuggestions(val), 220);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!showDropdown) return;
		const suggestions = filteredSuggestions();

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((prev) => {
				const next = Math.min(prev + 1, suggestions.length - 1);
				const item = suggestions[next];
				if (item?.url) setInputValue(item.url);
				else if (item) setInputValue(item.title);
				return next;
			});
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((prev) => {
				const next = prev - 1;
				if (next < 0) {
					setInputValue(filterQuery);
					return -1;
				}
				const item = suggestions[next];
				if (item?.url) setInputValue(item.url);
				else if (item) setInputValue(item.title);
				return next;
			});
		} else if (e.key === "Escape") {
			setShowDropdown(false);
			setSelectedIndex(-1);
			setInputValue(filterQuery);
			inputRef.current?.blur();
		} else if (e.key === "Enter" && selectedIndex >= 0) {
			e.preventDefault();
			const item = suggestions[selectedIndex];
			if (item) handleSuggestionClick(item);
		}
	};

	const handleCopyUrl = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			toast({ title: "URL copiada", description: toOrionDisplay(url) });
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast({
				title: "Error al copiar",
				description: "No se pudo copiar la URL",
			});
		}
	};

	const handleToggleFavorite = () => {
		if (isCurrentFavorite) {
			const fav = favorites.find((f) => f.url === url);
			if (fav) {
				removeFavorite(fav.id);
				toast({
					title: "Eliminado de favoritos",
					description: toOrionDisplay(url),
				});
			}
		} else {
			addFavorite({
				title: pageTitle || domain,
				url,
			});
			toast({ title: "⭐ Favorito guardado", description: toOrionDisplay(url) });
		}
	};

	const handleSetTimer = (minutes: number) => {
		setSiteTimer(minutes * 60 * 1000);
		setTimerElapsed(0);
		toast({
			title: `Temporizador: ${minutes} min`,
			description: `Se te avisará después de ${minutes} minutos en ${domain}`,
		});
		setShowDropdown(false);
	};

	const handleTogglePrivacy = () => {
		const next = !privacyMode;
		if (onPrivacyModeChange) onPrivacyModeChange(next);
		else setPrivacyModeLocal(next);
		toast({
			title: next ? "Modo privado" : "Modo normal",
			description: next
				? "No se guardarán historial ni cookies"
				: "Navegación normal restaurada",
		});
	};

	const handleToggleReader = () => {
		const next = !readerMode;
		if (onReaderModeChange) onReaderModeChange(next);
		else setReaderModeLocal(next);
		toast({
			title: next ? "Modo lectura" : "Vista normal",
			description: next
				? "Contenido optimizado para lectura"
				: "Vista original restaurada",
		});
	};

	const handleSuggestionClick = (item: SuggestionItem) => {
		if (item.action) {
			item.action();
		} else if (item.url) {
			onNavigate(item.url);
		}
		setShowDropdown(false);
		setIsFocused(false);
		inputRef.current?.blur();
	};

	// ── Visual states ──
	const getBarBorder = () => {
		if (isVoiceActive) {
			if (voiceState === "listening")
				return "border-cyan-500/50 shadow-[0_0_20px_-4px_rgba(6,182,212,0.25)]";
			if (voiceState === "processing")
				return "border-violet-500/50 shadow-[0_0_20px_-4px_rgba(139,92,246,0.25)]";
			return "border-emerald-500/50 shadow-[0_0_20px_-4px_rgba(16,185,129,0.25)]";
		}
		if (privacyMode)
			return "border-amber-500/40 shadow-[0_0_15px_-4px_rgba(245,158,11,0.2)]";
		if (readerMode) return "border-orange-500/40";
		if (isFocused)
			return "border-cyan-500/40 shadow-[0_0_20px_-4px_rgba(6,182,212,0.15)]";
		return "border-[var(--orion-border)] hover:border-[var(--orion-borderHover)]";
	};

	const getBarBg = () => {
		if (privacyMode) return "bg-amber-500/10";
		if (readerMode) return "bg-orange-500/10";
		if (isFocused) return "bg-[var(--orion-bgSecondary)]";
		return "bg-[var(--orion-bgTertiary)]";
	};
	// ── Highlight matching text in suggestions ──
	const highlightMatch = (text: string, query: string) => {
		if (!query.trim()) return <span>{text}</span>;
		const idx = text.toLowerCase().indexOf(query.toLowerCase());
		if (idx === -1) return <span>{text}</span>;
		return (
			<>
				<span>{text.slice(0, idx)}</span>
				<span className="text-white font-semibold">
					{text.slice(idx, idx + query.length)}
				</span>
				<span>{text.slice(idx + query.length)}</span>
			</>
		);
	};

	const SecurityIcon =
		securityInfo.level === "secure"
			? ShieldCheck
			: securityInfo.level === "warning"
			? Shield
			: ShieldAlert;

	const securityColor =
		securityInfo.level === "secure"
			? "text-emerald-400"
			: securityInfo.level === "warning"
			? "text-amber-400"
			: "text-red-400";

	// ═══ SHIELD BRAVE-STYLE: Stats reales de Electron ═══
	const [pageStats, setPageStats] = useState({
		trackersBlocked: 0,
		adsBlocked: 0,
		cookiesBlocked: 0,
		dataSavedBytes: 0,
	});
	const [badgePulse, setBadgePulse] = useState(false);
	const prevTotalRef = useRef(0);

	// Obtener stats al cambiar de URL
	useEffect(() => {
		if (!domain || isInternalUrl(url)) {
			setPageStats({ trackersBlocked: 0, adsBlocked: 0, cookiesBlocked: 0, dataSavedBytes: 0 });
			prevTotalRef.current = 0;
			return;
		}

	}, [domain, url]);

	return (
		<div className="relative w-full">
			<form
				ref={barRef}
				onSubmit={handleSubmit}
				className="flex items-center gap-2 w-full">
				{/* ═══ Main Bar ═══ */}
				<div
					className={`
            flex-1 flex items-center gap-0 rounded-2xl border transition-all duration-300 relative
            ${getBarBorder()} ${getBarBg()}
          `}>
					{/* Loading progress bar */}
					{isLoading && (
						<div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
							<div
								className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500 rounded-full"
								style={{
									animation: "loadBar 1.5s ease-in-out infinite",
									width: "40%",
								}}
							/>
						</div>
					)}

					{/* Privacy mode indicator strip */}
					{privacyMode && (
						<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
					)}

					{/* ── Security Icon → abre SecurityPanel lateral ── */}
					<SecurityPanel
						url={url}
						isSecure={isSecure}
						domain={domain}
						securityInfo={securityInfo}
						onTogglePrivacy={handleTogglePrivacy}>
						<button
							type="button"
							onClick={() => {
								setShowDropdown(false);
								setShowShareMenu(false);
							}}
							className="flex items-center gap-2 pl-4 pr-2 py-3.5 flex-shrink-0 transition-all duration-200 hover:bg-[var(--orion-hoverBg)] rounded-l-2xl group">
							<div className="relative">
								<SecurityIcon
									className={`h-4 w-4 ${securityColor} transition-all duration-200 group-hover:scale-110`}
								/>
								{(() => {
									const total = (pageStats.trackersBlocked ?? 0) + (pageStats.adsBlocked ?? 0);
									if (total === 0) return null;
									return (
										<div className={`absolute -top-2.5 -right-3 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center transition-all duration-200 ${badgePulse ? "scale-125 bg-violet-400" : "scale-100 bg-violet-600"}`}>
											<span className="text-[9px] font-bold text-white leading-none">
												{total > 99 ? "99+" : total}
											</span>
										</div>
									);
								})()}
							</div>
							{!isFocused && !isInternalUrl(url) && (
								<span className="text-xs text-slate-500 font-medium hidden sm:inline max-w-[100px] truncate">
									{domain}
								</span>
							)}
						</button>
					</SecurityPanel>

					{/* ── Separator ── */}
					<div className="w-px h-5 bg-[var(--orion-border)] flex-shrink-0" />


					{/* ── Input ── */}
					<input
						ref={inputRef}
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						className="flex-1 px-3 py-3.5 bg-transparent text-sm text-[var(--orion-textPrimary)] placeholder-[var(--orion-textMuted)] focus:outline-none min-w-0"
						placeholder={
							privacyMode
								? "Navegación privada — Buscar o escribir URL…"
								: `Buscar con Flux o escribir URL…`
						}
					/>

					{/* ── Right side actions ── */}
					<div className="flex items-center gap-0.5 pr-2 flex-shrink-0">
						{/* Active timer indicator */}
						{siteTimer !== null && (
							<div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/15 mr-1">
								<Timer className="w-3 h-3 text-amber-400" />
								<span className="text-[10px] font-mono text-amber-400 font-bold">
									{formatTimeAgo(siteTimer - timerElapsed)}
								</span>
							</div>
						)}

						{/* Flux AI panel toggle */}
						{onToggleAIPanel && (
							<div className="relative group">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={onToggleAIPanel}
									className={`h-8 w-8 rounded-lg transition-all duration-200 ${
										aiPanelOpen
											? "bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25"
											: "text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10"
									}`}
									title="Flux AI">
									<Sparkles className="h-3.5 w-3.5" />
								</Button>
								{!aiPanelOpen && (
									<div className="absolute right-0 top-full mt-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
										<div className="bg-[#0f1117] border border-cyan-500/20 rounded-xl shadow-2xl px-3 py-2.5 w-52">
											<div className="flex items-center gap-2 mb-1">
												<Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
												<p className="text-xs font-semibold text-foreground">Flux AI</p>
											</div>
											<p className="text-[11px] text-muted-foreground leading-relaxed">
												¿Quieres saber más sobre esta página? Pregúntale a tu asistente.
											</p>
											<div className="mt-2 pt-2 border-t border-white/6">
												<p className="text-[10px] text-cyan-400/70">Powered by Gemini · Haz clic para abrir</p>
											</div>
										</div>
										<div className="absolute right-3 -top-1 w-2 h-2 bg-[#0f1117] border-l border-t border-cyan-500/20 rotate-45" />
									</div>
								)}
							</div>
						)}

						{/* Reader mode toggle */}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={handleToggleReader}
							className={`h-8 w-8 rounded-lg transition-all duration-200 ${
								readerMode
									? "bg-orange-500/15 text-orange-400 hover:bg-orange-500/25"
									: "text-slate-600 hover:text-slate-300 hover:bg-white/[0.06]"
							}`}
							title="Modo lectura">
							<Sparkles className="h-3.5 w-3.5" />
						</Button>

						{/* Privacy toggle */}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={handleTogglePrivacy}
							className={`h-8 w-8 rounded-lg transition-all duration-200 ${
								privacyMode
									? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
									: "text-slate-600 hover:text-slate-300 hover:bg-white/[0.06]"
							}`}
							title={privacyMode ? "Desactivar modo privado" : "Modo privado"}>
							{privacyMode ? (
								<EyeOff className="h-3.5 w-3.5" />
							) : (
								<Eye className="h-3.5 w-3.5" />
							)}
						</Button>

						{/* Copy URL */}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={handleCopyUrl}
							className="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-all duration-200"
							title="Copiar URL">
							{copied ? (
								<Check className="h-3.5 w-3.5 text-emerald-400" />
							) : (
								<Copy className="h-3.5 w-3.5" />
							)}
						</Button>

						{/* Bookmark */}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={handleToggleFavorite}
							className={`h-8 w-8 rounded-lg transition-all duration-200 ${
								isCurrentFavorite
									? "text-cyan-400 hover:bg-cyan-500/15"
									: "text-slate-600 hover:text-slate-300 hover:bg-white/[0.06]"
							}`}
							title={
								isCurrentFavorite ? "Quitar de favoritos" : "Añadir a favoritos"
							}>
							<Star
								className={`h-3.5 w-3.5 transition-all duration-300 ${
									isCurrentFavorite ? "fill-cyan-400" : ""
								}`}
							/>
						</Button>

						{/* Separator */}
						<div className="w-px h-5 bg-white/[0.06] mx-0.5" />

						{/* Share */}
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => {
								setShowShareMenu(!showShareMenu);
								setShowSecurityPanel(false);
								setShowDropdown(false);
							}}
							className="h-8 w-8 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-all duration-200"
							title="Compartir">
							<Share2 className="h-3.5 w-3.5" />
						</Button>

						{/* Voice */}
						{onVoiceCommand && (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={onVoiceCommand}
								className={`h-8 w-8 rounded-lg transition-all duration-200 ${
									voiceState === "listening"
										? "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 animate-pulse"
										: voiceState === "processing"
										? "bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
										: "text-slate-600 hover:text-cyan-400 hover:bg-white/[0.06]"
								}`}
								title="Búsqueda por voz">
								{voiceState === "listening" ? (
									<MicOff className="h-3.5 w-3.5" />
								) : voiceState === "processing" ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
								) : (
									<Mic className="h-3.5 w-3.5" />
								)}
							</Button>
						)}
					</div>
				</div>

				{/* ═══ Refresh Button ═══ */}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={isLoading ? onStop : onRefresh}
					className={`h-10 w-10 rounded-xl border border-[var(--orion-border)] bg-[var(--orion-bgTertiary)] transition-all duration-300 flex-shrink-0 ${
						isLoading
							? "text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
							: "text-[var(--orion-textSecondary)] hover:text-[var(--orion-textPrimary)] hover:bg-[var(--orion-hoverBg)] hover:border-[var(--orion-borderHover)]"
					}`}>
					{isLoading ? (
						<X className="h-4 w-4" />
					) : (
						<RotateCw className="h-4 w-4" />
					)}
				</Button>
			</form>

			{/* ═══════════════════════════════════════
         DROPDOWNS
         ═══════════════════════════════════════ */}

			{/* ── Smart Suggestions Dropdown ── */}
			{showDropdown && isFocused && (
				<div
					ref={dropdownRef}
					className="absolute top-full left-0 right-0 mt-2 z-50 animate-in">
					<div className="rounded-2xl bg-[#0d1117] border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
						{/* Quick Actions */}
						{!filterQuery && (
							<div className="p-3 border-b border-white/[0.06]">
								<p className="text-[10px] uppercase tracking-wider text-slate-600 font-bold px-2 mb-2">
									Acciones rápidas
								</p>
								<div className="grid grid-cols-2 gap-1.5">
									{/* Timer action */}
									<button
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => handleSetTimer(15)}
										className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-150 text-left group">
										<div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/15 flex items-center justify-center flex-shrink-0">
											<Timer className="w-3.5 h-3.5 text-amber-400" />
										</div>
										<div className="min-w-0">
											<p className="text-xs text-slate-300 font-medium">
												Temporizador
											</p>
											<p className="text-[10px] text-slate-600">
												Limitar tiempo de uso
											</p>
										</div>
									</button>

									{/* Screenshot */}
									<button
										onMouseDown={(e) => e.preventDefault()}
										onClick={async () => {
											try {
												toast({ title: "Captura", description: "No disponible en modo web" });
											} catch {
												toast({ title: "Error", description: "No se pudo capturar", variant: "destructive" });
											}
										}}
										className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-150 text-left group">
										<div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/15 flex items-center justify-center flex-shrink-0">
											<QrCode className="w-3.5 h-3.5 text-sky-400" />
										</div>
										<div className="min-w-0">
											<p className="text-xs text-slate-300 font-medium">
												Captura
											</p>
											<p className="text-[10px] text-slate-600">
												Screenshot de la página
											</p>
										</div>
									</button>

									{/* Reader */}
									<button
										onMouseDown={(e) => e.preventDefault()}
										onClick={handleToggleReader}
										className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-150 text-left group">
										<div
											className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
												readerMode
													? "bg-orange-500/15 border-orange-500/20"
													: "bg-violet-500/10 border-violet-500/15"
											}`}>
											<Sparkles
												className={`w-3.5 h-3.5 ${
													readerMode ? "text-orange-400" : "text-violet-400"
												}`}
											/>
										</div>
										<div className="min-w-0">
											<p className="text-xs text-slate-300 font-medium">
												{readerMode ? "Salir de lectura" : "Modo lectura"}
											</p>
											<p className="text-[10px] text-slate-600">
												Sin distracciones
											</p>
										</div>
									</button>

									{/* Privacy */}
									<button
										onMouseDown={(e) => e.preventDefault()}
										onClick={handleTogglePrivacy}
										className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-150 text-left group">
										<div
											className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${
												privacyMode
													? "bg-amber-500/15 border-amber-500/20"
													: "bg-emerald-500/10 border-emerald-500/15"
											}`}>
											{privacyMode ? (
												<EyeOff className="w-3.5 h-3.5 text-amber-400" />
											) : (
												<Eye className="w-3.5 h-3.5 text-emerald-400" />
											)}
										</div>
										<div className="min-w-0">
											<p className="text-xs text-slate-300 font-medium">
												{privacyMode ? "Modo normal" : "Modo privado"}
											</p>
											<p className="text-[10px] text-slate-600">
												{privacyMode ? "Restaurar navegación" : "Sin registro"}
											</p>
										</div>
									</button>
								</div>
							</div>
						)}

						{/* Results / Suggestions */}
						<div className="p-2">
							<div className="flex items-center justify-between px-3 py-1.5">
								<p className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">
									{filterQuery ? "Resultados" : "Tendencias"}
								</p>
								{isFetchingSuggestions && (
									<Loader2 className="w-3 h-3 text-slate-600 animate-spin" />
								)}
							</div>

							{filteredSuggestions().map((item, i) => {
								const isSelected = i === selectedIndex;
								return (
									<button
										key={i}
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => handleSuggestionClick(item)}
										onMouseEnter={() => setSelectedIndex(i)}
										className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-150 text-left group ${
											isSelected
												? "bg-white/[0.07] border border-white/[0.06]"
												: "hover:bg-white/[0.04] border border-transparent"
										}`}>
										{/* Icon */}
										<div
											className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
												item.type === "bookmark"
													? "bg-cyan-500/10 border-cyan-500/15"
													: item.type === "trending"
													? "bg-rose-500/10 border-rose-500/15"
													: item.type === "suggestion"
													? "bg-indigo-500/10 border-indigo-500/15"
													: "bg-white/[0.04] border-white/[0.06]"
											}`}>
											{item.type === "bookmark" ? (
												<Bookmark className="w-3.5 h-3.5 text-cyan-400" />
											) : item.type === "trending" ? (
												<TrendingUp className="w-3.5 h-3.5 text-rose-400" />
											) : item.type === "suggestion" ? (
												<Search className="w-3.5 h-3.5 text-indigo-400" />
											) : item.type === "history" ? (
												<Clock className="w-3.5 h-3.5 text-slate-400" />
											) : (
												<Zap className="w-3.5 h-3.5 text-amber-400" />
											)}
										</div>

										{/* Text */}
										<div className="flex-1 min-w-0">
											<p
												className={`text-sm truncate transition-colors ${
													isSelected
														? "text-white"
														: "text-slate-300 group-hover:text-white"
												}`}>
												{filterQuery
													? highlightMatch(item.title, filterQuery)
													: item.title}
											</p>
											{item.description && (
												<p className="text-[11px] text-slate-600 truncate">
													{item.description}
												</p>
											)}
										</div>

										{/* Arrow */}
										<ArrowRight
											className={`w-3.5 h-3.5 transition-all duration-150 flex-shrink-0 ${
												isSelected
													? "text-slate-400 translate-x-0.5"
													: "text-slate-700 group-hover:text-slate-400"
											}`}
										/>
									</button>
								);
							})}
						</div>

						{/* Footer tip */}
						<div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.01]">
							<div className="flex items-center gap-3 justify-center">
								<span className="flex items-center gap-1 text-[10px] text-slate-700">
									<kbd className="px-1 py-0.5 rounded text-[9px] bg-white/[0.04] border border-white/[0.06] text-slate-500 font-mono">
										↵
									</kbd>
									navegar
								</span>
								<span className="flex items-center gap-1 text-[10px] text-slate-700">
									<kbd className="px-1 py-0.5 rounded text-[9px] bg-white/[0.04] border border-white/[0.06] text-slate-500 font-mono">
										↑↓
									</kbd>
									mover
								</span>
								<span className="flex items-center gap-1 text-[10px] text-slate-700">
									<kbd className="px-1 py-0.5 rounded text-[9px] bg-white/[0.04] border border-white/[0.06] text-slate-500 font-mono">
										Esc
									</kbd>
									cerrar
								</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ── Share Menu ── */}
			{showShareMenu && (
				<div className="absolute top-full right-12 mt-2 z-50 animate-in">
					<div className="w-56 rounded-2xl bg-[#0d1117] border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden p-3 space-y-1">
						<p className="text-[10px] uppercase tracking-wider text-slate-600 font-bold px-2 mb-2">
							Compartir
						</p>

						<button
							onClick={() => {
								handleCopyUrl();
								setShowShareMenu(false);
							}}
							className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left">
							<Copy className="w-4 h-4 text-slate-400" />
							<span className="text-sm text-slate-300">Copiar enlace</span>
						</button>

						<button
							onClick={() => {
								toast({
									title: "🔗 QR generado",
									description: "Escanea el código para compartir",
								});
								setShowShareMenu(false);
							}}
							className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left">
							<QrCode className="w-4 h-4 text-slate-400" />
							<span className="text-sm text-slate-300">Código QR</span>
						</button>

						<button
							onClick={() => {
								toast({
									title: "📧 Compartido",
									description: "Enlace listo para enviar",
								});
								setShowShareMenu(false);
							}}
							className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all text-left">
							<Share2 className="w-4 h-4 text-slate-400" />
							<span className="text-sm text-slate-300">Enviar por email</span>
						</button>
					</div>
				</div>
			)}

			{/* ═══ Styles ═══ */}
			<style>{`
        @keyframes loadBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(50%); }
          100% { transform: translateX(250%); }
        }
        .animate-in {
          animation: dropIn 0.2s ease-out forwards;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
		</div>
	);
};
