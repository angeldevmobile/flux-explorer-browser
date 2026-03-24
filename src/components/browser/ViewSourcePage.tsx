import { useState } from "react";
import { Copy, Check, FileCode2 } from "lucide-react";

interface ViewSourcePageProps {
  html: string;
  url: string;
}

export const ViewSourcePage = ({ html, url }: ViewSourcePageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightHtml = (source: string) => {
    return source
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="text-red-400">$2</span>')
      .replace(/([\w-]+)(=)/g, '<span class="text-amber-400">$1</span>$2')
      .replace(/"([^"]*)"/g, '<span class="text-emerald-400">"$1"</span>')
      .replace(/(&lt;!--)(.*?)(--&gt;)/gs, '<span class="text-slate-600">$1$2$3</span>');
  };

  const lines = html.split("\n");

  return (
    <div className="w-full h-full bg-[#0a0e1a] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-[#0d1117] border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <FileCode2 className="w-4 h-4 text-cyan-400" />
          <div>
            <p className="text-sm font-medium text-slate-300">Código fuente</p>
            <p className="text-[11px] text-slate-600 truncate max-w-[400px]">{url}</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all text-xs text-slate-400 hover:text-slate-200"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="flex-1 overflow-auto font-mono text-xs leading-6">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="select-none text-right pr-4 pl-4 text-slate-700 border-r border-white/[0.04] w-12 sticky left-0 bg-[#0a0e1a]">
                  {i + 1}
                </td>
                <td
                  className="pl-4 pr-4 text-slate-400 whitespace-pre"
                  dangerouslySetInnerHTML={{ __html: highlightHtml(line) }}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};