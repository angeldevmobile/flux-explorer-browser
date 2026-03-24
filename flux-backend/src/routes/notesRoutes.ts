import { Router } from "express";
import { notesController } from "../controllers/notesController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", notesController.getAll);
router.post("/", notesController.create);
router.delete("/:id", notesController.delete);

export default router;