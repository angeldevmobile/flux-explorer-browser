import { useState, useCallback } from "react";
import type { WorkspaceMode } from "@/types/browser";

export function useWorkspace() {
	const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("normal");
	const [secondaryUrl, setSecondaryUrl] = useState("https://www.google.com");

	const handleSplitView = useCallback(() => {
		setWorkspaceMode((prev) => {
			if (prev !== "split") setSecondaryUrl("https://www.google.com");
			return prev === "split" ? "normal" : "split";
		});
	}, []);

	const handleSidePanel = useCallback(() => {
		setWorkspaceMode((prev) => {
			if (prev !== "sidebar") setSecondaryUrl("https://www.google.com");
			return prev === "sidebar" ? "normal" : "sidebar";
		});
	}, []);

	return {
		workspaceMode,
		setWorkspaceMode,
		secondaryUrl,
		setSecondaryUrl,
		handleSplitView,
		handleSidePanel,
	};
}
