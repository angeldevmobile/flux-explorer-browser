import { Router } from "express";
import { FavoriteController } from "../controllers/favoritesController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get("/", FavoriteController.getFavorites);
router.post("/", FavoriteController.addFavorite);
router.delete("/:id", FavoriteController.deleteFavorite);

export default router;