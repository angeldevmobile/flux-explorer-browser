import { Request, Response } from 'express';
import { geminiService } from '../services/geminiService';

export async function translate(req: Request, res: Response) {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'El campo "text" es requerido.' });
    }
    if (!targetLanguage || typeof targetLanguage !== 'string') {
      return res.status(400).json({ success: false, error: 'El campo "targetLanguage" es requerido.' });
    }

    const result = await geminiService.translateText(text.trim(), targetLanguage, sourceLanguage);
    return res.json({ success: true, ...result, originalText: text.trim() });
  } catch (err) {
    console.error('[translate]', err);
    return res.status(500).json({ success: false, error: 'Error al traducir el texto.' });
  }
}

export async function detectLanguage(req: Request, res: Response) {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'El campo "text" es requerido.' });
    }

    const result = await geminiService.detectLanguage(text.trim());
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('[detectLanguage]', err);
    return res.status(500).json({ success: false, error: 'Error al detectar el idioma.' });
  }
}
