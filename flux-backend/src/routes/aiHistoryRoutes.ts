import { Router } from "express";
import { AiHistoryController } from "../controllers/aiHistoryController";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", AiHistoryController.getHistory);
router.post("/", AiHistoryController.saveConversation);
router.delete("/:id", AiHistoryController.deleteConversation);
router.delete("/", AiHistoryController.clearHistory);

export default router;
