import { Router } from "express";
import { UserController } from "../controllers/userController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/profile", UserController.getProfile);
router.put("/profile", UserController.updateProfile);
router.put("/password", UserController.changePassword);
router.delete("/", UserController.deleteAccount);

export default router;