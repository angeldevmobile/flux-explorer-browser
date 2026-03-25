import { useState, useEffect, useCallback } from "react";
import type { Tab } from "@/types/browser";
import { tabService, historyService, statsService, authService } from "@/services/api";
import { DEFAULT_TAB } from "@/constants/browser";

const DISCARD_AFTER_MS = 10 * 60 * 1000;

export function useTabs() {
	const isAuthenticated = authService.isAuthenticated();

	const [tabs, setTabs] = useState<Tab[]>([]);
	const [activeTabId, setActiveTabId] = useState("");
	const [loading, setLoading] = useState(true);
	const [loadingTabIds, setLoadingTabIds] = useState<Set<string>>(new Set());

	const setTabLoading = useCallback((tabId: string, isLoading: boolean) => {
		setLoadingTabIds((prev) => {
			const next = new Set(prev);
			if (isLoading) next.add(tabId);
			else next.delete(tabId);
			return next;
		});
	}, []);

	const isActiveTabLoading = activeTabId ? loadingTabIds.has(activeTabId) : false;

	// ── Actualizar lastActiveAt al cambiar tab activa ──
	useEffect(() => {
		if (!activeTabId) return;
		setTabs((prev) =>
			prev.map((t) =>
				t.id === activeTabId
					? { ...t, lastActiveAt: Date.now(), discarded: false }
					: t,
			),
		);
	}, [activeTabId]);

	// ── Tab Discard: liberar RAM de tabs inactivas > 10 min ──
	useEffect(() => {
		const interval = setInterval(() => {
			setTabs((prev) =>
				prev.map((tab) => {
					if (tab.id === activeTabId) return tab;
					if (tab.discarded) return tab;
					if (!tab.url.startsWith("http")) return tab;
					const idle = Date.now() - (tab.lastActiveAt ?? 0);
					if (idle > DISCARD_AFTER_MS) {
						console.log(`[TabDiscard] Liberando RAM: "${tab.title}"`);
						return { ...tab, discarded: true };
					}
					return tab;
				}),
			);
		}, 60_000);
		return () => clearInterval(interval);
	}, [activeTabId]);

	// ── Stats: contar minutos de navegación ──
	useEffect(() => {
		if (!isAuthenticated) return;
		const activeTab = tabs.find((t) => t.id === activeTabId);
		if (!activeTab?.url.startsWith("http")) return;
		const interval = setInterval(() => {
			statsService.incrementMinutes(1).catch(() => {});
		}, 60_000);
		return () => clearInterval(interval);
	}, [isAuthenticated, activeTabId, tabs]);


	const loadTabs = useCallback(async () => {
		if (!isAuthenticated) {
			setTabs([DEFAULT_TAB]);
			setActiveTabId("default");
			setLoading(false);
			return;
		}
		try {
			setLoading(true);
			const data = await tabService.getTabs();
			if (data.length === 0) {
				await handleNewTab();
			} else {
				setTabs(
					data.map((t) => ({
						id: t.id,
						title: t.title,
						url: t.url,
						favicon: t.favicon || undefined,
					})),
				);
				setActiveTabId(data[0].id);
			}
		} catch {
			setTabs([DEFAULT_TAB]);
			setActiveTabId("default");
		} finally {
			setLoading(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAuthenticated]);

	const handleNewTab = useCallback(async () => {
		const tempId = `temp-${Date.now()}`;
		const newTab: Tab = { id: tempId, title: "Nueva pestaña", url: "flux://newtab" };
		setTabs((prev) => [...prev, newTab]);
		setActiveTabId(tempId);

		if (isAuthenticated) {
			try {
				const created = await tabService.createTab({
					url: "flux://newtab",
					title: "Nueva pestaña",
				});
				setTabs((prev) =>
					prev.map((t) => (t.id === tempId ? { ...t, id: created.id } : t)),
				);
				setActiveTabId(created.id);
			} catch {
				/* keep temp */
			}
		}
	}, [isAuthenticated]);

	const handleCloseTab = useCallback(
		async (id: string, onGroupTabClosed?: (tabId: string) => void) => {
			onGroupTabClosed?.(id);

			if (tabs.length === 1) {
				await handleNewTab();
				return;
			}
			const remaining = tabs.filter((t) => t.id !== id);
			setTabs(remaining);
			if (activeTabId === id) setActiveTabId(remaining[0].id);

			if (isAuthenticated && !id.startsWith("temp-") && !id.startsWith("default")) {
				tabService.deleteTab(id).catch(() => {});
			}
		},
		[tabs, activeTabId, isAuthenticated, handleNewTab],
	);

	const updateTab = useCallback(
		(tabId: string, field: "title" | "favicon" | "url", value: string) => {
			setTabs((prev) =>
				prev.map((t) => (t.id === tabId ? { ...t, [field]: value } : t)),
			);
		},
		[],
	);

	const handleTabUrlChange = useCallback(
		(tabId: string, newUrl: string) => {
			updateTab(tabId, "url", newUrl);
			if (isAuthenticated && !tabId.startsWith("temp-") && !tabId.startsWith("default")) {
				try {
					const parsedUrl = new URL(newUrl);
					const domain = parsedUrl.hostname;
					const isSearchEngine =
						(domain.includes("google.") && parsedUrl.pathname.startsWith("/search")) ||
						domain === "search.yahoo.com" ||
						domain.includes("duckduckgo.com");
					if (!newUrl.startsWith("flux://") && !isSearchEngine) {
						statsService.recordVisit(domain).catch(() => {});
						historyService.addHistory({ url: newUrl, title: domain }).catch(() => {});
					}
				} catch {
					/* URL inválida */
				}
			}
		},
		[isAuthenticated, updateTab],
	);

	return {
		tabs,
		setTabs,
		activeTabId,
		setActiveTabId,
		loading,
		loadingTabIds,
		setTabLoading,
		isActiveTabLoading,
		loadTabs,
		handleNewTab,
		handleCloseTab,
		updateTab,
		handleTabUrlChange,
	};
}
