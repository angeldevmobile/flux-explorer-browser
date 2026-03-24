import { Router } from "express";
import { preferencesController } from "../controllers/preferencesController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", preferencesController.get);
router.patch("/", preferencesController.update);

export default router;