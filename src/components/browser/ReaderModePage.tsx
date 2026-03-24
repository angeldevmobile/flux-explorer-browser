import { useEffect, useState } from "react";
import { Readability } from "@mozilla/readability";
import { BookOpen, ExternalLink, X } from "lucide-react";

interface ReaderModePageProps {
	url: string;
	onExit: () => void;
}

interface Article {
	title: string;
	byline: string | null;
	content: string;
	excerpt: string | null;
	siteName: string | null;
}

export const ReaderModePage = ({ url, onExit }: ReaderModePageProps) => {
	const [article, setArticle] = useState<Article | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		const extract = async () => {
			setLoading(true);
			setError(false);
			try {
				const res = await fetch(`http://localhost:4000/render?url=${encodeURIComponent(url)}`);
				if (!res.ok) throw new Error("Fetch failed");
				const html = await res.text();
				if (!html) throw new Error("No HTML");

				const doc = new DOMParser().parseFromString(html, "text/html");
				// Base URL para resolver imágenes/links relativos
				const base = doc.createElement("base");
				base.href = url;
				doc.head.insertBefore(base, doc.head.firstChild);

				const parsed = new Readability(doc).parse();
				if (!parsed) throw new Error("Readability failed");
				setArticle(parsed as Article);
			} catch {
				setError(true);
			} finally {
				setLoading(false);
			}
		};
		extract();
	}, [url]);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full bg-[#f9f6f0] dark:bg-[#1a1814]">
				<div className="flex flex-col items-center gap-3">
					<BookOpen className="w-8 h-8 text-orange-400 animate-pulse" />
					<p className="text-sm text-slate-500">Preparando modo lectura…</p>
				</div>
			</div>
		);
	}

	if (error || !article) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 bg-[#f9f6f0] dark:bg-[#1a1814]">
				<BookOpen className="w-10 h-10 text-slate-400" />
				<p className="text-slate-500 text-sm">No se pudo extraer el contenido de esta página.</p>
				<button
					onClick={onExit}
					className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-sm hover:bg-orange-500/20 transition-colors">
					Salir del modo lectura
				</button>
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto bg-[#f9f6f0] dark:bg-[#1a1814]">
			{/* Toolbar */}
			<div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-[#f9f6f0]/90 dark:bg-[#1a1814]/90 backdrop-blur-sm border-b border-orange-200/30 dark:border-orange-900/20">
				<div className="flex items-center gap-2 text-orange-500">
					<BookOpen className="w-4 h-4" />
					<span className="text-xs font-medium">Modo Lectura</span>
				</div>
				<div className="flex items-center gap-2">
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
						<ExternalLink className="w-3 h-3" />
						Ver original
					</a>
					<button
						onClick={onExit}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
						<X className="w-3 h-3" />
						Salir
					</button>
				</div>
			</div>

			{/* Article content */}
			<div className="max-w-2xl mx-auto px-6 py-10">
				{article.siteName && (
					<p className="text-xs text-orange-400 uppercase tracking-widest font-medium mb-3">
						{article.siteName}
					</p>
				)}
				<h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight mb-4">
					{article.title}
				</h1>
				{article.byline && (
					<p className="text-sm text-slate-500 mb-6 pb-6 border-b border-slate-200 dark:border-slate-700">
						{article.byline}
					</p>
				)}
				<div
					className="prose prose-slate dark:prose-invert prose-lg max-w-none
						prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-slate-100
						prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed
						prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline
						prose-img:rounded-xl prose-img:shadow-md
						prose-blockquote:border-orange-400 prose-blockquote:text-slate-500"
					dangerouslySetInnerHTML={{ __html: article.content }}
				/>
			</div>
		</div>
	);
};
