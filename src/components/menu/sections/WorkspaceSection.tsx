import {
	Columns,
	PanelLeft,
	Maximize2,
	Layers,
	Moon,
	Sun,
	Monitor,
	Plus,
	X,
	Check,
	ChevronDown,
	ChevronRight,
	ExternalLink,
} from "lucide-react";
import { MenuContent, ToolCard } from "./ShareSectionUtils";
import type { UserPrefs } from "@/hooks/useMenuData";
import { useState, useRef, useEffect } from "react";

const GROUP_COLORS = [
	"#22d3ee",
	"#a78bfa",
	"#fb923c",
	"#f472b6",
	"#34d399",
	"#facc15",
];

interface WorkspaceSectionProps {
	prefs: UserPrefs | null;
	onThemeChange: (themeId: string) => Promise<void>;
	onClose: () => void;
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

function AddTabDropdown({
	tabs,
	onAdd,
}: {
	tabs: { id: string; title: string }[];
	onAdd: (tabId: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node))
				setOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	if (tabs.length === 0) return null;

	return (
		<div ref={ref} className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 rounded-md transition-all w-full">
				<Plus className="w-3 h-3" />
				<span className="flex-1 text-left">Agregar pestaña</span>
				<ChevronDown
					className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div className="absolute left-0 right-0 bottom-full mb-1 z-10 py-1 rounded-lg bg-[#141922] border border-white/[0.1] shadow-xl shadow-black/40 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => {
								onAdd(tab.id);
								setOpen(false);
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.06] transition-colors group">
							<div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-cyan-400 transition-colors flex-shrink-0" />
							<span className="text-[10px] text-slate-400 group-hover:text-slate-200 truncate transition-colors">
								{tab.title}
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export function WorkspaceSection({
	prefs,
	onThemeChange,
	onClose,
	onSplitView,
	onSidePanel,
	workspaceMode = "normal",
	tabGroups = [],
	tabs = [],
	activeTabId = "",
	onCreateTabGroup,
	onAddTabToGroup,
	onRemoveTabFromGroup,
	onDeleteGroup,
	onSelectTab,
  onReopenGroupTab,
  onRemoveSavedTab,
}: WorkspaceSectionProps) {
	const [showNewGroup, setShowNewGroup] = useState(false);
	const [newGroupName, setNewGroupName] = useState("");
	const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
	const [showGroupManager, setShowGroupManager] = useState(false);
	const [selectedTabIds, setSelectedTabIds] = useState<string[]>([]);
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

	const ungroupedTabs = tabs.filter((t) => !t.groupId);

	const toggleTabSelection = (tabId: string) => {
		setSelectedTabIds((prev) =>
			prev.includes(tabId)
				? prev.filter((id) => id !== tabId)
				: [...prev, tabId],
		);
	};

	const toggleGroupExpanded = (groupId: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) next.delete(groupId);
			else next.add(groupId);
			return next;
		});
	};

	const handleCreateGroup = () => {
		if (!newGroupName.trim()) return;
		const tabIds = selectedTabIds.length > 0 ? selectedTabIds : undefined;
		onCreateTabGroup?.(newGroupName.trim(), newGroupColor, tabIds);
		setNewGroupName("");
		setNewGroupColor(GROUP_COLORS[0]);
		setSelectedTabIds([]);
		setShowNewGroup(false);
	};

	return (
		<MenuContent title="Espacio de trabajo" subtitle="Organiza tu pantalla">
			{/* Layout tools */}
			<div className="grid grid-cols-2 gap-2">
				<ToolCard
					icon={
						<Columns
							className={`w-5 h-5 ${
								workspaceMode === "split" ? "text-cyan-300" : "text-cyan-400"
							}`}
						/>
					}
					title="Vista dividida"
					desc={
						workspaceMode === "split"
							? "Activa — clic para cerrar"
							: "Dos páginas lado a lado"
					}
					accent="cyan"
					onClick={() => onSplitView?.()}
				/>
				<ToolCard
					icon={
						<PanelLeft
							className={`w-5 h-5 ${
								workspaceMode === "sidebar"
									? "text-violet-300"
									: "text-violet-400"
							}`}
						/>
					}
					title="Panel lateral"
					desc={
						workspaceMode === "sidebar"
							? "Activo — clic para cerrar"
							: "Panel con segunda página"
					}
					accent="violet"
					onClick={() => onSidePanel?.()}
				/>
				<ToolCard
					icon={<Maximize2 className="w-5 h-5 text-amber-400" />}
					title="Pantalla completa"
					desc="Ocultar todo el UI"
					accent="amber"
					onClick={() => {
						document.documentElement.requestFullscreen?.();
						onClose();
					}}
				/>
				<ToolCard
					icon={<Layers className="w-5 h-5 text-emerald-400" />}
					title="Grupos de pestañas"
					desc={
						tabGroups.length > 0
							? `${tabGroups.length} grupo(s)`
							: "Organizar pestañas por tema"
					}
					accent="emerald"
					onClick={() => setShowGroupManager(!showGroupManager)}
				/>
			</div>

			{/* Indicador de modo activo */}
			{workspaceMode !== "normal" && (
				<div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
					<div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
					<span className="text-[11px] text-cyan-400 font-medium">
						{workspaceMode === "split"
							? "Vista dividida activa"
							: "Panel lateral activo"}
					</span>
					<button
						onClick={() => {
							if (workspaceMode === "split") onSplitView?.();
							else onSidePanel?.();
						}}
						className="ml-auto text-[10px] text-cyan-500 hover:text-cyan-300 transition-colors">
						Desactivar
					</button>
				</div>
			)}

			{/* ── Gestor de grupos de pestañas ── */}
			{showGroupManager && (
				<div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
					<div className="flex items-center justify-between mb-3">
						<p className="text-xs font-bold text-slate-300">
							Grupos de pestañas
						</p>
						<button
							onClick={() => {
								setShowNewGroup(!showNewGroup);
								setSelectedTabIds([]);
							}}
							className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
							<Plus className="w-3 h-3" /> Nuevo grupo
						</button>
					</div>

					{/* Formulario nuevo grupo CON selección múltiple */}
					{showNewGroup && (
						<div className="mb-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
							<input
								type="text"
								value={newGroupName}
								onChange={(e) => setNewGroupName(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
								placeholder="Nombre del grupo..."
								className="w-full text-xs bg-transparent border-b border-white/10 pb-1.5 mb-2 text-slate-300 placeholder-slate-600 outline-none focus:border-cyan-500/30"
								maxLength={20}
							/>

							{/* Color picker */}
							<div className="flex items-center gap-3 mb-3">
								<div className="flex gap-1.5">
									{GROUP_COLORS.map((c) => (
										<button
											key={c}
											onClick={() => setNewGroupColor(c)}
											className={`w-5 h-5 rounded-full border-2 transition-all ${
												newGroupColor === c
													? "border-white scale-110"
													: "border-transparent"
											}`}
											style={{ backgroundColor: c }}
										/>
									))}
								</div>
							</div>

							{/* Selección de pestañas */}
							{tabs.length > 0 && (
								<div className="mb-3">
									<p className="text-[10px] text-slate-500 mb-1.5">
										Seleccionar pestañas ({selectedTabIds.length} de{" "}
										{tabs.length})
									</p>
									<div className="max-h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
										{tabs.map((tab) => {
											const isSelected = selectedTabIds.includes(tab.id);
											const isInOtherGroup = tab.groupId && !isSelected;
											return (
												<button
													key={tab.id}
													onClick={() =>
														!isInOtherGroup && toggleTabSelection(tab.id)
													}
													disabled={!!isInOtherGroup}
													className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
														isSelected
															? "bg-cyan-500/10 border border-cyan-500/20"
															: isInOtherGroup
															? "opacity-30 cursor-not-allowed border border-transparent"
															: "hover:bg-white/[0.04] border border-transparent"
													}`}>
													<div
														className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-all ${
															isSelected
																? "bg-cyan-500 border-cyan-500"
																: "border-white/20 bg-transparent"
														}`}>
														{isSelected && (
															<Check className="w-2.5 h-2.5 text-white" />
														)}
													</div>
													<span className="text-[10px] text-slate-400 truncate flex-1">
														{tab.title}
													</span>
													{tab.id === activeTabId && (
														<span className="text-[8px] text-cyan-500 flex-shrink-0">
															activa
														</span>
													)}
													{isInOtherGroup && (
														<span className="text-[8px] text-slate-600 flex-shrink-0">
															en grupo
														</span>
													)}
												</button>
											);
										})}
									</div>
								</div>
							)}

							<button
								onClick={handleCreateGroup}
								disabled={!newGroupName.trim()}
								className="w-full py-1.5 text-[11px] font-medium rounded-md bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
								Crear grupo
								{selectedTabIds.length > 0
									? ` con ${selectedTabIds.length} pestaña(s)`
									: ""}
							</button>
						</div>
					)}

					{/* Lista de grupos existentes */}
					{tabGroups.length === 0 && !showNewGroup ? (
						<p className="text-[11px] text-slate-600 text-center py-3">
							No hay grupos creados. Crea uno para organizar tus pestañas.
						</p>
					) : (
						<div className="space-y-2">
							{tabGroups.map((group) => {
								const groupTabs = tabs.filter((t) => t.groupId === group.id);
								const isExpanded = expandedGroups.has(group.id);
								return (
									<div
										key={group.id}
										className="rounded-xl overflow-hidden border transition-all"
										style={{
											borderColor: isExpanded
												? `${group.color}30`
												: "rgba(255,255,255,0.06)",
											backgroundColor: isExpanded
												? `${group.color}08`
												: "rgba(255,255,255,0.02)",
										}}>
										{/* Cabecera del grupo */}
										<button
											onClick={() => toggleGroupExpanded(group.id)}
											className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.03] transition-all group">
											<span
												className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white/20 ring-offset-1 ring-offset-[#0a0e17]"
												style={{ backgroundColor: group.color }}
											/>
											<span className="text-[11px] font-semibold text-slate-200 flex-1 text-left">
												{group.name}
											</span>
											<span
												className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
												style={{
													backgroundColor: `${group.color}15`,
													color: group.color,
												}}>
												{groupTabs.length + (group.savedTabs?.length ?? 0)}
											</span>
											{isExpanded ? (
												<ChevronDown className="w-3.5 h-3.5 text-slate-500" />
											) : (
												<ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />
											)}
										</button>

										{/* Contenido expandido */}
										{isExpanded && (
											<div
												className="border-t"
												style={{ borderColor: `${group.color}15` }}>
												{/* Tabs del grupo — clickeables para navegar */}
												{groupTabs.length > 0 ? (
													<div className="py-1">
														{groupTabs.map((tab) => {
															const isActive = tab.id === activeTabId;
															return (
																<div
																	key={tab.id}
																	className={`flex items-center gap-2 px-3 py-1.5 group/tab transition-all ${
																		isActive
																			? "bg-white/[0.06]"
																			: "hover:bg-white/[0.04]"
																	}`}>
																	<div
																		className="w-1.5 h-1.5 rounded-full flex-shrink-0"
																		style={{
																			backgroundColor: isActive
																				? group.color
																				: "rgb(100,116,139)",
																		}}
																	/>
																	<button
																		onClick={() => onSelectTab?.(tab.id)}
																		className="text-[10px] text-slate-400 hover:text-slate-200 truncate flex-1 text-left transition-colors"
																		title={`Ir a: ${tab.title}`}>
																		{tab.title}
																	</button>
																	{isActive && (
																		<span
																			className="text-[8px] font-bold px-1 py-0.5 rounded"
																			style={{
																				backgroundColor: `${group.color}20`,
																				color: group.color,
																			}}>
																			activa
																		</span>
																	)}
																	<button
																		onClick={() =>
																			onRemoveTabFromGroup?.(tab.id)
																		}
																		className="opacity-0 group-hover/tab:opacity-100 text-slate-700 hover:text-red-400 transition-all flex-shrink-0"
																		title="Quitar del grupo">
																		<X className="w-3 h-3" />
																	</button>
																</div>
															);
														})}
													</div>
												) : (
													<p className="px-3 py-3 text-[10px] text-slate-600 italic">
														Grupo vacío — agrega pestañas abajo
													</p>
												)}

												{(group.savedTabs?.length ?? 0) > 0 && (
													<div
														className="py-1 border-t"
														style={{ borderColor: `${group.color}10` }}>
														<p className="px-3 pt-1 pb-0.5 text-[9px] text-slate-600 uppercase tracking-wider">
															Cerradas
														</p>
														{group.savedTabs.map((saved, idx) => (
															<div
																key={`saved-${idx}`}
																className="flex items-center gap-2 px-3 py-1.5 group/tab hover:bg-white/[0.04] transition-all">
																<div className="w-1.5 h-1.5 rounded-full bg-slate-700 flex-shrink-0" />
																<span className="text-[10px] text-slate-600 truncate flex-1">
																	{saved.title}
																</span>
																<button
																	onClick={() =>
																		onReopenGroupTab?.(group.id, idx)
																	}
																	className="text-[9px] text-cyan-500 hover:text-cyan-300 transition-colors flex-shrink-0">
																	Abrir
																</button>
																<button
																	onClick={() =>
																		onRemoveSavedTab?.(group.id, idx)
																	}
																	className="opacity-0 group-hover/tab:opacity-100 text-slate-700 hover:text-red-400 transition-all flex-shrink-0">
																	<X className="w-3 h-3" />
																</button>
															</div>
														))}
													</div>
												)}

												{/* Acciones del grupo */}
												<div
													className="flex items-center border-t px-1 py-1"
													style={{ borderColor: `${group.color}10` }}>
													{/* Dropdown bonito para agregar tabs */}
													<div className="flex-1">
														<AddTabDropdown
															tabs={ungroupedTabs}
															onAdd={(tabId) =>
																onAddTabToGroup?.(tabId, group.id)
															}
														/>
													</div>
													<button
														onClick={() => onDeleteGroup?.(group.id)}
														className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all">
														<X className="w-3 h-3" />
														<span>Eliminar</span>
													</button>
												</div>
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* ── Tema de colores ── */}
			<div className="mt-5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
				<p className="text-xs font-bold text-slate-300 mb-3">Tema de colores</p>
				<div className="flex gap-2">
					{[
						{ id: "dark", icon: <Moon className="w-4 h-4" />, label: "Oscuro" },
						{ id: "light", icon: <Sun className="w-4 h-4" />, label: "Claro" },
						{
							id: "system",
							icon: <Monitor className="w-4 h-4" />,
							label: "Sistema",
						},
					].map((t) => (
						<button
							key={t.id}
							onClick={() => onThemeChange(t.id)}
							className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl border transition-all duration-200 ${
								prefs?.theme === t.id
									? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
									: "bg-white/[0.02] border-white/[0.06] text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
							}`}>
							{t.icon}
							<span className="text-[10px] font-medium">{t.label}</span>
						</button>
					))}
				</div>
			</div>
		</MenuContent>
	);
}
