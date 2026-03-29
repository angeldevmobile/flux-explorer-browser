import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { songDetectionService } from '../services/songDetectionService';
import db from '../config/db';
import crypto from 'crypto';

export class MediaController {
  async detectSong(req: AuthenticatedRequest, res: Response) {
    try {
      const { audioBase64, sourceUrl, pageTitle } = req.body;
      const userId = req.userId!;
      if (!sourceUrl) return res.status(400).json({ success: false, error: 'sourceUrl es requerido' });

      const result = await songDetectionService.identifyFromAudio(audioBase64 || '', sourceUrl, pageTitle);
      if (result.found) {
        const saved = songDetectionService.saveSong({ title: result.title, artist: result.artist, album: result.album || undefined, coverUrl: result.coverUrl || undefined, previewUrl: result.previewUrl || undefined, sourceUrl: result.sourceUrl, confidence: result.confidence, genre: result.genre || undefined, year: result.year != null ? String(result.year) : undefined, userId });
        return res.json({ success: true, song: { ...result, id: (saved as any).id } });
      }
      res.json({ success: false, message: result.message || 'Canción no identificada' });
    } catch {
      res.status(500).json({ success: false, error: 'Error detectando canción' });
    }
  }

  async getSongHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const songs = songDetectionService.getUserSongHistory(req.userId!);
      res.json({ success: true, data: songs });
    } catch {
      res.status(500).json({ success: false, error: 'Error obteniendo historial' });
    }
  }

  async deleteSong(req: AuthenticatedRequest, res: Response) {
    try {
      db.prepare("DELETE FROM DetectedSong WHERE id = ? AND userId = ?").run(req.params.id, req.userId!);
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Error eliminando canción' });
    }
  }

  async recordDownload(req: AuthenticatedRequest, res: Response) {
    try {
      const { url, title, type, size, sourceUrl } = req.body;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(
        "INSERT INTO MediaDownload (id, url, title, type, size, sourceUrl, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(id, url, title, type, size ?? null, sourceUrl, req.userId!, now);
      const record = db.prepare("SELECT * FROM MediaDownload WHERE id = ?").get(id);
      res.json({ success: true, data: record });
    } catch {
      res.status(500).json({ success: false, error: 'Error registrando descarga' });
    }
  }

  async getDownloadHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const downloads = db.prepare(
        "SELECT * FROM MediaDownload WHERE userId = ? ORDER BY createdAt DESC LIMIT 100"
      ).all(req.userId!);
      res.json({ success: true, data: downloads });
    } catch {
      res.status(500).json({ success: false, error: 'Error obteniendo descargas' });
    }
  }
}

export const mediaController = new MediaController();
