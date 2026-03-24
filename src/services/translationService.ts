import api from './api';

export interface TranslationResult {
  success: boolean;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  detectedLanguageCode: string;
}

export interface DetectLanguageResult {
  success: boolean;
  language: string;
  languageCode: string;
  confidence: string;
}

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  hi: 'Hindi',
};

/** Traduce texto usando el backend Gemini. Si falla, usa MyMemory como fallback. */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult> {
  if (!text.trim()) {
    return { success: false, originalText: text, translatedText: '', detectedLanguage: '', detectedLanguageCode: '' };
  }

  // Primario: Gemini via backend
  try {
    const { data } = await api.post('/translation/translate', { text, targetLanguage, sourceLanguage });
    if (data.success) return data as TranslationResult;
  } catch {
    // fallback a MyMemory
  }

  // Fallback: MyMemory (gratis, sin API key, sin instalación)
  return translateWithMyMemory(text, targetLanguage, sourceLanguage);
}

/** Detecta el idioma de un texto. */
export async function detectLanguage(text: string): Promise<DetectLanguageResult> {
  if (!text.trim()) {
    return { success: false, language: '', languageCode: '', confidence: 'low' };
  }

  try {
    const { data } = await api.post('/translation/detect', { text });
    if (data.success) return data as DetectLanguageResult;
  } catch {
    // fallback: detectar via MyMemory (submit sin target y leer match)
  }

  return { success: false, language: 'Unknown', languageCode: 'und', confidence: 'low' };
}

async function translateWithMyMemory(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult> {
  // Mapear nombre de idioma a código ISO si es necesario
  const targetCode = resolveLanguageCode(targetLanguage);
  const sourceCode = sourceLanguage ? resolveLanguageCode(sourceLanguage) : 'autodetect';
  const langPair = sourceCode === 'autodetect' ? `|${targetCode}` : `${sourceCode}|${targetCode}`;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.responseStatus === 200) {
    return {
      success: true,
      originalText: text,
      translatedText: data.responseData.translatedText,
      detectedLanguage: data.responseData.match === 1 ? sourceLanguage || '' : '',
      detectedLanguageCode: sourceCode !== 'autodetect' ? sourceCode : '',
    };
  }

  throw new Error(`MyMemory error: ${data.responseDetails}`);
}

function resolveLanguageCode(language: string): string {
  // Si ya es un código ISO corto (2-3 chars), devolverlo
  if (/^[a-z]{2,3}$/i.test(language)) return language.toLowerCase();

  // Buscar por nombre en el mapa
  const entry = Object.entries(SUPPORTED_LANGUAGES).find(
    ([, name]) => name.toLowerCase() === language.toLowerCase()
  );
  if (entry) return entry[0];

  // Fallback: primeras 2 letras en minúscula
  return language.slice(0, 2).toLowerCase();
}
