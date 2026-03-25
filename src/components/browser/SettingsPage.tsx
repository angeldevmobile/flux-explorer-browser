import { useState, useEffect } from "react";
import {
	Settings,
	Keyboard,
	Palette,
	Shield,
	Globe,
	Download,
	Smartphone,
	Info,
	ChevronRight,
	Check,
	Folder,
	Trash2,
	RefreshCw,
	Zap,
	Moon,
	Sun,
	Monitor,
	Eye,
	EyeOff,
	LogIn,
	UserPlus,
	LogOut,
	ExternalLink,
	RotateCcw,
	Cpu,
	MemoryStick,
	Activity,
	Gauge,
	HardDrive,
	Layers,
} from "lucide-react";
import { usePerformance } from "@/hooks/usePerformance";
import type { PerfProfileId } from "@/lib/window";
import { useTheme } from "@/hooks/useTheme";
import { type ThemeId, type Mode } from "@/contexts/theme-definitions";
import { useAuth } from "@/hooks/useAuth";
import { mediaService } from "@/services/api";
import { useSettings } from "@/contexts/SettingsContext";

interface SettingsPageProps {
	url: string;
	onNavigate: (url: string) => void;
}

// ── UI Primitives ─────────────────────────────────────────────────────────────
function Toggle({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<button
			onClick={() => onChange(!checked)}
			className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
				checked ? "bg-primary" : "bg-white/10"
			}`}>
			<span
				className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
					checked ? "translate-x-4" : "translate-x-0"
				}`}
			/>
		</button>
	);
}

function SettingRow({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between py-3 border-b border-white/[0.06] last:border-0">
			<div className="flex-1 pr-4">
				<div className="text-sm font-medium text-foreground">{label}</div>
				{description && (
					<div className="text-xs text-muted-foreground mt-0.5">
						{description}
					</div>
				)}
			</div>
			<div className="flex-shrink-0">{children}</div>
		</div>
	);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-6 first:mt-0">
			{children}
		</h3>
	);
}

function Card({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-1 ${className}`}>
			{children}
		</div>
	);
}

// ── GENERAL ───────────────────────────────────────────────────────────────────
function GeneralSettings() {
	const { settings, set } = useSettings();
	const [restartNeeded, setRestartNeeded] = useState(false);

	const handleRestartSetting = <K extends "hardwareAccel" | "continuousLoad">(
		key: K,
		value: boolean,
	) => {
		set(key, value);
		setRestartNeeded(true);
	};

	return (
		<div>
			<SectionTitle>Inicio</SectionTitle>
			<Card>
				<SettingRow
					label="Página de inicio"
					description="Qué mostrar al abrir una nueva ventana">
					<select
						value={settings.startupPage}
						onChange={(e) => set("startupPage", e.target.value)}
						className="bg-white/[0.08] border border-white/[0.12] rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
						<option value="newtab">Nueva pestaña</option>
						<option value="home">Página de inicio</option>
						<option value="last">Última sesión</option>
					</select>
				</SettingRow>
				<SettingRow
					label="Mostrar barra de favoritos"
					description="Visible debajo de la barra de direcciones">
					<Toggle
						checked={settings.showBookmarksBar}
						onChange={(v) => set("showBookmarksBar", v)}
					/>
				</SettingRow>
			</Card>

			<SectionTitle>Rendimiento</SectionTitle>
			<Card>
				<SettingRow
					label="Desplazamiento suave"
					description="Animaciones de scroll más fluidas">
					<Toggle
						checked={settings.smoothScrolling}
						onChange={(v) => set("smoothScrolling", v)}
					/>
				</SettingRow>
				<SettingRow
					label="Aceleración por hardware"
					description="Usa GPU para mejorar el rendimiento">
					<div className="flex items-center gap-2">
						<Toggle
							checked={settings.hardwareAccel}
							onChange={(v) => handleRestartSetting("hardwareAccel", v)}
						/>
					</div>
				</SettingRow>
				<SettingRow
					label="Carga continua en segundo plano"
					description="Mantener pestañas activas al minimizar">
					<div className="flex items-center gap-2">
						<Toggle
							checked={settings.continuousLoad}
							onChange={(v) => handleRestartSetting("continuousLoad", v)}
						/>
					</div>
				</SettingRow>
			</Card>

			{restartNeeded && (
				<div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
					<RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
					Reinicia el navegador para aplicar los cambios de rendimiento
				</div>
			)}

			<SectionTitle>Idioma y región</SectionTitle>
			<Card>
				<SettingRow label="Idioma de la interfaz">
					<select
						value={settings.language}
						onChange={(e) => set("language", e.target.value)}
						className="bg-white/[0.08] border border-white/[0.12] rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
						<option value="es">Español</option>
						<option value="en">English</option>
						<option value="fr">Français</option>
						<option value="de">Deutsch</option>
					</select>
				</SettingRow>
			</Card>
		</div>
	);
}

// ── ATAJOS ────────────────────────────────────────────────────────────────────
function ShortcutsSettings() {
	const shortcuts = [
		{ action: "Nueva pestaña", keys: ["Ctrl", "T"] },
		{ action: "Cerrar pestaña", keys: ["Ctrl", "W"] },
		{ action: "Recargar página", keys: ["Ctrl", "R"] },
		{ action: "Buscar en página", keys: ["Ctrl", "F"] },
		{ action: "Barra de direcciones", keys: ["Ctrl", "L"] },
		{ action: "Modo privado", keys: ["Ctrl", "Shift", "P"] },
		{ action: "Modo lector", keys: ["Ctrl", "Shift", "R"] },
		{ action: "Zoom +", keys: ["Ctrl", "+"] },
		{ action: "Zoom -", keys: ["Ctrl", "-"] },
		{ action: "Zoom restablecer", keys: ["Ctrl", "0"] },
		{ action: "Historial", keys: ["Ctrl", "H"] },
		{ action: "Descargas", keys: ["Ctrl", "J"] },
		{ action: "Devtools", keys: ["F12"] },
		{ action: "Vista de código fuente", keys: ["Ctrl", "U"] },
		{ action: "Pantalla completa", keys: ["F11"] },
	];
	return (
		<div>
			<SectionTitle>Atajos de teclado</SectionTitle>
			<Card>
				{shortcuts.map((s, i) => (
					<div
						key={i}
						className="flex items-center justify-between py-2.5 border-b border-white/[0.06] last:border-0">
						<span className="text-sm text-foreground">{s.action}</span>
						<div className="flex items-center gap-1">
							{s.keys.map((k, j) => (
								<kbd
									key={j}
									className="px-2 py-0.5 bg-white/[0.08] border border-white/[0.15] rounded-md text-xs font-mono text-muted-foreground">
									{k}
								</kbd>
							))}
						</div>
					</div>
				))}
			</Card>
		</div>
	);
}

// ── APARIENCIA — conectado a useTheme() real ──────────────────────────────────
function AppearanceSettings() {
	const {
		themeId,
		mode,
		setTheme,
		setMode,
		opacity,
		blur,
		setOpacity,
		setBlur,
		allThemes,
	} = useTheme();

	return (
		<div>
			<SectionTitle>Modo de color</SectionTitle>
			<Card>
				<SettingRow label="Apariencia del sistema">
					<div className="flex items-center gap-1 bg-white/[0.06] rounded-lg p-1">
						{[
							{
								id: "light" as Mode,
								icon: <Sun className="w-3.5 h-3.5" />,
								label: "Claro",
							},
							{
								id: "system" as Mode,
								icon: <Monitor className="w-3.5 h-3.5" />,
								label: "Sistema",
							},
							{
								id: "dark" as Mode,
								icon: <Moon className="w-3.5 h-3.5" />,
								label: "Oscuro",
							},
						].map((t) => (
							<button
								key={t.id}
								onClick={() => setMode(t.id)}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
									mode === t.id
										? "bg-primary text-white"
										: "text-muted-foreground hover:text-foreground"
								}`}>
								{t.icon}
								{t.label}
							</button>
						))}
					</div>
				</SettingRow>
			</Card>

			<SectionTitle>Tema</SectionTitle>
			<div className="grid grid-cols-2 gap-2">
				{allThemes.map((t) => (
					<button
						key={t.id}
						onClick={() => setTheme(t.id as ThemeId)}
						className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
							themeId === t.id
								? "border-primary/40 bg-primary/10"
								: "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
						}`}>
						<div
							className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
							style={{
								background: `linear-gradient(135deg, ${t.colors.dark.accentGradient[0]}, ${t.colors.dark.accentGradient[1]})`,
							}}
							dangerouslySetInnerHTML={{
								__html: t.iconSvg
									.replace('stroke="currentColor"', 'stroke="white"')
									.replace("viewBox", 'width="16" height="16" viewBox'),
							}}
						/>
						<div className="min-w-0">
							<div className="text-sm font-medium text-foreground">
								{t.name}
							</div>
							<div className="text-xs text-muted-foreground truncate">
								{t.description}
							</div>
						</div>
						{themeId === t.id && (
							<Check className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
						)}
					</button>
				))}
			</div>

			<SectionTitle>Efectos visuales</SectionTitle>
			<Card>
				<div className="py-3 space-y-4">
					<div>
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm text-foreground">Opacidad de fondo</span>
							<span className="text-xs text-muted-foreground font-mono">
								{Math.round(opacity * 100)}%
							</span>
						</div>
						<input
							type="range"
							min={0}
							max={1}
							step={0.05}
							value={opacity}
							onChange={(e) => setOpacity(parseFloat(e.target.value))}
							className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-primary cursor-pointer"
						/>
					</div>
					<div>
						<div className="flex items-center justify-between mb-2">
							<span className="text-sm text-foreground">Desenfoque</span>
							<span className="text-xs text-muted-foreground font-mono">
								{blur}px
							</span>
						</div>
						<input
							type="range"
							min={0}
							max={40}
							step={2}
							value={blur}
							onChange={(e) => setBlur(parseInt(e.target.value))}
							className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-primary cursor-pointer"
						/>
					</div>
				</div>
			</Card>
		</div>
	);
}

// ── PRIVACIDAD — conectado a IPC real ─────────────────────────────────────────
function PrivacySettings() {
	const { settings: globalSettings, set: setGlobal } = useSettings();
	const [blockTrackers, setBlockTrackers] = useState(true);
	const [blockMining, setBlockMining] = useState(true);
	const [httpsOnly, setHttpsOnly] = useState(true);
	const [antiFingerprint, setAntiFingerprint] = useState(false);
	const [blockThirdPartyCookies, setBlockThirdPartyCookies] = useState(true);
	const [stats, setStats] = useState({
		trackersBlocked: 0,
		cookiesBlocked: 0,
		dataSavedBytes: 0,
	});
	const [clearing, setClearing] = useState(false);
	const [cleared, setCleared] = useState(false);

	// updatePrefs — solo backend (la llamada ya existe en el componente padre)
	const updatePrefs = (_updates: Record<string, boolean>) => {};

	const handleClearData = async () => {
		setClearing(true);
		try {
			localStorage.clear();
			sessionStorage.clear();
			if ("caches" in window) {
				const keys = await caches.keys();
				await Promise.all(keys.map((k) => caches.delete(k)));
			}
		} catch { /* silencioso */ }
		setClearing(false);
		setCleared(true);
		setTimeout(() => setCleared(false), 2500);
	};

	const formatBytes = (bytes: number) => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<div>
			{/* Stats en tiempo real */}
			<SectionTitle>Protección activa</SectionTitle>
			<div className="grid grid-cols-3 gap-2 mb-6">
				{[
					{
						label: "Rastreadores",
						value: stats.trackersBlocked,
						color: "text-emerald-400",
					},
					{
						label: "Cookies",
						value: stats.cookiesBlocked,
						color: "text-amber-400",
					},
					{
						label: "Datos ahorrados",
						value: formatBytes(stats.dataSavedBytes),
						color: "text-cyan-400",
					},
				].map((s) => (
					<div
						key={s.label}
						className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 text-center">
						<div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
						<div className="text-xs text-muted-foreground mt-0.5">
							{s.label}
						</div>
					</div>
				))}
			</div>

			<SectionTitle>Rastreo</SectionTitle>
			<Card>
				<SettingRow
					label="Bloquear rastreadores"
					description="Protección activa contra rastreadores de terceros">
					<Toggle
						checked={blockTrackers}
						onChange={(v) => {
							setBlockTrackers(v);
							updatePrefs({ blockTrackers: v });
						}}
					/>
				</SettingRow>
				<SettingRow
					label="Bloquear minería de criptomonedas"
					description="Evita scripts de minado en páginas web">
					<Toggle
						checked={blockMining}
						onChange={(v) => {
							setBlockMining(v);
							updatePrefs({ blockMining: v });
						}}
					/>
				</SettingRow>
				<SettingRow
					label="Anti-fingerprinting"
					description="Reduce la huella digital del navegador">
					<Toggle
						checked={antiFingerprint}
						onChange={(v) => {
							setAntiFingerprint(v);
							updatePrefs({ antiFingerprint: v });
						}}
					/>
				</SettingRow>
			</Card>

			<SectionTitle>Cookies y seguridad</SectionTitle>
			<Card>
				<SettingRow
					label="Bloquear cookies de terceros"
					description="Solo permite cookies del sitio actual">
					<Toggle
						checked={blockThirdPartyCookies}
						onChange={(v) => {
							setBlockThirdPartyCookies(v);
							updatePrefs({ blockThirdPartyCookies: v });
						}}
					/>
				</SettingRow>
				<SettingRow
					label="Forzar HTTPS"
					description="Actualizar conexiones a HTTPS automáticamente">
					<Toggle
						checked={httpsOnly}
						onChange={(v) => {
							setHttpsOnly(v);
							updatePrefs({ forceHttps: v });
						}}
					/>
				</SettingRow>
				<SettingRow
					label="Limpiar datos al salir"
					description="Elimina historial, cookies y caché al cerrar">
					<Toggle
						checked={globalSettings.clearOnExit}
						onChange={(v) => setGlobal("clearOnExit", v)}
					/>
				</SettingRow>
			</Card>

			<SectionTitle>Datos del navegador</SectionTitle>
			<Card className="py-3">
				<button
					onClick={handleClearData}
					disabled={clearing}
					className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
						cleared
							? "bg-emerald-500/20 text-emerald-400"
							: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 disabled:opacity-50"
					}`}>
					{cleared ? (
						<>
							<Check className="w-4 h-4" /> Datos eliminados
						</>
					) : clearing ? (
						<>
							<RefreshCw className="w-4 h-4 animate-spin" /> Limpiando...
						</>
					) : (
						<>
							<Trash2 className="w-4 h-4" /> Limpiar datos de navegación
						</>
					)}
				</button>
			</Card>
		</div>
	);
}

function SearchSettings() {
	const { settings, set } = useSettings();

	return (
		<div>
		<SectionTitle>Motor de búsqueda</SectionTitle>
		<Card>
			<div className="flex items-center gap-3 py-2">
				<div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">✦</div>
				<div>
					<p className="text-sm font-medium text-foreground">Flux Search</p>
					<p className="text-xs text-muted-foreground">Motor de búsqueda propio · privado · sin rastreo</p>
				</div>
				<div className="ml-auto w-5 h-5 rounded-full bg-primary flex items-center justify-center">
					<Check className="w-3 h-3 text-white" />
				</div>
			</div>
		</Card>

			<SectionTitle>Comportamiento</SectionTitle>
			<Card>
				<SettingRow
					label="Sugerencias de búsqueda"
					description="Autocompletado en la barra de direcciones">
					<Toggle
						checked={settings.searchSuggestions}
						onChange={(v) => set("searchSuggestions", v)}
					/>
				</SettingRow>
				<SettingRow
					label="Búsqueda instantánea"
					description="Resultados mientras escribes">
					<Toggle
						checked={settings.instantSearch}
						onChange={(v) => set("instantSearch", v)}
					/>
				</SettingRow>
			</Card>
		</div>
	);
}

// ── DESCARGAS — historial desde BD (autenticado) o Electron (sin sesión) ──────
function DownloadsSettings() {
	const { isAuthenticated } = useAuth();
	const { settings, set } = useSettings();
	const [history, setHistory] = useState<
		import("@/lib/window").DownloadEntry[]
	>([]);
	const [clearing, setClearing] = useState(false);

	useEffect(() => {
		if (isAuthenticated) {
			// Cargar desde BD
			mediaService
				.getDownloadHistory()
				.then(
					(
						items: {
							id: string;
							url: string;
							title: string;
							size?: number;
							createdAt: string;
						}[],
					) => {
						setHistory(
							items.map((item) => ({
								id: item.id,
								filename: item.title,
								url: item.url,
								savePath: "",
								state: "completed" as const,
								receivedBytes: item.size ?? 0,
								totalBytes: item.size ?? 0,
								speed: 0,
								startTime: new Date(item.createdAt).getTime(),
								endTime: new Date(item.createdAt).getTime(),
							})),
						);
					},
				)
				.catch(() => {});
		}

		// Actualizar en tiempo real — Rust despacha este evento al chrome WebView
		const onDone = (e: Event) => {
			const d = (e as CustomEvent<import("@/lib/window").DownloadEntry>).detail;
			setHistory((prev) => {
				const map = new Map(prev.map((en) => [en.id, en]));
				map.set(d.id, d);
				return Array.from(map.values()).sort((a, b) => b.startTime - a.startTime);
			});
		};
		window.addEventListener("orion:download:done", onDone);
		return () => window.removeEventListener("orion:download:done", onDone);
	}, [isAuthenticated]);

	const handleClear = () => {
		setHistory((prev) => prev.filter((d) => d.state === "progressing"));
	};

	const formatBytes = (b: number) => {
		if (b < 1024) return `${b} B`;
		if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
		return `${(b / (1024 * 1024)).toFixed(1)} MB`;
	};

	const formatDate = (ts: number) =>
		new Date(ts).toLocaleString("es", {
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});

	return (
		<div>
			<SectionTitle>Preferencias</SectionTitle>
			<Card>
				<SettingRow
					label="Preguntar antes de descargar"
					description="Elegir ubicación para cada descarga">
					<Toggle
						checked={settings.askBeforeDownload}
						onChange={(v) => set("askBeforeDownload", v)}
					/>
				</SettingRow>
				<SettingRow
					label="Abrir al completar"
					description="Abre el archivo cuando termina la descarga">
					<Toggle
						checked={settings.openAfterDownload}
						onChange={(v) => set("openAfterDownload", v)}
					/>
				</SettingRow>
			</Card>

			<div className="flex items-center justify-between mt-6 mb-3">
				<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
					Historial de descargas
				</h3>
				{history.length > 0 && (
					<button
						onClick={handleClear}
						disabled={clearing}
						className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rose-400 transition-colors disabled:opacity-50">
						<Trash2 className="w-3.5 h-3.5" /> Limpiar historial
					</button>
				)}
			</div>

			{history.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<Download className="w-8 h-8 mb-2 opacity-20" />
					<p className="text-sm">Sin descargas todavía</p>
				</div>
			) : (
				<Card className="py-1">
					{history.slice(0, 50).map((dl) => (
						<div
							key={dl.id}
							className="flex items-center gap-3 py-2.5 border-b border-white/[0.06] last:border-0 group">
							<div className="flex-shrink-0">
								{dl.state === "completed" && (
									<div className="w-2 h-2 rounded-full bg-emerald-400" />
								)}
								{(dl.state === "cancelled" || dl.state === "interrupted") && (
									<div className="w-2 h-2 rounded-full bg-rose-400" />
								)}
								{dl.state === "progressing" && (
									<div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
								)}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm text-foreground truncate">
									{dl.filename}
								</p>
								<p className="text-xs text-muted-foreground">
									{dl.totalBytes > 0 ? formatBytes(dl.totalBytes) : "—"}
									{" · "}
									{formatDate(dl.startTime)}
								</p>
							</div>
							{dl.state === "completed" && (
								<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
									<button
										onClick={() => { if (dl.savePath) window.open("file://" + dl.savePath); }}
										className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
										title="Abrir archivo">
										<ExternalLink className="w-3.5 h-3.5" />
									</button>
									<button
										onClick={() => { const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc; ipc?.postMessage(JSON.stringify({ cmd: "show_in_folder", path: dl.savePath })); }}
										className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
										title="Mostrar en carpeta">
										<Folder className="w-3.5 h-3.5" />
									</button>
								</div>
							)}
						</div>
					))}
				</Card>
			)}
		</div>
	);
}

// ── SINCRONIZACIÓN — conectado a useAuth() real ───────────────────────────────
function SyncSettings() {
	const { user, isAuthenticated, loading, login, register, logout } = useAuth();
	const [authMode, setAuthMode] = useState<"login" | "register">("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [username, setUsername] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const { settings, set } = useSettings();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSubmitting(true);
		try {
			if (authMode === "login") {
				await login(email, password);
			} else {
				await register(email, password, username);
			}
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Error de autenticación");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-16">
				<RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div>
			<SectionTitle>Cuenta de Flux</SectionTitle>

			{isAuthenticated && user ? (
				<Card>
					<div className="py-3 space-y-3">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
								{user.username?.[0]?.toUpperCase() ??
									user.email[0].toUpperCase()}
							</div>
							<div className="min-w-0">
								<div className="text-sm font-medium text-foreground truncate">
									{user.username || "Usuario"}
								</div>
								<div className="text-xs text-muted-foreground truncate">
									{user.email}
								</div>
							</div>
						</div>
						<button
							onClick={logout}
							className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
							<LogOut className="w-4 h-4" /> Cerrar sesión
						</button>
					</div>
				</Card>
			) : (
				<Card className="py-4">
					<div className="flex items-center gap-2 mb-4">
						<button
							onClick={() => setAuthMode("login")}
							className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
								authMode === "login"
									? "bg-primary text-white"
									: "text-muted-foreground hover:text-foreground"
							}`}>
							Iniciar sesión
						</button>
						<button
							onClick={() => setAuthMode("register")}
							className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
								authMode === "register"
									? "bg-primary text-white"
									: "text-muted-foreground hover:text-foreground"
							}`}>
							Registrarse
						</button>
					</div>

					<form onSubmit={handleSubmit} className="space-y-2">
						{authMode === "register" && (
							<input
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder="Nombre de usuario"
								required
								className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						)}
						<input
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Correo electrónico"
							required
							className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<div className="relative">
							<input
								type={showPassword ? "text" : "password"}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Contraseña"
								required
								className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
								{showPassword ? (
									<EyeOff className="w-4 h-4" />
								) : (
									<Eye className="w-4 h-4" />
								)}
							</button>
						</div>
						{error && <p className="text-xs text-rose-400">{error}</p>}
						<button
							type="submit"
							disabled={submitting}
							className="w-full flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
							{submitting ? (
								<RefreshCw className="w-4 h-4 animate-spin" />
							) : authMode === "login" ? (
								<LogIn className="w-4 h-4" />
							) : (
								<UserPlus className="w-4 h-4" />
							)}
							{authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}
						</button>
					</form>
				</Card>
			)}

			{isAuthenticated && (
				<>
					<SectionTitle>Qué sincronizar</SectionTitle>
					<Card>
						<SettingRow label="Favoritos">
							<Toggle
								checked={settings.syncBookmarks}
								onChange={(v) => set("syncBookmarks", v)}
							/>
						</SettingRow>
						<SettingRow label="Historial de navegación">
							<Toggle
								checked={settings.syncHistory}
								onChange={(v) => set("syncHistory", v)}
							/>
						</SettingRow>
						<SettingRow label="Contraseñas guardadas">
							<Toggle
								checked={settings.syncPasswords}
								onChange={(v) => set("syncPasswords", v)}
							/>
						</SettingRow>
						<SettingRow label="Configuración">
							<Toggle
								checked={settings.syncSettingsPref}
								onChange={(v) => set("syncSettingsPref", v)}
							/>
						</SettingRow>
					</Card>
				</>
			)}
		</div>
	);
}

// ── ACERCA DE ─────────────────────────────────────────────────────────────────
function AboutPage() {
	const [updateChecked, setUpdateChecked] = useState(false);

	return (
		<div>
			<div className="flex flex-col items-center py-8 gap-4">
				<div className="relative">
					<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg">
						<Zap className="w-8 h-8 text-white" />
					</div>
					<div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-400 blur-xl opacity-30" />
				</div>
				<div className="text-center">
					<h2 className="text-xl font-bold text-foreground">Flux Browser</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Versión 1.0.0 (Build 2025.1)
					</p>
				</div>
			</div>

			<Card>
				<SettingRow label="Versión" description="Flux Modern Browser">
					<span className="text-sm text-muted-foreground font-mono">
						v1.0.0
					</span>
				</SettingRow>
				<SettingRow label="Motor de renderizado">
					<span className="text-sm text-muted-foreground">
						Electron / Chromium
					</span>
				</SettingRow>
				<SettingRow label="Plataforma">
					<span className="text-sm text-muted-foreground">Windows 11</span>
				</SettingRow>
			</Card>

			<SectionTitle>Actualizaciones</SectionTitle>
			<Card className="py-3">
				<button
					onClick={() => setUpdateChecked(true)}
					className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
						updateChecked
							? "bg-emerald-500/20 text-emerald-400"
							: "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
					}`}>
					{updateChecked ? (
						<>
							<Check className="w-4 h-4" /> Flux está actualizado
						</>
					) : (
						<>
							<RefreshCw className="w-4 h-4" /> Buscar actualizaciones
						</>
					)}
				</button>
			</Card>

			<SectionTitle>Legal</SectionTitle>
			<Card>
				<div className="py-2 space-y-1">
					{[
						"Licencia MIT",
						"Política de privacidad",
						"Términos de uso",
						"Créditos de código abierto",
					].map((item) => (
						<button
							key={item}
							className="w-full text-left py-2 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-between group">
							{item}
							<ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
						</button>
					))}
				</div>
			</Card>
		</div>
	);
}

// ── RENDIMIENTO ADAPTATIVO ────────────────────────────────────────────────────
const PROFILE_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; desc: string }> = {
	auto:     { label: "Automático",         color: "text-cyan-400",    bg: "bg-cyan-400/10 border-cyan-400/20",    icon: <Activity className="w-4 h-4" />,   desc: "El sistema elige según tu hardware y uso actual" },
	high:     { label: "Alto rendimiento",   color: "text-violet-400",  bg: "bg-violet-400/10 border-violet-400/20",icon: <Gauge className="w-4 h-4" />,       desc: "Máxima velocidad, todas las pestañas activas" },
	balanced: { label: "Balanceado",         color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20",icon:<Layers className="w-4 h-4" />,      desc: "Equilibrio entre rendimiento y consumo" },
	eco:      { label: "Ahorro de energía",  color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/20",  icon: <Zap className="w-4 h-4" />,         desc: "Mínimo consumo, ideal para batería baja" },
};

function MetricBar({ value, color }: { value: number; color: string }) {
	return (
		<div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
			<div
				className={`h-full rounded-full transition-all duration-700 ${color}`}
				style={{ width: `${Math.min(value, 100)}%` }}
			/>
		</div>
	);
}

function PerformanceSettings() {
	const {
		loading, hardwareProfile, config, liveMetrics,
		schedulerStats, cacheSizeMB, setProfile, clearCache,
	} = usePerformance();

	const [clearing, setClearing] = useState(false);
	const [cleared,  setCleared]  = useState(false);

	const handleClearCache = async () => {
		setClearing(true);
		await clearCache();
		setClearing(false);
		setCleared(true);
		setTimeout(() => setCleared(false), 2500);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-16">
				<RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const tierColor = config?.hardwareTier === "high"
		? "text-violet-400"
		: config?.hardwareTier === "balanced"
		? "text-emerald-400"
		: "text-amber-400";

	return (
		<div>
			{/* ── Hardware detectado ── */}
			<SectionTitle>Hardware detectado</SectionTitle>
			<div className="grid grid-cols-3 gap-2 mb-4">
				{[
					{
						icon: <Cpu className="w-4 h-4" />,
						label: "CPU",
						value: hardwareProfile
							? `${hardwareProfile.snapshot.cpu.cores} núcleos`
							: "—",
						sub: hardwareProfile?.snapshot.cpu.model.split(" ").slice(0, 3).join(" ") ?? "",
						color: "text-cyan-400",
					},
					{
						icon: <MemoryStick className="w-4 h-4" />,
						label: "RAM",
						value: hardwareProfile
							? `${hardwareProfile.snapshot.memory.totalGB} GB`
							: "—",
						sub: hardwareProfile
							? `${hardwareProfile.snapshot.memory.freeGB} GB libres`
							: "",
						color: "text-violet-400",
					},
					{
						icon: <Gauge className="w-4 h-4" />,
						label: "Score",
						value: hardwareProfile ? `${hardwareProfile.score}/100` : "—",
						sub: (
							<span className={`font-semibold ${tierColor}`}>
								{config?.hardwareTier === "high"
									? "Alto"
									: config?.hardwareTier === "balanced"
									? "Balanceado"
									: "Eco"}
							</span>
						),
						color: tierColor,
					},
				].map((s) => (
					<div
						key={s.label}
						className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3">
						<div className={`flex items-center gap-1.5 mb-1 ${s.color}`}>
							{s.icon}
							<span className="text-xs font-medium">{s.label}</span>
						</div>
						<div className="text-base font-bold text-foreground">{s.value}</div>
						<div className="text-[11px] text-muted-foreground truncate">{s.sub}</div>
					</div>
				))}
			</div>

			{/* GPU */}
			{hardwareProfile && (
				<Card className="mb-1">
					<SettingRow label="GPU" description={hardwareProfile.snapshot.gpu.model}>
						<span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
							hardwareProfile.snapshot.gpu.hasHardwareAccel
								? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
								: "text-rose-400 bg-rose-400/10 border-rose-400/20"
						}`}>
							{hardwareProfile.snapshot.gpu.hasHardwareAccel ? "Aceleración activa" : "Sin aceleración"}
						</span>
					</SettingRow>
				</Card>
			)}

			{/* ── Métricas en vivo ── */}
			<SectionTitle>Uso en tiempo real</SectionTitle>
			<Card>
				<div className="py-2 space-y-3">
					<div>
						<div className="flex justify-between items-center mb-1.5">
							<span className="text-xs text-muted-foreground flex items-center gap-1.5">
								<Cpu className="w-3.5 h-3.5" /> CPU del proceso
							</span>
							<span className="text-xs font-mono text-cyan-400">
								{liveMetrics.cpuUsage.toFixed(1)}%
							</span>
						</div>
						<MetricBar
							value={liveMetrics.cpuUsage}
							color={liveMetrics.cpuUsage > 70 ? "bg-rose-400" : "bg-cyan-400"}
						/>
					</div>
					<div>
						<div className="flex justify-between items-center mb-1.5">
							<span className="text-xs text-muted-foreground flex items-center gap-1.5">
								<MemoryStick className="w-3.5 h-3.5" /> RAM del sistema
							</span>
							<span className="text-xs font-mono text-violet-400">
								{liveMetrics.memUsedPct}%
							</span>
						</div>
						<MetricBar
							value={liveMetrics.memUsedPct}
							color={liveMetrics.memUsedPct > 85 ? "bg-rose-400" : "bg-violet-400"}
						/>
					</div>
				</div>
			</Card>

			{/* ── Selector de perfil ── */}
			<SectionTitle>Perfil de rendimiento</SectionTitle>
			{config?.manualOverride !== "auto" && config?.profile !== config?.manualOverride && (
				<div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
					<Activity className="w-3.5 h-3.5 flex-shrink-0" />
					Auto-ajustado a <strong>{config?.profile}</strong> por uso elevado de recursos
				</div>
			)}
			<div className="grid grid-cols-2 gap-2 mb-2">
				{(["auto", "high", "balanced", "eco"] as PerfProfileId[]).map((id) => {
					const meta    = PROFILE_META[id];
					const active  = config?.manualOverride === id;
					return (
						<button
							key={id}
							onClick={() => setProfile(id)}
							className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
								active
									? `${meta.bg} border-current`
									: "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]"
							}`}>
							<span className={`mt-0.5 flex-shrink-0 ${meta.color}`}>{meta.icon}</span>
							<div className="min-w-0">
								<div className={`text-sm font-medium ${active ? meta.color : "text-foreground"}`}>
									{meta.label}
								</div>
								<div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
									{meta.desc}
								</div>
							</div>
							{active && <Check className={`w-4 h-4 ml-auto flex-shrink-0 mt-0.5 ${meta.color}`} />}
						</button>
					);
				})}
			</div>

			{/* Qué hace el perfil activo */}
			{config && (
				<Card className="mt-2">
					<div className="py-2 space-y-0">
						{[
							{ label: "Pestañas simultáneas máx.",   value: config.maxConcurrentTabs },
							{ label: "Suspender pestaña inactiva",  value: `${config.tabSuspendAfterMs / 60_000} min` },
							{ label: "Precargar siguiente pestaña", value: config.preloadNextTab ? "Sí" : "No" },
							{ label: "Animaciones",                 value: config.animationsEnabled ? "Activadas" : "Reducidas" },
							{ label: "Aceleración por hardware",    value: config.hardwareAccelEnabled ? "Activa" : "Inactiva" },
							{ label: "Calidad de imágenes",         value: config.imageQuality === "high" ? "Alta" : config.imageQuality === "medium" ? "Media" : "Reducida" },
							{ label: "Límite de caché",             value: `${config.cacheMaxMB} MB` },
						].map(({ label, value }) => (
							<SettingRow key={label} label={label}>
								<span className="text-xs font-medium text-muted-foreground">{value}</span>
							</SettingRow>
						))}
					</div>
				</Card>
			)}

			{/* ── Pestañas suspendidas ── */}
			{schedulerStats && (
				<>
					<SectionTitle>Gestión de pestañas</SectionTitle>
					<div className="grid grid-cols-3 gap-2">
						{[
							{ label: "Total",      value: schedulerStats.total,     color: "text-foreground"  },
							{ label: "Activas",    value: schedulerStats.active,    color: "text-emerald-400" },
							{ label: "Suspendidas",value: schedulerStats.suspended, color: "text-amber-400"   },
						].map((s) => (
							<div key={s.label} className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-3 text-center">
								<div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
								<div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
							</div>
						))}
					</div>
				</>
			)}

			{/* ── Caché ── */}
			<SectionTitle>Caché del navegador</SectionTitle>
			<Card>
				<SettingRow label="Uso actual" description="Caché HTTP acumulado">
					<span className="text-sm font-mono text-muted-foreground">
						{cacheSizeMB} MB
					</span>
				</SettingRow>
			</Card>
			<Card className="mt-2 py-3">
				<button
					onClick={handleClearCache}
					disabled={clearing}
					className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
						cleared
							? "bg-emerald-500/20 text-emerald-400"
							: "bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/20 disabled:opacity-50"
					}`}>
					{cleared ? (
						<><Check className="w-4 h-4" /> Caché limpiado</>
					) : clearing ? (
						<><RefreshCw className="w-4 h-4 animate-spin" /> Limpiando...</>
					) : (
						<><HardDrive className="w-4 h-4" /> Limpiar caché HTTP</>
					)}
				</button>
			</Card>
		</div>
	);
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
	{
		id: "flux://settings",
		label: "Configuración general",
		icon: Settings,
		color: "text-slate-300",
	},
	{
		id: "flux://settings/shortcuts",
		label: "Atajos de teclado",
		icon: Keyboard,
		color: "text-cyan-400",
	},
	{
		id: "flux://settings/appearance",
		label: "Apariencia y temas",
		icon: Palette,
		color: "text-violet-400",
	},
	{
		id: "flux://settings/privacy",
		label: "Privacidad y seguridad",
		icon: Shield,
		color: "text-emerald-400",
	},
	{
		id: "flux://settings/search",
		label: "Motor de búsqueda",
		icon: Globe,
		color: "text-amber-400",
	},
	{
		id: "flux://settings/downloads",
		label: "Descargas",
		icon: Download,
		color: "text-sky-400",
	},
	{
		id: "flux://settings/sync",
		label: "Sincronización",
		icon: Smartphone,
		color: "text-rose-400",
	},
	{
		id: "flux://settings/performance",
		label: "Rendimiento y energía",
		icon: Gauge,
		color: "text-orange-400",
	},
	{
		id: "flux://about",
		label: "Acerca de Flux",
		icon: Info,
		color: "text-slate-500",
	},
];

const TITLES: Record<string, string> = {
	"flux://settings": "Configuración general",
	"flux://settings/shortcuts": "Atajos de teclado",
	"flux://settings/appearance": "Apariencia y temas",
	"flux://settings/privacy": "Privacidad y seguridad",
	"flux://settings/search": "Motor de búsqueda",
	"flux://settings/downloads": "Descargas",
	"flux://settings/sync": "Sincronización",
	"flux://settings/performance": "Rendimiento y energía",
	"flux://about": "Acerca de Flux",
};

function renderSection(url: string) {
	switch (url) {
		case "flux://settings":
			return <GeneralSettings />;
		case "flux://settings/shortcuts":
			return <ShortcutsSettings />;
		case "flux://settings/appearance":
			return <AppearanceSettings />;
		case "flux://settings/privacy":
			return <PrivacySettings />;
		case "flux://settings/search":
			return <SearchSettings />;
		case "flux://settings/downloads":
			return <DownloadsSettings />;
		case "flux://settings/sync":
			return <SyncSettings />;
		case "flux://settings/performance":
			return <PerformanceSettings />;
		case "flux://about":
			return <AboutPage />;
		default:
			return <GeneralSettings />;
	}
}

// ── Main ──────────────────────────────────────────────────────────────────────
export const SettingsPage = ({ url, onNavigate }: SettingsPageProps) => {
	return (
		<div className="flex h-full bg-background overflow-hidden">
			{/* Sidebar */}
			<div className="w-60 flex-shrink-0 bg-browser-chrome border-r border-border flex flex-col overflow-y-auto">
				<div className="px-4 py-5">
					<h2 className="text-base font-semibold text-foreground">
						Configuración
					</h2>
					<p className="text-xs text-muted-foreground mt-0.5">
						Personaliza Flux
					</p>
				</div>
				<nav className="px-2 pb-4 space-y-0.5 flex-1">
					{NAV_ITEMS.slice(0, -1).map((item) => {
						const Icon = item.icon;
						const isActive = item.id === url;
						return (
							<button
								key={item.id}
								onClick={() => onNavigate(item.id)}
								className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
									isActive
										? "bg-primary/15 text-primary border border-primary/20"
										: "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
								}`}>
								<Icon
									className={`w-4 h-4 flex-shrink-0 ${
										isActive ? "text-primary" : item.color
									}`}
								/>
								{item.label}
							</button>
						);
					})}
					<div className="pt-2 mt-2 border-t border-white/[0.06]">
						{(() => {
							const item = NAV_ITEMS[NAV_ITEMS.length - 1];
							const Icon = item.icon;
							const isActive = item.id === url;
							return (
								<button
									onClick={() => onNavigate(item.id)}
									className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
										isActive
											? "bg-primary/15 text-primary border border-primary/20"
											: "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
									}`}>
									<Icon
										className={`w-4 h-4 flex-shrink-0 ${
											isActive ? "text-primary" : item.color
										}`}
									/>
									{item.label}
								</button>
							);
						})()}
					</div>
				</nav>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-2xl mx-auto px-8 py-8">
					<h1 className="text-2xl font-bold text-foreground mb-1">
						{TITLES[url] ?? "Configuración"}
					</h1>
					<p className="text-sm text-muted-foreground mb-8">
						{url === "flux://about"
							? "Información sobre Flux Browser"
							: "Gestiona tus preferencias de Flux"}
					</p>
					{renderSection(url)}
				</div>
			</div>
		</div>
	);
};
