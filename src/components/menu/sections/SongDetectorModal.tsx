import { useState, useEffect, useCallback } from "react";
import { X, Music, Disc3, Clock, Trash2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { mediaService, type DetectedSong } from "@/services/api";

interface SongDetectorModalProps {
	open: boolean;
	onClose: () => void;
	currentUrl: string;
	currentTitle?: string;
	tabs: { id: string; title: string; url: string; favicon?: string }[];
}

export function SongDetectorModal({
	open,
	onClose,
	currentUrl,
	currentTitle,
	tabs,
}: SongDetectorModalProps) {
	const { toast } = useToast();
	const [detecting, setDetecting] = useState(false);
	const [currentSong, setCurrentSong] = useState<DetectedSong | null>(null);
	const [history, setHistory] = useState<DetectedSong[]>([]);
	const [showHistory, setShowHistory] = useState(false);
	const [loadingHistory, setLoadingHistory] = useState(false);
	const [selectedUrl, setSelectedUrl] = useState(currentUrl);
	const [selectedTitle, setSelectedTitle] = useState(currentTitle || "");

	const loadHistory = useCallback(async () => {
		setLoadingHistory(true);
		try {
			const songs = await mediaService.getSongHistory();
			setHistory(songs);
		} catch {
			// silently fail
		} finally {
			setLoadingHistory(false);
		}
	}, []);

	useEffect(() => {
		if (open) loadHistory();
	}, [open, loadHistory]);

	useEffect(() => {
		if (open) {
			setSelectedUrl(currentUrl);
			setSelectedTitle(currentTitle || "");
		}
	}, [open]);

	const handleDetect = async () => {
		setDetecting(true);
		setCurrentSong(null);

		try {
			const result = await mediaService.detectSong(
				"",
				selectedUrl,
				selectedTitle,
			);

			if (result.success && result.song) {
				setCurrentSong(result.song);
				toast({
					title: `🎵 ${result.song.title}`,
					description: `por ${result.song.artist}`,
				});
				loadHistory();
			} else {
				toast({
					title: "No se pudo identificar la canción",
					description: "Intenta con otra página de música",
				});
			}
		} catch {
			toast({ title: "Error al detectar canción" });
		} finally {
			setDetecting(false);
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await mediaService.deleteSong(id);
			setHistory((prev) => prev.filter((s) => s.id !== id));
			if (currentSong?.id === id) setCurrentSong(null);
			toast({ title: "Canción eliminada del historial" });
		} catch {
			toast({ title: "Error eliminando canción" });
		}
	};

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="bg-[#0d1117] border border-white/10 rounded-2xl w-[90vw] max-w-md max-h-[80vh] flex flex-col shadow-2xl">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
					<div className="flex items-center gap-2">
						<Music className="w-5 h-5 text-pink-400" />
						<h2 className="text-lg font-bold text-white">Detectar canción</h2>
					</div>
					<button
						onClick={onClose}
						className="p-1.5 rounded-lg hover:bg-white/10 transition">
						<X className="w-5 h-5 text-slate-400" />
					</button>
				</div>

				{/* Detector */}
				<div className="p-5 flex flex-col items-center">
					<button
						onClick={handleDetect}
						disabled={detecting}
						className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all ${
							detecting
								? "bg-pink-500/20 animate-pulse"
								: "bg-white/5 hover:bg-pink-500/10 hover:scale-105"
						}`}>
						{detecting && (
							<>
								<span className="absolute inset-0 rounded-full border-2 border-pink-400/30 animate-ping" />
								<span
									className="absolute inset-2 rounded-full border border-pink-400/20 animate-ping"
									style={{ animationDelay: "0.3s" }}
								/>
							</>
						)}
						<Disc3
							className={`w-12 h-12 text-pink-400 ${
								detecting ? "animate-spin" : ""
							}`}
						/>
					</button>
					<p className="mt-3 text-sm text-slate-400">
						{detecting
							? "Analizando página…"
							: "Toca para identificar la canción"}
					</p>

					{currentSong && (
						<div className="mt-5 w-full p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
							<div className="flex gap-3">
								{currentSong.coverUrl ? (
									<img
										src={currentSong.coverUrl}
										alt=""
										className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
									/>
								) : (
									<div className="w-16 h-16 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
										<Music className="w-8 h-8 text-pink-400" />
									</div>
								)}
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-white truncate">
										{currentSong.title}
									</p>
									<p className="text-xs text-slate-400 truncate">
										{currentSong.artist}
									</p>
									{currentSong.album && (
										<p className="text-[11px] text-slate-600 truncate">
											{currentSong.album}
										</p>
									)}
									<div className="flex gap-2 mt-1.5">
										{currentSong.genre && (
											<span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-[10px] text-pink-400">
												{currentSong.genre}
											</span>
										)}
										{currentSong.year && (
											<span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-500">
												{currentSong.year}
											</span>
										)}
										<span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[10px] text-emerald-400">
											{Math.round(currentSong.confidence * 100)}%
										</span>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Historial */}
				<div className="flex-1 overflow-y-auto border-t border-white/[0.06]">
					<button
						onClick={() => setShowHistory(!showHistory)}
						className="w-full flex items-center justify-between p-3 text-xs text-slate-500 hover:text-slate-300 transition">
						<span className="flex items-center gap-1.5">
							<Clock className="w-3.5 h-3.5" />
							Historial ({history.length})
						</span>
						<span>{showHistory ? "▲" : "▼"}</span>
					</button>

					{showHistory && (
						<div className="px-3 pb-3 space-y-1.5">
							{loadingHistory ? (
								<div className="flex justify-center py-4">
									<div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
								</div>
							) : history.length === 0 ? (
								<p className="text-center text-xs text-slate-600 py-4">
									Sin canciones detectadas aún
								</p>
							) : (
								history.map((song) => (
									<div
										key={song.id}
										className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition group">
										{song.coverUrl ? (
											<img
												src={song.coverUrl}
												alt=""
												className="w-9 h-9 rounded-md object-cover flex-shrink-0"
											/>
										) : (
											<div className="w-9 h-9 rounded-md bg-pink-500/10 flex items-center justify-center flex-shrink-0">
												<Music className="w-4 h-4 text-pink-400" />
											</div>
										)}
										<div className="flex-1 min-w-0">
											<p className="text-xs font-medium text-slate-300 truncate">
												{song.title}
											</p>
											<p className="text-[10px] text-slate-600 truncate">
												{song.artist}
											</p>
										</div>
										<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
											{song.sourceUrl && (
												<button
													onClick={() => window.open(song.sourceUrl, "_blank")}
													className="p-1 rounded hover:bg-white/10 transition"
													title="Abrir fuente">
													<ExternalLink className="w-3 h-3 text-slate-500" />
												</button>
											)}
											<button
												onClick={() => handleDelete(song.id)}
												className="p-1 rounded hover:bg-red-500/20 transition"
												title="Eliminar">
												<Trash2 className="w-3 h-3 text-red-400" />
											</button>
										</div>
									</div>
								))
							)}
						</div>
					)}
				</div>

				{/* Selector de pestaña a identificar */}
				{tabs.filter((t) => t.url.startsWith("http")).length > 1 && (
					<div className="w-full mb-4">
						<p className="text-[11px] text-slate-500 mb-1.5">Detectar desde:</p>
						<div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
							{tabs
								.filter((t) => t.url.startsWith("http"))
								.map((tab) => (
									<button
										key={tab.id}
										onClick={() => {
											setSelectedUrl(tab.url);
											setSelectedTitle(tab.title);
										}}
										className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
											selectedUrl === tab.url
												? "bg-pink-500/15 text-pink-300 border border-pink-500/20"
												: "text-slate-400 hover:bg-white/5 border border-transparent"
										}`}>
										{tab.favicon && (
											<img
												src={tab.favicon}
												alt=""
												className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
											/>
										)}
										<span className="truncate">{tab.title || tab.url}</span>
									</button>
								))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
