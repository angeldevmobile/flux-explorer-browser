import { Router } from "express";
import { tasksController } from "../controllers/taskController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", tasksController.getAll);
router.post("/", tasksController.create);
router.patch("/:id/toggle", tasksController.toggle);
router.delete("/:id", tasksController.delete);

export default router;