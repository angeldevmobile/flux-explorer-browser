import { Router } from "express";
import { SearchController } from "../controllers/searchController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// GET /api/search?q=texto — busca en historial y favoritos del usuario
router.get("/", authMiddleware, SearchController.search);

// GET /api/search/web?q=texto — busca en la web 
router.get("/web", SearchController.webSearch);

export default router;
