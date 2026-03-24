import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { songDetectionService } from '../services/songDetectionService';
import prisma from '../config/prisma';

export class MediaController {
  // ─── Detectar canción ───
  async detectSong(req: AuthenticatedRequest, res: Response) {
    try {
      const { audioBase64, sourceUrl, pageTitle } = req.body;
      const userId = req.userId!;

      if (!sourceUrl) {
        return res.status(400).json({ success: false, error: 'sourceUrl es requerido' });
      }

      const result = await songDetectionService.identifyFromAudio(
        audioBase64 || '',
        sourceUrl,
        pageTitle
      );

      // Auto-guardar si se encontró
      if (result.found) {
        const saved = await songDetectionService.saveSong({
          title: result.title,
          artist: result.artist,
          album: result.album || undefined,
          coverUrl: result.coverUrl || undefined,
          previewUrl: result.previewUrl || undefined,
          sourceUrl: result.sourceUrl,
          confidence: result.confidence,
          genre: result.genre || undefined,
          year: result.year != null ? String(result.year) : undefined,
          userId,
        }, prisma);

        return res.json({ success: true, song: { ...result, id: saved.id } });
      }

      res.json({ success: false, message: result.message || 'Canción no identificada' });
    } catch (error) {
      console.error('Error detecting song:', error);
      res.status(500).json({ success: false, error: 'Error detectando canción' });
    }
  }

  // ─── Historial de canciones ───
  async getSongHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const songs = await songDetectionService.getUserSongHistory(req.userId!, prisma);
      res.json({ success: true, data: songs });
    } catch (error) {
      console.error('Error getting song history:', error);
      res.status(500).json({ success: false, error: 'Error obteniendo historial' });
    }
  }

  // ─── Eliminar canción del historial ───
  async deleteSong(req: AuthenticatedRequest, res: Response) {
    try {
      await prisma.detectedSong.deleteMany({
        where: { id: req.params.id, userId: req.userId! },
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Error eliminando canción' });
    }
  }

  // ─── Registrar descarga de media ───
  async recordDownload(req: AuthenticatedRequest, res: Response) {
    try {
      const { url, title, type, size, sourceUrl } = req.body;
      const record = await prisma.mediaDownload.create({
        data: { url, title, type, size, sourceUrl, userId: req.userId! },
      });
      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Error registrando descarga' });
    }
  }

  // ─── Historial de descargas ───
  async getDownloadHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const downloads = await prisma.mediaDownload.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json({ success: true, data: downloads });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Error obteniendo descargas' });
    }
  }
}

export const mediaController = new MediaController();