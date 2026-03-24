import { Request, Response } from 'express';
import https from 'https';
import http from 'http';
import { geminiService } from '../services/geminiService';

function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mimeType = res.headers['content-type'] || 'image/png';
        resolve({ base64: buffer.toString('base64'), mimeType: mimeType.split(';')[0] });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

export class VisionController {
  async analyzeImage(req: Request, res: Response) {
    try {
      const { imageBase64, imageUrl, mimeType, action, question, targetLanguage } = req.body;

      if (!action) {
        return res.status(400).json({ success: false, error: 'action es requerido' });
      }

      const validActions = ['extract', 'translate', 'summarize', 'analyze', 'ask', 'search'];
      if (!validActions.includes(action)) {
        return res.status(400).json({
          success: false,
          error: `action inválido. Usa: ${validActions.join(', ')}`,
        });
      }

      let base64Clean: string;
      let mime: string;

      if (imageUrl) {
        // El servidor descarga la imagen — sin restricciones CORS
        const fetched = await fetchImageAsBase64(imageUrl);
        base64Clean = fetched.base64;
        mime = mimeType || fetched.mimeType;
      } else if (imageBase64) {
        base64Clean = imageBase64.replace(/^data:[^;]+;base64,/, '');
        mime = mimeType || 'image/png';
      } else {
        return res.status(400).json({ success: false, error: 'imageBase64 o imageUrl son requeridos' });
      }

      const result = await geminiService.analyzeImage(
        base64Clean,
        mime,
        action,
        { question, targetLanguage }
      );

      res.json({ success: true, action, ...result as object });
    } catch (error) {
      console.error('Error en vision OCR:', error);
      res.status(500).json({ success: false, error: 'Error procesando imagen' });
    }
  }
}

export const visionController = new VisionController();
