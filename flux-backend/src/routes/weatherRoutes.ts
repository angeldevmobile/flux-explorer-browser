import { Router, Request, Response } from "express";

const router = Router();

// GET /api/weather?city=Lima  (city es opcional, wttr.in detecta por IP si no se pasa)
router.get("/", async (req: Request, res: Response) => {
  const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
  const target = city
    ? `https://wttr.in/${encodeURIComponent(city)}?format=j1`
    : "https://wttr.in/?format=j1";

  try {
    const response = await fetch(target, {
      headers: { "User-Agent": "OrionBrowser/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return res.status(502).json({ error: "weather unavailable" });

    const raw = await response.json() as {
      current_condition: {
        temp_C: string;
        FeelsLikeC: string;
        humidity: string;
        windspeedKmph: string;
        uvIndex: string;
        weatherDesc: { value: string }[];
      }[];
      nearest_area?: { areaName: { value: string }[]; country: { value: string }[] }[];
    };

    const c = raw.current_condition[0];
    const area = raw.nearest_area?.[0];
    const city_name = area
      ? `${area.areaName[0].value}, ${area.country[0].value}`
      : "";

    res.json({
      temp: c.temp_C,
      feelsLike: c.FeelsLikeC,
      humidity: c.humidity,
      windKmph: c.windspeedKmph,
      uvIndex: c.uvIndex,
      description: c.weatherDesc[0]?.value ?? "",
      city: city_name,
    });
  } catch {
    res.status(502).json({ error: "weather unavailable" });
  }
});

export default router;
