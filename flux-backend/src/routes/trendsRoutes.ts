import { Router, Request, Response } from "express";

const router = Router();

// GET /api/trends
router.get("/", async (_req: Request, res: Response) => {
  try {
    // Google Trends RSS feed (sin autenticación)
    const url =
      "https://trends.google.com/trending/rss?geo=US";
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OrionBrowser/1.0)" },
    });

    if (!response.ok) {
      return res.json([]);
    }

    const xml = await response.text();

    // Parseo simple del RSS sin dependencias externas
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const trafficRegex = /<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/;
    const linkRegex = /<link>(.*?)<\/link>/;

    const trends: { title: string; traffic: string; link: string }[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && trends.length < 10) {
      const block = match[1];
      const titleMatch = titleRegex.exec(block);
      const trafficMatch = trafficRegex.exec(block);
      const linkMatch = linkRegex.exec(block);

      const title = titleMatch ? (titleMatch[1] || titleMatch[2] || "").trim() : "";
      const traffic = trafficMatch ? trafficMatch[1].trim() : "";
      const link = linkMatch ? linkMatch[1].trim() : "";

      if (title) {
        trends.push({ title, traffic, link });
      }
    }

    res.json(trends);
  } catch {
    res.json([]);
  }
});

export default router;
