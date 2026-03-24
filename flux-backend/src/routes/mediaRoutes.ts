import { Router } from 'express';
import { mediaController } from '../controllers/mediaController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Canciones
router.post('/detect-song', authMiddleware, mediaController.detectSong.bind(mediaController));
router.get('/songs', authMiddleware, mediaController.getSongHistory.bind(mediaController));
router.delete('/songs/:id', authMiddleware, mediaController.deleteSong.bind(mediaController));

// Descargas
router.post('/downloads', authMiddleware, mediaController.recordDownload.bind(mediaController));
router.get('/downloads', authMiddleware, mediaController.getDownloadHistory.bind(mediaController));

export default router;