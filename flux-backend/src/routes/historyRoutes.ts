import { Router } from "express";
import { HistoryController } from "../controllers/historyController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get("/", HistoryController.getHistory);
router.post("/", HistoryController.addHistory);
router.delete("/:id", HistoryController.deleteHistory);
router.delete("/", HistoryController.clearHistory);

export default router;