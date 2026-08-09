import db from "../config/db";
import crypto from "crypto";

// HTTPS obligatorio: por aquí viajan los prompts del usuario, que
// pueden incluir el contenido de la página que está leyendo.
const AI_PROXY_URL = process.env.AI_PROXY_URL || "https://flux-explorer-browser-production-0a6e.up.railway.app";

const AI_PROXY_TOKEN = process.env.FLUX_API_TOKEN || "";
const AI_DEVICE_ID = process.env.FLUX_DEVICE_ID || "";

async function callProxy(prompt: string): Promise<string> {
  const res = await fetch(`${AI_PROXY_URL}/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-flux-token': AI_PROXY_TOKEN,
      'x-flux-device': AI_DEVICE_ID,
    },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`AI proxy error: ${res.status}`);
  const data = await res.json() as { text: string };
  return data.text;
}

export class SongDetectionService {

  /**
   * Identifica una canción usando Gemini a partir de la letra/descripción capturada
   * y opcionalmente audio fingerprint via AudD API
   */
  async identifyFromAudio(audioBase64: string, sourceUrl: string, pageTitle?: string) {
    if (process.env.AUDD_API_KEY) {
      return this.identifyWithAudD(audioBase64, sourceUrl);
    }
    return this.identifyWithGemini(sourceUrl, pageTitle);
  }

  /**
   * AudD API - reconocimiento real de audio por fingerprint
   * https://audd.io/ - 300 req/mes gratis
   */
  private async identifyWithAudD(audioBase64: string, sourceUrl: string) {
    const formData = new URLSearchParams();
    formData.append('api_token', process.env.AUDD_API_KEY!);
    formData.append('audio', audioBase64);
    formData.append('return', 'apple_music,spotify');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();

    if (data.status === 'success' && data.result) {
      const song = data.result;
      // Enriquecer con Gemini
      const enrichment = await this.enrichWithGemini(song.title, song.artist);
      return {
        found: true,
        title: song.title || 'Desconocido',
        artist: song.artist || 'Desconocido',
        album: song.album || enrichment.album || null,
        coverUrl: song.apple_music?.artwork?.url?.replace('{w}x{h}', '300x300') 
          || song.spotify?.album?.images?.[0]?.url || null,
        previewUrl: song.spotify?.preview_url || null,
        genre: enrichment.genre || null,
        year: song.release_date?.substring(0, 4) || enrichment.year || null,
        confidence: 0.95,
        sourceUrl,
        enrichment: enrichment.funFact || null,
      };
    }

    return { found: false, message: 'No se pudo identificar la canción' };
  }

  /**
   * Fallback: Gemini analiza la URL/contexto para identificar qué suena
   */
  private async identifyWithGemini(sourceUrl: string, pageTitle?: string) {
    const prompt = `
      Identifica qué canción se está reproduciendo basándote en esta información:
      URL: ${sourceUrl}
      ${pageTitle ? `Título de la página: ${pageTitle}` : ''}

      Si es YouTube, Spotify, SoundCloud u otro servicio de música, usa el título de la página
      como fuente principal (es más confiable que la URL para playlists/radios).

      RESPONDE SOLO EN JSON VÁLIDO, sin markdown ni backticks:
      {
        "found": true,
        "title": "nombre de la canción",
        "artist": "artista",
        "album": "álbum si lo conoces",
        "genre": "género musical",
        "year": "año como string",
        "confidence": 0.9,
        "funFact": "un dato curioso sobre la canción"
      }
    `;

    const text = await callProxy(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { found: false, message: 'No se pudo analizar' };

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      year: parsed.year != null ? String(parsed.year) : null,
      sourceUrl,
      coverUrl: null,
      previewUrl: null,
    };
  }

  /**
   * Enriquece la info de una canción ya identificada con datos adicionales de Gemini
   */
  private async enrichWithGemini(title: string, artist: string) {
    const prompt = `
      Dame información adicional sobre la canción "${title}" de ${artist}.

      RESPONDE SOLO EN JSON VÁLIDO:
      {
        "album": "nombre del álbum",
        "genre": "género musical",
        "year": "año",
        "funFact": "un dato curioso breve (1 oración)"
      }
    `;

    try {
      const text = await callProxy(prompt);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      return {};
    }
  }

  /**
   * Obtiene el historial de canciones detectadas de un usuario
   */
  getUserSongHistory(userId: string) {
    return db.prepare(
      "SELECT * FROM DetectedSong WHERE userId = ? ORDER BY createdAt DESC LIMIT 50"
    ).all(userId);
  }

  /**
   * Guarda una canción detectada
   */
  saveSong(data: {
    title: string;
    artist: string;
    album?: string;
    coverUrl?: string;
    previewUrl?: string;
    sourceUrl: string;
    confidence: number;
    genre?: string;
    year?: string;
    userId: string;
  }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO DetectedSong (id, title, artist, album, coverUrl, previewUrl, sourceUrl, confidence, genre, year, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, data.title, data.artist, data.album ?? null, data.coverUrl ?? null, data.previewUrl ?? null, data.sourceUrl, data.confidence, data.genre ?? null, data.year ?? null, data.userId, now);
    return db.prepare("SELECT * FROM DetectedSong WHERE id = ?").get(id);
  }
}

export const songDetectionService = new SongDetectionService();