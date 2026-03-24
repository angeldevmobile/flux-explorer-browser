import { Response, Request } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { searchWeb } from "../services/searxngService";

const ORION_ENGINE_URL = process.env.ORION_ENGINE_URL || "http://localhost:4000";

export class SearchController {
  /**
   * GET /api/search?q=texto - Buscar en historial y favoritos
   */
  static async search(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Parámetro de búsqueda 'q' requerido" });
      }

      const searchTerm = q.trim();

      // Buscar en favoritos
      const favorites = await prisma.favorite.findMany({
        where: {
          userId,
          OR: [
            { url: { contains: searchTerm, mode: "insensitive" } },
            { title: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });

      // Buscar en historial
      const history = await prisma.history.findMany({
        where: {
          userId,
          OR: [
            { url: { contains: searchTerm, mode: "insensitive" } },
            { title: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
        take: 20,
        orderBy: { timestamp: "desc" },
      });

      res.json({
        data: {
          favorites,
          history,
          totalResults: favorites.length + history.length,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Error al buscar" });
    }
  }

  /**
   * GET /api/search/web?q=texto — Buscar en la web via SearXNG
   */
  static async webSearch(req: Request, res: Response) {
    const { q } = req.query;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "Parámetro 'q' requerido" });
    }

    const query = q.trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);

    try {
      // 1. SearXNG obtiene las URLs (con title + description del índice)
      const searxData = await searchWeb(query, page);
      const urls = searxData.results.map((r) => r.url).slice(0, 10);

      // Mapa de fallbacks por URL: SearXNG ya tiene title/description del índice.
      // El engine puede fallar en páginas JS-rendered o con bot-protection.
      const searxFallback = new Map(searxData.results.map((r) => [r.url, r]));

      // 2. Orion Engine procesa y rankea las URLs
      const orionRes = await fetch(`${ORION_ENGINE_URL}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, urls }),
        signal: AbortSignal.timeout(15000),
      });

      if (!orionRes.ok) throw new Error("Orion Engine error");

      const orionData = await orionRes.json() as {
        query: string;
        results: { url: string; title: string; description: string; image: string | null; score: number }[];
        engine: string;
      };

      res.json({
        query: orionData.query,
        results: orionData.results.map((r) => {
          const fallback = searxFallback.get(r.url);
          return {
            url:       r.url,
            // El engine extrae directo del HTML — si falla, usar lo de SearXNG
            title:     r.title       || fallback?.title   || r.url,
            content:   r.description || fallback?.content || "",
            thumbnail: r.image       ?? fallback?.thumbnail ?? "",
            score:     r.score,
          };
        }),
        total:  orionData.results.length,
        source: orionData.engine,
      });
    } catch (error) {
      res.status(502).json({ error: "Error al conectar con el motor de búsqueda" });
    }
  }
}