import { useEffect, useRef, useState } from "react";
import { Plus, Menu, Globe } from "lucide-react";
import { BrowserTab } from "./BrowserTab";
import { AddressBar } from "./AddressBar";
import { NavigationControls } from "./NavigationControls";
import { ThemeSelector } from "./ThemeSelector";
import { FavoritesPanel } from "./FavoritesPanel";
import { NewTabPage } from "./NewTabPage";
import { BrowserMenu } from "@/components/menu/MenuOrion";
import { WebView } from "./WebView";
import { WindowControls } from "./WindowControls";
import { FocusBlockedPage } from "@/pages/FocusBlockedPage";
import { useFocusBlocker } from "@/hooks/useFocusBlocker";
import { ViewSourcePage } from "./ViewSourcePage";
import { OrionAIPage } from "./OrionAIPage";
import { OrionAISidePanel } from "./OrionAISidePanel";
import { SearchPage } from "./SearchPage";
import { ReaderModePage } from "./ReaderModePage";
import { SettingsPage } from "./SettingsPage";
import { DownloadsPanel } from "./DownloadsPanel";
import { ErrorPage } from "./ErrorPage";
import { HistoryPage } from "./HistoryPage";
import { BookmarksPage } from "./BookmarksPage";
import { DownloadsPage } from "./DownloadsPage";
import type { ErrorCode } from "./ErrorPage";
// Hooks extraídos
import { useTabs } from "@/hooks/useTabs";
import { useTabGroups } from "@/hooks/useTabGroups";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { useVoice } from "@/hooks/useVoice";
import { useWorkspace } from "@/hooks/useWorkspace";
import { QUICK_ACCESS } from "@/constants/browser";
import { useSettings } from "@/contexts/SettingsContext";
import { useFavorites } from "@/hooks/useFavorite";

export const BrowserWindow = () => {
	// ── Hooks de estado ──
	const [privacyMode, setPrivacyMode] = useState(false);

	const {
		tabs, setTabs, activeTabId, setActiveTabId,
		loading, loadingTabIds, setTabLoading, isActiveTabLoading,
		loadTabs, handleNewTab, handleCloseTab,
	} = useTabs();

	const {
		tabGroups, loadTabGroups, onGroupTabClosed,
		handleCreateTabGroup, handleAddTabToGroup, handleRemoveTabFromGroup,
		handleRemoveSavedTab, handleDeleteGroup, handleToggleGroupCollapse, handleReopenGroupTab,
	} = useTabGroups({ tabs, setTabs, activeTabId, setActiveTabId });

	const {
		navigation, handleNavigate, handleBack, handleForward,
		handleRefresh, handleStop,
		recentSearches,
	} = useBrowserNavigation({ tabs, activeTabId, setTabs, setTabLoading, privacyMode });

	const activeTab = tabs.find((t) => t.id === activeTabId);

	const { voiceState, transcription, audioLevels, suggestions, handleVoiceCommand } = useVoice({
		activeTabUrl: activeTab?.url,
		onNavigate: handleNavigate,
	});

	const {
		workspaceMode, setWorkspaceMode, secondaryUrl, setSecondaryUrl,
		handleSplitView, handleSidePanel,
	} = useWorkspace();

	const { settings } = useSettings();
	const { favorites } = useFavorites();

	// ── UI state local ──
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [currentZoom, setCurrentZoom] = useState(100);

	const handleZoomChange = (level: number) => {
		setCurrentZoom(level);
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		ipc?.postMessage(JSON.stringify({ cmd: "zoom", level }));
	};
	const [viewSourceHtml, setViewSourceHtml] = useState<string | null>(null);
	const [viewSourceUrl, setViewSourceUrl] = useState("");
	const [navError, setNavError] = useState<{ url: string; code?: ErrorCode } | null>(null);
	const [readerMode, setReaderMode] = useState(false);
	const [aiPanelOpen, setAiPanelOpen] = useState(false);

	// Notifica a Rust para redimensionar el content_view cuando el panel AI abre/cierra
	useEffect(() => {
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		ipc?.postMessage(JSON.stringify({ cmd: "ai_panel", width: aiPanelOpen ? 340 : 0 }));
	}, [aiPanelOpen]);

	const handlePrivacyModeChange = (value: boolean) => {
		setPrivacyMode(value);
	};

	const handleReaderModeChange = (value: boolean) => {
		setReaderMode(value);
	};
	// ── Permisos de sitio ─────────────────────────────────────────────────────
	const [permRequest, setPermRequest] = useState<{ origin: string; kind: string; label: string } | null>(null);

	const [focusActive, setFocusActive] = useState(false);
	const [focusTimeRemaining, setFocusTimeRemaining] = useState("");
	const [focusBlockedSites, setFocusBlockedSites] = useState<{ id: string; domain: string }[]>([]);

	const { isBlocked, blockedDomain } = useFocusBlocker({
		isActive: focusActive,
		blockedSites: focusBlockedSites,
		currentUrl: activeTab?.url || "",
	});

	useEffect(() => {
		loadTabs();
		loadTabGroups();
	}, []);  // eslint-disable-line react-hooks/exhaustive-deps

	// ── Atajos de teclado globales ───────────────────────────────────────────
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const ctrl = e.ctrlKey || e.metaKey;
			if (!ctrl) return;

			switch (e.key.toLowerCase()) {
				case "l":
					e.preventDefault();
					window.dispatchEvent(new CustomEvent("orion:focus-address-bar"));
					break;
				case "r":
					e.preventDefault();
					handleRefresh();
					break;
				case "t":
					e.preventDefault();
					handleNewTab(privacyMode);
					break;
				case "w":
					e.preventDefault();
					if (activeTabId) handleCloseTab(activeTabId, onGroupTabClosed);
					break;
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [handleRefresh, handleNewTab, handleCloseTab, activeTabId, onGroupTabClosed]); // eslint-disable-line react-hooks/exhaustive-deps

	// ── IPC: altura real del chrome → Rust ajusta los bounds del content_view ─
	const chromeHeaderRef = useRef<HTMLDivElement>(null);
	const sendChromeHeight = () => {
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		if (!ipc || !chromeHeaderRef.current) return;
		// requestAnimationFrame garantiza que el layout ya está calculado
		requestAnimationFrame(() => {
			if (!chromeHeaderRef.current) return;
			const h = Math.ceil(chromeHeaderRef.current.getBoundingClientRect().height);
			ipc.postMessage(JSON.stringify({ cmd: "chrome_height", height: h }));
		});
	};
	useEffect(() => {
		sendChromeHeight();
	}, [settings.showBookmarksBar]); // re-enviar cuando cambia la barra de favoritos

	// ── IPC: errores de navegación desde Rust ───────────────────────────────
	useEffect(() => {
		const handler = (e: Event) => {
			const { url, code } = (e as CustomEvent<{ url: string; code?: string }>).detail ?? {};
			if (url) setNavError({ url, code: code as ErrorCode });
		};
		window.addEventListener("orion:navigate:error", handler);
		return () => window.removeEventListener("orion:navigate:error", handler);
	}, []);

	// Limpiar error al navegar a nueva URL
	useEffect(() => {
		setNavError(null);
	}, [activeTab?.url]); // eslint-disable-line react-hooks/exhaustive-deps

	// ── IPC: ciclo de vida de pestañas → Rust crea/destruye WebViews ───────
	// native_id = "n-" + tab.id  (estable y derivable sin campo extra en Tab)
	const nativeIdsRef = useRef<Map<string, string>>(new Map()); // tabId → nativeId

	useEffect(() => {
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		if (!ipc) return;

		const currentIds = new Set(tabs.map((t) => t.id));

		// Pestañas nuevas → Rust crea el WebView
		for (const tab of tabs) {
			if (!nativeIdsRef.current.has(tab.id)) {
				const nativeId = `n-${tab.id}`;
				nativeIdsRef.current.set(tab.id, nativeId);
				ipc.postMessage(JSON.stringify({ cmd: "new_tab", native_id: nativeId, private: tab.private ?? false }));
			}
		}

		// Pestañas cerradas → Rust destruye el WebView
		for (const [tabId, nativeId] of nativeIdsRef.current.entries()) {
			if (!currentIds.has(tabId)) {
				nativeIdsRef.current.delete(tabId);
				ipc.postMessage(JSON.stringify({ cmd: "close_tab", native_id: nativeId }));
			}
		}

		// Pestañas descartadas (inactivas > 10 min) → navegar a about:blank libera
		// la RAM del renderer (DOM, JS, imágenes). Al volver, Rust detecta que
		// loaded_urls tiene "about:blank" ≠ URL real y recarga automáticamente.
		for (const tab of tabs) {
			if (tab.discarded && tab.id !== activeTabId) {
				const nativeId = nativeIdsRef.current.get(tab.id) ?? `n-${tab.id}`;
				ipc.postMessage(JSON.stringify({ cmd: "navigate", url: "about:blank", native_id: nativeId }));
			}
		}
	}, [tabs]); // eslint-disable-line react-hooks/exhaustive-deps

	// ── IPC: sincronizar pestaña activa con el WebView nativo ───────────────
	// Envía "navigate" con native_id; Rust muestra el WebView correcto y carga
	// la URL solo si cambió (evitando recargar al cambiar de pestaña).
	const lastSentUrlRef  = useRef<string>("");
	const lastSentTabRef  = useRef<string>("");
	useEffect(() => {
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		if (!ipc || !activeTab) return;

		const nativeId = nativeIdsRef.current.get(activeTabId) ?? `n-${activeTabId}`;
		const url = activeTab.url;
		const nativeUrl =
			url.startsWith("http://") || url.startsWith("https://") ? url : "about:blank";

		const tabChanged = lastSentTabRef.current !== activeTabId;
		const urlChanged = lastSentUrlRef.current !== nativeUrl;

		// Siempre enviar si cambió la pestaña O si cambió la URL
		if (!tabChanged && !urlChanged) return;

		lastSentTabRef.current  = activeTabId;
		lastSentUrlRef.current  = nativeUrl;

		ipc.postMessage(JSON.stringify({ cmd: "navigate", url: nativeUrl, native_id: nativeId }));
	}, [activeTabId, activeTab?.url]); // eslint-disable-line react-hooks/exhaustive-deps

	// ── IPC: actualizar la barra de direcciones cuando el usuario clica un
	// link dentro de una página cargada via el engine proxy (/render).
	// Rust dispara 'orion:urlchange' con la URL real (sin el prefijo de proxy).
	// Seteamos lastSentUrlRef antes de handleNavigate para evitar que el
	// useEffect de IPC de arriba reenvíe un segundo comando 'navigate' duplicado.
	useEffect(() => {
		const handler = (e: Event) => {
			const url = (e as CustomEvent<{ url: string }>).detail?.url;
			if (!url) return;
			// Si la URL ya fue enviada por nosotros (navigate, back, forward),
			// no agregar al historial — solo actualiza la barra de direcciones.
			if (lastSentUrlRef.current === url) return;
			// Nueva URL por click de link interno o redirect: marcar y agregar al historial.
			lastSentUrlRef.current = url;
			handleNavigate(url);
		};
		window.addEventListener("orion:urlchange", handler);
		return () => window.removeEventListener("orion:urlchange", handler);
	}, [handleNavigate]);

	// ── Permiso solicitado por el contenido ──────────────────────────────────
	useEffect(() => {
		const handler = (e: Event) => {
			const { origin, kind, label } = (e as CustomEvent).detail ?? {};
			if (origin && kind) setPermRequest({ origin, kind, label });
		};
		window.addEventListener("orion:permission:requested", handler);
		return () => window.removeEventListener("orion:permission:requested", handler);
	}, []);

	const handlePermDecision = (allow: boolean) => {
		if (!permRequest) return;
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		ipc?.postMessage(JSON.stringify({
			cmd: "permission_decision",
			origin: permRequest.origin,
			kind: permRequest.kind,
			allow,
		}));
		setPermRequest(null);
	};

	// ── Transparencia: el body del HTML debe ser transparente cuando el
	// content_view nativo muestra una página, para que se vea a través
	// del chrome React (WebView con with_transparent=true en wry).
	useEffect(() => {
		const isExternal =
			activeTab?.url.startsWith("http://") || activeTab?.url.startsWith("https://");
		document.body.style.background = isExternal ? "transparent" : "";
		document.documentElement.style.background = isExternal ? "transparent" : "";
	}, [activeTab?.url]); // eslint-disable-line react-hooks/exhaustive-deps


	if (loading) {
		return (
			<div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
				<div className="relative">
					<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 animate-pulse" />
					<div className="absolute inset-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 blur-lg opacity-40 animate-pulse" />
				</div>
				<div className="flex items-center gap-1.5">
					{[0, 150, 300].map((delay) => (
						<div
							key={delay}
							className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce"
							style={{ animationDelay: `${delay}ms` }}
						/>
					))}
				</div>
				<span className="text-xs text-slate-500">Cargando Flux...</span>
			</div>
		);
	}

	const showWebView =
		activeTab?.url.startsWith("http://") || activeTab?.url.startsWith("https://");

	return (
		<div className={`flex flex-col h-screen overflow-hidden ${showWebView ? "bg-transparent" : "bg-background"}`}>
			{/* ═══ Chrome Header ═══ */}
			<div ref={chromeHeaderRef} className="bg-browser-chrome border-b border-border flex-shrink-0 pb-[3px]">
				{/* Title bar + Tab strip */}
				<div
					className="flex items-end px-2 pt-1 h-12 gap-0.5 bg-[hsl(var(--browser-chrome))] overflow-hidden"
					style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
					onMouseDown={(e) => {
						// Solo drag si se hace clic en el fondo, nunca sobre un boton o tab
						if (e.button === 0 && !(e.target as HTMLElement).closest("button, a, input"))
							(window as unknown as { ipc?: { postMessage: (m: string) => void } })
								.ipc?.postMessage(JSON.stringify({ cmd: "drag_window" }));
					}}>
					<div
						className="flex items-end gap-0.5 flex-1 overflow-x-hidden"
						style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
						{/* Tabs agrupadas */}
						{tabGroups.map((group) => {
							const groupTabs = tabs.filter((t) => t.groupId === group.id);
							if (groupTabs.length === 0) return null;
							return (
								<div key={group.id} className="flex items-end gap-0.5">
									<button
										onClick={() => handleToggleGroupCollapse(group.id)}
										className="flex items-center gap-1 px-2 py-1 mb-0.5 rounded-t-md text-[10px] font-bold transition-all"
										style={{ backgroundColor: `${group.color}20`, color: group.color }}>
										<span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
										{group.name}
										<span className="text-[9px] opacity-60">
											{group.collapsed ? `(${groupTabs.length})` : ""}
										</span>
									</button>
									{!group.collapsed &&
										groupTabs.map((tab) => (
											<BrowserTab
												key={tab.id}
												{...tab}
												isActive={tab.id === activeTabId}
												onSelect={() => setActiveTabId(tab.id)}
												onClose={() => handleCloseTab(tab.id, onGroupTabClosed)}
												isLoading={loadingTabIds.has(tab.id)}
											/>
										))}
								</div>
							);
						})}

						{/* Tabs sin grupo */}
						{tabs
							.filter((t) => !t.groupId)
							.map((tab) => (
								<BrowserTab
									key={tab.id}
									{...tab}
									isActive={tab.id === activeTabId}
									onSelect={() => setActiveTabId(tab.id)}
									onClose={() => handleCloseTab(tab.id, onGroupTabClosed)}
									isLoading={loadingTabIds.has(tab.id)}
								/>
							))}

						<button
							onClick={() => handleNewTab(privacyMode)}
							className="flex-shrink-0 w-8 h-8 mb-0.5 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-hoverBg transition-all duration-200">
							<Plus className="h-4 w-4" />
						</button>

						{workspaceMode !== "normal" && (
							<button
								onClick={() => setWorkspaceMode("normal")}
								className="flex items-center gap-1 px-2 py-1 mb-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all">
								✕ {workspaceMode === "split" ? "Split" : "Panel"}
							</button>
						)}
					</div>

					<div
						className="flex items-end gap-0.5 flex-shrink-0 pb-1.5 pl-2"
						style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
						<WindowControls />
					</div>
				</div>

				{/* ── Barra de permiso de sitio ── */}
			{permRequest && (
				<div className="flex items-center gap-3 px-4 py-2 bg-amber-950/60 border-t border-amber-800/40 text-sm">
					<span className="text-amber-300 flex-1">
						<span className="font-semibold text-amber-200">{permRequest.origin}</span>
						{" "}quiere acceder a <span className="font-semibold text-amber-200">{permRequest.label}</span>
					</span>
					<button
						onClick={() => handlePermDecision(true)}
						className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition-colors">
						Permitir
					</button>
					<button
						onClick={() => handlePermDecision(false)}
						className="px-3 py-1 rounded-md bg-transparent hover:bg-white/10 text-amber-300 text-xs font-semibold border border-amber-700 transition-colors">
						Denegar
					</button>
				</div>
			)}

			{/* Navigation + Address bar */}
				<div className="flex items-center gap-3 px-3 py-2.5 bg-browser-chrome border-t border-border">
					<NavigationControls
						canGoBack={navigation.canGoBack}
						canGoForward={navigation.canGoForward}
						onBack={handleBack}
						onForward={handleForward}
						onHome={() => handleNavigate("flux://welcome")}
						onMenu={() => setIsMenuOpen(!isMenuOpen)}
					/>

					<div className="flex-1 min-w-0">
						<AddressBar
							url={activeTab?.url || ""}
							onNavigate={handleNavigate}
							onRefresh={handleRefresh}
							onStop={handleStop}
							isLoading={isActiveTabLoading}
							privacyMode={privacyMode}
							onPrivacyModeChange={handlePrivacyModeChange}
							readerMode={readerMode}
							onReaderModeChange={handleReaderModeChange}
						/>
					</div>

					<div className="flex items-center gap-1">
						<FavoritesPanel onNavigate={handleNavigate} />
						<DownloadsPanel onNavigate={handleNavigate} />
						<ThemeSelector />
						<button
							onClick={() => setIsMenuOpen(!isMenuOpen)}
							className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
								isMenuOpen
									? "bg-primary/15 text-primary border-primary/20"
									: "text-muted-foreground hover:text-foreground hover:bg-hoverBg border-transparent hover:border-border"
							}`}
							title="Menú de Flux">
							<Menu className="h-4 w-4" />
						</button>
					</div>
				</div>
			{/* Bookmarks bar */}
				{settings.showBookmarksBar && (
					<div className="flex items-center gap-0.5 px-3 py-1 bg-browser-chrome border-t border-border overflow-x-auto scrollbar-none">
						{(() => {
							const BAR_COLORS = [
								"bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/25",
								"bg-violet-500/15 text-violet-300 border border-violet-500/20 hover:bg-violet-500/25",
								"bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25",
								"bg-rose-500/15 text-rose-300 border border-rose-500/20 hover:bg-rose-500/25",
								"bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/25",
								"bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:bg-blue-500/25",
							];
							return favorites.length === 0 ? null : favorites.map((fav, i) => (
								<button
									key={fav.id}
									onClick={() => handleNavigate(fav.url)}
									className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors max-w-[140px] ${BAR_COLORS[i % BAR_COLORS.length]}`}
									title={fav.url}>
									{fav.icon ? (
										<img
											src={fav.icon}
											className="w-3.5 h-3.5 flex-shrink-0"
											alt=""
											onError={(e) => {
												(e.target as HTMLImageElement).style.display = "none";
											}}
										/>
									) : (
										<Globe className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
									)}
									<span className="truncate">{fav.title || fav.url}</span>
								</button>
							));
						})()}
					</div>
				)}
			</div>

			{/* ═══ Content ═══ */}
			{/* bg-transparent cuando hay una página http(s):// activa:
			    el content_view nativo de wry se ve a través del chrome React.
			    Para páginas flux:// React renderiza con su propio fondo. */}
			{/* pointer-events-none cuando hay página nativa: los clicks pasan al content_view */}
			<div className={`flex-1 overflow-hidden relative flex flex-row ${showWebView ? "bg-transparent pointer-events-none" : "bg-background"}`}>
				<div className="absolute inset-0 pointer-events-none overflow-hidden">
					<div className="orion-bg-blob orion-bg-blob-1" />
					<div className="orion-bg-blob orion-bg-blob-2" />
					<div className="orion-bg-blob orion-bg-blob-3" />
				</div>

				<div
					className={`relative z-10 flex-1 h-full flex ${
						workspaceMode !== "normal" ? "flex-row" : ""
					}`}>
					{/* Panel principal */}
					<div
						className={`h-full overflow-hidden relative ${
							workspaceMode === "split" ? "w-1/2" : workspaceMode === "sidebar" ? "flex-1" : "w-full"
						}`}>
						{isBlocked ? (
							<FocusBlockedPage
								domain={blockedDomain || ""}
								timeRemaining={focusTimeRemaining}
								onGoBack={() => handleNavigate("flux://newtab")}
							/>
						) : (
							<>
								{/* Las páginas http(s):// se renderizan en el content_view
								   nativo de wry (WebView2/WebKit) vía IPC — sin iframe, sin proxy.
								   El useEffect de arriba sincroniza el tab activo con content_view. */}

																{/* Página de error cuando Rust reporta fallo de navegación */}
								{navError && showWebView && (
									<div className="absolute inset-0 z-20 pointer-events-auto">
										<ErrorPage
											url={navError.url}
											code={navError.code}
											onRetry={() => { setNavError(null); handleRefresh(); }}
											onBack={() => { setNavError(null); handleBack(); }}
										/>
									</div>
								)}

								{/* Reader Mode — superpone al webview */}
								{readerMode && showWebView && activeTab && (
									<div className="absolute inset-0 z-10">
										<ReaderModePage
											url={activeTab.url}
											onExit={() => setReaderMode(false)}
										/>
									</div>
								)}

								{activeTab?.url === "flux://view-source" && viewSourceHtml && (
									<div className="absolute inset-0">
										<ViewSourcePage html={viewSourceHtml} url={viewSourceUrl} />
									</div>
								)}

								{activeTab?.url.startsWith("flux://search") && (
							<div className="absolute inset-0">
								<SearchPage
									query={
										new URLSearchParams(activeTab.url.split("?")[1] ?? "").get("q") ?? ""
									}
									onNavigate={handleNavigate}
								/>
							</div>
						)}

							{activeTab?.url.startsWith("flux://ai") && (
									<div className="absolute inset-0">
										<OrionAIPage
											query={
												new URLSearchParams(activeTab.url.split("?")[1] ?? "").get("q") ?? ""
											}
											onNavigate={handleNavigate}
										/>
									</div>
								)}

								{(activeTab?.url.startsWith("flux://settings") || activeTab?.url === "flux://about") && (
									<div className="absolute inset-0">
										<SettingsPage url={activeTab.url} onNavigate={handleNavigate} />
									</div>
								)}

								{activeTab?.url === "flux://history" && (
									<div className="absolute inset-0">
										<HistoryPage onNavigate={handleNavigate} />
									</div>
								)}

								{activeTab?.url === "flux://bookmarks" && (
									<div className="absolute inset-0">
										<BookmarksPage onNavigate={handleNavigate} />
									</div>
								)}

								{activeTab?.url === "flux://downloads" && (
									<div className="absolute inset-0">
										<DownloadsPage onNavigate={handleNavigate} />
									</div>
								)}

								{!showWebView &&
									activeTab?.url !== "flux://view-source" &&
									!activeTab?.url.startsWith("flux://ai") &&
								!activeTab?.url.startsWith("flux://search") &&
									!activeTab?.url.startsWith("flux://settings") &&
									activeTab?.url !== "flux://about" &&
								activeTab?.url !== "flux://history" &&
								activeTab?.url !== "flux://bookmarks" &&
								activeTab?.url !== "flux://downloads" && (
										<div className="absolute inset-0">
											<NewTabPage
												voiceState={voiceState}
												transcription={transcription}
												audioLevels={audioLevels}
												suggestions={suggestions}
												quickAccess={QUICK_ACCESS}
												recentSearches={recentSearches}
												tabsCount={tabs.length}
												onVoiceCommand={handleVoiceCommand}
												onNavigate={handleNavigate}
											/>
										</div>
									)}
							</>
						)}
					</div>

					{/* Panel secundario (split / sidebar) */}
					{workspaceMode !== "normal" && (
						<>
							<div
								className={`flex-shrink-0 ${
									workspaceMode === "split"
										? "w-[3px] bg-primary/20 hover:bg-primary/40 cursor-col-resize"
										: "w-[1px] bg-border"
								}`}
							/>
							<div
								className={`h-full overflow-hidden flex flex-col ${
									workspaceMode === "split" ? "w-1/2" : "w-[320px] flex-shrink-0"
								}`}>
								<div className="flex items-center gap-2 px-2 py-1.5 bg-browser-chrome border-b border-border">
									<input
										type="text"
										defaultValue={secondaryUrl}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												const raw = (e.target as HTMLInputElement).value.trim();
												const normalized =
													raw.startsWith("http://") || raw.startsWith("https://")
														? raw
														: raw.includes(".") && !raw.includes(" ")
														? `https://${raw}`
														: `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
												setSecondaryUrl(normalized);
											}
										}}
										className="flex-1 text-xs bg-hoverBg border border-border rounded-md px-2 py-1 text-foreground placeholder-muted-foreground outline-none focus:border-primary/30"
										placeholder="URL del panel..."
									/>
									<button
										onClick={() => setWorkspaceMode("normal")}
										className="text-slate-600 hover:text-slate-300 text-xs px-1">
										✕
									</button>
								</div>
								<div className="flex-1">
									<WebView url={secondaryUrl} className="w-full h-full" />
								</div>
							</div>
						</>
					)}
				</div>

			{/* ═══ Flux AI Toggle Button (flotante lateral) ═══ */}
			{!aiPanelOpen && (
				<button
					onClick={() => setAiPanelOpen(true)}
					className="pointer-events-auto absolute right-0 bottom-1/2 translate-y-1/2 z-50 flex flex-col items-center justify-center gap-2 w-10 py-5 rounded-l-2xl transition-all duration-300 group"
					style={{
						background: "linear-gradient(180deg, #0f172a 0%, #0c1220 100%)",
						border: "1px solid rgba(6,182,212,0.35)",
						borderRight: "none",
						boxShadow: "0 0 18px rgba(6,182,212,0.25), -4px 0 20px rgba(6,182,212,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
					}}
					title="Flux AI"
					onMouseEnter={e => {
						(e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 28px rgba(6,182,212,0.45), -6px 0 28px rgba(6,182,212,0.2), inset 0 1px 0 rgba(255,255,255,0.08)";
						(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(6,182,212,0.6)";
					}}
					onMouseLeave={e => {
						(e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 18px rgba(6,182,212,0.25), -4px 0 20px rgba(6,182,212,0.1), inset 0 1px 0 rgba(255,255,255,0.06)";
						(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(6,182,212,0.35)";
					}}
				>
					<div className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 6px rgba(6,182,212,0.9)" }} />
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-cyan-400 group-hover:text-cyan-300 transition-colors" style={{ filter: "drop-shadow(0 0 4px rgba(6,182,212,0.8))" }}>
						<path d="M12 3L10 9H4L9 13L7 19L12 15.5L17 19L15 13L20 9H14L12 3Z" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
						<path d="M12 8L11 11H8.5L10.5 12.5L9.5 15.5L12 14L14.5 15.5L13.5 12.5L15.5 11H13L12 8Z" fill="currentColor"/>
					</svg>
					<span
						className="text-[9px] font-bold tracking-[0.15em] text-cyan-400/80 group-hover:text-cyan-300 transition-colors"
						style={{ writingMode: "vertical-rl", textShadow: "0 0 8px rgba(6,182,212,0.6)" }}
					>
						AI
					</span>
					<div className="w-1.5 h-1.5 rounded-full bg-cyan-400/50" style={{ boxShadow: "0 0 4px rgba(6,182,212,0.6)" }} />
				</button>
			)}

			{/* ═══ Flux AI Side Panel ═══ */}
			<OrionAISidePanel
				open={aiPanelOpen}
				onClose={() => setAiPanelOpen(false)}
				currentUrl={activeTab?.url || ""}
				currentTitle={activeTab?.title}
			/>
			</div>

			{/* ═══ Browser Menu (overlay) ═══ */}
			<BrowserMenu
				isOpen={isMenuOpen}
				onClose={() => setIsMenuOpen(false)}
				onNavigate={(url) => {
					handleNavigate(url);
					setIsMenuOpen(false);
				}}
				onNewTab={() => { handleNewTab(privacyMode); setIsMenuOpen(false); }}
				currentUrl={activeTab?.url || ""}
				currentTitle={activeTab?.title}
				currentZoom={currentZoom}
				onZoomChange={handleZoomChange}
				onViewSource={(html, url) => {
					setViewSourceHtml(html);
					setViewSourceUrl(url);
				}}
				onFocusChange={(active, sites, timeRemaining) => {
					setFocusActive(active);
					setFocusBlockedSites(sites);
					setFocusTimeRemaining(timeRemaining);
				}}
				onSplitView={() => { handleSplitView(); setIsMenuOpen(false); }}
				onSidePanel={() => { handleSidePanel(); setIsMenuOpen(false); }}
				onTabGroups={() => {}}
				workspaceMode={workspaceMode}
				tabGroups={tabGroups}
				tabs={tabs}
				activeTabId={activeTabId}
				onCreateTabGroup={handleCreateTabGroup}
				onAddTabToGroup={handleAddTabToGroup}
				onRemoveTabFromGroup={handleRemoveTabFromGroup}
				onDeleteGroup={handleDeleteGroup}
				onSelectTab={(tabId: string) => {
					setActiveTabId(tabId);
					setIsMenuOpen(false);
				}}
				onReopenGroupTab={(groupId, index) => {
					handleReopenGroupTab(groupId, index);
					setIsMenuOpen(false);
				}}
				onRemoveSavedTab={handleRemoveSavedTab}
			/>
		</div>
	);
};
