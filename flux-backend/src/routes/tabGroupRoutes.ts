import { Router } from "express";
import { TabGroupController } from "../controllers/tabGroupController";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/", TabGroupController.getAll);
router.post("/", TabGroupController.create);
router.post("/:groupId/tabs", TabGroupController.addTab);
router.delete("/tabs/:tabId", TabGroupController.removeTab);
router.delete("/:id", TabGroupController.delete);

export default router;