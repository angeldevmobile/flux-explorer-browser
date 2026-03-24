export interface Tab {
	id: string;
	title: string;
	url: string;
	favicon?: string;
	groupId?: string;
	discarded?: boolean;   // true = WebView destruido para liberar RAM
	lastActiveAt?: number; // timestamp de la última vez activa
}

export type VoiceState = "idle" | "listening" | "processing" | "results";
export type WorkspaceMode = "normal" | "split" | "sidebar";

export interface TabGroup {
	id: string;
	name: string;
	color: string;
	tabIds: string[];
	collapsed: boolean;
	savedTabs: { url: string; title: string }[];
}
