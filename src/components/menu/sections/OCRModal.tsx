import { useState, useCallback } from "react";
import {
  X, ScanLine, Upload, Camera, Image as ImageIcon,
  Copy, Download, Search, Globe, FileText, Sparkles,
  MessageSquare, RefreshCw, CheckCheck, Link,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  extractText, translateText, summarizeImage,
  analyzeImage, askAboutImage, type OCRResult,
} from "@/services/ocrService";
import { aiHistoryService } from "@/services/api";

interface OCRModalProps {
  open: boolean;
  onClose: () => void;
  onSearch?: (query: string) => void;
}

type SourceTab = "page" | "upload" | "screenshot";

interface PageImage {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

const ACTIONS = [
  { key: "extract", label: "Extraer texto", icon: <ScanLine className="w-4 h-4" />, color: "emerald" },
  { key: "translate", label: "Traducir", icon: <Globe className="w-4 h-4" />, color: "sky" },
  { key: "summarize", label: "Resumir", icon: <FileText className="w-4 h-4" />, color: "violet" },
  { key: "analyze", label: "Flux Vision", icon: <Sparkles className="w-4 h-4" />, color: "amber" },
  { key: "ask", label: "Preguntar", icon: <MessageSquare className="w-4 h-4" />, color: "pink" },
] as const;

type ActionKey = typeof ACTIONS[number]["key"];

export function OCRModal({ open, onClose, onSearch }: OCRModalProps) {
  const { toast } = useToast();
  const [sourceTab, setSourceTab] = useState<SourceTab>("page");
  const [pageImages, setPageImages] = useState<PageImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // dataURL o src
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState("");
  const [activeAction, setActiveAction] = useState<ActionKey>("extract");

  const scanPageImages = useCallback(async () => {
    setLoadingImages(true);
    setPageImages([]);
    try {
      const imgs = Array.from(document.querySelectorAll("img[src]"))
        .filter((el) => (el as HTMLImageElement).naturalWidth > 80)
        .map((el) => {
          const img = el as HTMLImageElement;
          return { src: img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight };
        });
      setPageImages(imgs);
      if (imgs.length === 0) toast({ title: "No se encontraron imágenes en la página" });
    } catch {
      toast({ title: "Error escaneando imágenes" });
    } finally {
      setLoadingImages(false);
    }
  }, [toast]);

  const handleTabChange = (tab: SourceTab) => {
    setSourceTab(tab);
    setSelectedImage(null);
    setSelectedFile(null);
    setResult(null);
    if (tab === "page") scanPageImages();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setSelectedImage(url);
    setResult(null);
  };

  const handleScreenshot = () => {
    const ipc = (window as unknown as { ipc?: { postMessage: (m: string) => void } }).ipc;
    if (ipc) {
      ipc.postMessage(JSON.stringify({ cmd: "capture_page" }));
      toast({ title: "Capturando pantalla..." });
    } else {
      toast({ title: "Captura no disponible en modo web" });
    }
  };

  const handleSelectPageImage = (src: string) => {
    setSelectedImage(src);
    setResult(null);
  };

  const getSource = (): string | File => {
    if (selectedFile && sourceTab === "upload") return selectedFile;
    return selectedImage || "";
  };

  const handleRun = async (action: ActionKey) => {
    const source = getSource();
    if (!source) {
      toast({ title: "Selecciona una imagen primero" });
      return;
    }
    setActiveAction(action);
    setProcessing(true);
    setResult(null);
    try {
      let res: OCRResult;
      switch (action) {
        case "extract":   res = await extractText(source); break;
        case "translate": res = await translateText(source); break;
        case "summarize": res = await summarizeImage(source); break;
        case "analyze":   res = await analyzeImage(source); break;
        case "ask":
          if (!question.trim()) {
            toast({ title: "Escribe una pregunta primero" });
            setProcessing(false);
            return;
          }
          res = await askAboutImage(source, question); break;
        default: return;
      }
      setResult(res);

      // Guardar en historial (silenciosamente)
      const imageRef = selectedImage
        ? (selectedImage.startsWith("data:") ? "[captura/archivo]" : selectedImage)
        : "[archivo]";
      const resultText = res.text || res.originalText || res.answer || res.fullText || res.summary || "";
      aiHistoryService.save(
        `[OCR:${action}] ${imageRef}`,
        resultText.slice(0, 1000)
      ).catch(() => {});

    } catch {
      toast({ title: "Error procesando imagen", description: "Verifica tu conexión o intenta otra imagen" });
    } finally {
      setProcessing(false);
    }
  };

  const getResultText = (): string => {
    if (!result) return "";
    return (
      result.text ||
      result.originalText ||
      result.fullText ||
      result.answer ||
      ""
    );
  };

  const handleCopy = async () => {
    const text = getResultText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Texto copiado al portapapeles" });
  };

  const handleDownload = () => {
    const text = getResultText();
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ocr-orion-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSearchResult = () => {
    const q = result?.searchQuery || getResultText().slice(0, 200);
    if (q && onSearch) {
      onSearch(q);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-[92vw] max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white leading-none">Flux Vision</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Extrae y analiza texto de imágenes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Source Tabs */}
          <div className="flex gap-1 p-3 border-b border-white/[0.04]">
            {([
              { key: "page" as SourceTab, label: "Página actual", icon: <ImageIcon className="w-3.5 h-3.5" /> },
              { key: "upload" as SourceTab, label: "Subir imagen", icon: <Upload className="w-3.5 h-3.5" /> },
              { key: "screenshot" as SourceTab, label: "Captura", icon: <Camera className="w-3.5 h-3.5" /> },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  sourceTab === t.key
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4">
            {/* === Fuente: Página actual === */}
            {sourceTab === "page" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500">{pageImages.length} imágenes encontradas</p>
                  <button
                    onClick={scanPageImages}
                    disabled={loadingImages}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingImages ? "animate-spin" : ""}`} />
                    Actualizar
                  </button>
                </div>
                {loadingImages ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : pageImages.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-sm">
                    No se encontraron imágenes en esta página
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-44 overflow-y-auto">
                    {pageImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectPageImage(img.src)}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                          selectedImage === img.src
                            ? "border-emerald-400"
                            : "border-transparent hover:border-white/20"
                        }`}
                      >
                        <img
                          src={img.src}
                          alt={img.alt || ""}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        {selectedImage === img.src && (
                          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <CheckCheck className="w-5 h-5 text-emerald-400" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === Fuente: Subir archivo === */}
            {sourceTab === "upload" && (
              <label className="block cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
                  selectedImage ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.02]"
                }`}>
                  {selectedImage ? (
                    <img src={selectedImage} alt="" className="max-h-40 mx-auto rounded-lg object-contain" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">Haz clic para seleccionar imagen</p>
                      <p className="text-xs text-slate-600 mt-1">PNG, JPG, WEBP, GIF</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            )}

            {/* === Fuente: Captura === */}
            {sourceTab === "screenshot" && (
              <div className="space-y-3">
                <button
                  onClick={handleScreenshot}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition text-slate-400 hover:text-emerald-300"
                >
                  <Camera className="w-5 h-5" />
                  <span className="text-sm font-medium">Capturar pantalla actual</span>
                </button>
                {selectedImage && (
                  <img src={selectedImage} alt="" className="w-full max-h-40 object-contain rounded-lg border border-white/10" />
                )}
              </div>
            )}

            {/* Preview imagen seleccionada (para página actual) */}
            {sourceTab === "page" && selectedImage && (
              <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-white/[0.02] p-2">
                <p className="text-[10px] text-slate-500 mb-2">Vista previa seleccionada</p>
                <img
                  src={selectedImage}
                  alt=""
                  className="max-h-36 mx-auto object-contain rounded-lg"
                />
              </div>
            )}

            {/* Pregunta (visible si acción = ask) */}
            {activeAction === "ask" && (
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="¿Qué quieres saber sobre esta imagen?"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500/40"
              />
            )}

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((action) => {
                const colorMap: Record<string, string> = {
                  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/25",
                  sky: "bg-sky-500/15 text-sky-300 border-sky-500/25 hover:bg-sky-500/25",
                  violet: "bg-violet-500/15 text-violet-300 border-violet-500/25 hover:bg-violet-500/25",
                  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25 hover:bg-amber-500/25",
                  pink: "bg-pink-500/15 text-pink-300 border-pink-500/25 hover:bg-pink-500/25",
                };
                return (
                  <button
                    key={action.key}
                    onClick={() => handleRun(action.key)}
                    disabled={processing || !selectedImage}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed ${colorMap[action.color]}`}
                  >
                    {processing && activeAction === action.key ? (
                      <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                    ) : action.icon}
                    {action.label}
                  </button>
                );
              })}
            </div>

            {/* Resultado */}
            {result && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-slate-300">Resultado</p>
                  <div className="flex gap-1.5">
                    {onSearch && getResultText() && (
                      <button
                        onClick={handleSearchResult}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-slate-400 hover:text-slate-200 transition"
                        title="Buscar en Flux"
                      >
                        <Search className="w-3 h-3" /> Buscar
                      </button>
                    )}
                    {getResultText() && (
                      <>
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-slate-400 hover:text-slate-200 transition"
                        >
                          {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copied ? "Copiado" : "Copiar"}
                        </button>
                        <button
                          onClick={handleDownload}
                          className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-slate-400 hover:text-slate-200 transition"
                        >
                          <Download className="w-3 h-3" /> .txt
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 space-y-3 text-sm">
                  {/* Texto extraído */}
                  {getResultText() && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Texto extraído</p>
                      <p className="text-slate-300 whitespace-pre-wrap leading-relaxed text-xs max-h-40 overflow-y-auto">
                        {getResultText()}
                      </p>
                    </div>
                  )}

                  {/* Traducción */}
                  {result.translatedText && (
                    <div>
                      <p className="text-[10px] text-sky-400 uppercase tracking-wide mb-1">Traducción</p>
                      <p className="text-slate-300 whitespace-pre-wrap text-xs">{result.translatedText}</p>
                    </div>
                  )}

                  {/* Respuesta a pregunta */}
                  {result.answer && (
                    <div>
                      <p className="text-[10px] text-pink-400 uppercase tracking-wide mb-1">Respuesta</p>
                      <p className="text-slate-300 text-xs">{result.answer}</p>
                    </div>
                  )}

                  {/* Resumen */}
                  {result.summary && (
                    <div>
                      <p className="text-[10px] text-violet-400 uppercase tracking-wide mb-1">Resumen</p>
                      <p className="text-slate-300 text-xs">{result.summary}</p>
                    </div>
                  )}

                  {/* Key points */}
                  {result.keyPoints && result.keyPoints.length > 0 && (
                    <div>
                      <p className="text-[10px] text-amber-400 uppercase tracking-wide mb-1">Puntos clave</p>
                      <ul className="space-y-1">
                        {result.keyPoints.map((p, i) => (
                          <li key={i} className="text-xs text-slate-400 flex gap-1.5">
                            <span className="text-amber-500 mt-0.5">•</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* URLs detectadas */}
                  {result.detectedUrls && result.detectedUrls.length > 0 && (
                    <div>
                      <p className="text-[10px] text-cyan-400 uppercase tracking-wide mb-1">URLs detectadas</p>
                      <div className="space-y-1">
                        {result.detectedUrls.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => onSearch ? (onSearch(url), onClose()) : window.open(url, "_blank")}
                            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition"
                          >
                            <Link className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{url}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sugerencias de Flux Vision */}
                  {result.suggestions && result.suggestions.length > 0 && (
                    <div>
                      <p className="text-[10px] text-emerald-400 uppercase tracking-wide mb-1">Flux sugiere</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => onSearch && (onSearch(s), onClose())}
                            className="px-2 py-1 rounded-md bg-emerald-500/10 text-xs text-emerald-400 hover:bg-emerald-500/20 transition border border-emerald-500/15"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Idioma / tipo de contenido */}
                  <div className="flex gap-2 pt-1">
                    {result.language && (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-500">
                        Idioma: {result.language}
                      </span>
                    )}
                    {result.contentType && (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-500">
                        Tipo: {result.contentType}
                      </span>
                    )}
                    {result.confidence && (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-slate-500">
                        Confianza: {result.confidence}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
