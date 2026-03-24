import { Router } from 'express';
import { voiceController } from '../controllers/voiceController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/process', authMiddleware, voiceController.processVoiceCommand.bind(voiceController));
router.post('/synthesize', authMiddleware, voiceController.synthesizeSpeech.bind(voiceController));
router.get('/voices', authMiddleware, voiceController.getVoices.bind(voiceController));
router.post('/summarize', authMiddleware, voiceController.summarizePage.bind(voiceController));
router.post('/chat', authMiddleware, voiceController.chat.bind(voiceController));
router.post('/suggestions', authMiddleware, voiceController.getSuggestions.bind(voiceController));
router.post('/clear-history', authMiddleware, voiceController.clearHistory.bind(voiceController));

export default router;