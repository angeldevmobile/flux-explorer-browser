import { Router, Request, Response } from "express";

const router = Router();

interface NewsItem {
  title: string;
  source: string;
  url: string;
  image?: string;
  category: string;
  time: string;
}

// RSS sources (sin API key necesaria)
const RSS_SOURCES = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",       source: "BBC News",    category: "World"    },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml",  source: "BBC Tech",    category: "Tech"     },
  { url: "https://techcrunch.com/feed/",                       source: "TechCrunch",  category: "Tech"     },
  { url: "https://www.nasa.gov/rss/dyn/breaking_news.rss",     source: "NASA",        category: "Science"  },
  { url: "https://www.aljazeera.com/xml/rss/all.xml",          source: "Al Jazeera",  category: "World"    },
];

function parseRelativeTime(dateStr: string): string {
  if (!dateStr) return "Reciente";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
  } catch {
    return "Reciente";
  }
}

function extractImage(itemXml: string): string | undefined {
  // media:content url
  const media = /media:content[^>]*url="([^"]+)"/.exec(itemXml);
  if (media) return media[1];
  // enclosure url
  const encl = /enclosure[^>]*url="([^"]+)"/.exec(itemXml);
  if (encl) return encl[1];
  // img src inside description
  const img = /<img[^>]*src="([^"]+)"/.exec(itemXml);
  if (img) return img[1];
  return undefined;
}

async function fetchRSS(source: typeof RSS_SOURCES[0]): Promise<NewsItem[]> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; OrionBrowser/1.0)" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return [];
  const xml = await res.text();

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const items: NewsItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 4) {
    const block = match[1];

    const titleM = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/.exec(block);
    const linkM  = /<link>([\s\S]*?)<\/link>|<guid[^>]*>(https?[^<]+)<\/guid>/.exec(block);
    const dateM  = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block);

    const title = (titleM?.[1] ?? titleM?.[2] ?? "").trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const url   = (linkM?.[1] ?? linkM?.[2] ?? "").trim();
    const time  = parseRelativeTime(dateM?.[1] ?? "");
    const image = extractImage(block);

    if (title && url) {
      items.push({ title, source: source.source, url, image, category: source.category, time });
    }
  }
  return items;
}

// GET /api/news
router.get("/", async (_req: Request, res: Response) => {
  try {
    const results = await Promise.allSettled(RSS_SOURCES.map(fetchRSS));
    const all: NewsItem[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") all.push(...r.value);
    }
    // Mezclar fuentes para variedad
    const shuffled = all.sort(() => Math.random() - 0.5).slice(0, 12);
    res.json(shuffled);
  } catch {
    res.json([]);
  }
});

export default router;
