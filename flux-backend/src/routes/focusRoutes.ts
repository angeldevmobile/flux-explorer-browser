import { Router } from "express";
import { focusController } from "../controllers/focusController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

// Blocked sites
router.get("/blocked-sites", focusController.getBlockedSites);
router.post("/blocked-sites", focusController.addBlockedSite);
router.delete("/blocked-sites/:id", focusController.removeBlockedSite);

// Sessions
router.post("/sessions", focusController.startSession);
router.patch("/sessions/:id/end", focusController.endSession);
router.get("/sessions", focusController.getSessionHistory);

export default router;