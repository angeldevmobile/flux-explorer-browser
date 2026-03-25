import { useState, useCallback } from "react";
import type { Tab } from "@/types/browser";
import { tabService, historyService, authService } from "@/services/api";
import { useNavigationHistory } from "@/hooks/useNavigationHistory";
import { useSearchEngine } from "@/hooks/useSearchEngine";
import { useToast } from "@/hooks/use-toast";

interface UseBrowserNavigationParams {
	tabs: Tab[];
	activeTabId: string;
	setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
	setTabLoading: (tabId: string, loading: boolean) => void;
}

export function useBrowserNavigation({
	tabs,
	activeTabId,
	setTabs,
	setTabLoading,
}: UseBrowserNavigationParams) {
	const isAuthenticated = authService.isAuthenticated();
	const { config: engineConfig } = useSearchEngine();
	const { toast } = useToast();
	const navigation = useNavigationHistory("flux://welcome");

	const [reloadTrigger, setReloadTrigger] = useState(0);
	const [stopTrigger, setStopTrigger] = useState(0);
	const [recentSearches, setRecentSearches] = useState<string[]>(() => {
		try {
			const stored = localStorage.getItem("orion-recent-searches");
			return stored ? JSON.parse(stored).slice(0, 5) : [];
		} catch {
			return [];
		}
	});

	const saveRecentSearch = useCallback((url: string) => {
		if (url.startsWith("flux://")) return;
		setRecentSearches((prev) => {
			const updated = [url, ...prev.filter((i) => i !== url)].slice(0, 5);
			localStorage.setItem("orion-recent-searches", JSON.stringify(updated));
			return updated;
		});
	}, []);

	const normalizeUrl = useCallback(
		(raw: string): string => {
			const url = raw.trim();
			if (
				url.startsWith("http://") ||
				url.startsWith("https://") ||
				url.startsWith("flux://")
			)
				return url;
			if (url.includes(" ")) return `flux://search?q=${encodeURIComponent(url)}`;
			if (url.includes(".")) return `https://${url}`;
			return `flux://search?q=${encodeURIComponent(url)}`;
		},
		[engineConfig],
	);

	const handleNavigate = useCallback(
		async (url: string) => {
			const activeTab = tabs.find((t) => t.id === activeTabId);
			if (!activeTab) return;

			const normalizedUrl = normalizeUrl(url);
			let pageTitle = normalizedUrl.includes("://")
				? normalizedUrl.split("://")[1].split("/")[0]
				: normalizedUrl;

			if (normalizedUrl.startsWith("flux://ai")) {
				const q = new URLSearchParams(normalizedUrl.split("?")[1] ?? "").get("q") ?? "";
				pageTitle = q ? `✦ ${q.slice(0, 40)}${q.length > 40 ? "…" : ""}` : "✦ Flux AI";
			}

			setTabs((prev) =>
				prev.map((t) =>
					t.id === activeTabId ? { ...t, url: normalizedUrl, title: pageTitle } : t,
				),
			);
			saveRecentSearch(normalizedUrl);
			navigation.push(normalizedUrl, pageTitle);

			if (
				isAuthenticated &&
				!activeTabId.startsWith("temp-") &&
				!activeTabId.startsWith("default")
			) {
				try {
					await Promise.all([
						tabService.updateTab(activeTabId, { url: normalizedUrl, title: pageTitle }),
						historyService.addHistory({ url: normalizedUrl, title: pageTitle }),
					]);
				} catch {
					/* silent */
				}
			}

			toast({ title: "Navegando", description: `Cargando ${pageTitle}` });
		},
		[tabs, activeTabId, isAuthenticated, toast, normalizeUrl, navigation, setTabs, saveRecentSearch],
	);

	// Navega en el historial (atrás/adelante) sin agregar una nueva entrada.
	// A diferencia de handleNavigate, solo actualiza el tab URL y el índice.
	const setTabUrl = useCallback(
		(url: string) => {
			const pageTitle = url.includes("://")
				? url.split("://")[1].split("/")[0]
				: url;
			setTabs((prev) =>
				prev.map((t) =>
					t.id === activeTabId ? { ...t, url, title: pageTitle } : t,
				),
			);
		},
		[activeTabId, setTabs],
	);

	const handleBack = useCallback(() => {
		if (!navigation.canGoBack) return;
		const prevUrl = navigation.history[navigation.currentIndex - 1]?.url;
		navigation.back();
		if (prevUrl) setTabUrl(prevUrl);
	}, [navigation, setTabUrl]);

	const handleForward = useCallback(() => {
		if (!navigation.canGoForward) return;
		const nextUrl = navigation.history[navigation.currentIndex + 1]?.url;
		navigation.forward();
		if (nextUrl) setTabUrl(nextUrl);
	}, [navigation, setTabUrl]);

	const sendIpc = useCallback((cmd: Record<string, unknown>) => {
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		ipc?.postMessage(JSON.stringify(cmd));
	}, []);

	const handleRefresh = useCallback(() => {
		setReloadTrigger((prev) => prev + 1);
		sendIpc({ cmd: "reload" });
	}, [sendIpc]);

	const handleStop = useCallback(() => {
		setStopTrigger((prev) => prev + 1);
		if (activeTabId) setTabLoading(activeTabId, false);
		sendIpc({ cmd: "stop" });
	}, [activeTabId, setTabLoading, sendIpc]);

	return {
		navigation,
		normalizeUrl,
		handleNavigate,
		handleBack,
		handleForward,
		handleRefresh,
		handleStop,
		reloadTrigger,
		stopTrigger,
		recentSearches,
	};
}
