import { Router } from "express";
import { TabController } from "../controllers/tabController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get("/", TabController.getTabs);
router.post("/", TabController.createTab);
router.put("/:id", TabController.updateTab);
router.delete("/:id", TabController.deleteTab);

export default router;