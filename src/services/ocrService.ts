import { visionService } from './api';

export type OCRAction = 'extract' | 'translate' | 'summarize' | 'analyze' | 'ask' | 'search';

export interface OCRResult {
  success: boolean;
  action: OCRAction;
  // extract
  text?: string;
  confidence?: string;
  language?: string;
  // translate
  originalText?: string;
  translatedText?: string;
  detectedLanguage?: string;
  // summarize / analyze
  summary?: string;
  keyPoints?: string[];
  // analyze
  contentType?: string;
  detectedUrls?: string[];
  suggestions?: string[];
  // ask
  answer?: string;
  relevantText?: string;
  // search
  searchQuery?: string;
  fullText?: string;
}


/**
 * Convierte un File/Blob a base64.
 */
export async function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  const mimeType = file.type || 'image/png';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Si la fuente es una URL remota, la devuelve tal cual para que el backend la descargue.
 * Si es dataURL o File/Blob, la convierte a base64 aquí.
 */
async function prepareSource(
  source: string | File | Blob
): Promise<{ imageBase64?: string; imageUrl?: string; mimeType?: string }> {
  if (source instanceof File || source instanceof Blob) {
    const { base64, mimeType } = await fileToBase64(source);
    return { imageBase64: base64, mimeType };
  }
  if (source.startsWith('data:')) {
    const [header, base64] = source.split(',');
    const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/png';
    return { imageBase64: base64, mimeType };
  }
  // URL remota — el backend la descarga (sin CORS)
  return { imageUrl: source };
}

// ── Acciones OCR públicas ──────────────────────────────────────────────────

/** Extrae el texto de una imagen */
export async function extractText(source: string | File | Blob): Promise<OCRResult> {
  const params = await prepareSource(source);
  return visionService.analyze({ ...params, action: 'extract' });
}

/** Extrae y traduce el texto de una imagen */
export async function translateText(
  source: string | File | Blob,
  targetLanguage = 'español'
): Promise<OCRResult> {
  const params = await prepareSource(source);
  return visionService.analyze({ ...params, action: 'translate', targetLanguage });
}

/** Extrae texto y genera un resumen */
export async function summarizeImage(source: string | File | Blob): Promise<OCRResult> {
  const params = await prepareSource(source);
  return visionService.analyze({ ...params, action: 'summarize' });
}

/** Análisis completo (OCR + resumen + URLs + sugerencias) — Flux Vision */
export async function analyzeImage(source: string | File | Blob): Promise<OCRResult> {
  const params = await prepareSource(source);
  return visionService.analyze({ ...params, action: 'analyze' });
}

/** Responde una pregunta sobre la imagen */
export async function askAboutImage(
  source: string | File | Blob,
  question: string
): Promise<OCRResult> {
  const params = await prepareSource(source);
  return visionService.analyze({ ...params, action: 'ask', question });
}

/** Extrae texto optimizado para búsqueda web */
export async function extractSearchQuery(source: string | File | Blob): Promise<OCRResult> {
  const params = await prepareSource(source);
  return visionService.analyze({ ...params, action: 'search' });
}

/** Copia el texto de una imagen al portapapeles */
export async function copyTextFromImage(source: string | File | Blob): Promise<string> {
  const result = await extractText(source);
  const text = result.text || '';
  if (text) await navigator.clipboard.writeText(text);
  return text;
}
