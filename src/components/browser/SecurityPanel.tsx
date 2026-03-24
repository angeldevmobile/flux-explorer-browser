import { useState, useEffect } from "react";
import {
	Shield,
	ShieldAlert,
	ShieldCheck,
	Eye,
	Ban,
	Globe,
	Zap,
	Wifi,
	Server,
	Settings2,
	Lock,
	AlertTriangle,
} from "lucide-react";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

/* ─────────────────────────────────── types ── */
interface SecurityInfo {
	level: "secure" | "warning" | "danger";
	protocol: string;
	certificate?: string;
}

interface PageStats {
	trackersBlocked: number;
	adsBlocked: number;
	cookiesBlocked: number;
	dataSavedBytes: number;
}

interface ProxyConfig {
	enabled: boolean;
	type: "socks5" | "http";
	host: string;
	port: number;
	username: string;
	password: string;
}

interface SecurityPanelProps {
	url: string;
	isSecure: boolean;
	domain: string;
	securityInfo: SecurityInfo;
	onTogglePrivacy: () => void;
	/** Pass-through children = the trigger button rendered in AddressBar */
	children: React.ReactNode;
}

/* ─────────────────────────── helpers ── */
function fmtBytes(b: number) {
	if (b > 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
	return (b / 1024).toFixed(0) + " KB";
}

/* ════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════ */
export const SecurityPanel = ({
	url,
	isSecure,
	domain,
	securityInfo,
	onTogglePrivacy,
	children,
}: SecurityPanelProps) => {
	const { toast } = useToast();
	const isInternal = url.startsWith("orion://");

	/* ── Privacy stats ── */
	const EMPTY_STATS: PageStats = { trackersBlocked: 0, adsBlocked: 0, cookiesBlocked: 0, dataSavedBytes: 0 };
	const [pageStats, setPageStats] = useState<PageStats>(EMPTY_STATS);

	useEffect(() => {
		if (!domain || isInternal) {
			setPageStats(EMPTY_STATS);
			return;
		}

		// Rust despacha 'orion:privacy:blocked' con stats actualizadas
		const handler = (e: Event) => {
			const data = (e as CustomEvent<{ pageHost: string; pageStats: PageStats }>).detail;
			if (data?.pageHost === domain && data.pageStats)
				setPageStats({ ...EMPTY_STATS, ...data.pageStats });
		};
		window.addEventListener("orion:privacy:blocked", handler);
		return () => window.removeEventListener("orion:privacy:blocked", handler);
	}, [domain, url, isInternal]);

	/* ── VPN / Proxy ── */
	const [vpnConfig, setVpnConfig] = useState<ProxyConfig>({
		enabled: false,
		type: "socks5",
		host: "",
		port: 1080,
		username: "",
		password: "",
	});
	const [vpnLoading, setVpnLoading] = useState(false);
	const [vpnDraft, setVpnDraft] = useState({
		host: "",
		port: "1080",
		username: "",
		password: "",
		type: "socks5" as "socks5" | "http",
	});

	const sendIpc = (cmd: Record<string, unknown>) => {
		const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
		ipc?.postMessage(JSON.stringify(cmd));
	};

	const handleVpnToggle = () => {
		if (vpnConfig.enabled) {
			setVpnLoading(true);
			sendIpc({ cmd: "proxy_clear" });
			setVpnConfig((prev) => ({ ...prev, enabled: false }));
			setVpnLoading(false);
		} else {
			if (!vpnDraft.host.trim()) return;
			setVpnLoading(true);
			const cfg: ProxyConfig = {
				enabled: true,
				type: vpnDraft.type,
				host: vpnDraft.host.trim(),
				port: parseInt(vpnDraft.port) || 1080,
				username: vpnDraft.username,
				password: vpnDraft.password,
			};
			sendIpc({ cmd: "proxy_set", ...cfg });
			setVpnConfig(cfg);
			setVpnLoading(false);
			toast({ title: "Proxy conectado", description: `${vpnDraft.type.toUpperCase()} · ${vpnDraft.host}:${vpnDraft.port}` });
		}
	};

	/* ── Derived styles ── */
	const SecurityIcon =
		securityInfo.level === "secure" ? ShieldCheck :
		securityInfo.level === "warning" ? Shield : ShieldAlert;

	const levelColor = {
		secure: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", glow: "bg-emerald-500/[0.04]" },
		warning: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "bg-amber-500/[0.04]" },
		danger: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", glow: "bg-red-500/[0.04]" },
	}[securityInfo.level];

	const securityLabel = {
		secure: "Conexión segura",
		warning: "Precaución",
		danger: "No seguro",
	}[securityInfo.level];

	return (
		<Sheet>
			<SheetTrigger asChild>{children}</SheetTrigger>

			<SheetContent
				side="right"
				className="w-[360px] bg-[#0b0f16] border-l border-white/[0.06] p-0 flex flex-col"
			>
				{/* ── Header ── */}
				<SheetHeader className={`px-5 py-5 border-b border-white/[0.06] ${levelColor.glow} flex-shrink-0`}>
					<div className="flex items-center gap-3">
						<div className={`w-11 h-11 rounded-xl flex items-center justify-center ${levelColor.bg} border ${levelColor.border}`}>
							<SecurityIcon className={`w-5 h-5 ${levelColor.text}`} />
						</div>
						<div>
							<SheetTitle className={`text-base font-bold ${levelColor.text}`}>
								{securityLabel}
							</SheetTitle>
							<p className="text-[11px] text-slate-500 mt-0.5 font-normal">{domain || "Nueva pestaña"}</p>
						</div>
					</div>
				</SheetHeader>

				{/* ── Scrollable body ── */}
				<ScrollArea className="flex-1">
					<div className="px-5 py-4 space-y-5">

						{/* ── Conexión ── */}
						<section>
							<p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-3">
								Conexión
							</p>
							<div className="space-y-2.5">
								<Row icon={<Wifi className="w-3.5 h-3.5 text-slate-500" />} label="Protocolo">
									<span className="text-xs text-slate-300 font-medium">{securityInfo.protocol}</span>
								</Row>
								{securityInfo.certificate && (
									<Row icon={<Lock className="w-3.5 h-3.5 text-slate-500" />} label="Certificado">
										<span className="text-xs text-emerald-400 font-medium">{securityInfo.certificate}</span>
									</Row>
								)}
								{!isSecure && !isInternal && (
									<div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
										<AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
										<p className="text-[11px] text-amber-300/80 leading-relaxed">
											Tu conexión con este sitio no está cifrada. Los datos pueden ser visibles para terceros.
										</p>
									</div>
								)}
							</div>
						</section>

						{/* ── Privacidad ── */}
						<section>
							<p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-3">
								Privacidad
							</p>
							<div className="rounded-xl bg-white/[0.02] border border-white/[0.05] divide-y divide-white/[0.04]">
								<StatRow
									icon={<Ban className="w-3.5 h-3.5 text-slate-500" />}
									label="Anuncios bloqueados"
									value={pageStats.adsBlocked}
									valueClass={pageStats.adsBlocked === 0 ? "text-emerald-400" : "text-violet-400"}
								/>
								<StatRow
									icon={<Eye className="w-3.5 h-3.5 text-slate-500" />}
									label="Rastreadores bloqueados"
									value={pageStats.trackersBlocked}
									valueClass={
										pageStats.trackersBlocked === 0 ? "text-emerald-400" :
										pageStats.trackersBlocked < 5 ? "text-amber-400" : "text-red-400"
									}
								/>
								<StatRow
									icon={<Globe className="w-3.5 h-3.5 text-slate-500" />}
									label="Cookies 3ros bloqueadas"
									value={pageStats.cookiesBlocked}
									valueClass="text-amber-400"
								/>
								<StatRow
									icon={<Zap className="w-3.5 h-3.5 text-slate-500" />}
									label="Datos ahorrados"
									value={fmtBytes(pageStats.dataSavedBytes)}
									valueClass="text-emerald-400"
								/>
							</div>
						</section>

						{/* ── VPN / Proxy ── */}
						<section>
							<p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-3">
								VPN / Proxy
							</p>

							{/* Formulario de configuración (siempre visible cuando está desactivado) */}
							{!vpnConfig.enabled && (
								<div className="space-y-2 mb-3">
									<div className="flex gap-1.5">
										{(["socks5", "http"] as const).map((t) => (
											<button
												key={t}
												type="button"
												onClick={() => setVpnDraft((d) => ({ ...d, type: t }))}
												className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
													vpnDraft.type === t
														? "bg-violet-500/20 text-violet-300 border-violet-500/30"
														: "bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06]"
												}`}
											>
												{t.toUpperCase()}
											</button>
										))}
									</div>
									<div className="flex gap-1.5">
										<input
											type="text"
											placeholder="host o IP"
											value={vpnDraft.host}
											onChange={(e) => setVpnDraft((d) => ({ ...d, host: e.target.value }))}
											className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
										/>
										<input
											type="number"
											placeholder="puerto"
											value={vpnDraft.port}
											onChange={(e) => setVpnDraft((d) => ({ ...d, port: e.target.value }))}
											className="w-20 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
										/>
									</div>
									<input
										type="text"
										placeholder="usuario (opcional)"
										value={vpnDraft.username}
										onChange={(e) => setVpnDraft((d) => ({ ...d, username: e.target.value }))}
										className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
									/>
									<input
										type="password"
										placeholder="contraseña (opcional)"
										value={vpnDraft.password}
										onChange={(e) => setVpnDraft((d) => ({ ...d, password: e.target.value }))}
										className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-violet-500/50 transition-colors"
									/>
								</div>
							)}

							{/* Toggle row */}
							<div className="flex items-center justify-between px-3 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
								<div className="flex items-center gap-2.5">
									<div className={`w-8 h-8 rounded-lg flex items-center justify-center ${vpnConfig.enabled ? "bg-violet-500/15 border border-violet-500/25" : "bg-white/[0.04] border border-white/[0.06]"}`}>
										<Server className={`w-3.5 h-3.5 ${vpnConfig.enabled ? "text-violet-400" : "text-slate-500"}`} />
									</div>
									<div>
										<p className="text-xs font-medium text-slate-300">
											{vpnConfig.enabled ? "Proxy activo" : vpnDraft.host ? "Listo para conectar" : "Configura un proxy"}
										</p>
										{vpnConfig.enabled && (
											<p className="text-[10px] text-violet-400 font-medium">
												{vpnConfig.type.toUpperCase()} · {vpnConfig.host}:{vpnConfig.port}
											</p>
										)}
									</div>
								</div>

								<button
									type="button"
									onClick={handleVpnToggle}
									disabled={vpnLoading || (!vpnConfig.enabled && !vpnDraft.host.trim())}
									className={`relative w-10 h-6 rounded-full transition-all duration-200 flex-shrink-0 disabled:opacity-40 ${vpnConfig.enabled ? "bg-violet-500" : "bg-white/[0.10]"}`}
								>
									<span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${vpnConfig.enabled ? "left-5" : "left-1"}`} />
								</button>
							</div>

							{/* Editar config cuando está activo */}
							{vpnConfig.enabled && (
								<button
									type="button"
									onClick={() => {
										setVpnDraft({ host: vpnConfig.host, port: String(vpnConfig.port), username: vpnConfig.username, password: vpnConfig.password, type: vpnConfig.type });
										// Desactivar para poder editar
										sendIpc({ cmd: "proxy_clear" });
										setVpnConfig((prev) => ({ ...prev, enabled: false }));
									}}
									className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-400 transition-colors px-1"
								>
									<Settings2 className="w-3 h-3" />
									Editar configuración
								</button>
							)}
						</section>
					</div>
				</ScrollArea>

				{/* ── Footer actions ── */}
				<div className="px-5 py-4 border-t border-white/[0.06] flex gap-2 flex-shrink-0">
					<button
						onClick={onTogglePrivacy}
						className="flex-1 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-xs text-slate-300 font-medium transition-all"
					>
						Modo privado
					</button>
					<button
						onClick={() => toast({ title: "Sitio bloqueado", description: `${domain} fue bloqueado` })}
						className="flex-1 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/15 hover:bg-red-500/20 text-xs text-red-400 font-medium transition-all"
					>
						Bloquear sitio
					</button>
				</div>
			</SheetContent>
		</Sheet>
	);
};

/* ── Small reusable sub-components ── */
const Row = ({
	icon,
	label,
	children,
}: {
	icon: React.ReactNode;
	label: string;
	children: React.ReactNode;
}) => (
	<div className="flex items-center justify-between">
		<div className="flex items-center gap-2">
			{icon}
			<span className="text-xs text-slate-400">{label}</span>
		</div>
		{children}
	</div>
);

const StatRow = ({
	icon,
	label,
	value,
	valueClass,
}: {
	icon: React.ReactNode;
	label: string;
	value: string | number;
	valueClass: string;
}) => (
	<div className="flex items-center justify-between px-3 py-2.5">
		<div className="flex items-center gap-2">
			{icon}
			<span className="text-xs text-slate-400">{label}</span>
		</div>
		<span className={`text-xs font-bold ${valueClass}`}>{value}</span>
	</div>
);
