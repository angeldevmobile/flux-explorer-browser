import { Request, Response } from 'express';
import { geminiService } from '../services/geminiService';
import { textToSpeechService } from '../services/textToSpeechService';

export class VoiceController {
  async processVoiceCommand(req: Request, res: Response) {
    try {
      const { query, context } = req.body;
      const result = await geminiService.processVoiceQuery(query, context) as Record<string, unknown>;
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error processing voice command:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error procesando comando de voz',
        response: 'Lo siento, tuve un problema procesando tu solicitud. ¿Podrías repetirlo?'
      });
    }
  }

  async synthesizeSpeech(req: Request, res: Response) {
    try {
      const { text, languageCode, voiceName } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          error: 'Text is required'
        });
      }

      const audioBuffer = await textToSpeechService.synthesizeSpeech(
        text,
        languageCode || 'es-ES',
        voiceName
      );

      // Enviar audio como MP3
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });
      res.send(audioBuffer);
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      res.status(500).json({
        success: false,
        error: 'Error generando audio'
      });
    }
  }

  async getVoices(req: Request, res: Response) {
    try {
      const { languageCode } = req.query;
      const voices = await textToSpeechService.getAvailableVoices(
        languageCode as string || 'es-ES'
      );

      res.json({
        success: true,
        voices
      });
    } catch (error) {
      console.error('Error getting voices:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo voces'
      });
    }
  }

  async summarizePage(req: Request, res: Response) {
    try {
      const { url, content } = req.body;
      const summary = await geminiService.summarizeWebPage(url, content) as Record<string, unknown>;
      
      res.json({
        success: true,
        ...summary
      });
    } catch (error) {
      console.error('Error summarizing page:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error resumiendo página' 
      });
    }
  }

  async chat(req: Request, res: Response) {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }

      const result = await geminiService.chatWithUser(message) as Record<string, unknown>;
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error in chat:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error en conversación' 
      });
    }
  }

  async getSuggestions(req: Request, res: Response) {
    try {
      const { currentUrl, userActivity } = req.body;
      
      if (!currentUrl) {
        return res.status(400).json({
          success: false,
          error: 'Current URL is required'
        });
      }

      const suggestions = await geminiService.getContextualSuggestions(
        currentUrl,
        userActivity || {}
      ) as Record<string, unknown>;
      
      res.json({
        success: true,
        ...suggestions
      });
    } catch (error) {
      console.error('Error getting suggestions:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error obteniendo sugerencias' 
      });
    }
  }

  async clearHistory(req: Request, res: Response) {
    try {
      geminiService.clearHistory();
      
      res.json({
        success: true,
        message: 'Historial de conversación limpiado'
      });
    } catch (error) {
      console.error('Error clearing history:', error);
      res.status(500).json({
        success: false,
        error: 'Error limpiando historial'
      });
    }
  }
}

export const voiceController = new VoiceController();