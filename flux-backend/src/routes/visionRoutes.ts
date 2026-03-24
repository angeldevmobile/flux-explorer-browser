import { Router } from 'express';
import { visionController } from '../controllers/visionController';

const router = Router();

// POST /api/vision/analyze
// Body: { imageBase64, mimeType?, action, question?, targetLanguage? }
router.post('/analyze', (req, res) => visionController.analyzeImage(req, res));

export default router;
