import { useState, useCallback } from "react";
import type { Tab, TabGroup } from "@/types/browser";
import { tabService, authService } from "@/services/api";
import { tabGroupService } from "@/services/api";

interface UseTabGroupsParams {
	tabs: Tab[];
	setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
	activeTabId: string;
	setActiveTabId: (id: string) => void;
}

export function useTabGroups({ tabs, setTabs, activeTabId, setActiveTabId }: UseTabGroupsParams) {
	const isAuthenticated = authService.isAuthenticated();
	const [tabGroups, setTabGroups] = useState<TabGroup[]>([]);

	const loadTabGroups = useCallback(async () => {
		if (!isAuthenticated) return;
		try {
			const groups = await tabGroupService.getAll();
			setTabGroups(
				groups.map((g: TabGroup) => ({ ...g, collapsed: g.collapsed ?? false })),
			);
			const groupedTabIds = new Map<string, string>();
			for (const g of groups) {
				for (const tid of g.tabIds) groupedTabIds.set(tid, g.id);
			}
			setTabs((prev) =>
				prev.map((t) => ({ ...t, groupId: groupedTabIds.get(t.id) || undefined })),
			);
		} catch {
			/* silent */
		}
	}, [isAuthenticated, setTabs]);

	// Cuando se cierra una tab que pertenece a un grupo, guardar su info
	const onGroupTabClosed = useCallback(
		(tabId: string) => {
			const closingTab = tabs.find((t) => t.id === tabId);
			if (!closingTab?.groupId) return;
			setTabGroups((prev) =>
				prev.map((g) =>
					g.id === closingTab.groupId
						? {
								...g,
								tabIds: g.tabIds.filter((tid) => tid !== tabId),
								savedTabs: [
									...(g.savedTabs || []),
									{ url: closingTab.url, title: closingTab.title },
								],
						  }
						: g,
				),
			);
		},
		[tabs],
	);

	const handleCreateTabGroup = useCallback(
		async (name: string, color: string, selectedTabIds: string[] = []) => {
			const tabIds = selectedTabIds.length > 0 ? selectedTabIds : activeTabId ? [activeTabId] : [];
			const group: TabGroup = {
				id: `temp-group-${Date.now()}`,
				name,
				color,
				tabIds,
				collapsed: false,
				savedTabs: [],
			};
			setTabGroups((prev) => [...prev, group]);
			setTabs((prev) =>
				prev.map((t) => (tabIds.includes(t.id) ? { ...t, groupId: group.id } : t)),
			);
			if (isAuthenticated) {
				try {
					const created = await tabGroupService.create({ name, color, tabIds });
					setTabGroups((prev) =>
						prev.map((g) => (g.id === group.id ? { ...created, collapsed: false } : g)),
					);
					setTabs((prev) =>
						prev.map((t) => (t.groupId === group.id ? { ...t, groupId: created.id } : t)),
					);
				} catch {
					/* keep optimistic */
				}
			}
		},
		[activeTabId, isAuthenticated, setTabs],
	);

	const handleAddTabToGroup = useCallback(
		async (tabId: string, groupId: string) => {
			setTabGroups((prev) =>
				prev.map((g) =>
					g.id === groupId && !g.tabIds.includes(tabId)
						? { ...g, tabIds: [...g.tabIds, tabId] }
						: g,
				),
			);
			setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, groupId } : t)));
			if (isAuthenticated) {
				tabGroupService.addTab(groupId, tabId).catch(() => {});
			}
		},
		[isAuthenticated, setTabs],
	);

	const handleRemoveTabFromGroup = useCallback(
		async (tabId: string) => {
			setTabGroups((prev) =>
				prev.map((g) => ({ ...g, tabIds: g.tabIds.filter((id) => id !== tabId) })),
			);
			setTabs((prev) =>
				prev.map((t) => (t.id === tabId ? { ...t, groupId: undefined } : t)),
			);
			if (isAuthenticated) {
				tabGroupService.removeTab(tabId).catch(() => {});
			}
		},
		[isAuthenticated, setTabs],
	);

	const handleRemoveSavedTab = useCallback((groupId: string, index: number) => {
		setTabGroups((prev) =>
			prev.map((g) =>
				g.id === groupId
					? { ...g, savedTabs: g.savedTabs.filter((_, i) => i !== index) }
					: g,
			),
		);
	}, []);

	const handleDeleteGroup = useCallback(
		async (groupId: string) => {
			setTabGroups((prev) => prev.filter((g) => g.id !== groupId));
			setTabs((prev) =>
				prev.map((t) => (t.groupId === groupId ? { ...t, groupId: undefined } : t)),
			);
			if (isAuthenticated) {
				tabGroupService.delete(groupId).catch(() => {});
			}
		},
		[isAuthenticated, setTabs],
	);

	const handleToggleGroupCollapse = useCallback((groupId: string) => {
		setTabGroups((prev) =>
			prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g)),
		);
	}, []);

	const handleReopenGroupTab = useCallback(
		async (groupId: string, index: number) => {
			const group = tabGroups.find((g) => g.id === groupId);
			if (!group || !group.savedTabs[index]) return;
			const { url, title } = group.savedTabs[index];

			const tempId = `temp-${Date.now()}`;
			const newTab: Tab = { id: tempId, title, url, groupId };
			setTabs((prev) => [...prev, newTab]);
			setActiveTabId(tempId);

			setTabGroups((prev) =>
				prev.map((g) =>
					g.id === groupId
						? {
								...g,
								savedTabs: g.savedTabs.filter((_, i) => i !== index),
								tabIds: [...g.tabIds, tempId],
						  }
						: g,
				),
			);

			if (isAuthenticated) {
				try {
					const created = await tabService.createTab({ url, title });
					setTabs((prev) =>
						prev.map((t) => (t.id === tempId ? { ...t, id: created.id } : t)),
					);
					setActiveTabId(created.id);
					setTabGroups((prev) =>
						prev.map((g) =>
							g.id === groupId
								? { ...g, tabIds: g.tabIds.map((tid) => (tid === tempId ? created.id : tid)) }
								: g,
						),
					);
					tabGroupService.addTab(groupId, created.id).catch(() => {});
				} catch {
					/* keep temp */
				}
			}
		},
		[tabGroups, isAuthenticated, setTabs, setActiveTabId],
	);

	return {
		tabGroups,
		setTabGroups,
		loadTabGroups,
		onGroupTabClosed,
		handleCreateTabGroup,
		handleAddTabToGroup,
		handleRemoveTabFromGroup,
		handleRemoveSavedTab,
		handleDeleteGroup,
		handleToggleGroupCollapse,
		handleReopenGroupTab,
	};
}
