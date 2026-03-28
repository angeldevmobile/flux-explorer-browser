import { Response } from "express";
import prisma from "../config/prisma";
import { AuthenticatedRequest } from "../middleware/auth";
import { searchWeb } from "../services/searxngService";
import { geminiService } from "../services/geminiService";

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
            { url: { contains: searchTerm } },
            { title: { contains: searchTerm } },
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
            { url: { contains: searchTerm } },
            { title: { contains: searchTerm } },
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
   * GET /api/search/web?q=texto — Buscar en la web via SearXNG + re-ranking por historial
   * Auth opcional: si hay token válido, aplica boost a URLs visitadas previamente.
   */
  static async webSearch(req: AuthenticatedRequest, res: Response) {
    const { q } = req.query;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "Parámetro 'q' requerido" });
    }

    const query = q.trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const category = (req.query.category as string) || "general";

    try {
      // 1. SearXNG obtiene las URLs (con title + description del índice)
      const searxData = await searchWeb(query, page, category);

      // Para imágenes y videos, SearXNG ya devuelve los datos completos —
      // no necesitamos pasar por Orion Engine (que fetchea y parsea HTML).
      if (category === "images" || category === "videos") {
        const results = searxData.results.map((r) => ({
          url:       r.url,
          title:     r.title || r.url,
          content:   r.content || "",
          thumbnail: r.img_src || r.thumbnail_src || r.thumbnail || "",
          score:     1,
          visited:   false,
        }));
        return res.json({ query, results, total: results.length, source: "searxng", cached: false });
      }

      const urls = searxData.results.map((r) => r.url).slice(0, 10);

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

      // 3. Re-ranking por historial (solo si hay userId autenticado)
      let historyBoost = new Map<string, number>();
      if (req.userId) {
        const visitedUrls = orionData.results.map((r) => r.url);
        const historyMatches = await prisma.history.groupBy({
          by: ["url"],
          where: { userId: req.userId, url: { in: visitedUrls } },
          _count: { url: true },
        });
        // Normaliza visitas a un boost máximo de 0.3
        const maxVisits = Math.max(...historyMatches.map((h) => h._count.url), 1);
        for (const h of historyMatches) {
          historyBoost.set(h.url, (h._count.url / maxVisits) * 0.3);
        }
      }

      const results = orionData.results
        .map((r) => {
          const fallback = searxFallback.get(r.url);
          const boost = historyBoost.get(r.url) ?? 0;
          return {
            url:       r.url,
            title:     r.title       || fallback?.title   || r.url,
            content:   r.description || fallback?.content || "",
            thumbnail: r.image       ?? fallback?.thumbnail ?? "",
            score:     r.score + boost,
            visited:   boost > 0,
          };
        })
        .sort((a, b) => b.score - a.score);

      res.json({
        query:   orionData.query,
        results,
        total:   results.length,
        source:  orionData.engine,
        cached:  false,
      });
    } catch (error) {
      res.status(502).json({ error: "Error al conectar con el motor de búsqueda" });
    }
  }

  /**
   * GET /api/search/summary?q=texto — Resumen IA de los resultados de búsqueda (requiere auth)
   */
  static async summarizeSearch(req: AuthenticatedRequest, res: Response) {
    const { q } = req.query;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "Parámetro 'q' requerido" });
    }

    const query = q.trim();

    try {
      const searxData = await searchWeb(query, 1);
      const top5 = searxData.results.slice(0, 5).map((r) => ({
        title:   r.title,
        content: r.content,
        url:     r.url,
      }));

      const summary = await geminiService.summarizeSearchResults(query, top5);
      res.json(summary);
    } catch (error) {
      res.status(502).json({ error: "Error al generar resumen" });
    }
  }
}