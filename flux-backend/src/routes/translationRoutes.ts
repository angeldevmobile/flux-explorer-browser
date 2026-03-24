import { Router } from 'express';
import { translate, detectLanguage } from '../controllers/translationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/translate', authMiddleware, translate);
router.post('/detect', authMiddleware, detectLanguage);

export default router;
