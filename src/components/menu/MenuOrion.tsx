import { useState, useEffect, useRef } from "react";
import {
	Plus,
	History,
	Download,
	Bookmark,
	Settings,
	Wand2,
	Code2,
	Shield,
	MonitorPlay,
	ListTodo,
	StickyNote,
	Brain,
	BarChart3,
	Layers,
	Share2,
	HelpCircle,
	Zap,
	Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMenuData } from "@/hooks/useMenuData";

import { QuickActionBtn } from "./sections/ShareSectionUtils";
import { ToolsSection } from "./sections/ToolSection";
import { OCRModal } from "./sections/OCRModal";
import { PrivacySection } from "./sections/PrivacySection";
import { WorkspaceSection } from "./sections/WorkspaceSection";
import { FocusSection } from "./sections/FocusSection";
import { NotesSection } from "./sections/NotesSection";
import { TasksSection } from "./sections/TaskSection";
import { MediaSection } from "./sections/MediaSection";
import { DevToolsSection } from "./sections/DevToolsSection";
import { StatsSection } from "./sections/StatsSection";
import { ShareSection } from "./sections/ShareSection";
import { SettingsSection } from "./sections/SettingsSection";

interface BrowserMenuProps {
	isOpen: boolean;
	onClose: () => void;
	onNavigate: (url: string) => void;
	onNewTab?: () => void;
	currentUrl: string;
	currentTitle?: string;
	currentZoom?: number;
	onZoomChange?: (zoom: number) => void;
	onFocusChange?: (
		active: boolean,
		sites: { id: string; domain: string }[],
		timeRemaining: string,
	) => void;
	onViewSource?: (html: string, url: string) => void;
	onSplitView?: () => void;
	onSidePanel?: () => void;
	onTabGroups?: () => void;
	workspaceMode?: "normal" | "split" | "sidebar";
	tabGroups?: {
		id: string;
		name: string;
		color: string;
		tabIds: string[];
		collapsed: boolean;
		savedTabs: { url: string; title: string }[];
	}[];
	tabs?: { id: string; title: string; url: string; groupId?: string }[];
	activeTabId?: string;
	onCreateTabGroup?: (name: string, color: string, tabIds?: string[]) => void;
	onAddTabToGroup?: (tabId: string, groupId: string) => void;
	onRemoveTabFromGroup?: (tabId: string) => void;
	onDeleteGroup?: (groupId: string) => void;
	onSelectTab?: (tabId: string) => void;
	onReopenGroupTab?: (groupId: string, index: number) => void;
	onRemoveSavedTab?: (groupId: string, index: number) => void;
}

interface MenuSection {
	id: string;
	label: string;
	icon: React.ReactNode;
	badge?: string;
	badgeColor?: string;
}

const MENU_SECTIONS: MenuSection[] = [
	{ id: "tools", label: "Herramientas", icon: <Wand2 className="w-4 h-4" /> },
	{ id: "privacy", label: "Privacidad", icon: <Shield className="w-4 h-4" /> },
	{
		id: "workspace",
		label: "Espacio de trabajo",
		icon: <Layers className="w-4 h-4" />,
	},
	{
		id: "focus",
		label: "Focus Mode",
		icon: <Brain className="w-4 h-4" />,
		badge: "Nuevo",
		badgeColor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
	},
	{
		id: "notes",
		label: "Notas rápidas",
		icon: <StickyNote className="w-4 h-4" />,
	},
	{ id: "tasks", label: "Tareas", icon: <ListTodo className="w-4 h-4" /> },
	{
		id: "media",
		label: "Media Center",
		icon: <MonitorPlay className="w-4 h-4" />,
	},
	{
		id: "devtools",
		label: "Desarrollador",
		icon: <Code2 className="w-4 h-4" />,
	},
	{
		id: "stats",
		label: "Mi actividad",
		icon: <BarChart3 className="w-4 h-4" />,
	},
	{ id: "share", label: "Compartir", icon: <Share2 className="w-4 h-4" /> },
	{
		id: "settings",
		label: "Configuración",
		icon: <Settings className="w-4 h-4" />,
	},
];

export const BrowserMenu = ({
	isOpen,
	onClose,
	onNavigate,
	onNewTab,
	currentUrl,
	currentTitle,
	currentZoom = 100,
	onZoomChange,
	onFocusChange,
	onViewSource,
	onSplitView,
	onSidePanel,
	onTabGroups,
	workspaceMode = "normal",
	tabGroups = [],
	tabs: allTabs = [],
	activeTabId = "",
	onCreateTabGroup,
	onAddTabToGroup,
	onRemoveTabFromGroup,
	onDeleteGroup,
	onSelectTab,
	onReopenGroupTab,
	onRemoveSavedTab,
}: BrowserMenuProps) => {
	const [activeSection, setActiveSection] = useState<string>("tools");
	const [focusMode, setFocusMode] = useState(false);
	const [focusTimer, setFocusTimer] = useState<number | null>(null);
	const [focusElapsed, setFocusElapsed] = useState(0);
	const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
	const [searchMenu, setSearchMenu] = useState("");
	const [showOCR, setShowOCR] = useState(false);

	const menuRef = useRef<HTMLDivElement>(null);
	const { toast } = useToast();

	const formatTimer = (ms: number) => {
		const total = Math.ceil(ms / 1000);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	};

	const {
		loading,
		notes,
		tasks,
		blockedSites,
		stats,
		prefs,
		weeklyStats,
		addNote,
		deleteNote,
		addTask,
		toggleTask,
		deleteTask,
		addBlockedSite,
		removeBlockedSite,
		startFocusSession,
		endFocusSession,
		updatePreference,
	} = useMenuData(isOpen);

	// Dynamic badge for privacy
	const privacyBadge = stats?.trackersBlocked?.toString() || "0";
	const dynamicSections = MENU_SECTIONS.map((s) => {
		if (s.id === "privacy") {
			return {
				...s,
				badge: privacyBadge,
				badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
			};
		}
		return s;
	});

	// Focus timer
	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (focusMode && focusTimer) {
			interval = setInterval(() => {
				setFocusElapsed((prev) => {
					if (prev + 1000 >= focusTimer) {
						setFocusMode(false);
						if (focusSessionId) {
							endFocusSession(focusSessionId, focusTimer, true);
						}
						toast({
							title: "Sesión de focus terminada",
							description: "¡Buen trabajo! Toma un descanso.",
						});
						return 0;
					}
					return prev + 1000;
				});
			}, 1000);
		}
		return () => clearInterval(interval);
	}, [focusMode, focusTimer, focusSessionId, endFocusSession, toast]);

	// Close on Escape
	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		if (isOpen) window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [isOpen, onClose]);

	// Outside click
	useEffect(() => {
		const handle = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		if (isOpen) {
			setTimeout(() => document.addEventListener("mousedown", handle), 0);
		}
		return () => document.removeEventListener("mousedown", handle);
	}, [isOpen, onClose]);

	// Sincronizar sitios bloqueados cuando cambian durante focus
	useEffect(() => {
		// No-op: bloqueo de red manejado por el motor Rust
	}, [blockedSites, focusMode]);

	// Notify focus changes to parent
	useEffect(() => {
		if (onFocusChange) {
			const remaining =
				focusMode && focusTimer ? formatTimer(focusTimer - focusElapsed) : "";
			onFocusChange(focusMode, blockedSites, remaining);
		}
	}, [focusMode, focusElapsed, focusTimer, blockedSites, onFocusChange]);

	if (!isOpen && !showOCR) return null;

	const handleStartFocus = async (minutes: number) => {
		try {
			const durationMs = minutes * 60 * 1000;
			const session = await startFocusSession(durationMs);
			setFocusMode(true);
			setFocusTimer(durationMs);
			setFocusElapsed(0);
			setFocusSessionId(session.id);
			toast({
				title: `Focus: ${minutes} minutos`,
				description: "Sitios distractores bloqueados",
			});
		} catch {
			toast({ title: "Error al iniciar focus" });
		}
	};

	const handleStopFocus = async () => {
		if (focusSessionId) {
			await endFocusSession(focusSessionId, focusElapsed, false).catch(
				() => {},
			);
		}
		setFocusMode(false);
		setFocusElapsed(0);
		setFocusSessionId(null);
		toast({ title: "Focus mode desactivado" });
	};

	const handleUpdatePrivacyPref = async (key: string, value: boolean) => {
		try {
			await updatePreference(key, value);
		} catch {
			toast({ title: "Error al actualizar preferencia" });
		}
	};

	const handleThemeChange = async (themeId: string) => {
		try {
			await updatePreference("theme", themeId);
			toast({ title: `Tema: ${themeId}` });
		} catch {
			toast({ title: "Error al cambiar tema" });
		}
	};

	const filteredSections = searchMenu
		? dynamicSections.filter(
				(s) =>
					s.label.toLowerCase().includes(searchMenu.toLowerCase()) ||
					s.id.toLowerCase().includes(searchMenu.toLowerCase()),
		  )
		: dynamicSections;

	return (
		<>
		{isOpen && <div className="fixed inset-0 z-50">
			<div
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onClick={onClose}
			/>

			<div
				ref={menuRef}
				className="absolute top-2 right-2 w-[720px] max-h-[calc(100vh-16px)] bg-[#0a0e17] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden flex animate-menu-in">
				{/* ═══ LEFT SIDEBAR ═══ */}
				<div className="w-56 bg-white/[0.02] border-r border-white/[0.06] flex flex-col">
					<div className="p-4 border-b border-white/[0.06]">
						<div className="flex items-center gap-2.5 mb-3">
							<div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
								<Zap className="w-4 h-4 text-white" />
							</div>
							<div>
								<p className="text-sm font-bold text-white">Flux</p>
								<p className="text-[10px] text-slate-600">v1.0.0</p>
							</div>
						</div>
						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
							<input
								type="text"
								placeholder="Buscar en menú…"
								value={searchMenu}
								onChange={(e) => setSearchMenu(e.target.value)}
								className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/30"
							/>
						</div>
					</div>

					<div className="px-3 py-3 border-b border-white/[0.06]">
						<div className="grid grid-cols-4 gap-1.5">
							<QuickActionBtn
								icon={<Plus className="w-3.5 h-3.5" />}
								label="Pestaña"
								onClick={() => {
									onNewTab?.();
									onClose();
								}}
							/>
							<QuickActionBtn
								icon={<History className="w-3.5 h-3.5" />}
								label="Historial"
								onClick={() => {
									onNavigate("flux://history");
									onClose();
								}}
							/>
							<QuickActionBtn
								icon={<Download className="w-3.5 h-3.5" />}
								label="Descargas"
								onClick={() => {
									onNavigate("flux://downloads");
									onClose();
								}}
							/>
							<QuickActionBtn
								icon={<Bookmark className="w-3.5 h-3.5" />}
								label="Favoritos"
								onClick={() => {
									onNavigate("flux://bookmarks");
									onClose();
								}}
							/>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin scrollbar-thumb-slate-800">
						{filteredSections.map((section) => (
							<button
								key={section.id}
								onClick={() => setActiveSection(section.id)}
								className={`
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 mb-0.5 group
                  ${
										activeSection === section.id
											? "bg-cyan-500/10 border border-cyan-500/15 text-cyan-400"
											: "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent"
									}
                `}>
								<span
									className={`flex-shrink-0 transition-colors ${
										activeSection === section.id
											? "text-cyan-400"
											: "text-slate-500 group-hover:text-slate-300"
									}`}>
									{section.icon}
								</span>
								<span className="text-xs font-medium flex-1 truncate">
									{section.label}
								</span>
								{section.badge && (
									<span
										className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${section.badgeColor}`}>
										{section.badge}
									</span>
								)}
							</button>
						))}
					</div>

					{focusMode && (
						<div className="mx-3 mb-3 p-3 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/15">
							<div className="flex items-center gap-2 mb-1">
								<Brain className="w-3.5 h-3.5 text-violet-400" />
								<span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
									Focus activo
								</span>
							</div>
							<p className="text-lg font-mono font-bold text-white">
								{formatTimer(focusTimer! - focusElapsed)}
							</p>
							<button
								onClick={handleStopFocus}
								className="text-[10px] text-violet-400/60 hover:text-violet-400 mt-1 transition-colors">
								Detener
							</button>
						</div>
					)}

					<div className="p-3 border-t border-white/[0.06]">
						<button
							onClick={() => {
								onNavigate("flux://help");
								onClose();
							}}
							className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-white/[0.04] text-slate-600 hover:text-slate-300 transition-all">
							<HelpCircle className="w-3.5 h-3.5" />
							<span className="text-xs">Ayuda y feedback</span>
						</button>
					</div>
				</div>

				{/* ═══ RIGHT CONTENT ═══ */}
				<div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
					{loading && (
						<div className="flex items-center justify-center py-20">
							<div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
						</div>
					)}

					{!loading && activeSection === "tools" && (
						<ToolsSection
							currentZoom={currentZoom}
							onZoomChange={onZoomChange}
							onClose={onClose}
							onOpenOCR={() => { onClose(); setShowOCR(true); }}
						/>
					)}
					{!loading && activeSection === "privacy" && (
						<PrivacySection
							prefs={prefs}
							stats={stats}
							onUpdatePref={handleUpdatePrivacyPref}
						/>
					)}
					{!loading && activeSection === "workspace" && (
						<WorkspaceSection
							prefs={prefs}
							onThemeChange={handleThemeChange}
							onClose={onClose}
							onSplitView={onSplitView}
							onSidePanel={onSidePanel}
							onTabGroups={onTabGroups}
							workspaceMode={workspaceMode}
							tabGroups={tabGroups}
							tabs={allTabs}
							activeTabId={activeTabId}
							onCreateTabGroup={onCreateTabGroup}
							onAddTabToGroup={onAddTabToGroup}
							onRemoveTabFromGroup={onRemoveTabFromGroup}
							onDeleteGroup={onDeleteGroup}
							onSelectTab={onSelectTab}
							onReopenGroupTab={onReopenGroupTab}
							onRemoveSavedTab={onRemoveSavedTab}
						/>
					)}
					{!loading && activeSection === "focus" && (
						<FocusSection
							focusMode={focusMode}
							focusTimer={focusTimer}
							focusElapsed={focusElapsed}
							blockedSites={blockedSites}
							formatTimer={formatTimer}
							onStartFocus={handleStartFocus}
							onStopFocus={handleStopFocus}
							onAddBlockedSite={addBlockedSite}
							onRemoveBlockedSite={removeBlockedSite}
						/>
					)}
					{!loading && activeSection === "notes" && (
						<NotesSection
							notes={notes}
							currentUrl={currentUrl}
							onAddNote={addNote}
							onDeleteNote={deleteNote}
						/>
					)}
					{!loading && activeSection === "tasks" && (
						<TasksSection
							tasks={tasks}
							onAddTask={addTask}
							onToggleTask={toggleTask}
							onDeleteTask={deleteTask}
						/>
					)}
					{!loading && activeSection === "media" && (
						<MediaSection currentUrl={currentUrl} currentTitle={currentTitle} onClose={onClose} tabs={allTabs} />
					)}
					{!loading && activeSection === "devtools" && (
						<DevToolsSection
							currentUrl={currentUrl}
							onNavigate={onNavigate}
							onClose={onClose}
							onViewSource={onViewSource}
						/>
					)}
					{!loading && activeSection === "stats" && (
						<StatsSection stats={stats} weeklyStats={weeklyStats} />
					)}
					{!loading && activeSection === "share" && (
						<ShareSection currentUrl={currentUrl} onClose={onClose} />
					)}
					{!loading && activeSection === "settings" && (
						<SettingsSection onNavigate={onNavigate} onClose={onClose} />
					)}
				</div>
			</div>

			<style>{`
        @keyframes menu-in {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-menu-in {
          animation: menu-in 0.2s ease-out forwards;
        }
      `}</style>
		</div>}
		<OCRModal open={showOCR} onClose={() => setShowOCR(false)} onSearch={onNavigate} />
		</>
	);
};
