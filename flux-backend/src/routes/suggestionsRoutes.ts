import { Router, Request, Response } from "express";

const router = Router();

// GET /api/suggestions?q=texto
router.get("/", async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q || typeof q !== "string" || !q.trim()) {
    return res.json({ suggestions: [] });
  }

  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q.trim())}&hl=es`;
    const response = await fetch(url);
    const data = (await response.json()) as [string, string[]];
    const suggestions: string[] = Array.isArray(data[1]) ? data[1].slice(0, 8) : [];
    res.json({ suggestions });
  } catch {
    res.json({ suggestions: [] });
  }
});

export default router;
