import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/local", AuthController.localLogin);
router.get("/me", authMiddleware, AuthController.getCurrentUser);

export default router;
